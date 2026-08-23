/**
 * @file FilterBtn.tsx
 * Componente botón y menú popup interactivo para gestionar múltiples filtros dinámicos.
 * @remarks Componente de catálogo — aún sin consumidores en producción.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import styles from "./Toolbar.module.css" ;


export interface FilterFieldDef< T > {
  key:      keyof T ;
  label:    string ;
  options?: string[] ;
}

interface FilterBtnProps< T > {
  filters:         Partial< Record< keyof T , string[] > > ;
  setFilter:       ( key: keyof T , val: string[] ) => void ;
  getUniqueValues: ( key: keyof T ) => string[] ;
  clearFilters:    () => void ;
  filterFields:    FilterFieldDef< T >[] ;
  searchQuery?:    string ;
  isOpen:          boolean ;
  onToggle:        () => void ;
}

export function FilterBtn< T >( {
  filters ,
  setFilter ,
  getUniqueValues ,
  clearFilters ,
  filterFields ,
  searchQuery = "" ,
  isOpen ,
  onToggle
}: FilterBtnProps< T > ) {
  const activeCount = Object.values( filters ).reduce< number >(
    ( n , v ) => n + ( Array.isArray( v ) ? v.length : 0 ) ,
    0
  ) ;
  const hasActive = ( activeCount > 0 ) || ( searchQuery !== "" ) ;

  const toggle = ( key: keyof T , value: string ) => {
    const current = ( filters[key] || [] ) ;
    if( value === "all" ) {
      setFilter( key , [] ) ;
      return ;
    }
    if( current.includes( value ) ) {
      setFilter(
        key ,
        current.filter( ( v ) => v !== value )
      ) ;
    } else {
      setFilter( key , [ ...current , value ] ) ;
    }
  } ;

  return(
    <div className={styles.popupAnchor}>
      <button
        type="button"
        className={ `${styles.actionBtn} ${( isOpen || ( activeCount > 0 ) ) ? styles.actionBtnActive : ""}` }
        onClick={onToggle}
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
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span>Filtros</span>
        {activeCount > 0 && <span className={styles.badge}>{ activeCount }</span>}
      </button>

      {isOpen && (
        <div className={styles.popup} role="dialog" aria-label="Filter options">
          {filterFields.map( ( field ) => {
            const rawOptions = ( field.options || getUniqueValues( field.key ) ) ;
            const options = Array.from( new Set( ( rawOptions || [] ).filter( ( o ) => ( o !== undefined ) && ( o !== null ) && ( o !== "" ) ) ) ) ;
            const current = ( filters[field.key] || [] ) ;

            return(
              <div key={String( field.key )} className={styles.filterSection}>
                <div className={styles.popupHeader}>
                  <span className={styles.sectionTitle}>{ field.label }</span>
                  <div className={styles.popupHeaderActions}>
                    <button
                      type="button"
                      className={styles.textBtn}
                      onClick={ () => setFilter( field.key , [ ...options ] ) }
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      className={styles.textBtn}
                      onClick={ () => setFilter( field.key , [] ) }
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className={styles.pills}>
                  {options.map( ( opt , idx ) => (
                    <button
                      type="button"
                      key={ `${String( field.key )}-opt-${opt}-${idx}` }
                      className={ `${styles.pill} ${current.includes( opt ) ? styles.pillActive : ""}` }
                      onClick={ () => toggle( field.key , opt ) }
                    >
                      { opt }
                    </button>
                  ) )}
                </div>
              </div>
            ) ;
          } )}
          <div className={styles.popupFooter}>
            <button
              type="button"
              className={styles.resetBtn}
              onClick={clearFilters}
              disabled={!hasActive}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      )}
    </div>
  ) ;
}
