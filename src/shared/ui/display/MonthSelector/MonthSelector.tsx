/**
 * @file MonthSelector.tsx
 * Selector de mes con navegación por pasos (anterior/siguiente) y un popover
 * con grilla de meses del año en curso. Bloquea la selección de meses futuros
 * respecto a `maxKey`.
 */
"use client" ;

import React , { useState , useRef , useEffect , useMemo , useCallback } from "react" ;
import styles                                                           from "./MonthSelector.module.css" ;

export interface MonthSelectorProps {
  /** Mes seleccionado en formato "YYYY-MM". */
  selectedKey: string ;
  /** Callback invocado con la nueva clave "YYYY-MM" al cambiar de mes. */
  onChange:    ( key: string ) => void ;
  /** Idioma para los nombres de mes ("es" | "en" | "br"). Por defecto "es". */
  lang?:       string ;
  /** Clave "YYYY-MM" mínima seleccionable. Actualmente sin uso en el bloqueo de UI. */
  minKey?:     string ;
  /** Clave "YYYY-MM" máxima seleccionable; bloquea avance a meses futuros. */
  maxKey?:     string ;
  className?:  string ;
  /** Ícono opcional mostrado junto a la etiqueta del botón disparador. */
  icon?:       React.ReactNode ;
}

const MONTH_LABELS_MAP: Record< string , string[] > = {
  es: [ "Ene" , "Feb" , "Mar" , "Abr" , "May" , "Jun" , "Jul" , "Ago" , "Sep" , "Oct" , "Nov" , "Dic" ] ,
  en: [ "Jan" , "Feb" , "Mar" , "Apr" , "May" , "Jun" , "Jul" , "Aug" , "Sep" , "Oct" , "Nov" , "Dec" ] ,
  br: [ "Jan" , "Fev" , "Mar" , "Abr" , "Mai" , "Jun" , "Jul" , "Ago" , "Set" , "Out" , "Nov" , "Dez" ]
} ;

/**
 * Calcula una clave de mes desplazada por un offset de meses.
 */
function getOffsetMonthKey( key: string , offset: number ): string {
  const [ y , m ] = key.split( "-" ).map( Number ) ;
  const date = new Date( y , m - 1 + offset , 1 ) ;
  return( `${date.getFullYear()}-${String( date.getMonth() + 1 ).padStart( 2 , "0" )}` ) ;
}

/**
 * Componente de selección de mes con controles de paso lateral y popover de grilla anual.
 */
export function MonthSelector( {
  selectedKey ,
  onChange ,
  lang = "es" ,
  maxKey ,
  className = "" ,
  icon
}: MonthSelectorProps ) {
  const [ isOpen , setIsOpen ] = useState( false ) ;
  const containerRef = useRef<HTMLDivElement>(null) ;

  // Extraer año y mes seleccionados
  const [ selectedYear , selectedMonthIdx ] = useMemo( () => {
    const parts = selectedKey.split( "-" ) ;
    return( [ Number( parts[0] ) , Number( parts[1] ) - 1 ] ) ;
  } , [ selectedKey ] ) ;

  // Extraer año máximo para bloquear avance futuro
  const maxYear = useMemo( () => {
    if( !maxKey ) { return( new Date().getFullYear() ) ; }
    return( Number( maxKey.split( "-" )[0] ) ) ;
  } , [ maxKey ] ) ;

  // Estado para el año que se está visualizando en la grilla del popover
  const [ viewYear , setViewYear ] = useState( selectedYear ) ;

  // Sincronizar el año visto con el seleccionado al abrir
  const handleTriggerClick = () => {
    if( !isOpen ) {
      setViewYear( selectedYear ) ;
    }
    setIsOpen( (prev) => !prev ) ;
  } ;

  // Registrar listener global solo cuando el popover está abierto
  useEffect( () => {
    if( !isOpen ) { return ; }

    function handleClickOutside( event: MouseEvent ) {
      if( containerRef.current && !containerRef.current.contains( event.target as Node ) ) {
        setIsOpen( false ) ;
      }
    }
    document.addEventListener( "mousedown" , handleClickOutside ) ;
    return( () => {
      document.removeEventListener( "mousedown" , handleClickOutside ) ;
    } ) ;
  } , [ isOpen ] ) ;

  // Obtener etiquetas del mes y año por separado para evitar ocultar el año al truncar
  const labelParts = useMemo( () => {
    const date = new Date( selectedYear , selectedMonthIdx , 1 ) ;
    const monthStr = date.toLocaleDateString( lang === "en" ? "en-US" : lang === "br" ? "pt-BR" : "es-ES" , {month: "long"} ) ;
    const formattedMonth = ( monthStr.charAt( 0 ).toUpperCase() + monthStr.slice( 1 ) ) ;
    return( {
      month: formattedMonth ,
      year:  String( selectedYear )
    } ) ;
  } , [ selectedYear , selectedMonthIdx , lang ] ) ;

  // Nombres cortos de meses en el idioma activo
  const monthLabels = MONTH_LABELS_MAP[lang] || MONTH_LABELS_MAP.es ;

  // Manejar el cambio de año en el navegador (bloqueando avance más allá del año máximo)
  const adjustYear = useCallback( ( amount: number ) => {
    setViewYear( (prev) => {
      const next = prev + amount ;
      if( amount > 0 && next > maxYear ) { return( prev ) ; }
      return( next ) ;
    } ) ;
  } , [ maxYear ] ) ;

  // Manejar selección de mes en la cuadrícula
  const handleMonthSelect = useCallback( ( monthIdx: number ) => {
    const key = `${viewYear}-${String( monthIdx + 1 ).padStart( 2 , "0" )}` ;

    // Permitir selección ilimitada del pasado, pero bloquear futuro
    if( maxKey && (key > maxKey) ) { return ; }

    onChange( key ) ;
    setIsOpen( false ) ;
  } , [ viewYear , maxKey , onChange ] ) ;

  // Ir rápidamente al mes actual (T-0)
  const handleGoToCurrent = useCallback( () => {
    if( maxKey ) {
      onChange( maxKey ) ;
    } else {
      const d = new Date() ;
      const todayKey = `${d.getFullYear()}-${String( d.getMonth() + 1 ).padStart( 2 , "0" )}` ;
      onChange( todayKey ) ;
    }
    setIsOpen( false ) ;
  } , [ maxKey , onChange ] ) ;

  // Calcular claves para controles de paso lateral
  const prevMonthKey   = useMemo( () => getOffsetMonthKey( selectedKey , -1 ) , [ selectedKey ] ) ;
  const nextMonthKey   = useMemo( () => getOffsetMonthKey( selectedKey , 1 )  , [ selectedKey ] ) ;
  const isNextDisabled = useMemo( () => ( !!maxKey && (nextMonthKey > maxKey) ) , [ nextMonthKey , maxKey ] ) ;

  return(
    <div ref={containerRef} className={ `${styles.selectorContainer} ${className}` }>
      {/* Botón de Paso Atrás (Mes Anterior) */}
      <button
        type="button"
        className={styles.stepMonthBtn}
        onClick={ () => onChange( prevMonthKey ) }
        aria-label="Mes anterior"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Selector Desplegable Central */}
      <div className={styles.dropdownWrapper}>
        <button
          type="button"
          className={ `${styles.triggerButton} ${isOpen ? styles.active : ""}` }
          onClick={handleTriggerClick}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <div className={styles.triggerContent}>
            {icon}
            <span className={styles.triggerLabelText}>
              <span className={styles.monthText}>{labelParts.month}</span>
              <span className={styles.yearText}>{labelParts.year}</span>
            </span>
          </div>
          <svg
            className={ `${styles.chevronIcon} ${isOpen ? styles.rotated : ""}` }
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {isOpen ? (
          <div className={styles.gridPopover}>
            {/* Cabecera: Navegador de Año */}
            <div className={styles.yearNavigator}>
              <button
                type="button"
                className={styles.navBtn}
                onClick={ () => adjustYear( -1 ) }
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className={styles.yearLabel}>{viewYear}</span>
              <button
                type="button"
                className={styles.navBtn}
                disabled={viewYear >= maxYear}
                onClick={ () => adjustYear( 1 ) }
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Grilla 3x4 de Meses */}
            <div className={styles.monthsGrid}>
              {monthLabels.map( ( label , index ) => {
                const currentMonthKey = `${viewYear}-${String( index + 1 ).padStart( 2 , "0" )}` ;

                const isSelected = ( viewYear === selectedYear ) && ( index === selectedMonthIdx ) ;

                // Bloquear solo meses futuros respecto al mes actual
                const isDisabled = ( !!maxKey && (currentMonthKey > maxKey) ) ;

                return(
                  <button
                    key={index}
                    type="button"
                    disabled={isDisabled}
                    className={ `
                      ${styles.gridMonthBtn} 
                      ${isSelected ? styles.selected : ""} 
                      ${isDisabled ? styles.disabled : ""}
                    ` }
                    onClick={ () => handleMonthSelect( index ) }
                  >
                    {label}
                  </button>
                ) ;
              } )}
            </div>

            {/* Divisor & Botón Rápido "Hoy / Mes Actual" */}
            <div className={styles.divider} />
            <button
              type="button"
              className={styles.todayBtn}
              onClick={handleGoToCurrent}
            >
              {lang === "en" ? "Go to current month" : lang === "br" ? "Ir para o mês atual" : "Ir al mes actual"}
            </button>
          </div>
        ) : null}
      </div>

      {/* Botón de Paso Adelante (Mes Siguiente) */}
      <button
        type="button"
        disabled={isNextDisabled}
        className={styles.stepMonthBtn}
        onClick={ () => onChange( nextMonthKey ) }
        aria-label="Mes siguiente"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  ) ;
}
