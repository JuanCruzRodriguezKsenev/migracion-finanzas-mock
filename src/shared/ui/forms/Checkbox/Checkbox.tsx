/**
 * @file Checkbox.tsx
 * Casilla de verificación accesible con label, descripción y estado de error opcionales.
 * @remarks Componente de catálogo — aún sin consumidores en producción.
 */
"use client" ;

// Librerías externas
import React , { forwardRef , useId } from "react" ;

// Local styles
import styles from "./Checkbox.module.css" ;


interface CheckboxProps extends Omit< React.InputHTMLAttributes< HTMLInputElement > , "type" > {
  label?:       string ;
  description?: string ;
  error?:       string ;
}

/**
 * Checkbox controlado o no controlado con soporte de referencia (`forwardRef`).
 */
export const Checkbox = forwardRef< HTMLInputElement , CheckboxProps >( function Checkbox( {
  label ,
  description ,
  error ,
  className = "" ,
  ...props
} , ref ) {
  const generatedId = useId() ;
  const id          = ( props.id || generatedId ) ;
  const errorId     = ( error ? `${id}-error` : undefined ) ;

  return(
    <div className={ `${styles.checkboxWrapper} ${className}` }>
      <label className={styles.checkboxLabel}>
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className={styles.checkboxInput}
          aria-invalid={!!error}
          aria-describedby={errorId}
          {...props}
        />
        <span
          className={ `${styles.checkboxCustom} ${error ? styles.checkboxCustomError : ""}` }
        />
        {label && (
          <span className={styles.checkboxText}>
            { label }
            {props.required && <span className={styles.required}> *</span>}
          </span>
        )}
      </label>
      {description && (
        <span className={styles.checkboxDescription}>{ description }</span>
      )}
      {error && (
        <span className={styles.errorText} id={errorId}>
          { error }
        </span>
      )}
    </div>
  ) ;
} ) ;

Checkbox.displayName = "Checkbox" ;
export default Checkbox ;
