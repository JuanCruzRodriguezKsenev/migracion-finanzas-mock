/**
 * @file NetWorthCard.tsx
 * Tarjeta de desglose de Patrimonio Neto a hoy (RN-14, RN-15).
 * Muestra el neto calculado y el desglose de activos, pasivos y cuotas futuras por pagar.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import { useMetricsVisibility } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { formatCurrency }       from "@/shared/lib/currencyFormatter" ;

// Feature: Reports
import { ReportNetWorth } from "../types" ;

// Estilos
import styles from "./NetWorthCard.module.css" ;

export interface NetWorthCardProps {
  patrimonio:     ReportNetWorth ;
  currency:       string ;
  lang?:          string ;
  title?:         string ;
  asOfTodayText?: string ;
  activosText?:   string ;
  pasivosText?:   string ;
  cuotasText?:    string ;
}

export function NetWorthCard( {
  patrimonio ,
  currency ,
  lang = "es" ,
  title = "Patrimonio Neto" ,
  asOfTodayText = "a hoy" ,
  activosText = "Activos" ,
  pasivosText = "Pasivos" ,
  cuotasText = "Cuotas por pagar" ,
}: NetWorthCardProps ) {
  const { isContentVisible } = useMetricsVisibility() ;

  const locale = lang === "en" ? "en-US" : lang === "br" ? "pt-BR" : "es-AR" ;

  const netoFormatted    = isContentVisible ? formatCurrency( patrimonio.neto , currency , locale ) : "••••••" ;
  const activosFormatted = isContentVisible ? formatCurrency( patrimonio.activos , currency , locale ) : "••••••" ;

  // Pasivos: en el motor es negativo. Si es negativo lo formateamos directo
  const pasivosFormatted = isContentVisible
    ? ( ( patrimonio.pasivos < 0 )
        ? formatCurrency( patrimonio.pasivos , currency , locale )
        : `- ${formatCurrency( patrimonio.pasivos , currency , locale )}` )
    : "••••••" ;

  const cuotasFormatted = isContentVisible
    ? ( ( patrimonio.cuotasPorPagar > 0 )
        ? `- ${formatCurrency( patrimonio.cuotasPorPagar , currency , locale )}`
        : formatCurrency( 0 , currency , locale ) )
    : "••••••" ;

  return(
    <div className={styles.cardContainer}>
      <div className={styles.headerRow}>
        <h3 className={styles.title}>{ title }</h3>
        <span className={styles.asOfTodayBadge}>{ asOfTodayText }</span>
      </div>

      <div className={styles.netValueRow}>
        <span className={styles.netValue}>{ netoFormatted }</span>
      </div>

      <div className={styles.breakdownGrid}>
        <div className={styles.breakdownRow}>
          <span className={styles.breakdownLabel}>{ activosText }</span>
          <span className={styles.breakdownValue}>{ activosFormatted }</span>
        </div>

        <div className={styles.breakdownRow}>
          <span className={styles.breakdownLabel}>{ pasivosText }</span>
          <span className={ `${styles.breakdownValue} ${patrimonio.pasivos !== 0 ? styles.breakdownNegative : ""}` }>
            { pasivosFormatted }
          </span>
        </div>

        <div className={styles.breakdownRow}>
          <span className={styles.breakdownLabel}>{ cuotasText }</span>
          <span className={ `${styles.breakdownValue} ${patrimonio.cuotasPorPagar > 0 ? styles.breakdownNegative : ""}` }>
            { cuotasFormatted }
          </span>
        </div>
      </div>
    </div>
  ) ;
}
