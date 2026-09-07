/**
 * @file SearchInput.tsx
 * Campo de entrada de búsqueda accesible con icono y botón de reseteo rápido.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import { IconClose } from "@/shared/ui/display/Icons/Icons" ;
import styles        from "./SearchInput.module.css" ;


export interface SearchInputProps {
  value:        string ;
  onChange:     ( val: string ) => void ;
  placeholder?: string ;
  ariaLabel?:   string ;
  className?:   string ;
  onClear?:     () => void ;
}

/**
 * Componente SearchInput estilizado para filtros y búsquedas dinámicas.
 */
export function SearchInput( {
  value ,
  onChange ,
  placeholder = "Buscar..." ,
  ariaLabel = "Buscar" ,
  className = "" ,
  onClear ,
}: SearchInputProps ) {
  const handleClear = () => {
    onChange( "" ) ;
    onClear?.() ;
  } ;

  return(
    <div className={ `${styles.wrapper} ${className}`.trim() }>
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={ ( e ) => onChange( e.target.value ) }
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={styles.input}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className={styles.clearBtn}
          aria-label="Limpiar búsqueda"
        >
          <IconClose size={14} />
        </button>
      )}
    </div>
  ) ;
}
