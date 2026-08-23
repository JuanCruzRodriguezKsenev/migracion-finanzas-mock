/**
 * @file dashboardMetrics.ts
 * Utilidades para calcular métricas del dashboard desde datos contables reales.
 */

// Feature: Accounting
import { TransactionWithEntries } from "../repositories/ledgerRepository" ;
import { Account , MonthlySummary } from "../types" ;

/**
 * Formatea centavos a string de moneda.
 * Ejemplo: 1425000 → "$14,250.00"
 */
export function formatCents( cents: number , currency: string = "ARS" ): string {
  const amount = ( cents / 100 ) ;
  const prefix = amount < 0 ? "-$" : "$" ;
  return( `${prefix}${Math.abs( amount ).toLocaleString( "es-AR" , {minimumFractionDigits: 2 , maximumFractionDigits: 2} )}` ) ;
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
  transactions:  TransactionWithEntries[] ,
  accounts:      Account[] ,
  referenceDate?: Date
): number {
  const revenueIds = new Set( accounts.filter( ( a ) => a.type === "revenue" ).map( ( a ) => a.id ) ) ;
  const now = referenceDate || new Date() ;

  return( transactions
    .filter( ( tx ) => {
      const d = new Date( tx.createdAt ) ;
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
  transactions:  TransactionWithEntries[] ,
  accounts:      Account[] ,
  referenceDate?: Date
): number {
  const expenseIds = new Set( accounts.filter( ( a ) => a.type === "expense" ).map( ( a ) => a.id ) ) ;
  const now = referenceDate || new Date() ;

  return( transactions
    .filter( ( tx ) => {
      const d = new Date( tx.createdAt ) ;
      return( (d.getMonth() === now.getMonth()) && (d.getFullYear() === now.getFullYear()) ) ;
    } )
    .flatMap( ( tx ) => tx.entries )
    .filter( ( e ) => expenseIds.has( e.accountId ) )
    .reduce( ( sum , e ) => sum + e.debit , 0 ) ) ;
}

/**
 * Genera datos para el sparkline: balance total de los últimos N meses.
 * Utiliza los saldos consolidados de los resúmenes mensuales y el balance consolidado actual.
 * Devuelve un array de N números (uno por mes, del más antiguo al más reciente).
 */
export function calcularSparklineBalance(
  monthlySummaries: MonthlySummary[] ,
  accounts:         Account[] ,
  meses:            number = 6
): number[] {
  const actualBalance = calcularBalanceTotal( accounts ) ;
  
  const historico = [ ...monthlySummaries ]
    .slice( 0 , meses - 1 )
    .reverse() ;

  const serie = historico.map( ( ms ) => ms.balanceSnapshot / 100 ) ;
  serie.push( actualBalance / 100 ) ;

  while( serie.length < meses ) {
    serie.unshift( 0 ) ;
  }

  return( serie ) ;
}

/**
 * Calcula la tendencia de una tarjeta basándose directamente en los dos últimos
 * puntos del Sparkline visual correspondiente, garantizando consistencia absoluta.
 *
 * @param sparklineData - Array de valores que alimentará al gráfico.
 * @param isInverted - Si es verdadero, el incremento se considera un cambio negativo.
 */
export function calcularTendenciaDesdeSparkline(
  sparklineData: number[] ,
  isInverted:    boolean = false
): { value: string ; isPositive: boolean ; isRising: boolean } {
  if( !sparklineData || ( sparklineData.length < 2 ) ) {
    return( {value: "0.0%" , isPositive: !isInverted , isRising: true} ) ;
  }

  const actual   = sparklineData[sparklineData.length - 1] ;
  const anterior = sparklineData[sparklineData.length - 2] ;

  // Manejo seguro si no hay datos históricos anteriores (cero de relleno en el Sparkline)
  if( anterior === 0 ) {
    const isRising = ( actual > 0 ) ;
    return( {
      value:      actual > 0 ? "100.0%" : "0.0%" ,
      isPositive: isInverted ? !isRising : isRising ,
      isRising
    } ) ;
  }

  const pct = ( ((actual - anterior) / Math.abs( anterior )) * 100 ) ;
  const isRising   = ( pct >= 0 ) ;
  const isPositive = isInverted ? ( pct <= 0 ) : ( pct >= 0 ) ;

  return( {
    value:      `${Math.abs( pct ).toFixed( 1 )}%` ,
    isPositive ,
    isRising
  } ) ;
}

/**
 * Genera datos para el sparkline de ingresos de los últimos N meses.
 */
export function calcularSparklineIngresos(
  monthlySummaries: MonthlySummary[] ,
  ingresosMesActual: number ,
  meses:             number = 6
): number[] {
  const historico = [ ...monthlySummaries ]
    .slice( 0 , meses - 1 )
    .reverse() ;

  const serie = historico.map( ( ms ) => ms.totalRevenue / 100 ) ;
  serie.push( ingresosMesActual / 100 ) ;

  while( serie.length < meses ) {
    serie.unshift( 0 ) ;
  }

  return( serie ) ;
}

/**
 * Genera datos para el sparkline de gastos de los últimos N meses.
 */
export function calcularSparklineGastos(
  monthlySummaries: MonthlySummary[] ,
  gastosMesActual:  number ,
  meses:            number = 6
): number[] {
  const historico = [ ...monthlySummaries ]
    .slice( 0 , meses - 1 )
    .reverse() ;

  const serie = historico.map( ( ms ) => ms.totalExpense / 100 ) ;
  serie.push( gastosMesActual / 100 ) ;

  while( serie.length < meses ) {
    serie.unshift( 0 ) ;
  }

  return( serie ) ;
}

/**
 * Genera datos para el sparkline de ahorro neto de los últimos N meses.
 */
export function calcularSparklineAhorro(
  monthlySummaries: MonthlySummary[] ,
  ahorroMesActual:  number ,
  meses:            number = 6
): number[] {
  const historico = [ ...monthlySummaries ]
    .slice( 0 , meses - 1 )
    .reverse() ;

  const serie = historico.map( ( ms ) => ( ms.totalRevenue - ms.totalExpense ) / 100 ) ;
  serie.push( ahorroMesActual / 100 ) ;

  while( serie.length < meses ) {
    serie.unshift( 0 ) ;
  }

  return( serie ) ;
}
