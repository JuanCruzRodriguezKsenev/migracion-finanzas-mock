/**
 * @file monthlySummaryService.ts
 * Servicio para derivar y rellenar resúmenes mensuales a partir del libro mayor contable.
 */
// Librerías externas
import { eq , and , gte , lte , asc , sql } from "drizzle-orm" ;

// Shared
import { Result , ok , fail } from "@/shared/lib/result" ;
import { db , DBOrTx }        from "@/shared/db/client" ;
import { logger }             from "@/shared/lib/logger" ;

// Feature: Accounting
import { monthlySummaryRepository }                     from "../repositories/monthlySummaryRepository" ;
import { ledgerTransactions , ledgerEntries , accounts } from "../schema.db" ;
import { InsertMonthlySummary }                          from "../types" ;


/**
 * Deriva el resumen de un mes cerrado a partir del libro mayor.
 *
 * No lee `accounts.balance`: ese es el saldo de hoy. Reconstruye el cierre del mes sumando los
 * asientos cuya transacción ocurrió hasta el último instante de ese mes.
 *
 * @param organizationId - Identificador de la organización (tenant).
 * @param year - Año a derivar.
 * @param month - Mes a derivar (0-indexed, 0 = Enero ... 11 = Diciembre).
 * @param tx - Conexión o transacción de base de datos activa.
 * @returns Datos del resumen mensual calculados listos para insertar o actualizar.
 */
export async function derivarResumenDeMes(
  organizationId: string ,
  year:           number ,
  month:          number ,
  tx:             DBOrTx = db
): Promise< InsertMonthlySummary > {
  const startOfMonth = new Date( year , month , 1 , 0 , 0 , 0 , 0 ) ;
  const endOfMonth   = new Date( year , month + 1 , 0 , 23 , 59 , 59 , 999 ) ;

  // 1. Flujos mensuales: Ingresos y Gastos del período acotado [startOfMonth, endOfMonth]
  const [ monthlyFlows ] = await tx
    .select( {
      revenue: sql< string >`COALESCE(SUM(CASE WHEN ${accounts.type} = 'revenue' THEN (${ledgerEntries.credit} - ${ledgerEntries.debit}) ELSE 0 END), 0)` ,
      expense: sql< string >`COALESCE(SUM(CASE WHEN ${accounts.type} = 'expense' THEN (${ledgerEntries.debit} - ${ledgerEntries.credit})  ELSE 0 END), 0)` ,
    } )
    .from( ledgerEntries )
    .innerJoin( ledgerTransactions , eq( ledgerEntries.transactionId , ledgerTransactions.id ) )
    .innerJoin( accounts           , eq( ledgerEntries.accountId , accounts.id ) )
    .where(
      and(
        eq( ledgerTransactions.organizationId , organizationId ) ,
        eq( accounts.organizationId , organizationId ) ,
        gte( ledgerTransactions.occurredAt , startOfMonth ) ,
        lte( ledgerTransactions.occurredAt , endOfMonth )
      )
    ) ;

  // 2. Saldos acumulados históricos hasta el instante de cierre endOfMonth (sin piso)
  const [ snapshots ] = await tx
    .select( {
      assets:      sql< string >`COALESCE(SUM(CASE WHEN ${accounts.type} = 'asset'     THEN (${ledgerEntries.debit} - ${ledgerEntries.credit}) ELSE 0 END), 0)` ,
      liabilities: sql< string >`COALESCE(SUM(CASE WHEN ${accounts.type} = 'liability' THEN (${ledgerEntries.debit} - ${ledgerEntries.credit}) ELSE 0 END), 0)` ,
    } )
    .from( ledgerEntries )
    .innerJoin( ledgerTransactions , eq( ledgerEntries.transactionId , ledgerTransactions.id ) )
    .innerJoin( accounts           , eq( ledgerEntries.accountId , accounts.id ) )
    .where(
      and(
        eq( ledgerTransactions.organizationId , organizationId ) ,
        eq( accounts.organizationId , organizationId ) ,
        lte( ledgerTransactions.occurredAt , endOfMonth )
      )
    ) ;

  const totalRevenue        = Number( monthlyFlows?.revenue     || 0 ) ;
  const totalExpense        = Number( monthlyFlows?.expense     || 0 ) ;
  const balanceSnapshot     = Number( snapshots?.assets         || 0 ) ;
  const assetsSnapshot      = balanceSnapshot ;
  const liabilitiesSnapshot = Number( snapshots?.liabilities    || 0 ) ;

  return( {
    organizationId ,
    year ,
    month ,
    totalRevenue ,
    totalExpense ,
    balanceSnapshot ,
    assetsSnapshot ,
    liabilitiesSnapshot ,
  } ) ;
}

/**
 * Rellena los resúmenes de todos los meses cerrados que falten, desde el primer asiento
 * de la organización hasta el mes anterior al actual.
 *
 * @param organizationId - Identificador de la organización.
 * @param referenceDate - Fecha de referencia para definir el mes actual (por defecto hoy).
 * @returns Result con la cantidad de resúmenes escritos.
 */
export async function rellenarResumenesFaltantes(
  organizationId: string ,
  referenceDate:  Date = new Date()
): Promise< Result< number , string > > {
  try {
    const [ earliestTx ] = await db
      .select( { occurredAt: ledgerTransactions.occurredAt } )
      .from( ledgerTransactions )
      .where( eq( ledgerTransactions.organizationId , organizationId ) )
      .orderBy( asc( ledgerTransactions.occurredAt ) )
      .limit( 1 ) ;

    if( !earliestTx || !earliestTx.occurredAt ) {
      return( ok( 0 ) ) ;
    }

    const endTargetDate = new Date( referenceDate.getFullYear() , referenceDate.getMonth() - 1 , 1 ) ;
    const endYear       = endTargetDate.getFullYear() ;
    const endMonth      = endTargetDate.getMonth() ;

    const startYear  = earliestTx.occurredAt.getFullYear() ;
    const startMonth = earliestTx.occurredAt.getMonth() ;

    if( ( startYear > endYear ) || ( ( startYear === endYear ) && ( startMonth > endMonth ) ) ) {
      return( ok( 0 ) ) ;
    }

    let count = 0 ;
    let iterYear  = startYear ;
    let iterMonth = startMonth ;

    while( ( iterYear < endYear ) || ( ( iterYear === endYear ) && ( iterMonth <= endMonth ) ) ) {
      const summaryData = await derivarResumenDeMes( organizationId , iterYear , iterMonth ) ;
      await monthlySummaryRepository.upsert( summaryData ) ;
      count++ ;

      iterMonth++ ;
      if( iterMonth > 11 ) {
        iterMonth = 0 ;
        iterYear++ ;
      }
    }

    return( ok( count ) ) ;
  } catch( error ) {
    logger.error( "Error al rellenar resúmenes mensuales faltantes." , {
      organizationId ,
      error: String( error ) ,
    } ) ;
    return( fail( "Error al rellenar los resúmenes mensuales en el servidor." ) ) ;
  }
}
