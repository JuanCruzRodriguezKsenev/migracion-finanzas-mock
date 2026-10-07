/**
 * @file ProgressBar.tsx
 * Barra de progreso accesible con estado semántico (ok / warning / danger).
 * El valor no tiene tope (para mostrar 104 %), pero el ancho visual se recorta al 100 %.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import styles from "./ProgressBar.module.css" ;


export type ProgressBarState = "ok" | "warning" | "danger" ;

export interface ProgressBarProps {
  /** Porcentaje 0-100 o más, sin tope: el exceso se informa por texto, no por ancho. */
  value:      number ;
  /** Estado semántico que decide el color. El estado también debe ir en texto junto a la barra. */
  state:      ProgressBarState ;
  /** Texto para lectores de pantalla (incluye el valor y el estado). */
  label:      string ;
  className?: string ;
}

/**
 * Anchos visual y semántico: ambos se recortan al rango 0-100.
 */
export function anchoVisual( value: number ): number {
  if( !Number.isFinite( value ) ) {
    return( 0 ) ;
  }
  return( Math.min( 100 , Math.max( 0 , value ) ) ) ;
}

/**
 * Barra de progreso. Sin transición de ancho al montar ni cambios de tamaño en `:hover`.
 */
export function ProgressBar( { value , state , label , className = "" }: ProgressBarProps ) {
  const ancho = anchoVisual( value ) ;

  return(
    <div
      className={ `${styles.track} ${className}` }
      role="progressbar"
      aria-valuenow={Math.round( ancho )}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={label}
      aria-label={label}
    >
      <div
        className={ `${styles.fill} ${styles[state]}` }
        style={{width: `${ancho}%`}}
        data-testid="progress-fill"
      />
    </div>
  ) ;
}
