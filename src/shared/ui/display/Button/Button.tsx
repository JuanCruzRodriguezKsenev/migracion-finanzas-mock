/**
 * @file Button.tsx
 * Componente de botón interactivo genérico y reutilizable de FinanzIA.
 * Soporta variantes estéticas, estados de carga accesibles e iconos integrados.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import styles from "./Button.module.css" ;


interface ButtonProps extends React.ButtonHTMLAttributes< HTMLButtonElement > {
  variant?:      "primary" | "secondary" | "outline" | "danger" ;
  isLoading?:    boolean ;
  icon?:         React.ReactNode ;
  /** Etiqueta accesible del spinner de carga. Por defecto "Cargando". */
  loadingLabel?: string ;
}

export function Button( {
  children ,
  variant = "primary" ,
  isLoading = false ,
  icon ,
  loadingLabel = "Cargando" ,
  className = "" ,
  ...props
}: ButtonProps ) {
  const variantClass = ( styles[variant] || styles.primary ) ;

  return(
    <button
      className={ `${styles.btn} ${variantClass} ${className}` }
      disabled={ isLoading || props.disabled }
      aria-busy={ isLoading }
      {...props}
    >
      {isLoading ? (
        <span className={styles.spinner} aria-label={loadingLabel} />
      ) : (
        icon && <span className={styles.icon}>{ icon }</span>
      )}
      <span>{ children }</span>
    </button>
  ) ;
}
