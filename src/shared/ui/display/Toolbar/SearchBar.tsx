/**
 * @file SearchBar.tsx
 * Componente interactivo de barra de búsqueda para la Toolbar.
 * @remarks Componente de catálogo — aún sin consumidores en producción.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import styles from "./Toolbar.module.css" ;


interface SearchBarProps {
  query:        string ;
  setQuery:     ( val: string ) => void ;
  placeholder?: string ;
}

export function SearchBar( {query , setQuery , placeholder = "Search..."}: SearchBarProps ) {
  return(
    <div className={styles.searchWrapper}>
      <svg
        className={styles.searchIcon}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        className={styles.searchInput}
        placeholder={placeholder}
        value={query}
        onChange={ ( e ) => setQuery( e.target.value ) }
        aria-label="Search"
      />
      {query && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={ () => setQuery( "" ) }
          aria-label="Clear search"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  ) ;
}
