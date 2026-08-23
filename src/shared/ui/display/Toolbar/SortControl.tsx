/**
 * @file SortControl.tsx
 * Componente selector de criterio y dirección de ordenamiento para la Toolbar.
 * @remarks Componente de catálogo — aún sin consumidores en producción.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import styles from "./Toolbar.module.css" ;


export interface SortConfig< T > {
  key:       keyof T ;
  direction: "asc" | "desc" ;
}

export interface SortOptionDef< T > {
  label: string ;
  key:   keyof T ;
}

interface SortControlProps< T > {
  options:   SortOptionDef< T >[] ;
  config:    SortConfig< T > | null ;
  setConfig: ( conf: SortConfig< T > | null ) => void ;
}

export function SortControl< T >( {options , config , setConfig}: SortControlProps< T > ) {
  const handleKeyChange = ( newKey: string ) => {
    if( !newKey ) { return ; }
    setConfig( {key: newKey as keyof T , direction: config?.direction ?? "asc"} ) ;
  } ;

  const toggleDirection = () => {
    if( !config && ( options.length > 0 ) ) {
      setConfig( {key: options[0].key , direction: "asc"} ) ;
      return ;
    }
    if( config ) {
      setConfig( {
        key:       config.key ,
        direction: ( config.direction === "asc" ? "desc" : "asc" )
      } ) ;
    }
  } ;

  return(
    <div className={styles.sortGroup}>
      <div className={styles.sortSelectWrapper}>
        <select
          className={styles.sortSelect}
          value={config ? String( config.key ) : ""}
          onChange={ ( e ) => handleKeyChange( e.target.value ) }
          aria-label="Sort by"
        >
          <option value="" disabled>
            Ordenar por...
          </option>
          {options.map( ( opt ) => (
            <option key={String( opt.key )} value={String( opt.key )}>
              { opt.label }
            </option>
          ) )}
        </select>
        <svg
          className={styles.sortArrow}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={toggleDirection}
        disabled={!config}
        aria-label="Toggle sort direction"
      >
        {( config?.direction === "desc" ) ? (
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 18h18M3 12h12M3 6h6" />
          </svg>
        ) : (
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18M3 12h12M3 18h6" />
          </svg>
        )}
      </button>
    </div>
  ) ;
}
