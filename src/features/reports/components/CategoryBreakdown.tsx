/**
 * @file CategoryBreakdown.tsx
 * Desglose de gastos o ingresos por categoría padre y subcategorías (RN-10, RN-11, AC-8).
 * Contiene el interruptor Gastos/Ingresos, el DonutChart interactivo y el panel de hojas.
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;

// Shared
import { useMetricsVisibility } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { DonutChart , DonutSegment } from "@/shared/ui/display/DonutChart/DonutChart" ;
import { formatCurrency }            from "@/shared/lib/currencyFormatter" ;

// Feature: Reports
import { ReportCategoryGroup } from "../types" ;

// Estilos
import styles from "./CategoryBreakdown.module.css" ;

export interface CategoryBreakdownProps {
  categorias:   ReportCategoryGroup[] ;
  currency:     string ;
  lang?:        string ;
  title?:       string ;
  gastosText?:  string ;
  ingresosText?: string ;
  emptyText?:   string ;
  desgloseDeText?: string ;
}

export function CategoryBreakdown( {
  categorias ,
  currency ,
  lang = "es" ,
  title = "Por categoría" ,
  gastosText = "Gastos" ,
  ingresosText = "Ingresos" ,
  emptyText = "Sin movimientos por categoría en este mes" ,
  desgloseDeText = "Desglose de" ,
}: CategoryBreakdownProps ) {
  const [ tipoActivo , setTipoActivo ]             = useState< "expense" | "revenue" >( "expense" ) ;
  const [ selectedParentId , setSelectedParentId ] = useState< string | null >( null ) ;
  const { isContentVisible }                       = useMetricsVisibility() ;

  const locale = lang === "en" ? "en-US" : lang === "br" ? "pt-BR" : "es-AR" ;

  const grupoActivo = categorias.find( ( c ) => { return( c.tipo === tipoActivo ) ; } ) ;
  const padres      = grupoActivo?.padres || [] ;

  // Mapear segmentos para DonutChart
  const segments: DonutSegment[] = padres.map( ( p ) => {
    return( {
      id:             p.id ,
      name:           p.nombre ,
      value:          p.total ,
      color:          p.color ,
      formattedValue: formatCurrency( p.total , currency , locale ) ,
    } ) ;
  } ) ;

  const handleSelect = ( id: string ) => {
    if( selectedParentId === id ) {
      setSelectedParentId( null ) ;
    } else {
      setSelectedParentId( id ) ;
    }
  } ;

  const selectedParent = padres.find( ( p ) => { return( p.id === selectedParentId ) ; } ) ;

  return(
    <div className={styles.breakdownContainer}>
      <div className={styles.headerRow}>
        <h3 className={styles.title}>{ title }</h3>
        <div className={styles.toggleSwitch} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tipoActivo === "expense"}
            className={ `${styles.toggleButton} ${tipoActivo === "expense" ? styles.toggleButtonActive : ""}` }
            onClick={() => {
              setTipoActivo( "expense" ) ;
              setSelectedParentId( null ) ;
            }}
          >
            { gastosText }
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tipoActivo === "revenue"}
            className={ `${styles.toggleButton} ${tipoActivo === "revenue" ? styles.toggleButtonActive : ""}` }
            onClick={() => {
              setTipoActivo( "revenue" ) ;
              setSelectedParentId( null ) ;
            }}
          >
            { ingresosText }
          </button>
        </div>
      </div>

      <DonutChart
        segments={segments}
        selectedId={selectedParentId}
        onSelect={handleSelect}
        emptyText={emptyText}
      />

      { /* Desglose por subcategorías del padre seleccionado (RN-11) */ }
      { selectedParent && ( selectedParent.hojas.length > 0 ) && (
        <div className={styles.leafDetailsBox}>
          <div className={styles.leafDetailsHeader}>
            <h4 className={styles.leafDetailsTitle}>
              { desgloseDeText } { selectedParent.nombre }
            </h4>
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => { setSelectedParentId( null ) ; }}
            >
              ✕
            </button>
          </div>

          { selectedParent.hojas.map( ( h ) => {
            const hojaPct     = selectedParent.total > 0 ? ( ( h.total / selectedParent.total ) * 100 ) : 0 ;
            const pctStr      = isContentVisible ? `${hojaPct.toFixed( 1 )}%` : "••••••" ;
            const montoStr    = isContentVisible ? formatCurrency( h.total , currency , locale ) : "••••••" ;

            return(
              <div key={h.id} className={styles.leafItem}>
                <span className={styles.leafName}>
                  { h.nombre } ({ pctStr })
                </span>
                <span className={styles.leafAmount}>{ montoStr }</span>
              </div>
            ) ;
          } ) }
        </div>
      ) }
    </div>
  ) ;
}
