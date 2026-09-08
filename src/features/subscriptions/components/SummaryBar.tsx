/**
 * @file SummaryBar.tsx
 * Barra de totales del dashboard de suscripciones: gasto mensual y proyección anual.
 * Montos en centavos formateados con el formateador de moneda compartido.
 */
// Librerías externas
import React from "react" ;

// Shared
import { formatCurrency } from "@/shared/lib/currencyFormatter" ;

// Feature: Subscriptions
import styles from "./SummaryBar.module.css" ;


interface SummaryBarProps {
  totalMonthly:     number ; // centavos
  totalYearly:      number ; // centavos
  monthlyLabel:     string ;
  yearlyLabel:      string ;
  currency?:        string ;
  locale?:          string ;
}

/**
 * Totales agregados del gasto en suscripciones.
 */
export function SummaryBar( {
  totalMonthly ,
  totalYearly ,
  monthlyLabel ,
  yearlyLabel ,
  currency = "ARS" ,
  locale = "es-AR" ,
}: SummaryBarProps ) {
  return(
    <div className={styles.summaryBar}>
      <div className={styles.leftSection}>
        <p className={styles.label}>
          { monthlyLabel }
        </p>
        <p className={styles.totalPrice}>
          { formatCurrency( totalMonthly , currency , locale ) }
        </p>
      </div>
      <div className={styles.rightSection}>
        <p className={ `${styles.label} ${styles.yearlyLabel}` }>
          { yearlyLabel }
        </p>
        <p className={styles.yearlyPrice}>
          { formatCurrency( totalYearly , currency , locale ) }
        </p>
      </div>
    </div>
  ) ;
}
