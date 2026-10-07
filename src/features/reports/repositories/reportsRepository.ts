/**
 * @file reportsRepository.ts
 * Repositorio de consultas agregadas del libro diario para la pantalla de Estadísticas (RFC 027 §4).
 * Ejecuta consultas directas sobre el libro en vivo (Q1 a Q5 y saldos de hoy).
 */
// Librerías externas
import { eq , and , isNull , sql , inArray , lte , desc , asc } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Accounting
import { accounts , categories , categoryAccounts , ledgerEntries , ledgerTransactions } from "@/features/accounting/schema.db" ;
import { cuentaDeLaOrg } from "@/features/accounting/repositories/accountRepository" ;

// Feature: Reports
import { GastoPorHojaItem } from "../types" ;

/**
 * Genera la secuencia cronológica de 13 meses calendario que culmina en monthKey ("YYYY-MM").
 * Comprende los 12 meses de tendencia histórica más el mes anterior al inicio para variaciones.
 */
export function obtenerRango13Meses( monthKey: string ): string[] {
  const [ yStr , mStr ]     = monthKey.split( "-" ) ;
  const año                 = parseInt( yStr , 10 ) ;
  const mes                 = parseInt( mStr , 10 ) ;
  const resultado: string[] = [] ;

  for( let i = 12 ; i >= 0 ; i-- ) {
    let a = año ;
    let m = mes - i ;
    while( m <= 0 ) {
      m += 12 ;
      a -= 1 ;
    }
    const mPadded = String( m ).padStart( 2 , "0" ) ;
    resultado.push( `${a}-${mPadded}` ) ;
  }

  return( resultado ) ;
}

export interface FlujoMensualRow {
  monthKey:      string ;
  ingresos:      number ;
  gastos:        number ;
  transacciones: number ;
}

export interface PatrimonioMesRow {
  monthKey: string ;
  delta:    number ;
}

export interface TopGastoRow {
  id:          string ;
  descripcion: string ;
  categoria:   string ;
  fecha:       string ;
  monto:       number ;
}

/**
 * Repositorio del libro para estadísticas y reportes agregados.
 */
export const reportsRepository = {
  /**
   * Q1 — Flujos por mes (tendencia y métricas).
   * Consulta 13 meses hacia atrás desde el elegido (12 de tendencia + anterior para variación).
   * Excluye asientos reversados y contra-asientos (RN-6).
   */
  async flujosPorMes(
    { orgId , monthKey , zona , currency }: { orgId: string ; monthKey: string ; zona: string ; currency: string } ,
    tx: DBOrTx = db
  ): Promise< FlujoMensualRow[] > {
    const monthKeys = obtenerRango13Meses( monthKey ) ;

    const rows = await tx
      .select( {
        monthKey:      sql< string >`to_char(date_trunc('month', ${ledgerTransactions.occurredAt} AT TIME ZONE ${zona}), 'YYYY-MM')` ,
        ingresos:      sql< string >`COALESCE(SUM(CASE WHEN ${accounts.type} = 'revenue' THEN ${ledgerEntries.credit} ELSE 0 END), 0)` ,
        gastos:        sql< string >`COALESCE(SUM(CASE WHEN ${accounts.type} = 'expense' THEN ${ledgerEntries.debit}  ELSE 0 END), 0)` ,
        transacciones: sql< string >`COUNT(DISTINCT ${ledgerTransactions.id})` ,
      } )
      .from( ledgerEntries )
      .innerJoin( ledgerTransactions , eq( ledgerEntries.transactionId , ledgerTransactions.id ) )
      .innerJoin( accounts           , eq( ledgerEntries.accountId     , accounts.id ) )
      .where(
        and(
          eq( ledgerTransactions.organizationId , orgId ) ,
          cuentaDeLaOrg( orgId ) ,
          eq( ledgerEntries.currency            , currency ) ,
          inArray(
            sql< string >`to_char(date_trunc('month', ${ledgerTransactions.occurredAt} AT TIME ZONE ${zona}), 'YYYY-MM')` ,
            monthKeys
          ) ,
          isNull( ledgerTransactions.reversedAt ) ,
          isNull( ledgerTransactions.reversesTransactionId )
        )
      )
      .groupBy( sql`1` )
      .orderBy( asc( sql`1` ) ) ;

    return( rows.map( ( r ) => {
      return( {
        monthKey:      r.monthKey ,
        ingresos:      Number( r.ingresos ) ,
        gastos:        Number( r.gastos ) ,
        transacciones: Number( r.transacciones ) ,
      } ) ;
    } ) ) ;
  } ,

  /**
   * Q2 — Patrimonio según libro, mes a mes.
   * Sin piso histórico hasta monthKeyMax.
   * Aquí NO se excluye el par reversado: los saldos incluyen el original y su contra-asiento, que se anulan aritméticamente.
   */
  async patrimonioPorMes(
    { orgId , monthKeyMax , zona , currency }: { orgId: string ; monthKeyMax: string ; zona: string ; currency: string } ,
    tx: DBOrTx = db
  ): Promise< PatrimonioMesRow[] > {
    const rows = await tx
      .select( {
        monthKey: sql< string >`to_char(date_trunc('month', ${ledgerTransactions.occurredAt} AT TIME ZONE ${zona}), 'YYYY-MM')` ,
        delta:    sql< string >`COALESCE(SUM(${ledgerEntries.debit} - ${ledgerEntries.credit}), 0)` ,
      } )
      .from( ledgerEntries )
      .innerJoin( ledgerTransactions , eq( ledgerEntries.transactionId , ledgerTransactions.id ) )
      .innerJoin( accounts           , eq( ledgerEntries.accountId     , accounts.id ) )
      .where(
        and(
          eq( ledgerTransactions.organizationId , orgId ) ,
          cuentaDeLaOrg( orgId ) ,
          eq( ledgerEntries.currency            , currency ) ,
          inArray( accounts.type                , [ "asset" , "liability" ] ) ,
          lte(
            sql< string >`to_char(date_trunc('month', ${ledgerTransactions.occurredAt} AT TIME ZONE ${zona}), 'YYYY-MM')` ,
            monthKeyMax
          )
        )
      )
      .groupBy( sql`1` )
      .orderBy( asc( sql`1` ) ) ;

    return( rows.map( ( r ) => {
      return( {
        monthKey: r.monthKey ,
        delta:    Number( r.delta ) ,
      } ) ;
    } ) ) ;
  } ,

  /**
   * Q3 — Suma por hoja de categoría del mes.
   * Función exportada con nombre y firma estable: la reutiliza presupuestos-1.
   * Excluye asientos reversados y contra-asientos.
   */
  async gastoPorHojaDelMes(
    { orgId , monthKey , zona , currency , tipo = "expense" }: {
      orgId:     string ;
      monthKey:  string ;
      zona:      string ;
      currency:  string ;
      tipo?:     "expense" | "revenue" ;
    } ,
    tx: DBOrTx = db
  ): Promise< GastoPorHojaItem[] > {
    const rows = await tx
      .select( {
        categoryId: categoryAccounts.categoryId ,
        accountId:  ledgerEntries.accountId ,
        total:      sql< string >`COALESCE(SUM(CASE WHEN ${accounts.type} = 'expense' THEN ${ledgerEntries.debit} ELSE ${ledgerEntries.credit} END), 0)` ,
      } )
      .from( ledgerEntries )
      .innerJoin( ledgerTransactions , eq( ledgerEntries.transactionId , ledgerTransactions.id ) )
      .innerJoin( accounts           , eq( ledgerEntries.accountId     , accounts.id ) )
      .leftJoin( categoryAccounts    , eq( categoryAccounts.accountId  , accounts.id ) )
      .where(
        and(
          eq( ledgerTransactions.organizationId , orgId ) ,
          cuentaDeLaOrg( orgId ) ,
          eq( ledgerEntries.currency            , currency ) ,
          eq( accounts.type                     , tipo ) ,
          eq(
            sql< string >`to_char(date_trunc('month', ${ledgerTransactions.occurredAt} AT TIME ZONE ${zona}), 'YYYY-MM')` ,
            monthKey
          ) ,
          isNull( ledgerTransactions.reversedAt ) ,
          isNull( ledgerTransactions.reversesTransactionId )
        )
      )
      .groupBy( categoryAccounts.categoryId , ledgerEntries.accountId ) ;

    return( rows.map( ( r ) => {
      return( {
        categoryId: r.categoryId ,
        accountId:  r.accountId ,
        total:      Number( r.total ) ,
      } ) ;
    } ) ) ;
  } ,

  /**
   * Q4 — Top 5 gastos del mes (RN-13, PA-4).
   * Identifica los 5 asientos de mayor gasto y asocia la categoría de la línea con mayor importe.
   * Excluye asientos reversados y contra-asientos.
   */
  async topGastosDelMes(
    { orgId , monthKey , zona , currency }: { orgId: string ; monthKey: string ; zona: string ; currency: string } ,
    tx: DBOrTx = db
  ): Promise< TopGastoRow[] > {
    const topTxRows = await tx
      .select( {
        txId:        ledgerTransactions.id ,
        description: ledgerTransactions.description ,
        fecha:       sql< string >`to_char(${ledgerTransactions.occurredAt} AT TIME ZONE ${zona}, 'YYYY-MM-DD')` ,
        monto:       sql< string >`COALESCE(SUM(${ledgerEntries.debit}), 0)` ,
      } )
      .from( ledgerEntries )
      .innerJoin( ledgerTransactions , eq( ledgerEntries.transactionId , ledgerTransactions.id ) )
      .innerJoin( accounts           , eq( ledgerEntries.accountId     , accounts.id ) )
      .where(
        and(
          eq( ledgerTransactions.organizationId , orgId ) ,
          cuentaDeLaOrg( orgId ) ,
          eq( ledgerEntries.currency            , currency ) ,
          eq( accounts.type                     , "expense" ) ,
          eq(
            sql< string >`to_char(date_trunc('month', ${ledgerTransactions.occurredAt} AT TIME ZONE ${zona}), 'YYYY-MM')` ,
            monthKey
          ) ,
          isNull( ledgerTransactions.reversedAt ) ,
          isNull( ledgerTransactions.reversesTransactionId )
        )
      )
      .groupBy( sql`1, 2, 3` )
      .orderBy( desc( sql`4` ) )
      .limit( 5 ) ;

    if( topTxRows.length === 0 ) {
      return( [] ) ;
    }

    const txIds = topTxRows.map( ( r ) => { return( r.txId ) ; } ) ;

    const lineRows = await tx
      .select( {
        txId:         ledgerEntries.transactionId ,
        categoryName: categories.name ,
        monto:        ledgerEntries.debit ,
      } )
      .from( ledgerEntries )
      .innerJoin( accounts        , eq( ledgerEntries.accountId     , accounts.id ) )
      .leftJoin( categoryAccounts , eq( categoryAccounts.accountId  , accounts.id ) )
      .leftJoin( categories       , eq( categoryAccounts.categoryId , categories.id ) )
      .where(
        and(
          inArray( ledgerEntries.transactionId , txIds ) ,
          eq( accounts.type                    , "expense" ) ,
          eq( ledgerEntries.currency           , currency )
        )
      )
      .orderBy( desc( ledgerEntries.debit ) ) ;

    // Elegir para cada transacción la categoría de mayor débito
    const categoryByTx = new Map< string , string >() ;
    for( const line of lineRows ) {
      if( !categoryByTx.has( line.txId ) ) {
        categoryByTx.set( line.txId , line.categoryName || "Sin categoría" ) ;
      }
    }

    return( topTxRows.map( ( r ) => {
      return( {
        id:          r.txId ,
        descripcion: r.description ,
        categoria:   categoryByTx.get( r.txId ) || "Sin categoría" ,
        fecha:       r.fecha ,
        monto:       Number( r.monto ) ,
      } ) ;
    } ) ) ;
  } ,

  /**
   * Q5 — Primer mes con movimientos de la organización (RN-23).
   * No excluye nada: un mes con solo asientos reversados sigue siendo navegable.
   */
  async primerMesConMovimientos( orgId: string , tx: DBOrTx = db ): Promise< Date | null > {
    const [ row ] = await tx
      .select( {
        minDate: sql< string | null >`MIN(${ledgerTransactions.occurredAt})` ,
      } )
      .from( ledgerTransactions )
      .where( eq( ledgerTransactions.organizationId , orgId ) ) ;

    if( !row?.minDate ) {
      return( null ) ;
    }

    const d = new Date( row.minDate ) ;
    return( isNaN( d.getTime() ) ? null : d ) ;
  } ,

  /**
   * Divisas en las que la organización tiene cuentas dadas de alta (RN-2).
   */
  async divisasConCuentas( orgId: string , tx: DBOrTx = db ): Promise< string[] > {
    const rows = await tx
      .selectDistinct( {
        currency: accounts.currency ,
      } )
      .from( accounts )
      .where( cuentaDeLaOrg( orgId ) ) ;

    return( rows.map( ( r ) => { return( r.currency ) ; } ).filter( Boolean ) ) ;
  } ,

  /**
   * Divisa con más movimientos en el libro diario para desempate de divisa por defecto (RN-2).
   */
  async divisaConMasMovimientos( orgId: string , tx: DBOrTx = db ): Promise< string | null > {
    const [ row ] = await tx
      .select( {
        currency: ledgerEntries.currency ,
        conteo:   sql< string >`COUNT(*)` ,
      } )
      .from( ledgerEntries )
      .innerJoin( ledgerTransactions , eq( ledgerEntries.transactionId , ledgerTransactions.id ) )
      .where( eq( ledgerTransactions.organizationId , orgId ) )
      .groupBy( ledgerEntries.currency )
      .orderBy( desc( sql`COUNT(*)` ) )
      .limit( 1 ) ;

    return( row?.currency ?? null ) ;
  } ,

  /**
   * Saldos a hoy de cuentas de activo y pasivo para una divisa (RN-15).
   * Notar que en la convención contable del motor, los pasivos se guardan con signo negativo (patterns.md §8).
   */
  async saldosDeHoy(
    orgId: string ,
    currency: string ,
    tx: DBOrTx = db
  ): Promise< { activos: number ; pasivos: number } > {
    const [ row ] = await tx
      .select( {
        activos: sql< string >`COALESCE(SUM(CASE WHEN ${accounts.type} = 'asset' THEN ${accounts.balance} ELSE 0 END), 0)` ,
        pasivos: sql< string >`COALESCE(SUM(CASE WHEN ${accounts.type} = 'liability' THEN ${accounts.balance} ELSE 0 END), 0)` ,
      } )
      .from( accounts )
      .where(
        and(
          cuentaDeLaOrg( orgId ) ,
          eq( accounts.currency       , currency ) ,
          inArray( accounts.type      , [ "asset" , "liability" ] )
        )
      ) ;

    return( {
      activos: Number( row?.activos ?? 0 ) ,
      pasivos: Number( row?.pasivos ?? 0 ) ,
    } ) ;
  } ,
} ;
