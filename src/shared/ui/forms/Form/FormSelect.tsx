/**
 * @file FormSelect.tsx
 * Select de formulario con label, mensaje de error y texto de ayuda opcionales.
 */
"use client" ;

// Librerías externas
import React , { forwardRef , useId } from "react" ;

// Local styles
import styles from "./Form.module.css" ;


export interface FormSelectProps extends React.SelectHTMLAttributes< HTMLSelectElement > {
  label?:          string ;
  error?:          string ;
  helperText?:     string ;
  containerStyle?: React.CSSProperties ;
}

/**
 * Select controlado/no controlado con soporte de referencia (`forwardRef`).
 */
export const FormSelect = forwardRef< HTMLSelectElement , FormSelectProps >( function FormSelect( {
  label ,
  error ,
  helperText ,
  id ,
  className = "" ,
  disabled ,
  required ,
  children ,
  containerStyle ,
  ...props
} , ref ) {
  const generatedId = useId() ;
  const selectId    = ( id || generatedId ) ;
  const hasError    = !!error ;

  return(
    <div 
      className={ `${styles.formGroup} ${disabled ? styles.disabled : ""}` }
      style={containerStyle}
    >
      {label && (
        <label htmlFor={selectId} className={styles.label}>
          { label }
          {required && <span className={styles.required}> *</span>}
        </label>
      )}
      <div className={styles.selectWrapper}>
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          required={required}
          className={ `${styles.select} ${hasError ? styles.selectError : ""} ${className}` }
          aria-invalid={hasError}
          aria-describedby={ hasError ? `${selectId}-error` : undefined }
          {...props}
        >
          { children }
        </select>
      </div>
      {hasError ? (
        <p id={ `${selectId}-error` } className={styles.errorText}>
          { error }
        </p>
      ) : helperText ? (
        <p className={styles.helperText}>{ helperText }</p>
      ) : null}
    </div>
  ) ;
} ) ;

FormSelect.displayName = "FormSelect" ;
