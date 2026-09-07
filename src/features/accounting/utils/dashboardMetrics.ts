/**
 * @file dashboardMetrics.ts
 * Utilidades para calcular métricas del dashboard desde datos contables reales.
 * Genera series etiquetadas cronológicamente para Sparklines y tendencias consistentes.
 */

// Shared
import {
  SparklinePoint ,
  calcularCambioPorcentual
} from "@/shared/ui/display/RechartsSparkline/sparklineUtils" ;

export type { SparklinePoint } ;
export { calcularCambioPorcentual } ;

// Feature: Accounting
import { TransactionWithEntries } from "../repositories/ledgerRepository" ;
import { Account , MonthlySummary } from "../types" ;

/**
 * Formatea centavos a string de moneda.
 * Ejemplo: 1425000 → "$14,250.00"
 */
export function formatCents( cents: number ): string {
  const amount = ( cents / 100 ) ;
  const prefix = amount < 0 ? "-$" : "$" ;
  return( `${prefix}${Math.abs( amount ).toLocaleString( "es-AR" , {minimumFractionDigits: 2 , maximumFractionDigits: 2} )}` ) ;
}

/**
 * Convierte un año y un mes (0-indexed de 0 a 11) a la clave canónica "YYYY-MM".
 */
export function formatMonthKey( year: number , month: number ): string {
  return( `${year}-${String( month + 1 ).padStart( 2 , "0" )}` ) ;
}

/**
 * Calcula el balance total sumando todas las cuentas de tipo 'asset'.
 */
export function calcularBalanceTotal( accounts: Account[] ): number {
  return( accounts
    .filter( ( a ) => a.type === "asset" )
    .reduce( ( sum , a ) => sum + a.balance , 0 ) ) ;
}

/**
 * Calcula el total de ingresos del mes actual.
 * Busca transacciones donde haya créditos en cuentas de tipo 'revenue'.
 */
export function calcularIngresosMes(
  transactions:   TransactionWithEntries[] ,
  accounts:       Account[] ,
  referenceDate?: Date
): number {
  const revenueIds = new Set( accounts.filter( ( a ) => a.type === "revenue" ).map( ( a ) => a.id ) ) ;
  const now = referenceDate || new Date() ;

  return( transactions
    .filter( ( tx ) => {
      const d = new Date( tx.occurredAt || tx.createdAt ) ;
      return( (d.getMonth() === now.getMonth()) && (d.getFullYear() === now.getFullYear()) ) ;
    } )
    .flatMap( ( tx ) => tx.entries )
    .filter( ( e ) => revenueIds.has( e.accountId ) )
    .reduce( ( sum , e ) => sum + e.credit , 0 ) ) ;
}

/**
 * Calcula el total de gastos del mes actual.
 * Busca transacciones donde haya débitos en cuentas de tipo 'expense'.
 */
export function calcularGastosMes(
  transactions:   TransactionWithEntries[] ,
  accounts:       Account[] ,
  referenceDate?: Date
): number {
  const expenseIds = new Set( accounts.filter( ( a ) => a.type === "expense" ).map( ( a ) => a.id ) ) ;
  const now = referenceDate || new Date() ;

  return( transactions
    .filter( ( tx ) => {
      const d = new Date( tx.occurredAt || tx.createdAt ) ;
      return( (d.getMonth() === now.getMonth()) && (d.getFullYear() === now.getFullYear()) ) ;
    } )
    .flatMap( ( tx ) => tx.entries )
    .filter( ( e ) => expenseIds.has( e.accountId ) )
    .reduce( ( sum , e ) => sum + e.debit , 0 ) ) ;
}

/**
 * Genera datos para el sparkline: balance total de los últimos N meses.
 * Cada punto lleva su clave de mes "YYYY-MM" explícita para evitar desfasajes en tooltips.
 */
export function calcularSparklineBalance(
  monthlySummaries: MonthlySummary[] ,
  accounts:         Account[] ,
  limiteMeses:      number = 12 ,
  referenceDate?:   Date
): SparklinePoint[] {
  const actualBalance = calcularBalanceTotal( accounts ) ;
  const ref           = referenceDate || new Date() ;
  const currentKey    = formatMonthKey( ref.getFullYear() , ref.getMonth() ) ;

  const historico = [ ...monthlySummaries ]
    .filter( ( ms ) => formatMonthKey( ms.year , ms.month ) < currentKey )
    .sort( ( a , b ) => ( a.year !== b.year ? a.year - b.year : a.month - b.month ) )
    .slice( -(limiteMeses - 1) ) ;

  const points: SparklinePoint[] = historico.map( ( ms ) => ( {
    value:    ( ms.balanceSnapshot / 100 ) ,
    monthKey: formatMonthKey( ms.year , ms.month )
  } ) ) ;

  points.push( {
    value:    ( actualBalance / 100 ) ,
    monthKey: currentKey
  } ) ;

  return( points ) ;
}

/**
 * Calcula la tendencia de una tarjeta basándose en los dos últimos puntos de la serie.
 * Utiliza exactamente la misma lógica que el tooltip del Sparkline (sin porcentajes inventados).
 */
export function calcularTendenciaDesdeSparkline(
  points?:    SparklinePoint[] ,
  isInverted: boolean = false
): { value: string ; isPositive: boolean ; isRising: boolean } | undefined {
  if( !points || ( points.length < 2 ) ) {
    return( undefined ) ;
  }

  const pLast    = points[points.length - 1] ;
  const pPrev    = points[points.length - 2] ;
  const actual   = pLast.value ;
  const anterior = pPrev.value ;
  const pct      = calcularCambioPorcentual( actual , anterior ) ;

  if( pct === null ) {
    return( undefined ) ;
  }

  const isRising   = ( pct >= 0 ) ;
  const isPositive = isInverted ? ( pct <= 0 ) : ( pct >= 0 ) ;

  return( {
    value:      `${Math.abs( pct ).toFixed( 1 )}%` ,
    isPositive ,
    isRising
  } ) ;
}

/**
 * Genera datos para el sparkline de ingresos de los últimos N meses con sus claves de mes.
 */
export function calcularSparklineIngresos(
  monthlySummaries:  MonthlySummary[] ,
  ingresosMesActual: number ,
  limiteMeses:       number = 12 ,
  referenceDate?:    Date
): SparklinePoint[] {
  const ref        = referenceDate || new Date() ;
  const currentKey = formatMonthKey( ref.getFullYear() , ref.getMonth() ) ;

  const historico = [ ...monthlySummaries ]
    .filter( ( ms ) => formatMonthKey( ms.year , ms.month ) < currentKey )
    .sort( ( a , b ) => ( a.year !== b.year ? a.year - b.year : a.month - b.month ) )
    .slice( -(limiteMeses - 1) ) ;

  const points: SparklinePoint[] = historico.map( ( ms ) => ( {
    value:    ( ms.totalRevenue / 100 ) ,
    monthKey: formatMonthKey( ms.year , ms.month )
  } ) ) ;

  points.push( {
    value:    ( ingresosMesActual / 100 ) ,
    monthKey: currentKey
  } ) ;

  return( points ) ;
}

/**
 * Genera datos para el sparkline de gastos de los últimos N meses con sus claves de mes.
 */
export function calcularSparklineGastos(
  monthlySummaries: MonthlySummary[] ,
  gastosMesActual:  number ,
  limiteMeses:      number = 12 ,
  referenceDate?:   Date
): SparklinePoint[] {
  const ref        = referenceDate || new Date() ;
  const currentKey = formatMonthKey( ref.getFullYear() , ref.getMonth() ) ;

  const historico = [ ...monthlySummaries ]
    .filter( ( ms ) => formatMonthKey( ms.year , ms.month ) < currentKey )
    .sort( ( a , b ) => ( a.year !== b.year ? a.year - b.year : a.month - b.month ) )
    .slice( -(limiteMeses - 1) ) ;

  const points: SparklinePoint[] = historico.map( ( ms ) => ( {
    value:    ( ms.totalExpense / 100 ) ,
    monthKey: formatMonthKey( ms.year , ms.month )
  } ) ) ;

  points.push( {
    value:    ( gastosMesActual / 100 ) ,
    monthKey: currentKey
  } ) ;

  return( points ) ;
}

/**
 * Genera datos para el sparkline de ahorro neto de los últimos N meses con sus claves de mes.
 */
export function calcularSparklineAhorro(
  monthlySummaries: MonthlySummary[] ,
  ahorroMesActual:  number ,
  limiteMeses:      number = 12 ,
  referenceDate?:   Date
): SparklinePoint[] {
  const ref        = referenceDate || new Date() ;
  const currentKey = formatMonthKey( ref.getFullYear() , ref.getMonth() ) ;

  const historico = [ ...monthlySummaries ]
    .filter( ( ms ) => formatMonthKey( ms.year , ms.month ) < currentKey )
    .sort( ( a , b ) => ( a.year !== b.year ? a.year - b.year : a.month - b.month ) )
    .slice( -(limiteMeses - 1) ) ;

  const points: SparklinePoint[] = historico.map( ( ms ) => ( {
    value:    ( ( ms.totalRevenue - ms.totalExpense ) / 100 ) ,
    monthKey: formatMonthKey( ms.year , ms.month )
  } ) ) ;

  points.push( {
    value:    ( ahorroMesActual / 100 ) ,
    monthKey: currentKey
  } ) ;

  return( points ) ;
}
