/**
 * @file ColumnSelector.tsx
 * Componente panel interactivo para alternar la visibilidad de columnas en tablas.
 * @remarks Componente de catálogo — aún sin consumidores en producción.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import styles from "./Toolbar.module.css" ;


export interface Column< T > {
  key:     keyof T ;
  label:   string ;
  width?:  string ;
  align?:  "left" | "center" | "right" ;
  render?: ( value: T[keyof T] , item: T ) => React.ReactNode ;
}

interface ColumnSelectorProps< T > {
  columns:      Column< T >[] ;
  visible:      ( keyof T )[] ;
  onToggle:     ( key: keyof T ) => void ;
  onShowAll:    () => void ;
  onHideAll:    () => void ;
  isOpen:       boolean ;
  onOpenToggle: () => void ;
}

export function ColumnSelector< T >( {
  columns ,
  visible ,
  onToggle ,
  onShowAll ,
  onHideAll ,
  isOpen ,
  onOpenToggle
}: ColumnSelectorProps< T > ) {
  const hiddenCount = ( columns.length - visible.length ) ;

  return(
    <div className={styles.popupAnchor}>
      <button
        type="button"
        className={ `${styles.actionBtn} ${( isOpen || ( hiddenCount > 0 ) ) ? styles.actionBtnActive : ""}` }
        onClick={onOpenToggle}
        aria-expanded={isOpen}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="7" y1="4" x2="7" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
          <line x1="17" y1="4" x2="17" y2="20" />
        </svg>
        <span>Columnas</span>
        {hiddenCount > 0 && (
          <span className={styles.badge}>
            { visible.length }/{ columns.length }
          </span>
        )}
      </button>

      {isOpen && (
        <div className={ `${styles.popup} ${styles.popupRight}` } role="dialog" aria-label="Column visibility">
          <div className={styles.popupHeader}>
            <span className={styles.sectionTitle}>Columnas</span>
            <div className={styles.popupHeaderActions}>
              <button type="button" className={styles.textBtn} onClick={onShowAll}>
                Todas
              </button>
              <button type="button" className={styles.textBtn} onClick={onHideAll}>
                Ninguna
              </button>
            </div>
          </div>
          <div className={styles.colList}>
            {columns.map( ( col ) => {
              const isOn = visible.includes( col.key ) ;
              return(
                <div
                  key={String( col.key )}
                  className={ `${styles.colItem} ${isOn ? styles.colItemOn : ""}` }
                  onClick={ () => onToggle( col.key ) }
                >
                  <span>{ col.label }</span>
                  <div className={ `${styles.toggle} ${isOn ? styles.toggleOn : ""}` } />
                </div>
              ) ;
            } )}
          </div>
        </div>
      )}
    </div>
  ) ;
}
