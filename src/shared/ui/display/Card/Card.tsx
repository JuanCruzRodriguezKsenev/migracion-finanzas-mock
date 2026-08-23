/**
 * @file Card.tsx
 * Componente contenedor genérico tipo tarjeta.
 * Soporta estados interactivos (hovers, focos de accesibilidad, clics por teclado).
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import styles from "./Card.module.css" ;


interface CardProps {
  children:     React.ReactNode ;
  className?:   string ;
  noPadding?:   boolean ;
  interactive?: boolean ;
  onClick?:     () => void ;
  style?:       React.CSSProperties ;
}

/**
 * Componente de tarjeta base interactivo y accesible.
 */
export function Card( {
  children ,
  className = "" ,
  noPadding = false ,
  interactive = false ,
  onClick ,
  style
}: CardProps ) {
  // Corrección de lógica de accesibilidad
  const isClickable = !!onClick ;

  const classes = [
    styles.card ,
    noPadding ? styles.noPadding : "" ,
    ( interactive || isClickable ) ? styles.interactive : "" ,
    className
  ].filter( Boolean ).join( " " ) ;

  function handleKeyDown( event: React.KeyboardEvent< HTMLDivElement > ) {
    if( onClick && ( ( event.key === "Enter" ) || ( event.key === " " ) ) ) {
      event.preventDefault() ;
      onClick() ;
    }
  }

  return(
    <div
      className={classes}
      onClick={onClick}
      role={ isClickable ? "button" : undefined }
      tabIndex={ isClickable ? 0 : undefined }
      onKeyDown={ isClickable ? handleKeyDown : undefined }
      style={style}
    >
      { children }
    </div>
  ) ;
}
