/**
 * @file ledgerRepository.ts
 * Repositorio de Libro Mayor y Asientos de Diario (Capa de Acceso a Datos - DAL).
 */
import { db } from "@/shared/db/client" ;
import { ledgerTransactions , ledgerEntries } from "../schema.db" ;
import { eq , and , desc , inArray } from "drizzle-orm" ;
import { LedgerTransaction , InsertLedgerTransaction , LedgerEntry , InsertLedgerEntry } from "../types" ;

/**
 * Tipo compuesto que representa una transacción junto con todas sus líneas contables asociadas.
 */
export type TransactionWithEntries = LedgerTransaction & {
  entries: LedgerEntry[] ;
} ;

/**
 * Repositorio del Libro Diario Contable.
 * Centraliza la creación y lectura de cabeceras de transacciones e individuales asientos.
 */
export const ledgerRepository = {
  /**
   * Registra la cabecera de una transacción contable en la base de datos.
   * 
   * @param data - Datos de inserción para la cabecera.
   * @param tx - Instancia de transacción opcional.
   * @returns La cabecera insertada.
   */
  async createTransaction( data: InsertLedgerTransaction , tx = db ): Promise< LedgerTransaction > {
    const [ inserted ] = await tx
      .insert( ledgerTransactions )
      .values( data )
      .returning() ;
    return( inserted ) ;
  } ,

  /**
   * Registra múltiples apuntes contables (movimientos) en lote.
   * 
   * @param data - Listado de asientos a insertar.
   * @param tx - Instancia de transacción opcional.
   * @returns Listado de asientos insertados.
   */
  async createEntries( data: InsertLedgerEntry[] , tx = db ): Promise< LedgerEntry[] > {
    return( await tx
      .insert( ledgerEntries )
      .values( data )
      .returning() ) ;
  } ,

  /**
   * Busca una transacción por ID y valida su pertenencia a la organización.
   * 
   * @param id - ID de la transacción.
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns La transacción o null si no se encuentra.
   */
  async findById( id: string , organizationId: string , tx = db ): Promise< LedgerTransaction | null > {
    const results = await tx
      .select()
      .from( ledgerTransactions )
      .where(
        and(
          eq(ledgerTransactions.id , id) ,
          eq(ledgerTransactions.organizationId , organizationId) ,
        )
      )
      .limit( 1 ) ;
    return( (results[0]) || null ) ;
  } ,

  /**
   * Busca todas las entradas individuales de diario asociadas a una transacción.
   * 
   * @param transactionId - ID de la cabecera de transacción.
   * @param tx - Instancia de transacción opcional.
   * @returns Lista de entradas de diario.
   */
  async findEntriesByTransactionId( transactionId: string , tx = db ): Promise< LedgerEntry[] > {
    return( await tx
      .select()
      .from( ledgerEntries )
      .where( eq(ledgerEntries.transactionId , transactionId) ) ) ;
  } ,

  /**
   * Busca las entradas de diario correspondientes a un conjunto de IDs de transacciones.
   * 
   * @param transactionIds - Colección de IDs de transacciones a buscar.
   * @param tx - Instancia de transacción opcional.
   * @returns Lista de entradas de diario agrupadas.
   */
  async findEntriesByTransactionIds( transactionIds: string[] , tx = db ): Promise< LedgerEntry[] > {
    if( transactionIds.length === 0 ){
      return( [] ) ;
    }
    return( await tx
      .select()
      .from( ledgerEntries )
      .where( inArray(ledgerEntries.transactionId , transactionIds) ) ) ;
  } ,

  /**
   * Elimina una transacción contable.
   * Por cascading rules en base de datos, esto eliminará también sus entradas asociadas.
   * 
   * @param id - ID de la transacción a eliminar.
   * @param tx - Instancia de transacción opcional.
   */
  async deleteTransaction( id: string , tx = db ): Promise< void > {
    await tx
      .delete( ledgerTransactions )
      .where( eq(ledgerTransactions.id , id) ) ;
  } ,

  /**
   * Consulta el histórico de transacciones contables del libro diario con sus respectivos movimientos asociados.
   * Optimiza el consumo evitando N+1 consultas de base de datos agrupando en memoria.
   * 
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns Listado de transacciones con sus líneas asociadas ordenadas por fecha descendente.
   */
  async findTransactionsWithEntries( organizationId: string , tx = db ): Promise< TransactionWithEntries[] > {
    const transactions = await tx
      .select()
      .from( ledgerTransactions )
      .where( eq(ledgerTransactions.organizationId , organizationId) )
      .orderBy( desc(ledgerTransactions.createdAt) ) ;

    if( transactions.length === 0 ){
      return( [] ) ;
    }

    const txIds = transactions.map( (t) => t.id ) ;
    const entries = await this.findEntriesByTransactionIds( txIds , tx ) ;

    return( transactions.map( (tx) => ( {
      ...tx ,
      entries: entries.filter((e) => e.transactionId === tx.id) ,
    } ) ) ) ;
  }
} ;
