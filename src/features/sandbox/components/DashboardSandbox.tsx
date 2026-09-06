/**
 * @file DashboardSandbox.tsx
 * Sub-sandbox interactivo para simular y testear métricas y gráficos del dashboard principal.
 */
"use client" ;

// Librerías externas
import React , { useState , useMemo } from "react" ;

// Shared
import { MetricsSection } from "@/shared/ui/layout/MetricsSection/MetricsSection" ;
import { Sparkline }      from "@/shared/ui/display/RechartsSparkline/Sparkline" ;
import { MetricCard }     from "@/shared/ui/MetricCard/MetricCard" ;
import { Card }           from "@/shared/ui/display/Card/Card" ;

// Feature: Accounting
import { formatCents , calcularTendenciaDesdeSparkline } from "@/features/accounting/utils/dashboardMetrics" ;

// Shared
import type { getDictionary } from "@/shared/lib/dictionary" ;

// Local styles
import styles from "./DashboardSandbox.module.css" ;


interface SandboxMonth {
  label:   string ;
  revenue: number ;
  expense: number ;
}

interface DashboardSandboxProps {
  dict: Awaited< ReturnType< typeof getDictionary > > ;
  lang: string ;
}

/**
 * Obtiene la secuencia de nombres de meses en el idioma actual.
 */
function getMonthsLabelSequence( length: number , langStr: string = "es" ) {
  const labels = [] ;
  const currentDate = new Date() ;
  for( let i = 0 ; i < length ; i++ ) {
    const date = new Date( currentDate.getFullYear() , currentDate.getMonth() - ( (length - 1) - i ) , 1 ) ;
    const monthStr = date.toLocaleDateString( langStr === "en" ? "en-US" : "es-ES" , {month: "short"} ) ;
    const yearStr = date.toLocaleDateString( langStr === "en" ? "en-US" : "es-ES" , {year: "2-digit"} ) ;
    const cleanMonth = monthStr.replace( "." , "" ) ;
    const formattedMonth = ( cleanMonth.charAt( 0 ).toUpperCase() + cleanMonth.slice( 1 ) ) ;
    labels.push( `${formattedMonth} ${yearStr}` ) ;
  }
  return( labels ) ;
}

/**
 * Componente de sandbox específico para las métricas del panel principal.
 */
export function DashboardSandbox( {dict , lang}: DashboardSandboxProps ) {
  // Estado para los 12 meses, inicializado de forma perezosa
  const [ months , setMonths ]                 = useState< SandboxMonth[] >( () => {
    const labels = getMonthsLabelSequence( 12 , lang ) ;
    return( labels.map( ( label , index ) => ( {
      label ,
      revenue: 4200 + ( index * 120 ) ,
      expense: 3100 + ( index * 80 )
    } ) ) ) ;
  } ) ;

  const [ selectedIndex , setSelectedIndex ]   = useState< number >( 11 ) ;
  const [ activePreset , setActivePreset ]     = useState< string >( "positivo" ) ;
  const [ limitTo6Months , setLimitTo6Months ] = useState< boolean >( false ) ;

  // Cambiar ingresos o gastos del mes seleccionado
  const handleValueChange = ( type: "revenue" | "expense" , val: number ) => {
    setActivePreset( "custom" ) ;
    const updated = [ ...months ] ;
    updated[selectedIndex] = {
      ...updated[selectedIndex] ,
      [type]: Math.max( 0 , val )
    } ;
    setMonths( updated ) ;
  } ;

  // Aplicar preset predefinido de simulación
  const applyPreset = ( presetName: string ) => {
    setActivePreset( presetName ) ;
    if( months.length === 0 ) { return ; }

    const updated = months.map( ( m , index ) => {
      let revenue = 5000 ;
      let expense = 4000 ;

      if( presetName === "positivo" ) {
        revenue = 4500 + ( index * 150 ) ;
        expense = 3200 + ( index * 80 ) ;
      } else if( presetName === "negativo" ) {
        revenue = 3500 + ( index * 80 ) ;
        expense = 4500 + ( index * 150 ) ;
      } else if( presetName === "alcista" ) {
        revenue = 3000 + ( index * 300 ) ;
        expense = 3500 + ( index * 80 ) ;
      } else if( presetName === "bajista" ) {
        revenue = 6500 - ( index * 200 ) ;
        expense = 4000 + ( index * 50 ) ;
      } else if( presetName === "volatil" ) {
        const isEven = ( index % 2 === 0 ) ;
        revenue = isEven ? 5500 : 3200 ;
        expense = isEven ? 3800 : 4200 ;
      } else if( presetName === "sobregiro" ) {
        const isCurrent = ( index === months.length - 1 ) ;
        revenue = isCurrent ? 2200 : 4800 + ( index * 50 ) ;
        expense = isCurrent ? 6200 : 3700 + ( index * 30 ) ;
      }

      return( {
        ...m ,
        revenue ,
        expense
      } ) ;
    } ) ;

    setMonths( updated ) ;
  } ;

  // ── Métricas de Simulación ──────────────────────────────────────────────────
  const metrics = useMemo( () => {
    if( months.length === 0 ) {
      return( {
        ingresosMes:           0 ,
        gastosMes:             0 ,
        ahorro:                0 ,
        liquidezTotal:         0 ,
        sparklineDataIngresos: [] ,
        sparklineDataGastos:   [] ,
        sparklineDataAhorro:   [] ,
        sparklineDataLiquidez: [] ,
        tendenciaIngresos:     {value: "0.0%" , isPositive: true , isRising: true} ,
        tendenciaGastos:       {value: "0.0%" , isPositive: true , isRising: true} ,
        tendenciaAhorro:       {value: "0.0%" , isPositive: true , isRising: true} ,
        tendenciaLiquidez:     {value: "0.0%" , isPositive: true , isRising: true}
      } ) ;
    }

    const targetMonth = months[selectedIndex] ;
    const ingresosMes = ( targetMonth.revenue * 100 ) ;
    const gastosMes   = ( targetMonth.expense * 100 ) ;
    const ahorro      = ( ingresosMes - gastosMes ) ;

    // Calcular la liquidez acumulada mes a mes
    const initialLiquidity = 15000 ;
    let runningLiquidity   = initialLiquidity ;
    const liquidityHistory = months.map( ( m ) => {
      runningLiquidity += ( m.revenue - m.expense ) ;
      return( runningLiquidity ) ;
    } ) ;

    const liquidezTotal = ( liquidityHistory[selectedIndex] * 100 ) ;

    // Obtener la porción histórica de Sparkline según el filtro (6 o 12 meses)
    const activeSlice = limitTo6Months ? months.slice( 6 ) : months ;

    const sparklineDataIngresos = activeSlice.map( ( m ) => m.revenue ) ;
    const sparklineDataGastos   = activeSlice.map( ( m ) => m.expense ) ;
    const sparklineDataAhorro   = activeSlice.map( ( m ) => m.revenue - m.expense ) ;
    const sparklineDataLiquidez = limitTo6Months ? liquidityHistory.slice( 6 ) : liquidityHistory ;

    // Slices para calcular la tendencia (siempre comparando con el mes anterior inmediato)
    const sliceTrendIngresos = months.slice( 0 , selectedIndex + 1 ).map( ( m ) => m.revenue ) ;
    const sliceTrendGastos   = months.slice( 0 , selectedIndex + 1 ).map( ( m ) => m.expense ) ;
    const sliceTrendAhorro   = months.slice( 0 , selectedIndex + 1 ).map( ( m ) => m.revenue - m.expense ) ;
    const sliceTrendLiquidez = liquidityHistory.slice( 0 , selectedIndex + 1 ) ;

    const tendenciaIngresos = calcularTendenciaDesdeSparkline( sliceTrendIngresos ) ;
    const tendenciaGastos   = calcularTendenciaDesdeSparkline( sliceTrendGastos , true ) ;
    const tendenciaAhorro   = calcularTendenciaDesdeSparkline( sliceTrendAhorro ) ;
    const tendenciaLiquidez  = calcularTendenciaDesdeSparkline( sliceTrendLiquidez ) ;

    return( {
      ingresosMes ,
      gastosMes ,
      ahorro ,
      liquidezTotal ,
      sparklineDataIngresos ,
      sparklineDataGastos ,
      sparklineDataAhorro ,
      sparklineDataLiquidez ,
      tendenciaIngresos ,
      tendenciaGastos ,
      tendenciaAhorro ,
      tendenciaLiquidez
    } ) ;
  } , [ months , selectedIndex , limitTo6Months ] ) ;

  // Colores dinámicos para los Sparklines
  const colorIngresos = metrics.tendenciaIngresos ? ( metrics.tendenciaIngresos.isPositive ? "var(--color-success)" : "var(--color-danger)" ) : "var(--color-success)" ;
  const colorGastos   = metrics.tendenciaGastos ? ( metrics.tendenciaGastos.isPositive ? "var(--color-success)" : "var(--color-danger)" ) : "var(--color-danger)" ;
  const colorAhorro   = metrics.tendenciaAhorro ? ( metrics.tendenciaAhorro.isPositive ? "var(--color-purple)" : "var(--color-danger)" ) : "var(--color-purple)" ;

  // Iconos
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

  const selectedMonth = months[selectedIndex] ;
  const isSelectedCurrent = ( selectedIndex === months.length - 1 ) ;
  const selectedSaving = selectedMonth ? ( selectedMonth.revenue - selectedMonth.expense ) : 0 ;

  return(
    <div className={styles.wrapper}>
      {/* Presets globales rápidos */}
      <div className={styles.presetsWrapper}>
        <div className={styles.presetTitle}>Presets de Simulación Completa (Aplica a los 12 meses)</div>
        <div className={styles.presetsList}>
          <button
            type="button"
            className={ `${styles.presetBtn} ${activePreset === "positivo" ? styles.presetBtnActive : ""}` }
            onClick={ () => applyPreset( "positivo" ) }
          >
            Todos Positivos
          </button>
          <button
            type="button"
            className={ `${styles.presetBtn} ${activePreset === "negativo" ? styles.presetBtnActive : ""}` }
            onClick={ () => applyPreset( "negativo" ) }
          >
            Todos Negativos
          </button>
          <button
            type="button"
            className={ `${styles.presetBtn} ${activePreset === "alcista" ? styles.presetBtnActive : ""}` }
            onClick={ () => applyPreset( "alcista" ) }
          >
            Tendencia Alcista
          </button>
          <button
            type="button"
            className={ `${styles.presetBtn} ${activePreset === "bajista" ? styles.presetBtnActive : ""}` }
            onClick={ () => applyPreset( "bajista" ) }
          >
            Tendencia Bajista
          </button>
          <button
            type="button"
            className={ `${styles.presetBtn} ${activePreset === "volatil" ? styles.presetBtnActive : ""}` }
            onClick={ () => applyPreset( "volatil" ) }
          >
            Volátil / Alternante
          </button>
          <button
            type="button"
            className={ `${styles.presetBtn} ${activePreset === "sobregiro" ? styles.presetBtnActive : ""}` }
            onClick={ () => applyPreset( "sobregiro" ) }
          >
            Sobregiro Mes Actual
          </button>
        </div>

        <div className={styles.configRow}>
          <div className={styles.toggleContainer}>
            <input
              id="limit-months-toggle"
              type="checkbox"
              className={styles.toggleInput}
              checked={limitTo6Months}
              onChange={ ( e ) => setLimitTo6Months( e.target.checked ) }
            />
            <label htmlFor="limit-months-toggle" className={styles.toggleLabel}>
              Limitar Sparkline a últimos 6 meses (como en el Dashboard original)
            </label>
          </div>
          <div className={styles.toggleLabel}>
            Sparkline: <strong>{ limitTo6Months ? "6 meses" : "12 meses" }</strong>
          </div>
        </div>
      </div>

      {/* Selector de Mes */}
      <div className={styles.selectorWrapper}>
        <div className={styles.presetTitle}>Seleccionar Mes a Editar y Visualizar:</div>
        <div className={styles.selectorList}>
          {months.map( ( m , index ) => {
            const isSelected = ( index === selectedIndex ) ;
            return(
              <button
                key={index}
                type="button"
                className={ `${styles.selectorBtn} ${isSelected ? styles.selectorBtnActive : ""}` }
                onClick={ () => setSelectedIndex( index ) }
              >
                {m.label}
              </button>
            ) ;
          } )}
        </div>
      </div>

      {/* Visualización de Tarjetas */}
      <MetricsSection
        allowVisibilityToggle={true}
        hero={{
          label:         dict.dashboard.balanceLabel ,
          value:         formatCents( metrics.liquidezTotal ) ,
          sparklineData: metrics.sparklineDataLiquidez.length >= 2 ? metrics.sparklineDataLiquidez : undefined ,
          lang:          lang ,
          isInverted:    false ,
          trend:         metrics.tendenciaLiquidez ? {
            value:      metrics.tendenciaLiquidez.value ,
            isPositive: metrics.tendenciaLiquidez.isPositive ,
            isRising:   metrics.tendenciaLiquidez.isRising ,
            label:      dict.dashboard.savingTrend
          } : undefined
        }}
      >
        {/* Tarjeta 1: Ingresos */}
        <MetricCard
          title={ `${dict.dashboard.incomeLabel} (${selectedMonth?.label || ""})` }
          value={formatCents( metrics.ingresosMes )}
          trend={metrics.tendenciaIngresos ? {
            value:      metrics.tendenciaIngresos.value ,
            isPositive: metrics.tendenciaIngresos.isPositive ,
            isRising:   metrics.tendenciaIngresos.isRising ,
            label:      dict.dashboard.savingTrend
          } : undefined}
          icon={iconoIngresos}
          iconBg="rgba(5, 150, 105, 0.12)"
          iconColor="var(--color-success)"
          sparkline={
            <Sparkline
              data={metrics.sparklineDataIngresos.length >= 2 ? metrics.sparklineDataIngresos : [ 0 , 0 ]}
              color={colorIngresos}
              height={ 26 }
              lang={lang}
            />
          }
        />

        {/* Tarjeta 2: Gastos */}
        <MetricCard
          title={ `${dict.dashboard.expenseLabel} (${selectedMonth?.label || ""})` }
          value={formatCents( metrics.gastosMes )}
          trend={metrics.tendenciaGastos ? {
            value:      metrics.tendenciaGastos.value ,
            isPositive: metrics.tendenciaGastos.isPositive ,
            isRising:   metrics.tendenciaGastos.isRising ,
            label:      dict.dashboard.savingTrend
          } : undefined}
          isDanger={ metrics.gastosMes > metrics.ingresosMes }
          icon={iconoEgresos}
          iconBg="rgba(225, 29, 72, 0.12)"
          iconColor="var(--color-danger)"
          sparkline={
            <Sparkline
              data={metrics.sparklineDataGastos.length >= 2 ? metrics.sparklineDataGastos : [ 0 , 0 ]}
              color={colorGastos}
              height={ 26 }
              lang={lang}
              isInverted={true}
            />
          }
        />

        {/* Tarjeta 3: Balance del Mes */}
        <MetricCard
          title={ `${dict.dashboard.savingsLabel} (${selectedMonth?.label || ""})` }
          value={formatCents( metrics.ahorro )}
          trend={metrics.tendenciaAhorro ? {
            value:      metrics.tendenciaAhorro.value ,
            isPositive: metrics.tendenciaAhorro.isPositive ,
            isRising:   metrics.tendenciaAhorro.isRising ,
            label:      dict.dashboard.savingTrend
          } : undefined}
          icon={iconoAhorro}
          iconBg="rgba(124, 58, 237, 0.12)"
          iconColor="var(--color-purple)"
          sparkline={
            <Sparkline
              data={metrics.sparklineDataAhorro.length >= 2 ? metrics.sparklineDataAhorro : [ 0 , 0 ]}
              color={colorAhorro}
              height={ 26 }
              lang={lang}
            />
          }
        />
      </MetricsSection>

      {/* Editor Único del Mes */}
      {selectedMonth ? (
        <Card className={styles.editorCard}>
          <div className={styles.cardHeader}>
            <span className={styles.monthLabel}>Configuración de {selectedMonth.label}</span>
            <span className={ `${styles.monthTag} ${isSelectedCurrent ? styles.monthTagActive : styles.monthTagPast}` }>
              { isSelectedCurrent ? "Mes Actual (T-0)" : `Historial (Mes T-${11 - selectedIndex})` }
            </span>
          </div>

          {/* Ingresos Slider & Input */}
          <div className={styles.inputGroup}>
            <div className={styles.inputHeader}>
              <span className={styles.inputLabel}>Ingresos del Mes</span>
              <span className={ `${styles.inputValue} ${styles.revenueText}` }>${selectedMonth.revenue.toLocaleString()}</span>
            </div>
            <div className={styles.numInputWrapper}>
              <button
                type="button"
                className={styles.stepBtn}
                onClick={ () => handleValueChange( "revenue" , selectedMonth.revenue - 500 ) }
              >
                -
              </button>
              <input
                type="number"
                className={styles.numInput}
                value={selectedMonth.revenue}
                onChange={ ( e ) => handleValueChange( "revenue" , Number( e.target.value ) ) }
              />
              <button
                type="button"
                className={styles.stepBtn}
                onClick={ () => handleValueChange( "revenue" , selectedMonth.revenue + 500 ) }
              >
                +
              </button>
            </div>
            <input
              type="range"
              className={ `${styles.slider} ${styles.revenueSlider}` }
              min="0"
              max="15000"
              step="100"
              value={selectedMonth.revenue}
              onChange={ ( e ) => handleValueChange( "revenue" , Number( e.target.value ) ) }
            />
          </div>

          {/* Gastos Slider & Input */}
          <div className={styles.inputGroup}>
            <div className={styles.inputHeader}>
              <span className={styles.inputLabel}>Gastos del Mes</span>
              <span className={ `${styles.inputValue} ${styles.expenseText}` }>${selectedMonth.expense.toLocaleString()}</span>
            </div>
            <div className={styles.numInputWrapper}>
              <button
                type="button"
                className={styles.stepBtn}
                onClick={ () => handleValueChange( "expense" , selectedMonth.expense - 500 ) }
              >
                -
              </button>
              <input
                type="number"
                className={styles.numInput}
                value={selectedMonth.expense}
                onChange={ ( e ) => handleValueChange( "expense" , Number( e.target.value ) ) }
              />
              <button
                type="button"
                className={styles.stepBtn}
                onClick={ () => handleValueChange( "expense" , selectedMonth.expense + 500 ) }
              >
                +
              </button>
            </div>
            <input
              type="range"
              className={ `${styles.slider} ${styles.expenseSlider}` }
              min="0"
              max="15000"
              step="100"
              value={selectedMonth.expense}
              onChange={ ( e ) => handleValueChange( "expense" , Number( e.target.value ) ) }
            />
          </div>

          {/* Resultado del mes */}
          <div className={styles.savingResult}>
            <span>Balance de Ahorro Neto ({selectedMonth.label}):</span>
            <span className={ selectedSaving >= 0 ? styles.savingValPositive : styles.savingValNegative }>
              { selectedSaving >= 0 ? `+$${selectedSaving.toLocaleString()}` : `-$${Math.abs( selectedSaving ).toLocaleString()}` }
            </span>
          </div>
        </Card>
      ) : null}
    </div>
  ) ;
}
