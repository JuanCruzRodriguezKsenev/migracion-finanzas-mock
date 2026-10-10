/**
 * @file accountingActions.ts
 * Acciones de servidor (Server Actions) para la gestión contable y transaccionalidad.
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { armarClaveIdempotencia , executeIdempotent } from "@/shared/services/idempotencyService" ;
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;

// Feature: Auth
import { obtenerSesionDeEscritura } from "@/features/auth/services/authorizationService" ;

// Feature: Auth
import { autorizarTitularPorCuenta } from "@/features/auth/services/titularService" ;

// Feature: Accounting
import {
  createTransactionSchema ,
  holderUserIdFiltroSchema ,
  createAccountSchema ,
  createFinancialEntitySchema
} from "../schemas/accounting.schema" ;
import {
  createLedgerTransaction ,
  deleteLedgerTransaction ,
  updateLedgerTransactionMetadata ,
  reverseLedgerTransaction
} from "../services/accountingService" ;
import {
  TransactionWithEntries ,
  TransactionsPageResult ,
  ledgerRepository
} from "../repositories/ledgerRepository" ;
import { LedgerTransaction , Account , MonthlySummary , FinancialEntity }             from "../types" ;
import { monthlySummaryRepository }                                                  from "../repositories/monthlySummaryRepository" ;
import { financialEntityRepository }                                                 from "../repositories/financialEntityRepository" ;
import { rellenarResumenesFaltantes }                                                 from "../services/monthlySummaryService" ;
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
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
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
    // El código se calcula sobre todas las ancladas (personales incluidas): el índice único las cuenta
    const ancladas        = await accountRepository.findTodasEnAncla( sesion.value.organizationId ) ;
    const codigoGenerado  = ( code || getNextCode( type , ancladas ) ) ;

    // 3. Opción B: Invertir signo automáticamente para cuentas de pasivo (liability)
    let balanceFinal = ( balance || 0 ) ;
    if( ( type === "liability" ) && ( balanceFinal > 0 ) ) {
      balanceFinal = -balanceFinal ;
    }

    const nuevaCuenta = await accountRepository.create( {
      organizationId: sesion.value.organizationId ,
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
 * Es un alta pura a nivel organización que no genera cuentas contables por defecto.
 * 
 * @param params - Parámetros de la entidad financiera (nombre, logo e icono, color).
 * @returns Un objeto Result con la entidad financiera creada o mensaje de error.
 */
export async function createFinancialEntityAction( params: {
  name:         string ;
  logo?:        string | null ;
  brandDomain?: string | null ;
  color?:       string | null ;
} ): Promise< Result<FinancialEntity , string> > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  // 1. Validar parámetros con Zod en runtime
  const validation = createFinancialEntitySchema.safeParse( params ) ;
  if( !validation.success ) {
    const errorMsg = validation.error.issues[0]?.message || "Datos de entidad financiera inválidos." ;
    return( fail(errorMsg) ) ;
  }

  const { name , logo , brandDomain , color } = validation.data ;

  logger.info( "[createFinancialEntityAction] Iniciando registro de entidad financiera..." , {
    orgId: sesion.value.organizationId ,
    name ,
    logo ,
    brandDomain ,
    color ,
  } ) ;

  try {
    const nuevaEntidad = await financialEntityRepository.create( {
      organizationId: sesion.value.organizationId ,
      name ,
      logo:           logo || null ,
      brandDomain:    brandDomain || null ,
      color:          color || null ,
    } ) ;

    logger.info( `[createFinancialEntityAction] Registro completado exitosamente para la entidad: ${name} (ID: ${nuevaEntidad.id})` ) ;
    return( ok(nuevaEntidad) ) ;
  } catch( error ) {
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
    occurredAt?:     Date | string ;
    /** A nombre de quién se carga. El autor nunca viene del cliente: es siempre la sesión (RN-3). */
    holderUserId?:   string ;
    /** Si el titular absorbe el gasto en vez de repartir la deuda (RN-19). */
    absorbeElDueno?: boolean ;
    entries: {
      accountId: string ;
      debit:     number ;
      credit:    number ;
      currency?: string ;
    } [] ;
  } ,
  idempotencyKey?: string
): Promise< Result<LedgerTransaction , string> > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const organizationId = sesion.value.organizationId ;
  const autorUserId    = sesion.value.userId ;

  // 1. Validar parámetros en runtime con Zod
  const validation = createTransactionSchema.safeParse( params ) ;

  if( !validation.success ){
    return( fail("Validación de esquema contable fallida.") ) ;
  }

  // La clave se arma con usuario, acción y huella de los datos: nunca devuelve la respuesta de otra persona
  // ni la de un envío con datos distintos.
  let claveArmada: string | null ;

  try {
    claveArmada = autorUserId
      ? armarClaveIdempotencia( { userId: autorUserId , accion: "crearMovimiento" , claveCliente: idempotencyKey , datos: validation.data } )
      : null ;
  } catch {
    return( fail("Clave de envío inválida.") ) ;
  }

  try {
    // 2. Ejecutar envuelto en idempotencia
    const result = await executeIdempotent( claveArmada || "" , async () => {
      // El titular se valida contra la base en cada llamada, dentro de la idempotencia: una revocación
      // entre dos intentos tiene que verse en el segundo (AC-4).
      const cuentaIds = validation.data.entries.map( ( e ) => e.accountId ) ;
      const titular = autorUserId
        ? await autorizarTitularPorCuenta( organizationId , autorUserId , validation.data.holderUserId , cuentaIds )
        : ok( null ) ;

      if( !titular.success ){
        throw new Error( titular.error ) ;
      }

      const bizRes = await createLedgerTransaction( {
        ...validation.data ,
        organizationId ,
        createdByUserId:       autorUserId ,
        holderUserId:          titular.value ,
        aplicarReparto:        true ,
        titularPorDefecto:     autorUserId ,
        absorbidoPorElTitular: validation.data.absorbeElDueno ,
      } ) ;

      if( !bizRes.success ){
        throw new Error( bizRes.error ) ;
      }

      return( bizRes.value ) ;
    } ) ;

    if( !result.success ){
      return( fail(result.error === "CONFLICT_PROCESSING" ? "Ese envío todavía se está procesando. Esperá unos segundos y revisá antes de reintentar." : result.error) ) ;
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
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  try {
    const res = await deleteLedgerTransaction( transactionId , sesion.value.organizationId ) ;

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
 * Consulta y retorna una página de transacciones con filtros y cursor determinístico.
 * 
 * @param params - Opciones de paginación y filtros.
 * @returns Un objeto Result con las transacciones y próximo cursor.
 */
export async function getTransactionsPageAction( params: {
  cursor?:       { occurredAt: Date | string ; id: string } | null ;
  limit?:        number ;
  search?:       string ;
  categoryId?:   string ;
  accountId?:    string ;
  holderUserId?: string ;
  fromDate?:     Date | string ;
  toDate?:       Date | string ;
} ): Promise< Result<TransactionsPageResult , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( fail("No autorizado para consultar transacciones.") ) ;
  }

  if( params.holderUserId && !holderUserIdFiltroSchema.safeParse( params.holderUserId ).success ) {
    return( fail("El titular elegido no es válido.") ) ;
  }

  try {
    const formattedCursor = params.cursor
      ? {
          occurredAt: new Date( params.cursor.occurredAt ) ,
          id:         params.cursor.id ,
        }
      : null ;

    const resultado = await ledgerRepository.findTransactionsPage( {
      organizationId: session.user.organizationId ,
      cursor:         formattedCursor ,
      limit:          params.limit ,
      search:         params.search ,
      categoryId:     params.categoryId ,
      accountId:      params.accountId ,
      holderUserId:   params.holderUserId ,
      fromDate:       params.fromDate ? new Date( params.fromDate ) : undefined ,
      toDate:         params.toDate   ? new Date( params.toDate   ) : undefined ,
    } ) ;

    return( ok(resultado) ) ;
  } catch( error ) {
    logger.error( "Error al paginar transacciones en getTransactionsPageAction." , {error: String(error)} ) ;
    return( fail("Error al consultar la página de transacciones.") ) ;
  }
}

/**
 * Actualiza los metadatos de una transacción contable sin alterar la partida doble.
 * 
 * @param params - Metadatos editables de la transacción.
 * @returns Objeto Result con la transacción actualizada.
 */
export async function updateLedgerTransactionMetadataAction( params: {
  transactionId:   string ;
  description?:    string ;
  categoryId?:     string | null ;
  merchantName?:   string | null ;
  merchantDomain?: string | null ;
  occurredAt?:     Date | string ;
} ): Promise< Result<LedgerTransaction , string> > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  try {
    const res = await updateLedgerTransactionMetadata( {
      ...params ,
      organizationId: sesion.value.organizationId ,
    } ) ;

    return( res ) ;
  } catch( error ) {
    if( (error as {code?: string})?.code === "23503" ) {
      return( fail("Tu sesión referencia una organización inexistente. Cerrá sesión y volvé a ingresar.") ) ;
    }
    logger.error( "Error en updateLedgerTransactionMetadataAction." , {error: String(error)} ) ;
    return( fail("Error al actualizar la transacción contable.") ) ;
  }
}

/**
 * Reversa una transacción contable mediante la generación de su asiento espejo compensatorio.
 * 
 * @param params - Parámetros de reversión (ID y motivo).
 * @returns Objeto Result con la transacción de reversión generada.
 */
export async function reverseLedgerTransactionAction( params: {
  transactionId: string ;
  reason?:       string ;
} ): Promise< Result<LedgerTransaction , string> > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  try {
    const res = await reverseLedgerTransaction(
      params.transactionId ,
      sesion.value.organizationId ,
      params.reason ,
      sesion.value.userId
    ) ;

    return( res ) ;
  } catch( error ) {
    if( (error as {code?: string})?.code === "23503" ) {
      return( fail("Tu sesión referencia una organización inexistente. Cerrá sesión y volvé a ingresar.") ) ;
    }
    logger.error( "Error en reverseLedgerTransactionAction." , {error: String(error)} ) ;
    return( fail("Error al reversar la transacción contable.") ) ;
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

/**
 * Rellena los resúmenes mensuales históricos que falten para la organización del usuario autenticado.
 *
 * @returns Un objeto Result con la cantidad de resúmenes escritos.
 */
export async function rellenarResumenesMensualesAction(): Promise< Result< number , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado para rellenar los resúmenes mensuales." ) ) ;
  }

  try {
    return( await rellenarResumenesFaltantes( session.user.organizationId ) ) ;
  } catch( error ) {
    logger.error( "Error al rellenar resúmenes mensuales en rellenarResumenesMensualesAction." , { error: String( error ) } ) ;
    return( fail( "Error al rellenar los resúmenes mensuales en el servidor." ) ) ;
  }
}