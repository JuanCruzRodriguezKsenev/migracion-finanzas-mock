/**
 * @file DonutChart.tsx
 * Componente de gráfico Donut implementado con Recharts para distribución por categorías.
 * Sin lógica de negocio: recibe segmentos formateados, soporta enmascaramiento y accesibilidad (NFR-4, RN-24).
 */
"use client" ;

// Librerías externas
import { ResponsiveContainer , PieChart , Pie , Cell , Tooltip } from "recharts" ;
import React , { useId }                                          from "react" ;

// Shared
import { useMetricsVisibility } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;

// Estilos
import styles from "./DonutChart.module.css" ;

export interface DonutSegment {
  id:              string ;
  name:            string ;
  value:           number ;
  color:           string ;
  formattedValue?: string ;
  percentage?:     number ;
}

export interface DonutChartProps {
  segments:    DonutSegment[] ;
  selectedId?: string | null ;
  onSelect?:   ( id: string ) => void ;
  ariaLabel?:  string ;
  title?:      string ;
  emptyText?:  string ;
}

interface CustomTooltipProps {
  active?:           boolean ;
  payload?:          { payload: DonutSegment }[] ;
  isContentVisible?: boolean ;
}

function CustomDonutTooltip( { active , payload , isContentVisible = true }: CustomTooltipProps ) {
  if( !active || !payload || ( payload.length === 0 ) ) {
    return( null ) ;
  }

  const segment = payload[ 0 ].payload ;
  const pctStr  = ( segment.percentage !== undefined ) ? `${segment.percentage.toFixed( 1 )}%` : "" ;

  return(
    <div className={styles.tooltipContainer}>
      <div className={styles.tooltipTitle}>{ segment.name }</div>
      <div>
        <span>{ isContentVisible ? ( segment.formattedValue || segment.value.toLocaleString() ) : "••••••" }</span>
        { pctStr && <span className={styles.tooltipPct}>({ isContentVisible ? pctStr : "••••••" })</span> }
      </div>
    </div>
  ) ;
}

/**
 * Gráfico Donut de distribución por categorías con desglose accesible.
 */
export function DonutChart( {
  segments ,
  selectedId ,
  onSelect ,
  ariaLabel = "Distribución por categoría" ,
  title ,
  emptyText = "Sin datos en el período" ,
}: DonutChartProps ) {
  const chartId              = useId() ;
  const { isContentVisible } = useMetricsVisibility() ;

  const total = segments.reduce( ( acc , s ) => { return( acc + s.value ) ; } , 0 ) ;

  // Calcular porcentaje si no viene provisto
  const processedSegments = segments.map( ( s ) => {
    const pct = ( s.percentage !== undefined )
      ? s.percentage
      : ( total > 0 ? ( ( s.value / total ) * 100 ) : 0 ) ;
    return( { ...s , percentage: pct } ) ;
  } ) ;

  if( !segments || ( segments.length === 0 ) || ( total === 0 ) ) {
    return(
      <div className={styles.donutContainer} role="img" aria-label={ariaLabel}>
        { title && <h3 className={styles.donutTitle}>{ title }</h3> }
        <div className={styles.emptyState}>{ emptyText }</div>
      </div>
    ) ;
  }

  return(
    <div className={styles.donutContainer} role="img" aria-label={ariaLabel}>
      { title && (
        <div className={styles.donutHeader}>
          <h3 className={styles.donutTitle}>{ title }</h3>
        </div>
      ) }

      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart id={chartId}>
            <Tooltip content={<CustomDonutTooltip isContentVisible={isContentVisible} />} />
            <Pie
              data={processedSegments}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              isAnimationActive={false}
              onClick={( entry: { id?: string ; payload?: { id?: string } } ) => {
                const targetId = entry?.id || entry?.payload?.id ;
                if( onSelect && targetId ) {
                  onSelect( targetId ) ;
                }
              }}
            >
              { processedSegments.map( ( entry ) => {
                const isSelected = selectedId === entry.id ;
                return(
                  <Cell
                    key={entry.id}
                    fill={entry.color}
                    stroke={isSelected ? "var(--text-primary, #FFFFFF)" : "transparent"}
                    strokeWidth={isSelected ? 2 : 0}
                    style={{ cursor: onSelect ? "pointer" : "default" }}
                  />
                ) ;
              } ) }
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      { /* Lista interactiva visible debajo: no depende sólo del color y muestra % y valor */ }
      <div className={styles.segmentsList}>
        { processedSegments.map( ( s ) => {
          const isSelected = selectedId === s.id ;
          const pctText    = isContentVisible ? `${s.percentage.toFixed( 1 )}%` : "••••••" ;
          const amountText = isContentVisible ? ( s.formattedValue || s.value.toLocaleString() ) : "••••••" ;

          return(
            <button
              type="button"
              key={s.id}
              className={ `${styles.segmentItem} ${isSelected ? styles.segmentItemSelected : ""}` }
              onClick={() => { onSelect?.( s.id ) ; }}
            >
              <div className={styles.segmentLeft}>
                <span className={styles.segmentColorDot} style={{ backgroundColor: s.color }} />
                <span className={styles.segmentName}>{ s.name }</span>
              </div>
              <div className={styles.segmentRight}>
                <span className={styles.segmentPct}>{ pctText }</span>
                <span className={styles.segmentAmount}>{ amountText }</span>
              </div>
            </button>
          ) ;
        } ) }
      </div>

      { /* Alternativa textual para lectores de pantalla (NFR-4) */ }
      <div className={styles.srOnly}>
        <ul>
          { processedSegments.map( ( s ) => {
            const pctText    = isContentVisible ? `${s.percentage.toFixed( 1 )}%` : "••••••" ;
            const amountText = isContentVisible ? ( s.formattedValue || s.value ) : "••••••" ;
            return(
              <li key={s.id}>
                { s.name }: { pctText } ({ amountText })
              </li>
            ) ;
          } ) }
        </ul>
      </div>
    </div>
  ) ;
}
