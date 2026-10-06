/**
 * @file TopExpensesList.tsx
 * Listado de los 5 mayores gastos del período con su categoría asignada y fecha (RN-13).
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import { useMetricsVisibility } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { formatCurrency }       from "@/shared/lib/currencyFormatter" ;

// Feature: Reports
import { ReportTopExpense } from "../types" ;

// Estilos
import styles from "./TopExpensesList.module.css" ;

export interface TopExpensesListProps {
  topGastos:  ReportTopExpense[] ;
  currency:   string ;
  lang?:      string ;
  title?:     string ;
  emptyText?: string ;
}

export function TopExpensesList( {
  topGastos ,
  currency ,
  lang = "es" ,
  title = "Top gastos" ,
  emptyText = "Sin gastos en este período" ,
}: TopExpensesListProps ) {
  const { isContentVisible } = useMetricsVisibility() ;

  const locale = lang === "en" ? "en-US" : lang === "br" ? "pt-BR" : "es-AR" ;

  if( !topGastos || ( topGastos.length === 0 ) ) {
    return(
      <div className={styles.listContainer}>
        <h3 className={styles.title}>{ title }</h3>
        <div className={styles.emptyState}>{ emptyText }</div>
      </div>
    ) ;
  }

  return(
    <div className={styles.listContainer}>
      <h3 className={styles.title}>{ title }</h3>
      <div className={styles.rowsList}>
        { topGastos.map( ( g ) => {
          const montoFormatted = isContentVisible
            ? formatCurrency( g.monto , currency , locale )
            : "••••••" ;

          return(
            <div key={g.id} className={styles.rowItem}>
              <div className={styles.itemLeft}>
                <span className={styles.itemDescription} title={g.descripcion}>
                  { g.descripcion }
                </span>
                <div className={styles.itemMeta}>
                  <span className={styles.categoryBadge}>{ g.categoria }</span>
                  <span>{ g.fecha }</span>
                </div>
              </div>
              <span className={styles.itemAmount}>{ montoFormatted }</span>
            </div>
          ) ;
        } ) }
      </div>
    </div>
  ) ;
}
