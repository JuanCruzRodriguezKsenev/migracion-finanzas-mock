/**
 * @file page.tsx
 * Página de inicio (Dashboard) — conectada a datos reales de la DB.
 */
// Librerías externas
import Link from "next/link" ;

// Shared
import { MetricsSection } from "@/shared/ui/layout/MetricsSection/MetricsSection" ;
import { Sparkline }      from "@/shared/ui/display/RechartsSparkline/Sparkline" ;
import { EmptyState }     from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { MetricCard }     from "@/shared/ui/MetricCard/MetricCard" ;
import { Button }         from "@/shared/ui/display/Button/Button" ;
import { getDictionary }  from "@/shared/lib/dictionary" ;
import styles             from "./page.module.css" ;

// Actions
import {
  getTransactionsAction ,
  getAccountsAction ,
  getMonthlySummariesAction
} from "@/features/accounting/actions/accountingActions" ;

// Utils
import {
  formatCents ,
  calcularBalanceTotal ,
  calcularIngresosMes ,
  calcularGastosMes ,
  calcularSparklineBalance ,
  calcularSparklineIngresos ,
  calcularSparklineGastos ,
  calcularSparklineAhorro ,
  calcularTendenciaDesdeSparkline
} from "@/features/accounting/utils/dashboardMetrics" ;

// Feature: Notifications
import { DashboardAlerts } from "@/features/notifications/components/DashboardAlerts" ;


interface HomePageProps {
  params:       Promise< {lang: string} > ;
  searchParams: Promise< {month?: string} > ;
}

export default async function HomePage( {params , searchParams}: HomePageProps ) {
  const { lang }  = await params ;
  const { month } = await searchParams ;
  const dict      = await getDictionary( lang ) ;

  // ── Calcular rango de fecha para consultas ──────────────────────────────────
  const ahora = new Date() ;
  let fromDate = new Date( ahora.getFullYear() , ahora.getMonth() , 1 , 0 , 0 , 0 ) ;
  let toDate   = new Date( ahora.getFullYear() , ahora.getMonth() + 1 , 0 , 23 , 59 , 59 ) ;

  if( month ) {
    const parts = month.split( "-" ) ;
    const y     = Number( parts[0] ) ;
    const m     = Number( parts[1] ) ;
    fromDate = new Date( y , m - 1 , 1 , 0 , 0 , 0 ) ;
    toDate   = new Date( y , m , 0 , 23 , 59 , 59 ) ;
  }

  // ── Obtener datos reales de la DB (Optimizado) ─────────────────────────────
  const [ accountsResult , monthlySummariesResult , transactionsResult ] = await Promise.all( [
    getAccountsAction() ,
    getMonthlySummariesAction( 12 , fromDate.getFullYear() , fromDate.getMonth() + 1 ) ,
    getTransactionsAction( {fromDate , toDate} )
  ] ) ;

  // Si hay error, usar valores vacíos
  const accounts         = accountsResult.success         ? accountsResult.value         : [] ;
  const monthlySummaries = monthlySummariesResult.success ? monthlySummariesResult.value : [] ;
  const transactions     = transactionsResult.success     ? transactionsResult.value     : [] ;

  // ── Determinar si es un mes histórico cerrado o mes activo ─────────────────
  const selectedYear  = fromDate.getFullYear() ;
  const selectedMonth = fromDate.getMonth() ; // 0-indexed en JS

  const selectedSummary = monthlySummaries.find(
    ( s ) => (s.year === selectedYear) && (s.month === selectedMonth)
  ) ;

  // Definir clave del mes actual calendario
  const currentMonthKey = `${ahora.getFullYear()}-${String( ahora.getMonth() + 1 ).padStart( 2 , "0" )}` ;
  const isCurrentMonth  = !month || (month === currentMonthKey) ;

  let ingresosMes:           number ;
  let gastosMes:             number ;
  let ahorro:                number ;
  let liquidezTotal:         number ;
  let sparklineDataBalance:  number[] ;
  let sparklineDataIngresos: number[] ;
  let sparklineDataGastos:   number[] ;
  let sparklineDataAhorro:   number[] ;

  if( selectedSummary ) {
    // Mes cerrado: Usar datos consolidados del resumen mensual
    ingresosMes   = selectedSummary.totalRevenue ;
    gastosMes     = selectedSummary.totalExpense ;
    ahorro        = ( ingresosMes - gastosMes ) ;
    liquidezTotal = selectedSummary.balanceSnapshot ;

    // Generar sparklines directamente de la serie temporal obtenida
    sparklineDataBalance  = monthlySummaries.map( ( s ) => s.balanceSnapshot / 100 ).reverse() ;
    sparklineDataIngresos = monthlySummaries.map( ( s ) => s.totalRevenue / 100 ).reverse() ;
    sparklineDataGastos   = monthlySummaries.map( ( s ) => s.totalExpense / 100 ).reverse() ;
    sparklineDataAhorro   = monthlySummaries.map( ( s ) => ( s.totalRevenue - s.totalExpense ) / 100 ).reverse() ;

    // Rellenar con ceros a la izquierda para garantizar siempre exactamente 12 puntos en pantalla
    while( sparklineDataBalance.length < 12 ) { sparklineDataBalance.unshift( 0 ) ; }
    while( sparklineDataIngresos.length < 12 ) { sparklineDataIngresos.unshift( 0 ) ; }
    while( sparklineDataGastos.length < 12 ) { sparklineDataGastos.unshift( 0 ) ; }
    while( sparklineDataAhorro.length < 12 ) { sparklineDataAhorro.unshift( 0 ) ; }
  } else if( isCurrentMonth ) {
    // Mes activo o sin resumen: Calcular dinámicamente desde las cuentas y transacciones diarias
    const balanceTotal = calcularBalanceTotal( accounts ) ;
    ingresosMes   = calcularIngresosMes( transactions , accounts , fromDate ) ;
    gastosMes     = calcularGastosMes( transactions , accounts , fromDate ) ;
    ahorro        = ( ingresosMes - gastosMes ) ;
    liquidezTotal = balanceTotal ;

    // Utilizar las funciones helpers que anexan el mes actual al final
    sparklineDataBalance  = calcularSparklineBalance( monthlySummaries , accounts , 12 ) ;
    sparklineDataIngresos = calcularSparklineIngresos( monthlySummaries , ingresosMes , 12 ) ;
    sparklineDataGastos   = calcularSparklineGastos( monthlySummaries , gastosMes , 12 ) ;
    sparklineDataAhorro   = calcularSparklineAhorro( monthlySummaries , ahorro , 12 ) ;
  } else {
    // Mes pasado sin registros en la base de datos: Mostrar todo en cero de forma coherente
    ingresosMes   = 0 ;
    gastosMes     = 0 ;
    ahorro        = 0 ;
    liquidezTotal = 0 ;

    // Inicializar sparklines vacíos de 12 puntos en cero
    sparklineDataBalance  = Array( 12 ).fill( 0 ) ;
    sparklineDataIngresos = Array( 12 ).fill( 0 ) ;
    sparklineDataGastos   = Array( 12 ).fill( 0 ) ;
    sparklineDataAhorro   = Array( 12 ).fill( 0 ) ;
  }

  // ── Calcular tendencias DIRECTAMENTE sobre los datos visuales del Sparkline ──
  const tendenciaBalance  = calcularTendenciaDesdeSparkline( sparklineDataBalance ) ;
  const tendenciaIngresos = calcularTendenciaDesdeSparkline( sparklineDataIngresos ) ;
  const tendenciaGastos   = calcularTendenciaDesdeSparkline( sparklineDataGastos , true ) ; // Invertido
  const tendenciaAhorro   = calcularTendenciaDesdeSparkline( sparklineDataAhorro ) ;

  // ── Colores dinámicos para los gráficos de área ─────────────────────────────
  const colorIngresos     = tendenciaIngresos.isPositive ? "var(--color-success)" : "var(--color-danger)" ;
  const colorGastos       = tendenciaGastos.isPositive ? "var(--color-success)" : "var(--color-danger)" ;
  const colorAhorro       = tendenciaAhorro.isPositive ? "var(--color-purple)" : "var(--color-danger)" ;

  // ── Iconos SVG ────────────────────────────────────────────────────────────
  const iconoIngresos = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  ) ;

  const iconoEgresos = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="7" x2="17" y2="17" />
      <polyline points="17 7 17 17 7 17" />
    </svg>
  ) ;

  const iconoAhorro = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ) ;

  if( accounts.length === 0 ) {
    return(
      <div className={styles.container}>
        <DashboardAlerts lang={lang} />
        <EmptyState
          title={dict.dashboard.emptyStateTitle}
          description={dict.dashboard.emptyStateDescription}
          action={
            <Link href={`/${lang}/accounts`}>
              <Button variant="primary">{ dict.accountsPage.btnCreate }</Button>
            </Link>
          }
        />
      </div>
    ) ;
  }

  return(
    <div className={styles.container}>
      <DashboardAlerts lang={lang} />
      <MetricsSection
        allowVisibilityToggle={true}
        hero={{
          label:         dict.dashboard.balanceLabel ,
          value:         formatCents( liquidezTotal ) ,
          sparklineData: sparklineDataBalance.length >= 2 ? sparklineDataBalance : undefined ,
          lang:          lang ,
          isInverted:    false ,
          trend:         {
            value:      tendenciaBalance.value ,
            isPositive: tendenciaBalance.isPositive ,
            isRising:   tendenciaBalance.isRising ,
            label:      dict.dashboard.savingTrend
          } ,
          referenceDate: fromDate
        }}
      >
        {/* Tarjeta 1: Ingresos */}
        <MetricCard
          title={dict.dashboard.incomeLabel}
          value={formatCents( ingresosMes )}
          trend={{
            value:      tendenciaIngresos.value ,
            isPositive: tendenciaIngresos.isPositive ,
            isRising:   tendenciaIngresos.isRising ,
            label:      dict.dashboard.savingTrend
          }}
          icon={iconoIngresos}
          iconBg="rgba(5, 150, 105, 0.12)"
          iconColor="var(--color-success)"
          sparkline={
            <Sparkline
              data={sparklineDataIngresos.length >= 2 ? sparklineDataIngresos : [ 0 , 0 ]}
              color={colorIngresos}
              height={ 26 }
              lang={lang}
              referenceDate={fromDate}
            />
          }
        />

        {/* Tarjeta 2: Gastos */}
        <MetricCard
          title={dict.dashboard.expenseLabel}
          value={formatCents( gastosMes )}
          trend={{
            value:      tendenciaGastos.value ,
            isPositive: tendenciaGastos.isPositive ,
            isRising:   tendenciaGastos.isRising ,
            label:      dict.dashboard.savingTrend
          }}
          isDanger={ gastosMes > ingresosMes }
          icon={iconoEgresos}
          iconBg="rgba(225, 29, 72, 0.12)"
          iconColor="var(--color-danger)"
          sparkline={
            <Sparkline
              data={sparklineDataGastos.length >= 2 ? sparklineDataGastos : [ 0 , 0 ]}
              color={colorGastos}
              height={ 26 }
              lang={lang}
              isInverted={true}
              referenceDate={fromDate}
            />
          }
        />

        {/* Tarjeta 3: Ahorro Neto */}
        <MetricCard
          title={dict.dashboard.savingsLabel}
          value={formatCents( ahorro )}
          trend={{
            value:      tendenciaAhorro.value ,
            isPositive: tendenciaAhorro.isPositive ,
            isRising:   tendenciaAhorro.isRising ,
            label:      dict.dashboard.savingTrend
          }}
          icon={iconoAhorro}
          iconBg="rgba(124, 58, 237, 0.12)"
          iconColor="var(--color-purple)"
          sparkline={
            <Sparkline
              data={sparklineDataAhorro.length >= 2 ? sparklineDataAhorro : [ 0 , 0 ]}
              color={colorAhorro}
              height={ 26 }
              lang={lang}
              referenceDate={fromDate}
            />
          }
        />
      </MetricsSection>
    </div>
  ) ;
}
