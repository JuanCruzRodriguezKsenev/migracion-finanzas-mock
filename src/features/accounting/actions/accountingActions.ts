/**
 * @file accountingActions.ts
 * Acciones de servidor (Server Actions) para la gestión contable y transaccionalidad.
 */
"use server" ;

import { accountRepository } from "../repositories/accountRepository" ;
import { ledgerRepository } from "../repositories/ledgerRepository" ;
import { createLedgerTransaction , deleteLedgerTransaction } from "../services/accountingService" ;
import { createTransactionSchema } from "../schemas/accounting.schema" ;
import { executeIdempotent } from "@/shared/services/idempotencyService" ;
import { getServerSession } from "next-auth" ;
import { authOptions } from "@/shared/lib/auth" ;
import { logger } from "@/shared/lib/logger" ;

/**
 * Consulta y retorna todas las cuentas financieras de la organización del usuario autenticado.
 * 
 * @returns Un objeto Result con el listado de cuentas ordenadas por código contable.
 */
export async function getAccountsAction() {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( {isOk: false , error: {message: "No autorizado para consultar las cuentas."}} ) ;
  }

  try {
    const listado = await accountRepository.findAll( session.user.organizationId ) ;
    return( {isOk: true , value: listado} ) ;
  } catch( error ) {
    logger.error( "Error al consultar cuentas en getAccountsAction." , { error: String(error) } ) ;
    return( {isOk: false , error: {message: "Error al consultar las cuentas en el servidor."}} ) ;
  }
}

/**
 * Registra una nueva cuenta en el plan de cuentas de la organización del usuario.
 * 
 * @param params - Los parámetros para registrar la cuenta contable.
 * @returns Un objeto con la cuenta creada.
 */
export async function createAccountAction( params: {
  code:      string ;
  name:      string ;
  type:      string ;
  balance?:  number ;
  currency?: string ;
} ) {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( {isOk: false , error: {message: "No autorizado para crear cuentas."}} ) ;
  }

  try {
    const nuevaCuenta = await accountRepository.create( {
      organizationId: session.user.organizationId ,
      code:           params.code ,
      name:           params.name ,
      type:           params.type ,
      balance:        params.balance || 0 ,
      currency:       params.currency || "ARS" ,
    } ) ;

    return( {isOk: true , value: nuevaCuenta} ) ;
  } catch( error ) {
    logger.error( "Error al crear cuenta en createAccountAction." , { error: String(error) } ) ;
    return( {isOk: false , error: {message: "Error al crear la cuenta contable en el servidor."}} ) ;
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
) {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( {isOk: false , error: {message: "No autorizado para registrar transacciones."}} ) ;
  }

  const organizationId = session.user.organizationId ;

  // 1. Validar parámetros en runtime con Zod
  const validation = createTransactionSchema.safeParse( params ) ;

  if( !validation.success ){
    return( {
      isOk: false ,
      error: {
        message: "Validación de esquema contable fallida." ,
        details: validation.error.format() ,
      }
    } ) ;
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
      return( {
        isOk: false ,
        error: {
          message: result.error === "CONFLICT_PROCESSING" ? "Transacción duplicada en proceso." : result.error ,
        }
      } ) ;
    }

    return( {isOk: true , value: result.value} ) ;
  } catch( error ) {
    logger.error( "Error en createLedgerTransactionAction." , { error: String(error) } ) ;
    return( {isOk: false , error: {message: ((error as Error).message) || "Error al registrar la transacción contable."}} ) ;
  }
}

/**
 * Elimina una transacción contable y revierte los saldos asociados.
 * 
 * @param transactionId - ID de la transacción a eliminar.
 * @returns Un objeto indicando el resultado de la operación.
 */
export async function deleteLedgerTransactionAction( transactionId: string ) {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( {isOk: false , error: {message: "No autorizado para eliminar transacciones."}} ) ;
  }

  try {
    const res = await deleteLedgerTransaction( transactionId , session.user.organizationId ) ;

    if( !res.success ){
      return( {isOk: false , error: {message: res.error}} ) ;
    }

    return( {isOk: true , value: true} ) ;
  } catch( error ) {
    logger.error( "Error al eliminar transacción en deleteLedgerTransactionAction." , { error: String(error) } ) ;
    return( {isOk: false , error: {message: "Error al intentar eliminar la transacción contable."}} ) ;
  }
}

/**
 * Consulta y retorna el histórico de transacciones contables del libro diario con sus respectivos movimientos asociados.
 * Utiliza una consulta optimizada del repositorio para evitar N+1 consultas.
 * 
 * @returns Un objeto con las transacciones y sus asientos asociados.
 */
export async function getTransactionsAction() {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( {isOk: false , error: {message: "No autorizado para consultar el libro diario."}} ) ;
  }

  try {
    const resultado = await ledgerRepository.findTransactionsWithEntries( session.user.organizationId ) ;
    return( {isOk: true , value: resultado} ) ;
  } catch( error ) {
    logger.error( "Error al obtener transacciones en getTransactionsAction." , { error: String(error) } ) ;
    return( {isOk: false , error: {message: "Error al consultar el libro diario contable."}} ) ;
  }
}