/**
 * @file Sparkline.tsx
 * Componente gráfico Sparkline implementado con la librería Recharts para un renderizado y tooltip fluidos.
 */
"use client" ;

// Librerías externas
import { ResponsiveContainer , AreaChart , Area , YAxis , Tooltip } from "recharts" ;
import React , { useId , useState , useEffect }                       from "react" ;

// Estilos
import styles from "./Sparkline.module.css" ;

function getMonthsLabelSequence( length: number , lang: string = "es" , referenceDate?: Date ) {
  const labels = [] ;
  const currentDate = referenceDate || new Date() ;
  for( let i = 0 ; i < length ; i++ ) {
    const date = new Date( currentDate.getFullYear() , currentDate.getMonth() - ( (length - 1) - i ) , 1 ) ;
    const monthStr = date.toLocaleDateString( lang === "en" ? "en-US" : "es-ES" , {month: "short"} ) ;
    const yearStr = date.toLocaleDateString( lang === "en" ? "en-US" : "es-ES" , {year: "2-digit"} ) ;
    // Quitar el punto en español (ej: "may.") y capitalizar
    const cleanMonth = monthStr.replace( "." , "" ) ;
    const formattedMonth = ( cleanMonth.charAt( 0 ).toUpperCase() + cleanMonth.slice( 1 ) ) ;
    labels.push( `${formattedMonth} ${yearStr}` ) ;
  }
  return( labels ) ;
}

interface SparklineDataPoint {
  value:       number ;
  label:       string ;
  pctChange:   number | null ;
  isInverted?: boolean ;
}

interface CustomMiniTooltipProps {
  active?:  boolean ;
  payload?: { payload: SparklineDataPoint }[] ;
  lang?:    string ;
}

function CustomMiniTooltip( { active , payload , lang }: CustomMiniTooltipProps ) {
  if( active && payload && payload.length ) {
    const dataPoint       = payload[0].payload ;
    const val             = dataPoint.value ;
    const monthLabel      = dataPoint.label ;
    const pctChange       = dataPoint.pctChange ;
    const isInverted      = dataPoint.isInverted ;
    const comparisonLabel = lang === "en" ? "vs last month" : lang === "br" ? "vs mês anterior" : "vs mes anterior" ;

    const formatted = typeof val === "number"
      ? ( val < 0 ? `-$${Math.abs( val ).toLocaleString( undefined , {minimumFractionDigits: 2 , maximumFractionDigits: 2} )}` : `$${val.toLocaleString( undefined , {minimumFractionDigits: 2 , maximumFractionDigits: 2} )}` )
      : String( val ) ;

    // pctChange puede ser null (sin dato histórico anterior): se trata como 0 en las comparaciones,
    // preservando la coerción implícita que ya aplicaba este mismo código antes de tipar el tooltip.
    const pctChangeComparable = ( pctChange ?? 0 ) ;
    const isPositive = ( pctChangeComparable >= 0 ) ;
    const isNeutral  = ( pctChange === 0 ) || ( pctChange === null ) ;
    const isGood     = isInverted ? ( pctChangeComparable < 0 ) : ( pctChangeComparable > 0 ) ;

    let pctColor = "var(--text-muted, #94a3b8)" ;
    if( !isNeutral ) {
      pctColor = isGood ? "var(--color-success, #10b981)" : "var(--color-danger, #ef4444)" ;
    }

    const formattedPct = pctChange !== null
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

interface SparklineProps {
  data:          number[] ;
  color:         string ;
  height?:       number | string ;
  lang?:         string ;
  isInverted?:   boolean ;
  fullWidth?:    boolean ;
  referenceDate?: Date ;
}

export function Sparkline( {
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

  useEffect( () => {
    const handle = requestAnimationFrame( () => {
      setMounted( true ) ;
    } ) ;
    return( () => cancelAnimationFrame( handle ) ) ;
  } , [] ) ;

  if( !mounted || !data || ( data.length < 2 ) ) {
    return( <div className={styles.sparklineWrapper} style={{height}} /> ) ;
  }

  const labels = getMonthsLabelSequence( data.length , lang , referenceDate ) ;
  const chartData = data.map( ( val , i ) => {
    let pctChange = null ;
    if( i > 0 ) {
      const prevVal = data[i - 1] ;
      pctChange = prevVal !== 0 ? ( ((val - prevVal) / Math.abs( prevVal )) * 100 ) : 0 ;
    }
    return( {
      value: val ,
      index: i ,
      label: labels[i] ,
      pctChange ,
      isInverted
    } ) ;
  } ) ;

  const safeId = id.replace( /:/g , "" ) ;
  const gradientId = `sparkline-gradient-${safeId}` ;
  const min = Math.min( ...data ) ;
  const max = Math.max( ...data ) ;
  const range = ( max - min ) ;
  
  const padding = range === 0 ? 1 : ( range * 0.03 ) ;
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
            content={<CustomMiniTooltip lang={lang} />}
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
            dot={false}
            activeDot={{r: 3 , stroke: color , strokeWidth: 1 , fill: "#fff"}}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  ) ;
}
