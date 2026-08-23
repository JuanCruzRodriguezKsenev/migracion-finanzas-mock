/**
 * @file Autocomplete.tsx
 * Campo de texto con lista de sugerencias flotante y navegación por teclado.
 * No conoce el origen de las opciones (API externa, datos locales, etc.):
 * el componente padre resuelve la búsqueda y pasa las opciones ya calculadas.
 */
"use client" ;

// Librerías externas
import React , { useState , useRef , useEffect } from "react" ;

// Shared
import { FormInput } from "@/shared/ui/forms/Form/FormInput" ;
import styles         from "./Autocomplete.module.css" ;


export interface AutocompleteOption {
  key:       string ;
  label:     string ;
  sublabel?: string ;
  icon?:     React.ReactNode ;
  trailing?: React.ReactNode ;
}

interface AutocompleteProps {
  value:        string ;
  onChange:     ( value: string ) => void ;
  options:      AutocompleteOption[] ;
  onSelect:     ( option: AutocompleteOption ) => void ;
  isOpen:       boolean ;
  onOpenChange: ( open: boolean ) => void ;
  label?:       string ;
  placeholder?: string ;
  disabled?:    boolean ;
  required?:    boolean ;
}

/**
 * Input de texto con dropdown de sugerencias posicionado de forma absoluta.
 * Soporta navegación con flechas ↑↓, selección con Enter, cierre con Escape
 * y cierre al hacer clic fuera del componente.
 */
export function Autocomplete( {
  value ,
  onChange ,
  options ,
  onSelect ,
  isOpen ,
  onOpenChange ,
  label ,
  placeholder ,
  disabled = false ,
  required = false
}: AutocompleteProps ) {
  const [ activeIndex , setActiveIndex ] = useState( -1 ) ;
  const containerRef = useRef< HTMLDivElement >( null ) ;

  // Reiniciar el índice activo cada vez que cambia el set de opciones.
  // Se ajusta durante el render (patrón oficial de React para "resetear estado
  // ante un cambio de prop") en vez de en un efecto, para evitar un ciclo de
  // render adicional con el índice viejo aún activo.
  const [ prevOptions , setPrevOptions ] = useState( options ) ;
  if( options !== prevOptions ) {
    setPrevOptions( options ) ;
    setActiveIndex( -1 ) ;
  }

  // Cerrar el dropdown al hacer clic fuera del componente
  useEffect( () => {
    const handleClickOutside = ( event: MouseEvent ) => {
      if( containerRef.current && !containerRef.current.contains( event.target as Node ) ) {
        onOpenChange( false ) ;
      }
    } ;
    document.addEventListener( "mousedown" , handleClickOutside ) ;
    return( () => document.removeEventListener( "mousedown" , handleClickOutside ) ) ;
  } , [ onOpenChange ] ) ;

  function handleKeyDown( e: React.KeyboardEvent ) {
    if( !isOpen || ( options.length === 0 ) ) { return ; }

    if( e.key === "ArrowDown" ) {
      e.preventDefault() ;
      setActiveIndex( ( prev ) => ( prev < options.length - 1 ? prev + 1 : prev ) ) ;
    } else if( e.key === "ArrowUp" ) {
      e.preventDefault() ;
      setActiveIndex( ( prev ) => ( prev > 0 ? prev - 1 : -1 ) ) ;
    } else if( e.key === "Enter" ) {
      if( ( activeIndex >= 0 ) && ( activeIndex < options.length ) ) {
        e.preventDefault() ;
        onSelect( options[activeIndex] ) ;
      }
    } else if( e.key === "Escape" ) {
      onOpenChange( false ) ;
    }
  }

  return(
    <div ref={containerRef} className={styles.container}>
      <FormInput
        label={label}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={ ( e ) => onChange( e.target.value ) }
        onKeyDown={handleKeyDown}
        disabled={disabled}
        required={required}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-autocomplete="list"
      />

      {isOpen && ( options.length > 0 ) && (
        <ul className={styles.dropdown} role="listbox">
          {options.map( ( option , idx ) => (
            <li
              key={option.key}
              role="option"
              aria-selected={activeIndex === idx}
              onClick={ () => onSelect( option ) }
              onMouseEnter={ () => setActiveIndex( idx ) }
              className={ `${styles.option} ${activeIndex === idx ? styles.optionActive : ""}` }
            >
              {option.icon && <span className={styles.optionIcon}>{ option.icon }</span>}
              <div className={styles.optionText}>
                <span className={styles.optionLabel}>{ option.label }</span>
                {option.sublabel && <span className={styles.optionSublabel}>{ option.sublabel }</span>}
              </div>
              {option.trailing && <span className={styles.optionTrailing}>{ option.trailing }</span>}
            </li>
          ) )}
        </ul>
      )}
    </div>
  ) ;
}
