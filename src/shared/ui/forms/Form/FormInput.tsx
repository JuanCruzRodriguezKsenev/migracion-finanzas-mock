/**
 * @file FormInput.tsx
 * Campo de texto de formulario con label, mensaje de error y texto de ayuda opcionales.
 */
"use client" ;

// Librerías externas
import React , { forwardRef , useId } from "react" ;

// Local styles
import styles from "./Form.module.css" ;


export interface FormInputProps extends React.InputHTMLAttributes< HTMLInputElement > {
  label?:          string ;
  error?:          string ;
  helperText?:     string ;
  /** Estilos aplicados al `div` contenedor (ej: ancho fijo de un color picker). Único uso de estilo inline permitido: valor dinámico por instancia. */
  containerStyle?: React.CSSProperties ;
}

/**
 * Input de texto controlado/no controlado con soporte de referencia (`forwardRef`).
 */
export const FormInput = forwardRef< HTMLInputElement , FormInputProps >( function FormInput( {
  label ,
  error ,
  helperText ,
  id ,
  className = "" ,
  disabled ,
  required ,
  containerStyle ,
  ...props
} , ref ) {
  const generatedId = useId() ;
  const inputId     = ( id || generatedId ) ;
  const hasError    = !!error ;

  return(
    <div 
      className={ `${styles.formGroup} ${disabled ? styles.disabled : ""}` }
      style={containerStyle}
    >
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          { label }
          {required && <span className={styles.required}> *</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        disabled={disabled}
        required={required}
        className={ `${styles.input} ${hasError ? styles.inputError : ""} ${className}` }
        aria-invalid={hasError}
        aria-describedby={ hasError ? `${inputId}-error` : undefined }
        {...props}
      />
      {hasError ? (
        <p id={ `${inputId}-error` } className={styles.errorText}>
          { error }
        </p>
      ) : helperText ? (
        <p className={styles.helperText}>{ helperText }</p>
      ) : null}
    </div>
  ) ;
} ) ;

FormInput.displayName = "FormInput" ;
