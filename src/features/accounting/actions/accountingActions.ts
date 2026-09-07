/**
 * @file accountingActions.ts
 * Acciones de servidor (Server Actions) para la gestión contable y transaccionalidad.
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { executeIdempotent } from "@/shared/services/idempotencyService" ;
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;
import { db }                 from "@/shared/db/client" ;

// Feature: Accounting
import { createTransactionSchema , createAccountSchema , createFinancialEntitySchema } from "../schemas/accounting.schema" ;
import { createLedgerTransaction , deleteLedgerTransaction }                         from "../services/accountingService" ;
import { TransactionWithEntries , ledgerRepository }                                 from "../repositories/ledgerRepository" ;
import { LedgerTransaction , Account , MonthlySummary , FinancialEntity }             from "../types" ;
import { monthlySummaryRepository }                                                  from "../repositories/monthlySummaryRepository" ;
import { financialEntityRepository }                                                 from "../repositories/financialEntityRepository" ;
import { accountRepository }                                                         from "../repositories/accountRepository" ;
import { getNextCode }                                                               from "../utils/accountCodes" ;

/**
 * Consulta y retorna todas las cuentas financieras de la organización del usuario autenticado.
 * 
 * @returns Un objeto Result con el listado de cuentas ordenadas por código contable.
 */
export async function getAccountsAction(): Promise< Result<Account[] , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( fail("No autorizado para consultar las cuentas.") ) ;
  }

  try {
    const listado = await accountRepository.findAll( session.user.organizationId ) ;
    
    return( ok(listado) ) ;
  } catch( error ) {
    logger.error( "Error al consultar cuentas en getAccountsAction." , {error: String(error)} ) ;
    
    return( fail("Error al consultar las cuentas en el servidor.") ) ;
  }
}

/**
 * Registra una nueva cuenta en el plan de cuentas de la organización del usuario.
 * 
 * @param params - Los parámetros para registrar la cuenta contable.
 * @returns Un objeto con la cuenta creada.
 */
export async function createAccountAction( params: {
  name:         string ;
  type:         string ;
  code?:        string ;
  balance?:     number ;
  currency?:    string ;
  entityId?:    string ;
} ): Promise< Result<Account , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( fail("No autorizado para crear cuentas.") ) ;
  }

  // 1. Validar parámetros con Zod en runtime
  const validation = createAccountSchema.safeParse( params ) ;
  if( !validation.success ) {
    const errorMsg = validation.error.issues[0]?.message || "Datos de cuenta inválidos." ;
    return( fail(errorMsg) ) ;
  }

  const { name , type , code , balance , currency , entityId } = validation.data ;

  try {
    // 2. Obtener cuentas para autogeneración del código contable correlativo
    const todasLasCuentas = await accountRepository.findAll( session.user.organizationId ) ;
    const codigoGenerado  = ( code || getNextCode( type , todasLasCuentas ) ) ;

    // 3. Opción B: Invertir signo automáticamente para cuentas de pasivo (liability)
    let balanceFinal = ( balance || 0 ) ;
    if( ( type === "liability" ) && ( balanceFinal > 0 ) ) {
      balanceFinal = -balanceFinal ;
    }

    const nuevaCuenta = await accountRepository.create( {
      organizationId: session.user.organizationId ,
      code:           codigoGenerado ,
      name ,
      type ,
      balance:        balanceFinal ,
      currency:       currency || "ARS" ,
      entityId:       entityId || null ,
    } ) ;

    return( ok(nuevaCuenta) ) ;
  } catch( error ) {
    if( (error as {code?: string})?.code === "23505" ) {
      return( fail("Ya existe una cuenta con ese código contable. Por favor, intente de nuevo.") ) ;
    }
    if( (error as {code?: string})?.code === "23503" ) {
      return( fail("Tu sesión referencia una organización inexistente. Cerrá sesión y volvé a ingresar.") ) ;
    }
    logger.error( "Error al crear cuenta en createAccountAction." ,  {error: String(error)} ) ;
    return( fail("Error al crear la cuenta contable en el servidor.") ) ;
  }
}

/**
 * Registra una nueva entidad financiera (Banco, Billetera Virtual, etc.) en el espacio de trabajo.
 * Junto con ella, registra atómicamente su cuenta principal asociada por defecto.
 * 
 * @param params - Los parámetros para registrar la entidad financiera y su saldo inicial.
 * @returns Un objeto Result con la entidad financiera creada o error.
 */
export async function createFinancialEntityAction( params: {
  name:     string ;
  logo?:    string ;
  color?:   string ;
  balance?: number ;
} ): Promise< Result<FinancialEntity , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail("No autorizado para registrar entidades financieras.") ) ;
  }

  // 1. Validar parámetros con Zod en runtime
  const validation = createFinancialEntitySchema.safeParse( params ) ;
  if( !validation.success ) {
    const errorMsg = validation.error.issues[0]?.message || "Datos de entidad financiera inválidos." ;
    return( fail(errorMsg) ) ;
  }

  const { name , logo , color , balance } = validation.data ;

  logger.info( "[createFinancialEntityAction] Iniciando registro de entidad financiera..." , {
    orgId:   session.user.organizationId ,
    name ,
    logo ,
    color ,
    balance
  } ) ;

  try {
    const result = await db.transaction( async ( tx ) => {
      // 1. Crear la entidad financiera
      const nuevaEntidad = await financialEntityRepository.create( {
        organizationId: session.user.organizationId ,
        name ,
        logo:           logo || null ,
        color:          color || null ,
      } , tx ) ;

      logger.info( `[createFinancialEntityAction] Entidad financiera creada con ID: ${nuevaEntidad.id}. Generando cuenta asociada...` ) ;

      // 2. Obtener cuentas para autogenerar el código correlativo de activo libre
      const todasLasCuentas = await accountRepository.findAll( session.user.organizationId , tx ) ;
      const codigoGenerado  = getNextCode( "asset" , todasLasCuentas ) ;

      logger.info( `[createFinancialEntityAction] Código contable autogenerado para la cuenta principal: ${codigoGenerado}` ) ;

      // 3. Crear la cuenta principal por defecto
      const cuentaCreada = await accountRepository.create( {
        organizationId: session.user.organizationId ,
        code:           codigoGenerado ,
        name:           `Cuenta Principal ${name}` ,
        type:           "asset" ,
        balance:        balance || 0 ,
        currency:       "ARS" ,
        entityId:       nuevaEntidad.id ,
      } , tx ) ;

      logger.info( `[createFinancialEntityAction] Cuenta principal creada con ID: ${cuentaCreada.id} y saldo: ${cuentaCreada.balance} centavos.` ) ;

      return( nuevaEntidad ) ;
    } ) ;

    logger.info( `[createFinancialEntityAction] Registro completado exitosamente para la entidad: ${name}` ) ;
    return( ok(result) ) ;
  } catch( error ) {
    // Colisión del índice único org+code: dos altas concurrentes generaron el mismo código contable
    if( (error as {code?: string})?.code === "23505" ) {
      return( fail("Conflicto al generar el código contable. Por favor, intente de nuevo.") ) ;
    }
    if( (error as {code?: string})?.code === "23503" ) {
      return( fail("Tu sesión referencia una organización inexistente. Cerrá sesión y volvé a ingresar.") ) ;
    }
    logger.error( "Error al registrar entidad en createFinancialEntityAction." , {error: String(error)} ) ;
    return( fail("Error al registrar la entidad financiera en el servidor.") ) ;
  }
}

/**
 * Consulta y retorna todas las entidades financieras registradas para el inquilino.
 * 
 * @returns Un objeto Result con el listado de entidades ordenadas por nombre.
 */
export async function getFinancialEntitiesAction(): Promise< Result<FinancialEntity[] , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail("No autorizado para consultar entidades financieras.") ) ;
  }

  try {
    const listado = await financialEntityRepository.findAll( session.user.organizationId ) ;
    return( ok(listado) ) ;
  } catch( error ) {
    logger.error( "Error al consultar entidades en getFinancialEntitiesAction." , {error: String(error)} ) ;
    return( fail("Error al consultar las entidades financieras en el servidor.") ) ;
  }
}

/**
 * Crea una transacción de partida doble balanceada con control de idempotencia y validación en runtime.
 * 
 * @param params - Los movimientos y cabecera de la transacción sin el organizationId.
 * @param idempotencyKey - Clave única opcional para evitar duplicados.
 * @returns Un objeto con la cabecera de la transacción creada.
 */
export async function createLedgerTransactionAction(
  params: {
    categoryId?:     string ;
    description:     string ;
    merchantName?:   string ;
    merchantDomain?: string ;
    entries: {
      accountId: string ;
      debit:     number ;
      credit:    number ;
      currency?: string ;
    } [] ;
  } ,
  idempotencyKey?: string
): Promise< Result<LedgerTransaction , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( fail("No autorizado para registrar transacciones.") ) ;
  }

  const organizationId = session.user.organizationId ;

  // 1. Validar parámetros en runtime con Zod
  const validation = createTransactionSchema.safeParse( params ) ;

  if( !validation.success ){
    return( fail("Validación de esquema contable fallida.") ) ;
  }

  try {
    // 2. Ejecutar envuelto en idempotencia
    const result = await executeIdempotent( idempotencyKey || "" , async () => {
      const bizRes = await createLedgerTransaction( {
        ...validation.data ,
        organizationId ,
      } ) ;

      if( !bizRes.success ){
        throw new Error( bizRes.error ) ;
      }

      return( bizRes.value ) ;
    } ) ;

    if( !result.success ){
      return( fail(result.error === "CONFLICT_PROCESSING" ? "Transacción duplicada en proceso." : result.error) ) ;
    }

    return( ok(result.value) ) ;
  } catch( error ) {
    if( (error as {code?: string})?.code === "23503" ) {
      return( fail("Tu sesión referencia una organización inexistente. Cerrá sesión y volvé a ingresar.") ) ;
    }
    logger.error( "Error en createLedgerTransactionAction." , {error: String(error)} ) ;
    
    return( fail(((error as Error).message) || "Error al registrar la transacción contable.") ) ;
  }
}

/**
 * Elimina una transacción contable y revierte los saldos asociados.
 * 
 * @param transactionId - ID de la transacción a eliminar.
 * @returns Un objeto indicando el resultado de la operación.
 */
export async function deleteLedgerTransactionAction( transactionId: string ): Promise< Result<boolean , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( fail("No autorizado para eliminar transacciones.") ) ;
  }

  try {
    const res = await deleteLedgerTransaction( transactionId , session.user.organizationId ) ;

    if( !res.success ){ return( fail(res.error) ) ; }

    return( ok(true) ) ;
  } catch( error ) {
    if( (error as {code?: string})?.code === "23503" ) {
      return( fail("Tu sesión referencia una organización inexistente. Cerrá sesión y volvé a ingresar.") ) ;
    }
    logger.error( "Error al eliminar transacción en deleteLedgerTransactionAction." , {error: String(error)} ) ;
    
    return( fail("Error al intentar eliminar la transacción contable.") ) ;
  }
}

/**
 * Consulta y retorna el histórico de transacciones contables del libro diario dentro de un rango opcional.
 * Utiliza una consulta optimizada del repositorio para evitar N+1 consultas.
 * 
 * @returns Un objeto con las transacciones y sus asientos asociados.
 */
export async function getTransactionsAction( params?: {
  fromDate?: Date ;
  toDate?:   Date ;
} ): Promise< Result<TransactionWithEntries[] , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( fail("No autorizado para consultar el libro diario.") ) ;
  }

  logger.info( "getTransactionsAction: Iniciando consulta" , {
    fromDate: params?.fromDate?.toISOString() ,
    toDate:   params?.toDate?.toISOString()
  } ) ;

  try {
    const resultado = await ledgerRepository.findTransactionsWithEntries(
      session.user.organizationId ,
      params?.fromDate ,
      params?.toDate
    ) ;

    logger.info( "getTransactionsAction: Consulta completada con éxito" , {
      count: resultado.length
    } ) ;
    
    return( ok(resultado) ) ;
  } catch( error ) {
    logger.error( "Error al obtener transacciones en getTransactionsAction." , {error: String(error)} ) ;
    
    return( fail("Error al consultar el libro diario contable.") ) ;
  }
}

/**
 * Consulta y retorna los resúmenes mensuales históricos de la organización del usuario autenticado.
 * 
 * @param limit - Cantidad máxima de meses a recuperar.
 * @returns Un objeto Result con el listado de resúmenes.
 */
export async function getMonthlySummariesAction(
  limit:       number = 6 ,
  beforeYear?:  number ,
  beforeMonth?: number
): Promise< Result<MonthlySummary[] , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( fail("No autorizado para consultar los resúmenes mensuales.") ) ;
  }

  logger.info( "getMonthlySummariesAction: Iniciando consulta" , {
    limit ,
    beforeYear ,
    beforeMonth
  } ) ;

  try {
    const listado = await monthlySummaryRepository.findRecent(
      session.user.organizationId ,
      limit ,
      beforeYear ,
      beforeMonth
    ) ;

    logger.info( "getMonthlySummariesAction: Consulta completada con éxito" , {
      count: listado.length
    } ) ;
    
    return( ok(listado) ) ;
  } catch( error ) {
    logger.error( "Error al consultar resúmenes mensuales en getMonthlySummariesAction." , {error: String(error)} ) ;
    
    return( fail("Error al consultar los resúmenes mensuales en el servidor.") ) ;
  }
}

/**
 * Consulta y retorna la clave de mes (YYYY-MM) más antigua con registros para la organización.
 *
 * @returns Un objeto Result con el string YYYY-MM o undefined si no existen resúmenes.
 */
export async function getEarliestMonthKeyAction(): Promise< Result< string | undefined , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado para consultar los resúmenes mensuales." ) ) ;
  }

  try {
    const earliestKey = await monthlySummaryRepository.findEarliestMonthKey( session.user.organizationId ) ;
    return( ok( earliestKey ) ) ;
  } catch( error ) {
    logger.error( "Error al consultar mes más antiguo en getEarliestMonthKeyAction." , { error: String( error ) } ) ;
    return( fail( "Error al consultar el mes más antiguo en el servidor." ) ) ;
  }
}