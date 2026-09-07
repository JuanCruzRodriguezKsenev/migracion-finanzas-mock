/**
 * @file MonthSelector.tsx
 * Selector de mes con navegación por pasos (anterior/siguiente) y un popover
 * con grilla de meses del año en curso. Bloquea la selección de meses futuros
 * respecto a `maxKey`.
 */
"use client" ;

import React , { useState , useRef , useEffect , useMemo , useCallback , useId } from "react" ;
import styles                                                           from "./MonthSelector.module.css" ;

export interface MonthSelectorDictionary {
  prevMonth?:       string ;
  nextMonth?:       string ;
  prevYear?:        string ;
  nextYear?:        string ;
  currentMonth?:    string ;
  selectMonth?:     string ;
  dialogAriaLabel?: string ;
}

export interface MonthSelectorProps {
  /** Mes seleccionado en formato "YYYY-MM". */
  selectedKey: string ;
  /** Callback invocado con la nueva clave "YYYY-MM" al cambiar de mes. */
  onChange:    ( key: string ) => void ;
  /** Idioma para los nombres de mes ("es" | "en" | "br"). Por defecto "es". */
  lang?:       string ;
  /** Clave "YYYY-MM" mínima seleccionable. */
  minKey?:     string ;
  /** Clave "YYYY-MM" máxima seleccionable; bloquea avance a meses futuros. */
  maxKey?:     string ;
  /** Clave "YYYY-MM" del mes actual; si no se provee usa maxKey o la fecha actual del sistema. */
  todayKey?:   string ;
  className?:  string ;
  /** Ícono opcional mostrado junto a la etiqueta del botón disparador. */
  icon?:       React.ReactNode ;
  /** Diccionario para accesibilidad y traducciones. */
  dict?:       MonthSelectorDictionary ;
}

/**
 * Obtiene las etiquetas cortas de los 12 meses internacionalizadas según el locale.
 */
export function getLocalizedMonthShortLabels( lang: string = "es" ): string[] {
  const locale    = lang === "en" ? "en-US" : lang === "br" ? "pt-BR" : "es-ES" ;
  const formatter = new Intl.DateTimeFormat( locale , {month: "short"} ) ;
  const labels: string[] = [] ;
  for( let m = 0 ; m < 12 ; m++ ) {
    const d   = new Date( 2026 , m , 1 ) ;
    const raw = formatter.format( d ).replace( "." , "" ) ;
    const capitalized = ( raw.charAt( 0 ).toUpperCase() + raw.slice( 1 ) ) ;
    labels.push( capitalized ) ;
  }
  return( labels ) ;
}

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
  minKey ,
  maxKey ,
  todayKey ,
  className = "" ,
  icon ,
  dict
}: MonthSelectorProps ) {
  const dialogId     = useId() ;
  const [ isOpen , setIsOpen ] = useState( false ) ;
  const containerRef = useRef<HTMLDivElement>( null ) ;
  const triggerRef   = useRef<HTMLButtonElement>( null ) ;

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

  // Extraer año mínimo para bloquear retroceso a años sin datos (M3)
  const minYear = useMemo( () => {
    if( !minKey ) { return( undefined ) ; }
    return( Number( minKey.split( "-" )[0] ) ) ;
  } , [ minKey ] ) ;

  // Clave del mes actual efectivo para el botón rápido (M4)
  const effectiveTodayKey = useMemo( () => {
    if( todayKey ) { return( todayKey ) ; }
    if( maxKey )   { return( maxKey ) ; }
    const d = new Date() ;
    return( `${d.getFullYear()}-${String( d.getMonth() + 1 ).padStart( 2 , "0" )}` ) ;
  } , [ todayKey , maxKey ] ) ;

  // Estado para el año que se está visualizando en la grilla del popover
  const [ viewYear , setViewYear ] = useState( selectedYear ) ;

  // Sincronizar el año visto con el seleccionado al abrir
  const handleTriggerClick = () => {
    if( !isOpen ) {
      setViewYear( selectedYear ) ;
    }
    setIsOpen( ( prev ) => !prev ) ;
  } ;

  // Manejar Escape y clics afuera del popover para a11y (M6)
  useEffect( () => {
    if( !isOpen ) { return ; }

    function handleKeyDown( event: KeyboardEvent ) {
      if( event.key === "Escape" ) {
        setIsOpen( false ) ;
        triggerRef.current?.focus() ;
      }
    }

    function handleClickOutside( event: MouseEvent ) {
      if( containerRef.current && !containerRef.current.contains( event.target as Node ) ) {
        setIsOpen( false ) ;
      }
    }

    document.addEventListener( "keydown" , handleKeyDown ) ;
    document.addEventListener( "mousedown" , handleClickOutside ) ;
    return( () => {
      document.removeEventListener( "keydown" , handleKeyDown ) ;
      document.removeEventListener( "mousedown" , handleClickOutside ) ;
    } ) ;
  } , [ isOpen ] ) ;

  // Obtener etiquetas del mes y año por separado para evitar ocultar el año al truncar
  const labelParts = useMemo( () => {
    const date = new Date( selectedYear , selectedMonthIdx , 1 ) ;
    const locale = lang === "en" ? "en-US" : lang === "br" ? "pt-BR" : "es-ES" ;
    const monthStr = date.toLocaleDateString( locale , {month: "long"} ) ;
    const formattedMonth = ( monthStr.charAt( 0 ).toUpperCase() + monthStr.slice( 1 ) ) ;
    return( {
      month: formattedMonth ,
      year:  String( selectedYear )
    } ) ;
  } , [ selectedYear , selectedMonthIdx , lang ] ) ;

  // Nombres cortos de meses generados dinámicamente con Intl (M5b)
  const monthLabels = useMemo( () => getLocalizedMonthShortLabels( lang ) , [ lang ] ) ;

  // Manejar el cambio de año en el navegador (bloqueando avance más allá del máximo o retroceso antes del mínimo)
  const adjustYear = useCallback( ( amount: number ) => {
    setViewYear( ( prev ) => {
      const next = ( prev + amount ) ;
      if( (amount > 0) && (next > maxYear) ) { return( prev ) ; }
      if( (amount < 0) && (minYear !== undefined) && (next < minYear) ) { return( prev ) ; }
      return( next ) ;
    } ) ;
  } , [ maxYear , minYear ] ) ;

  // Manejar selección de mes en la cuadrícula
  const handleMonthSelect = useCallback( ( monthIdx: number ) => {
    const key = `${viewYear}-${String( monthIdx + 1 ).padStart( 2 , "0" )}` ;

    // Bloquear selecciones fuera del rango [minKey, maxKey]
    if( maxKey && (key > maxKey) ) { return ; }
    if( minKey && (key < minKey) ) { return ; }

    onChange( key ) ;
    setIsOpen( false ) ;
    triggerRef.current?.focus() ;
  } , [ viewYear , maxKey , minKey , onChange ] ) ;

  // Ir rápidamente al mes actual (M4)
  const handleGoToCurrent = useCallback( () => {
    onChange( effectiveTodayKey ) ;
    const [ targetYear ] = effectiveTodayKey.split( "-" ).map( Number ) ;
    setViewYear( targetYear ) ;
    setIsOpen( false ) ;
    triggerRef.current?.focus() ;
  } , [ effectiveTodayKey , onChange ] ) ;

  // Textos accesibles e internacionalizados (S7/M5)
  const prevLabel             = dict?.prevMonth || ( lang === "en" ? "Previous month" : lang === "br" ? "Mês anterior" : "Mes anterior" ) ;
  const nextLabel             = dict?.nextMonth || ( lang === "en" ? "Next month" : lang === "br" ? "Próximo mês" : "Mes siguiente" ) ;
  const prevYearLabel         = dict?.prevYear || ( lang === "en" ? "Previous year" : lang === "br" ? "Ano anterior" : "Año anterior" ) ;
  const nextYearLabel         = dict?.nextYear || ( lang === "en" ? "Next year" : lang === "br" ? "Próximo ano" : "Año siguiente" ) ;
  const triggerLabel          = dict?.selectMonth || ( lang === "en" ? "Select month" : lang === "br" ? "Selecionar mês" : "Seleccionar mes" ) ;
  const dialogLabel           = dict?.dialogAriaLabel || ( lang === "en" ? "Month and year selector" : lang === "br" ? "Seletor de mês e ano" : "Selector de mes y año" ) ;
  const currentMonthBtnLabel  = dict?.currentMonth || ( lang === "en" ? "Go to current month" : lang === "br" ? "Ir para o mês atual" : "Ir al mes actual" ) ;

  // Calcular claves para controles de paso lateral
  const prevMonthKey   = useMemo( () => getOffsetMonthKey( selectedKey , -1 ) , [ selectedKey ] ) ;
  const nextMonthKey   = useMemo( () => getOffsetMonthKey( selectedKey , 1 )  , [ selectedKey ] ) ;
  const isPrevDisabled = useMemo( () => ( !!minKey && (prevMonthKey < minKey) ) , [ prevMonthKey , minKey ] ) ;
  const isNextDisabled = useMemo( () => ( !!maxKey && (nextMonthKey > maxKey) ) , [ nextMonthKey , maxKey ] ) ;

  return(
    <div ref={containerRef} className={ `${styles.selectorContainer} ${className}` }>
      {/* Botón de Paso Atrás (Mes Anterior) */}
      <button
        type="button"
        disabled={isPrevDisabled}
        className={styles.stepMonthBtn}
        onClick={ () => onChange( prevMonthKey ) }
        aria-label={prevLabel}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Selector Desplegable Central */}
      <div className={styles.dropdownWrapper}>
        <button
          ref={triggerRef}
          type="button"
          className={ `${styles.triggerButton} ${isOpen ? styles.active : ""}` }
          onClick={handleTriggerClick}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-controls={dialogId}
          aria-label={triggerLabel}
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
          <div
            id={dialogId}
            role="dialog"
            aria-label={dialogLabel}
            className={styles.gridPopover}
          >
            {/* Cabecera: Navegador de Año */}
            <div className={styles.yearNavigator}>
              <button
                type="button"
                className={styles.navBtn}
                disabled={ (minYear !== undefined) && (viewYear <= minYear) }
                onClick={ () => adjustYear( -1 ) }
                aria-label={prevYearLabel}
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
                aria-label={nextYearLabel}
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

                // Bloquear meses futuros respecto a maxKey o pasados respecto a minKey (M3)
                const isDisabled = ( (!!maxKey && (currentMonthKey > maxKey)) || (!!minKey && (currentMonthKey < minKey)) ) ;

                const btnClass = [
                  styles.gridMonthBtn ,
                  isSelected ? styles.selected : "" ,
                  isDisabled ? styles.disabled : ""
                ].filter( Boolean ).join( " " ) ;

                return(
                  <button
                    key={index}
                    type="button"
                    disabled={isDisabled}
                    className={btnClass}
                    onClick={ () => handleMonthSelect( index ) }
                  >
                    {label}
                  </button>
                ) ;
              } )}
            </div>

            {/* Botón Rápido "Hoy / Mes Actual" */}
            <button
              type="button"
              className={styles.todayBtn}
              onClick={handleGoToCurrent}
            >
              {currentMonthBtnLabel}
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
        aria-label={nextLabel}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  ) ;
}
