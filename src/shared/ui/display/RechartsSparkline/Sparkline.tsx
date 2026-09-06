/**
 * @file Sparkline.tsx
 * Componente gráfico Sparkline implementado con la librería Recharts para un renderizado y tooltip fluidos.
 * Soporta series etiquetadas por monthKey, enmascaramiento con MetricsVisibilityContext y porcentajes precisos.
 */
"use client" ;

// Librerías externas
import { ResponsiveContainer , AreaChart , Area , YAxis , Tooltip } from "recharts" ;
import React , { useId , useState , useEffect , useContext }         from "react" ;

// Shared
import { MetricsVisibilityContext } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;

// Estilos
import styles from "./Sparkline.module.css" ;

/**
 * Representa un punto de la serie temporal del Sparkline con su clave de mes explícita.
 */
export interface SparklinePoint {
  value:    number ;
  monthKey: string ; // Formato: "YYYY-MM"
}

/**
 * Formatea una clave "YYYY-MM" a etiqueta legible internacionalizada ("May 26" / "May. 26").
 */
export function formatMonthKeyLabel( monthKey: string , lang: string = "es" ): string {
  const parts = monthKey.split( "-" ) ;
  if( parts.length !== 2 ) {
    return( monthKey ) ;
  }
  const year  = parseInt( parts[0] , 10 ) ;
  const month = parseInt( parts[1] , 10 ) ;
  if( isNaN( year ) || isNaN( month ) ) {
    return( monthKey ) ;
  }
  const date   = new Date( year , month - 1 , 1 ) ;
  const locale = lang === "en" ? "en-US" : lang === "br" ? "pt-BR" : "es-ES" ;
  const mStr   = date.toLocaleDateString( locale , {month: "short"} ) ;
  const yStr   = date.toLocaleDateString( locale , {year: "2-digit"} ) ;
  const cleanMonth     = mStr.replace( "." , "" ) ;
  const formattedMonth = ( cleanMonth.charAt( 0 ).toUpperCase() + cleanMonth.slice( 1 ) ) ;
  return( `${formattedMonth} ${yStr}` ) ;
}

/**
 * Calcula el cambio porcentual entre dos valores numéricos.
 * Retorna null si no hay valor anterior o si el valor anterior es 0 (evita porcentajes inventados).
 */
export function calcularCambioPorcentual(
  actual:   number ,
  anterior: number | null | undefined
): number | null {
  if( (anterior === null) || (anterior === undefined) || (anterior === 0) ) {
    return( null ) ;
  }
  return( ((actual - anterior) / Math.abs( anterior )) * 100 ) ;
}

interface SparklineDataPoint {
  value:       number ;
  label:       string ;
  pctChange:   number | null ;
  isInverted?: boolean ;
}

interface CustomMiniTooltipProps {
  active?:           boolean ;
  payload?:          { payload: SparklineDataPoint }[] ;
  lang?:             string ;
  isContentVisible?: boolean ;
}

function CustomMiniTooltip( { active , payload , lang , isContentVisible = true }: CustomMiniTooltipProps ) {
  if( active && payload && payload.length ) {
    const dataPoint       = payload[0].payload ;
    const val             = dataPoint.value ;
    const monthLabel      = dataPoint.label ;
    const pctChange       = dataPoint.pctChange ;
    const isInverted      = dataPoint.isInverted ;
    const comparisonLabel = lang === "en" ? "vs last month" : lang === "br" ? "vs mês anterior" : "vs mes anterior" ;

    // Si los saldos están ocultos (ojito cerrado), enmascarar valor y ocultar porcentaje por privacidad (S2)
    if( !isContentVisible ) {
      return(
        <div className={styles.tooltipContainer}>
          <div className={styles.tooltipHeader}>
            { monthLabel }
          </div>
          <div className={styles.tooltipBody}>
            <span className={styles.tooltipValue}>••••••</span>
          </div>
        </div>
      ) ;
    }

    const formatted = typeof val === "number"
      ? ( val < 0 ? `-$${Math.abs( val ).toLocaleString( undefined , {minimumFractionDigits: 2 , maximumFractionDigits: 2} )}` : `$${val.toLocaleString( undefined , {minimumFractionDigits: 2 , maximumFractionDigits: 2} )}` )
      : String( val ) ;

    const isPositive = ( (pctChange ?? 0) >= 0 ) ;
    const isGood     = isInverted ? ( (pctChange ?? 0) < 0 ) : ( (pctChange ?? 0) > 0 ) ;

    let pctColor = "var(--text-muted, #94a3b8)" ;
    if( (pctChange !== null) && (pctChange !== 0) ) {
      pctColor = isGood ? "var(--color-success, #10b981)" : "var(--color-danger, #ef4444)" ;
    }

    const formattedPct = ( pctChange !== null )
      ? `${isPositive ? "+" : ""}${pctChange.toFixed( 1 )}%`
      : null ;

    return(
      <div className={styles.tooltipContainer}>
        <div className={styles.tooltipHeader}>
          { monthLabel }
        </div>
        <div className={styles.tooltipBody}>
          <span className={styles.tooltipValue}>{ formatted }</span>
        </div>
        {formattedPct !== null && (
          <div className={styles.tooltipFooter}>
            <span className={styles.tooltipPct} style={{color: pctColor}}>
              { formattedPct }
            </span>
            <span className={styles.tooltipCompareText}>
              { comparisonLabel }
            </span>
          </div>
        )}
      </div>
    ) ;
  }
  return( null ) ;
}

export interface SparklineProps {
  points?:        SparklinePoint[] ;
  data?:          number[] ;
  color:          string ;
  height?:        number | string ;
  lang?:          string ;
  isInverted?:    boolean ;
  fullWidth?:     boolean ;
  referenceDate?: Date ;
}

export function Sparkline( {
  points ,
  data ,
  color ,
  height = "100%" ,
  lang = "es" ,
  isInverted = false ,
  fullWidth = false ,
  referenceDate
}: SparklineProps ) {
  const id = useId() ;
  const [ mounted , setMounted ] = useState( false ) ;
  const { isContentVisible } = useContext( MetricsVisibilityContext ) ;

  useEffect( () => {
    const handle = requestAnimationFrame( () => {
      setMounted( true ) ;
    } ) ;
    return( () => cancelAnimationFrame( handle ) ) ;
  } , [] ) ;

  // Resolver los puntos efectivos: si viene points se usa directamente; si viene data se deriva
  const resolvedPoints: SparklinePoint[] = ( points && ( points.length > 0 ) )
    ? points
    : ( data && ( data.length > 0 ) )
    ? data.map( ( val , i ) => {
        const ref = referenceDate ? new Date( referenceDate ) : new Date() ;
        const d   = new Date( ref.getFullYear() , ref.getMonth() - (data.length - 1 - i) , 1 ) ;
        const mk  = `${d.getFullYear()}-${String( d.getMonth() + 1 ).padStart( 2 , "0" )}` ;
        return( { value: val , monthKey: mk } ) ;
      } )
    : [] ;

  if( !mounted || ( resolvedPoints.length === 0 ) ) {
    return( <div className={styles.sparklineWrapper} style={{height}} /> ) ;
  }

  // Si hay un solo punto, duplicamos para que el AreaChart de Recharts pueda trazar la línea horizontal
  const effectivePoints = resolvedPoints.length === 1 ? [ resolvedPoints[0] , resolvedPoints[0] ] : resolvedPoints ;

  const chartData: SparklineDataPoint[] = effectivePoints.map( ( pt , i ) => {
    let pctChange: number | null = null ;
    if( (i > 0) && (effectivePoints.length > 1) ) {
      const prevVal = effectivePoints[i - 1].value ;
      pctChange = calcularCambioPorcentual( pt.value , prevVal ) ;
    }
    return( {
      value:      pt.value ,
      label:      formatMonthKeyLabel( pt.monthKey , lang ) ,
      pctChange ,
      isInverted
    } ) ;
  } ) ;

  const safeId     = id.replace( /:/g , "" ) ;
  const gradientId = `sparkline-gradient-${safeId}` ;
  const values     = effectivePoints.map( ( p ) => p.value ) ;
  const min        = Math.min( ...values ) ;
  const max        = Math.max( ...values ) ;
  const range      = ( max - min ) ;
  
  const padding   = range === 0 ? 1 : ( range * 0.03 ) ;
  const domainMin = ( min - padding ) ;
  const domainMax = ( max + padding ) ;

  const chartMargin = fullWidth
    ? {top: 4 , right: 0 , left: 0 , bottom: 0}
    : {top: 4 , right: 4 , left: 4 , bottom: 4} ;

  return(
    <div className={styles.sparklineWrapper} style={{height}}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={chartData} margin={chartMargin}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <YAxis domain={[ domainMin , domainMax ]} hide />
          <Tooltip
            content={<CustomMiniTooltip lang={lang} isContentVisible={isContentVisible} />}
            cursor={{stroke: "rgba(255, 255, 255, 0.15)" , strokeWidth: 1}}
            isAnimationActive={false}
            position={{y: -50}}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  ) ;
}
