/**
 * @file TrendChart.tsx
 * Componente de visualización de series temporales de 12 meses (ingresos, gastos, ahorro) con Recharts.
 * Sin lógica de negocio: recibe series formateadas, soporta enmascaramiento y accesibilidad (NFR-4, RN-24).
 */
"use client" ;

// Librerías externas
import { ResponsiveContainer , LineChart , Line , XAxis , YAxis , Tooltip , CartesianGrid } from "recharts" ;
import React , { useId }                                                                   from "react" ;

// Shared
import { useMetricsVisibility } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;

// Estilos
import styles from "./TrendChart.module.css" ;

export interface TrendChartPoint {
  label:              string ;
  ingresos:           number ;
  gastos:             number ;
  ahorroNeto?:        number ;
  patrimonioLibro?:   number ;
  formattedIngresos?: string ;
  formattedGastos?:   string ;
  formattedAhorro?:   string ;
}

export interface TrendChartProps {
  data:             TrendChartPoint[] ;
  ariaLabel?:       string ;
  title?:           string ;
  ingresosLabel?:   string ;
  gastosLabel?:     string ;
  emptyText?:       string ;
}

interface CustomTooltipProps {
  active?:           boolean ;
  payload?:          { value: number ; name: string ; color: string ; payload: TrendChartPoint }[] ;
  isContentVisible?: boolean ;
  ingresosLabel?:    string ;
  gastosLabel?:      string ;
}

function CustomTooltip( { active , payload , isContentVisible = true , ingresosLabel = "Ingresos" , gastosLabel = "Gastos" }: CustomTooltipProps ) {
  if( !active || !payload || ( payload.length === 0 ) ) {
    return( null ) ;
  }

  const point = payload[ 0 ].payload ;

  return(
    <div className={styles.tooltipContainer}>
      <div className={styles.tooltipTitle}>{ point.label }</div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipLabelSuccess}>{ ingresosLabel }</span>
        <span className={styles.tooltipValue}>
          { isContentVisible ? ( point.formattedIngresos || point.ingresos.toLocaleString() ) : "••••••" }
        </span>
      </div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipLabelDanger}>{ gastosLabel }</span>
        <span className={styles.tooltipValue}>
          { isContentVisible ? ( point.formattedGastos || point.gastos.toLocaleString() ) : "••••••" }
        </span>
      </div>
    </div>
  ) ;
}

/**
 * Gráfico de tendencia mensual multilínea.
 */
export function TrendChart( {
  data ,
  ariaLabel = "Gráfico de tendencia de ingresos y gastos de los últimos 12 meses" ,
  title ,
  ingresosLabel = "Ingresos" ,
  gastosLabel = "Gastos" ,
  emptyText = "Sin datos de tendencia suficientes" ,
}: TrendChartProps ) {
  const chartId               = useId() ;
  const { isContentVisible }  = useMetricsVisibility() ;

  if( !data || ( data.length === 0 ) ) {
    return(
      <div className={styles.chartContainer} role="img" aria-label={ariaLabel}>
        { title && <h3 className={styles.chartTitle}>{ title }</h3> }
        <div className={styles.emptyState}>{ emptyText }</div>
      </div>
    ) ;
  }

  return(
    <div className={styles.chartContainer} role="img" aria-label={ariaLabel}>
      <div className={styles.chartHeader}>
        { title && <h3 className={styles.chartTitle}>{ title }</h3> }
        <div className={styles.chartLegend}>
          <span className={styles.legendItem}>
            <span className={ `${styles.legendDot} ${styles.legendDotSuccess}` } />
            { ingresosLabel }
          </span>
          <span className={styles.legendItem}>
            <span className={ `${styles.legendDot} ${styles.legendDotDanger}` } />
            { gastosLabel }
          </span>
        </div>
      </div>

      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} id={chartId} margin={{ top: 10 , right: 10 , left: -20 , bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #334155)" opacity={0.4} />
            <XAxis
              dataKey="label"
              stroke="var(--text-secondary, #94A3B8)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--text-secondary, #94A3B8)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={( v: number ) => { return( isContentVisible ? `${v}` : "••" ) ; }}
            />
            <Tooltip
              content={
                <CustomTooltip
                  isContentVisible={isContentVisible}
                  ingresosLabel={ingresosLabel}
                  gastosLabel={gastosLabel}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="ingresos"
              stroke="var(--color-success, #10B981)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 , strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="gastos"
              stroke="var(--color-danger, #EF4444)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 , strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      { /* Alternativa textual para lectores de pantalla (NFR-4) */ }
      <div className={styles.srOnly}>
        <table>
          <caption>{ ariaLabel }</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col">{ ingresosLabel }</th>
              <th scope="col">{ gastosLabel }</th>
            </tr>
          </thead>
          <tbody>
            { data.map( ( p ) => {
              return(
                <tr key={p.label}>
                  <th scope="row">{ p.label }</th>
                  <td>{ isContentVisible ? ( p.formattedIngresos || p.ingresos ) : "••••••" }</td>
                  <td>{ isContentVisible ? ( p.formattedGastos || p.gastos ) : "••••••" }</td>
                </tr>
              ) ;
            } ) }
          </tbody>
        </table>
      </div>
    </div>
  ) ;
}
