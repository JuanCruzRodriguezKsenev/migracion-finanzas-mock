/**
 * @file EmptyState.tsx
 * Placeholder genérico para listas o secciones sin datos.
 * Centraliza el patrón "sin resultados" para evitar reimplementarlo por feature.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import styles from "./EmptyState.module.css" ;


interface EmptyStateProps {
  title:        string ;
  description?: string ;
  icon?:        React.ReactNode ;
  action?:      React.ReactNode ;
  className?:   string ;
}

/**
 * Renderiza un mensaje centrado con título, descripción opcional, ícono opcional
 * y una acción opcional (ej: un botón para crear el primer registro).
 */
export function EmptyState( {
  title ,
  description ,
  icon ,
  action ,
  className = ""
}: EmptyStateProps ) {
  return(
    <div className={ `${styles.container} ${className}` }>
      { icon && <div className={styles.icon}>{ icon }</div> }
      <p className={styles.title}>{ title }</p>
      { description && <p className={styles.description}>{ description }</p> }
      { action && <div className={styles.action}>{ action }</div> }
    </div>
  ) ;
}
