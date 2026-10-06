/**
 * @file StatsContainer.tsx
 * Contenedor principal cliente para la pantalla de Estadísticas (/reports).
 * Compone métricas, gráfico de tendencia, desglose por categoría, top de gastos y patrimonio neto (RFC 027 §6).
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import { formatMonthKeyLabel } from "@/shared/ui/display/RechartsSparkline/sparklineUtils" ;
import { MetricsSection }      from "@/shared/ui/layout/MetricsSection/MetricsSection" ;
import { Sparkline }           from "@/shared/ui/display/RechartsSparkline/Sparkline" ;
import { TrendChart }          from "@/shared/ui/display/TrendChart/TrendChart" ;
import { formatCurrency }      from "@/shared/lib/currencyFormatter" ;
import type { getDictionary }  from "@/shared/lib/dictionary" ;
import { MetricCard }          from "@/shared/ui/MetricCard/MetricCard" ;

// Feature: Reports
import { CurrencySelector }  from "./CurrencySelector" ;
import { CategoryBreakdown } from "./CategoryBreakdown" ;
import { TopExpensesList }   from "./TopExpensesList" ;
import { NetWorthCard }      from "./NetWorthCard" ;
import { ReportData }        from "../types" ;

// Estilos
import styles from "./StatsContainer.module.css" ;

type ReportsPageDict = NonNullable< Awaited< ReturnType< typeof getDictionary > >["reportsPage"] > ;

export interface StatsContainerProps {
  reportData: ReportData ;
  dict?:      Awaited< ReturnType< typeof getDictionary > > ;
  lang?:      string ;
}

export function StatsContainer( {
  reportData ,
  dict ,
  lang = "es" ,
}: StatsContainerProps ) {
  const rDict: Partial< ReportsPageDict > = dict?.reportsPage ?? {} ;

  const locale = lang === "en" ? "en-US" : lang === "br" ? "pt-BR" : "es-AR" ;

  const { metrics , tendencia , categorias , topGastos , patrimonio , divisas , currency , monthKey , hayMovimientos } = reportData ;

  const monthLabel = formatMonthKeyLabel( monthKey , lang ) ;

  // Determinar si el período específico no tiene transacciones ni flujos
  const isPeriodEmpty = ( metrics.transacciones === 0 ) && ( metrics.ingresos.value === 0 ) && ( metrics.gastos.value === 0 ) ;

  // Formateo de métricas principales
  const ahorroNetoFormatted = formatCurrency( metrics.ahorroNeto.value , currency , locale ) ;
  const ingresosFormatted   = formatCurrency( metrics.ingresos.value , currency , locale ) ;
  const gastosFormatted     = formatCurrency( metrics.gastos.value , currency , locale ) ;

  const tasaAhorroFormatted = ( metrics.tasaAhorro.value !== null )
    ? `${metrics.tasaAhorro.value.toFixed( 1 )} %`
    : "—" ;

  const vsPrevLabel = rDict.vsLastMonth || "vs. mes anterior" ;

  // Puntos de Sparkline de ahorro neto (últimos meses)
  const sparklineAhorro = tendencia.map( ( t ) => {
    return( { value: t.ahorroNeto , monthKey: t.monthKey } ) ;
  } ) ;

  // Mapeo de datos para TrendChart
  const trendChartData = tendencia.map( ( t ) => {
    return( {
      label:              formatMonthKeyLabel( t.monthKey , lang ) ,
      ingresos:           t.ingresos ,
      gastos:             t.gastos ,
      ahorroNeto:         t.ahorroNeto ,
      patrimonioLibro:    t.patrimonioLibro ,
      formattedIngresos: formatCurrency( t.ingresos , currency , locale ) ,
      formattedGastos:   formatCurrency( t.gastos , currency , locale ) ,
    } ) ;
  } ) ;

  return(
    <div className={styles.container}>
      { /* Selector de divisa en barra superior */ }
      <div className={styles.topBar}>
        <CurrencySelector
          currencies={divisas}
          currentCurrency={currency}
          label={rDict.currencySelectorLabel || "Divisa:"}
        />
      </div>

      { /* Estado vacío del período (RN-22) */ }
      { ( !hayMovimientos || isPeriodEmpty ) ? (
        <>
          <div className={styles.emptyPeriodBanner}>
            { rDict.emptyPeriodMessage
              ? rDict.emptyPeriodMessage.replace( "{month}" , monthLabel )
              : `Sin movimientos en ${monthLabel}` }
          </div>
          <NetWorthCard
            patrimonio={patrimonio}
            currency={currency}
            lang={lang}
            title={rDict.netWorthTitle || "Patrimonio Neto"}
            asOfTodayText={rDict.asOfToday || "a hoy"}
            activosText={rDict.assetsLabel || "Activos"}
            pasivosText={rDict.liabilitiesLabel || "Pasivos"}
            cuotasText={rDict.futureInstallmentsLabel || "Cuotas por pagar"}
          />
        </>
      ) : (
        <>
          { /* Sección de 4 métricas del período + transacciones */ }
          <MetricsSection>
            { /* Tarjeta 1: Ahorro neto */ }
            <MetricCard
              title={rDict.savingsLabel || "Ahorro neto"}
              value={ahorroNetoFormatted}
              isSensitive={true}
              trend={
                ( metrics.ahorroNeto.variacionPct !== null ) ? {
                  value:      `${Math.abs( metrics.ahorroNeto.variacionPct ).toFixed( 1 )}%` ,
                  isPositive: metrics.ahorroNeto.variacionPct >= 0 ,
                  label:      vsPrevLabel ,
                } : undefined
              }
              sparkline={
                ( sparklineAhorro.length > 1 ) ? (
                  <Sparkline
                    points={sparklineAhorro}
                    color="var(--color-success, #10B981)"
                    lang={lang}
                    fullWidth={true}
                  />
                ) : undefined
              }
            />

            { /* Tarjeta 2: Ingresos */ }
            <MetricCard
              title={rDict.incomeLabel || "Ingresos"}
              value={ingresosFormatted}
              isSensitive={true}
              trend={
                ( metrics.ingresos.variacionPct !== null ) ? {
                  value:      `${Math.abs( metrics.ingresos.variacionPct ).toFixed( 1 )}%` ,
                  isPositive: metrics.ingresos.variacionPct >= 0 ,
                  label:      vsPrevLabel ,
                } : undefined
              }
            />

            { /* Tarjeta 3: Gastos */ }
            <MetricCard
              title={rDict.expenseLabel || "Gastos"}
              value={gastosFormatted}
              isSensitive={true}
              isDanger={
                ( metrics.gastos.variacionPct !== null ) ? ( metrics.gastos.variacionPct > 0 ) : false
              }
              trend={
                ( metrics.gastos.variacionPct !== null ) ? {
                  value:      `${Math.abs( metrics.gastos.variacionPct ).toFixed( 1 )}%` ,
                  isPositive: metrics.gastos.variacionPct <= 0 ,
                  isRising:   metrics.gastos.variacionPct > 0 ,
                  label:      vsPrevLabel ,
                } : undefined
              }
            />

            { /* Tarjeta 4: Tasa de ahorro */ }
            <MetricCard
              title={rDict.savingsRateLabel || "Tasa de ahorro"}
              value={tasaAhorroFormatted}
              count={
                metrics.transacciones > 0
                  ? `${metrics.transacciones} ${rDict.transactionsCountLabel || "transacciones"}`
                  : undefined
              }
              trend={
                ( metrics.tasaAhorro.deltaPP !== null ) ? {
                  value:      `${Math.abs( metrics.tasaAhorro.deltaPP ).toFixed( 1 )} pp` ,
                  isPositive: metrics.tasaAhorro.deltaPP >= 0 ,
                  label:      vsPrevLabel ,
                } : undefined
              }
            />
          </MetricsSection>

          { /* Gráfico de tendencia de 12 meses o aviso de historia insuficiente */ }
          { ( tendencia.length > 1 ) ? (
            <TrendChart
              data={trendChartData}
              title={rDict.trendTitle || "Tendencia · 12 meses"}
              ingresosLabel={rDict.incomeLabel || "Ingresos"}
              gastosLabel={rDict.expenseLabel || "Gastos"}
              ariaLabel={rDict.trendAriaLabel || "Gráfico de tendencia de ingresos y gastos de los últimos 12 meses"}
            />
          ) : (
            <div className={styles.trendTextNotice}>
              { rDict.singleMonthHistoryNotice || "Se necesita más de un mes de historia para graficar la tendencia." }
            </div>
          ) }

          { /* Desglose por categoría e interruptor Gastos/Ingresos */ }
          <CategoryBreakdown
            categorias={categorias}
            currency={currency}
            lang={lang}
            title={rDict.categoryBreakdownTitle || "Por categoría"}
            gastosText={rDict.expenseLabel || "Gastos"}
            ingresosText={rDict.incomeLabel || "Ingresos"}
            emptyText={rDict.emptyCategories || "Sin movimientos por categoría en este mes"}
            desgloseDeText={rDict.breakdownOf || "Desglose de"}
          />

          { /* Top 5 gastos */ }
          <TopExpensesList
            topGastos={topGastos}
            currency={currency}
            lang={lang}
            title={rDict.topExpensesTitle || "Top gastos"}
            emptyText={rDict.emptyTopExpenses || "Sin gastos en este período"}
          />

          { /* Patrimonio Neto de hoy */ }
          <NetWorthCard
            patrimonio={patrimonio}
            currency={currency}
            lang={lang}
            title={rDict.netWorthTitle || "Patrimonio Neto"}
            asOfTodayText={rDict.asOfToday || "a hoy"}
            activosText={rDict.assetsLabel || "Activos"}
            pasivosText={rDict.liabilitiesLabel || "Pasivos"}
            cuotasText={rDict.futureInstallmentsLabel || "Cuotas por pagar"}
          />
        </>
      ) }
    </div>
  ) ;
}
