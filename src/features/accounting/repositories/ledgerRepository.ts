/**
 * @file ledgerRepository.ts
 * Repositorio de Libro Mayor y Asientos de Diario (Capa de Acceso a Datos - DAL).
 */
// Librerías externas
import { eq , and , desc , inArray , gte , lte , lt , gt , or , ilike , isNull , isNotNull , sql } from "drizzle-orm" ;
import { alias }                                                                       from "drizzle-orm/pg-core" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Auth
import { nombreVisible } from "@/features/auth/utils/nombreVisible" ;
import { users }         from "@/features/auth/schema.db" ;

// Feature: Accounting
import { LedgerTransaction , InsertLedgerTransaction , LedgerEntry , InsertLedgerEntry } from "../types" ;
import { ledgerTransactions , ledgerEntries , accounts }                                   from "../schema.db" ;


/**
 * Persona que cargó un movimiento o a cuyo nombre se cargó, con el nombre ya resuelto para mostrar.
 */
export interface PersonaDeMovimiento {
  id:     string ;
  nombre: string ;
}

/**
 * Tipo compuesto que representa una transacción junto con todas sus líneas contables asociadas.
 * `holder` y `createdBy` sólo los completa la consulta paginada; `null` en los movimientos anteriores
 * a la autoría o sin autor (cron, outbox).
 */
export type TransactionWithEntries = LedgerTransaction & {
  entries:    LedgerEntry[] ;
  holder?:    PersonaDeMovimiento | null ;
  createdBy?: PersonaDeMovimiento | null ;
} ;

/**
 * Parámetros para la consulta paginada y filtrada de transacciones contables.
 */
export interface QueryTransactionsParams {
  organizationId: string ;
  cursor?:        { occurredAt: Date ; id: string } | null ;
  limit?:         number ;
  search?:        string ;
  categoryId?:    string ;
  accountId?:     string ;
  holderUserId?:  string ;
  fromDate?:      Date ;
  toDate?:        Date ;
}

/**
 * Cuenta personal que aparece en los asientos de una página de movimientos (RN-13). No lleva saldo: quien
 * ve el movimiento ve el nombre de la cuenta y de su dueño, no su dinero.
 */
export interface CuentaPersonalReferenciada {
  id:          string ;
  code:        string ;
  name:        string ;
  type:        string ;
  currency:    string ;
  ownerUserId: string ;
  ownerNombre: string ;
}

/**
 * Resultado estructurado para la paginación por cursor del libro diario.
 */
export interface TransactionsPageResult {
  items:             TransactionWithEntries[] ;
  /** Personales usadas por los asientos de la página, aunque ya no se compartan (RN-13). */
  cuentasPersonales: CuentaPersonalReferenciada[] ;
  nextCursor: { occurredAt: string ; id: string } | null ;
  hasMore:    boolean ;
}

/**
 * Repositorio del Libro Diario Contable.
 * Centraliza la creación, lectura, actualización de metadatos y paginación de transacciones.
 */
export const ledgerRepository = {
  /**
   * Registra la cabecera de una transacción contable en la base de datos.
   * 
   * @param data - Datos de inserción para la cabecera.
   * @param tx - Instancia de transacción opcional.
   * @returns La cabecera insertada.
   */
  async createTransaction( data: InsertLedgerTransaction , tx: DBOrTx = db ): Promise< LedgerTransaction > {
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
  async createEntries( data: InsertLedgerEntry[] , tx: DBOrTx = db ): Promise< LedgerEntry[] > {
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
  async findById( id: string , organizationId: string , tx: DBOrTx = db ): Promise< LedgerTransaction | null > {
    const results = await tx
      .select()
      .from( ledgerTransactions )
      .where(
        and(
          eq( ledgerTransactions.id             , id             ) ,
          eq( ledgerTransactions.organizationId , organizationId ) ,
        )
      )
      .limit( 1 ) ;
    return( results[0] || null ) ;
  } ,

  /**
   * Busca una transacción bloqueando su fila hasta el fin de la transacción de base de datos
   * (`SELECT ... FOR UPDATE`).
   *
   * La usa la reversión: sin el bloqueo, dos clics simultáneos leerían ambos `reversed_at` en nulo,
   * los dos pasarían la guarda y se generarían dos contra-asientos, devolviendo el doble del
   * importe a las cuentas. En un motor de partida doble eso es crear dinero de la nada.
   *
   * @param id - ID de la transacción.
   * @param organizationId - Organización dueña.
   * @param tx - Instancia de transacción; debe existir para que el bloqueo tenga sentido.
   * @returns La transacción bloqueada, o null si no existe o no pertenece a la organización.
   */
  async findByIdForUpdate( id: string , organizationId: string , tx: DBOrTx = db ): Promise< LedgerTransaction | null > {
    const results = await tx
      .select()
      .from( ledgerTransactions )
      .where(
        and(
          eq( ledgerTransactions.id             , id             ) ,
          eq( ledgerTransactions.organizationId , organizationId ) ,
        )
      )
      .limit( 1 )
      .for( "update" ) ;
    return( results[0] || null ) ;
  } ,

  /**
   * Marca una transacción como reversada, dejando constancia de cuándo ocurrió.
   *
   * @param id - ID de la transacción original.
   * @param momento - Instante de la reversión.
   * @param tx - Instancia de transacción opcional.
   */
  async markAsReversed( id: string , momento: Date , tx: DBOrTx = db ): Promise< void > {
    await tx
      .update( ledgerTransactions )
      .set( {reversedAt: momento} )
      .where( eq(ledgerTransactions.id , id) ) ;
  } ,

  /**
   * Busca todas las entradas individuales de diario asociadas a una transacción.
   * 
   * @param transactionId - ID de la cabecera de transacción.
   * @param tx - Instancia de transacción opcional.
   * @returns Lista de entradas de diario.
   */
  async findEntriesByTransactionId( transactionId: string , tx: DBOrTx = db ): Promise< LedgerEntry[] > {
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
  async findEntriesByTransactionIds( transactionIds: string[] , tx: DBOrTx = db ): Promise< LedgerEntry[] > {
    if( transactionIds.length === 0 ){ return( [] ) ; }
    
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
  async deleteTransaction( id: string , tx: DBOrTx = db ): Promise< void > {
    await tx
      .delete( ledgerTransactions )
      .where( eq(ledgerTransactions.id , id) ) ;
  } ,

  /**
   * Actualiza los metadatos editables de una transacción contable sin alterar los asientos de partida doble.
   * 
   * @param id - ID de la transacción.
   * @param organizationId - ID de la organización.
   * @param data - Datos parciales de metadatos.
   * @param tx - Instancia de transacción opcional.
   * @returns La transacción actualizada o null si no se encuentra.
   */
  async updateTransactionMetadata(
    id:             string ,
    organizationId: string ,
    data: {
      description?:    string ;
      categoryId?:     string | null ;
      merchantName?:   string | null ;
      merchantDomain?: string | null ;
      occurredAt?:     Date ;
    } ,
    tx:             DBOrTx = db
  ): Promise< LedgerTransaction | null > {
    const [ updated ] = await tx
      .update( ledgerTransactions )
      .set( data )
      .where(
        and(
          eq( ledgerTransactions.id             , id             ) ,
          eq( ledgerTransactions.organizationId , organizationId ) ,
        )
      )
      .returning() ;
    return( updated || null ) ;
  } ,

  /**
   * Consulta el histórico de transacciones contables del libro diario con sus respectivos movimientos asociados.
   * Optimiza el consumo evitando N+1 consultas de base de datos agrupando en memoria.
   * 
   * @param organizationId - ID de la organización.
   * @param fromDate - Opcional. Límite de fecha inferior sobre occurredAt.
   * @param toDate - Opcional. Límite de fecha superior sobre occurredAt.
   * @param tx - Instancia de transacción opcional.
   * @returns Listado de transacciones con sus líneas asociadas ordenadas por occurredAt descendente.
   */
  async findTransactionsWithEntries(
    organizationId: string ,
    fromDate?:       Date ,
    toDate?:         Date ,
    tx:              DBOrTx = db
  ): Promise< TransactionWithEntries[] > {
    const conditions = [ eq(ledgerTransactions.organizationId , organizationId) ] ;

    if( fromDate ){
      conditions.push( gte(ledgerTransactions.occurredAt , fromDate) ) ;
    }
    if( toDate ){
      conditions.push( lte(ledgerTransactions.occurredAt , toDate) ) ;
    }

    const transactions = await tx
      .select()
      .from( ledgerTransactions )
      .where( and(...conditions) )
      .orderBy( desc(ledgerTransactions.occurredAt) , desc(ledgerTransactions.id) ) ;

    if( transactions.length === 0 ){ return( [] ) ; }

    const txIds = transactions.map( (t) => t.id ) ;
    const entries = await this.findEntriesByTransactionIds( txIds , tx ) ;

    return( transactions.map( (t) => ( {
      ...t ,
      entries: entries.filter( (e) => e.transactionId === t.id ) ,
    } ) ) ) ;
  } ,

  /**
   * Consulta paginada por cursor determinístico con búsqueda de texto y filtros por cuenta y categoría.
   * 
   * @param params - Opciones de paginación y filtrado.
   * @param tx - Instancia de transacción opcional.
   * @returns Página de transacciones con sus entradas y el próximo cursor si existen más filas.
   */
  async findTransactionsPage(
    params: QueryTransactionsParams ,
    tx:     DBOrTx = db
  ): Promise< TransactionsPageResult > {
    const { organizationId , cursor , limit = 20 , search , categoryId , accountId , holderUserId , fromDate , toDate } = params ;
    const conditions = [ eq(ledgerTransactions.organizationId , organizationId) ] ;

    if( fromDate ) {
      conditions.push( gte(ledgerTransactions.occurredAt , fromDate) ) ;
    }
    if( toDate ) {
      conditions.push( lte(ledgerTransactions.occurredAt , toDate) ) ;
    }
    if( categoryId ) {
      conditions.push( eq(ledgerTransactions.categoryId , categoryId) ) ;
    }
    if( holderUserId ) {
      conditions.push( eq(ledgerTransactions.holderUserId , holderUserId) ) ;
    }
    if( search && (search.trim() !== "") ) {
      const pattern = `%${search.trim()}%` ;
      conditions.push(
        or(
          ilike( ledgerTransactions.description  , pattern ) ,
          ilike( ledgerTransactions.merchantName , pattern ) ,
        )!
      ) ;
    }
    if( accountId ) {
      const matchingTxIds = tx
        .select( { txId: ledgerEntries.transactionId } )
        .from( ledgerEntries )
        .where( eq(ledgerEntries.accountId , accountId) ) ;

      conditions.push( inArray(ledgerTransactions.id , matchingTxIds) ) ;
    }
    if( cursor ) {
      conditions.push(
        or(
          lt( ledgerTransactions.occurredAt , cursor.occurredAt ) ,
          and(
            eq( ledgerTransactions.occurredAt , cursor.occurredAt ) ,
            lt( ledgerTransactions.id         , cursor.id         ) ,
          ) ,
        )!
      ) ;
    }

    // El join va en la cabecera: los asientos se piden aparte, por id de transacción.
    const titular = alias( users , "titular" ) ;
    const autor   = alias( users , "autor" ) ;

    const queryLimit = limit + 1 ;
    const fetchedConPersonas = await tx
      .select( {
        cabecera:     ledgerTransactions ,
        titularName:  titular.name ,
        titularEmail: titular.email ,
        autorName:    autor.name ,
        autorEmail:   autor.email ,
      } )
      .from( ledgerTransactions )
      .leftJoin( titular , eq(ledgerTransactions.holderUserId    , titular.id) )
      .leftJoin( autor   , eq(ledgerTransactions.createdByUserId , autor.id  ) )
      .where( and(...conditions) )
      .orderBy( desc(ledgerTransactions.occurredAt) , desc(ledgerTransactions.id) )
      .limit( queryLimit ) ;

    const hasMore  = ( fetchedConPersonas.length > limit ) ;
    const filas    = hasMore ? fetchedConPersonas.slice( 0 , limit ) : fetchedConPersonas ;
    const pageRows = filas.map( ( f ) => f.cabecera ) ;

    if( pageRows.length === 0 ) {
      return( {
        items:             [] ,
        cuentasPersonales: [] ,
        nextCursor:        null ,
        hasMore:           false ,
      } ) ;
    }

    const txIds = pageRows.map( ( t ) => t.id ) ;
    const entries = await this.findEntriesByTransactionIds( txIds , tx ) ;

    // Personales referenciadas por los asientos: se resuelven por id, sin filtrar por la cuenta, para que
    // un movimiento cuya cuenta ya no se comparte siga mostrándose con su nombre y el de su dueño (RN-13).
    const idsDeCuentas = [ ...new Set( entries.map( ( e ) => e.accountId ) ) ] ;
    const personales   = ( idsDeCuentas.length === 0 ) ? [] : await tx
      .select( {
        id:          accounts.id ,
        code:        accounts.code ,
        name:        accounts.name ,
        type:        accounts.type ,
        currency:    accounts.currency ,
        ownerUserId: accounts.ownerUserId ,
        ownerName:   users.name ,
        ownerEmail:  users.email ,
      } )
      .from( accounts )
      .leftJoin( users , eq( accounts.ownerUserId , users.id ) )
      .where( and( inArray( accounts.id , idsDeCuentas ) , isNotNull( accounts.ownerUserId ) ) ) ;

    const items: TransactionWithEntries[] = filas.map( ( fila ) => ( {
      ...fila.cabecera ,
      entries:   entries.filter( ( e ) => e.transactionId === fila.cabecera.id ) ,
      holder:    ( fila.cabecera.holderUserId && fila.titularEmail )
        ? { id: fila.cabecera.holderUserId , nombre: nombreVisible( fila.titularName , fila.titularEmail ) }
        : null ,
      createdBy: ( fila.cabecera.createdByUserId && fila.autorEmail )
        ? { id: fila.cabecera.createdByUserId , nombre: nombreVisible( fila.autorName , fila.autorEmail ) }
        : null ,
    } ) ) ;

    const lastItem   = pageRows[pageRows.length - 1] ;
    const nextCursor = hasMore
      ? {
          occurredAt: lastItem.occurredAt.toISOString() ,
          id:         lastItem.id ,
        }
      : null ;

    return( {
      items ,
      cuentasPersonales: personales.map( ( p ) => ( {
        id:          p.id ,
        code:        p.code ,
        name:        p.name ,
        type:        p.type ,
        currency:    p.currency ,
        ownerUserId: p.ownerUserId! ,
        ownerNombre: nombreVisible( p.ownerName , p.ownerEmail ?? "" ) ,
      } ) ) ,
      nextCursor ,
      hasMore ,
    } ) ;
  } ,

  /**
   * Suma los débitos y créditos de los asientos de una cuenta en un rango de fechas contables.
   * Filtra por occurredAt de ledgerTransactions, garantiza aislamiento multi-tenant
   * y excluye transacciones reversadas o que revierten a otra.
   *
   * @param accountId - ID de la cuenta contable.
   * @param organizationId - ID de la organización.
   * @param desde - Cota inferior exclusiva (occurredAt > desde) o null.
   * @param hasta - Cota superior inclusiva (occurredAt <= hasta) o null.
   * @param tx - Instancia de transacción opcional.
   * @returns Total de débitos y créditos en centavos enteros.
   */
  async sumEntriesByAccountInRange(
    accountId:      string ,
    organizationId: string ,
    desde?:         Date | null ,
    hasta?:         Date | null ,
    tx:             DBOrTx = db
  ): Promise< {debit: number ; credit: number} > {
    const conditions = [
      eq( ledgerEntries.accountId              , accountId      ) ,
      eq( ledgerTransactions.organizationId    , organizationId ) ,
      isNull( ledgerTransactions.reversedAt ) ,
      isNull( ledgerTransactions.reversesTransactionId ) ,
    ] ;

    if( desde ) {
      conditions.push( gt( ledgerTransactions.occurredAt , desde ) ) ;
    }
    if( hasta ) {
      conditions.push( lte( ledgerTransactions.occurredAt , hasta ) ) ;
    }

    const [ result ] = await tx
      .select( {
        debit:  sql<string>`COALESCE(SUM(${ledgerEntries.debit}), 0)` ,
        credit: sql<string>`COALESCE(SUM(${ledgerEntries.credit}), 0)` ,
      } )
      .from( ledgerEntries )
      .innerJoin( ledgerTransactions , eq( ledgerEntries.transactionId , ledgerTransactions.id ) )
      .where( and( ...conditions ) ) ;

    return( {
      debit:  Number( result?.debit  || 0 ) ,
      credit: Number( result?.credit || 0 ) ,
    } ) ;
  } ,

  /**
   * Cuenta la cantidad de transacciones vinculadas a una lista de categorías en una organización.
   * 
   * @param categoryIds - Array de identificadores de categoría.
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns Cantidad de transacciones encontradas.
   */
  async countByCategories(
    categoryIds:    string[] ,
    organizationId: string ,
    tx:             DBOrTx = db
  ): Promise< number > {
    if( categoryIds.length === 0 ) {
      return( 0 ) ;
    }

    const [ result ] = await tx
      .select( { count: sql< number >`count(*)::int` } )
      .from( ledgerTransactions )
      .where(
        and(
          eq( ledgerTransactions.organizationId , organizationId ) ,
          inArray( ledgerTransactions.categoryId , categoryIds ) ,
        )
      ) ;

    return( result?.count ?? 0 ) ;
  } ,
} ;
