/**
 * @file RadioGroup.tsx
 * Grupo de opciones de radio button accesible (`fieldset`/`legend`), soportando
 * uso controlado (`value`) o no controlado (`defaultValue`).
 * @remarks Componente de catálogo — aún sin consumidores en producción.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Local styles
import styles from "./RadioGroup.module.css" ;


interface RadioOption {
  value: string | number ;
  label: string ;
}

interface RadioGroupProps {
  id?:           string ;
  name:          string ;
  options:       RadioOption[] ;
  defaultValue?: string | number ;
  value?:        string | number ;
  onChange?:     ( value: string | number ) => void ;
  label?:        string ;
  required?:     boolean ;
  error?:        string ;
}

/**
 * Renderiza un `fieldset` de opciones de radio con label, mensaje de error y soporte a11y.
 */
export default function RadioGroup( {
  id ,
  name ,
  options ,
  defaultValue ,
  value ,
  onChange ,
  label ,
  required ,
  error
}: RadioGroupProps ) {
  const labelId      = ( label ? `${name}-label` : undefined ) ;
  const errorId      = ( error ? `${name}-error` : undefined ) ;
  const isControlled = ( value !== undefined ) ;

  return(
    <fieldset className={styles.radioField} id={id}>
      {label && (
        <legend className={styles.label} id={labelId}>
          { label }
          {required && <span className={styles.required}> *</span>}
        </legend>
      )}
      <div className={styles.radioTrack} aria-describedby={errorId} aria-invalid={!!error}>
        {options.map( ( opt ) => {
          const checkedProps = isControlled
            ? { checked: value === opt.value }
            : { defaultChecked: defaultValue === opt.value } ;

          return(
            <label key={opt.value} className={styles.radioOption}>
              <input
                type="radio"
                name={name}
                value={opt.value}
                {...checkedProps}
                onChange={ () => onChange?.( opt.value ) }
                required={required}
                className={styles.radioInput}
              />
              <span className={styles.radioCircle} />
              <span className={styles.radioText}>{ opt.label }</span>
            </label>
          ) ;
        } )}
      </div>

      {error && (
        <span className={styles.errorText} id={errorId}>
          { error }
        </span>
      )}
    </fieldset>
  ) ;
}
