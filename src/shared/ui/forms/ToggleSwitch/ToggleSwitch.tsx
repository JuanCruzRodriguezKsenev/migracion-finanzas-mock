/**
 * @file ToggleSwitch.tsx
 * Interruptor booleano estilo switch, controlado.
 * @remarks Componente de catálogo — aún sin consumidores en producción.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Local styles
import styles from "./ToggleSwitch.module.css" ;


export interface ToggleSwitchProps {
  checked:   boolean ;
  onChange:  ( val: boolean ) => void ;
  disabled?: boolean ;
  id?:       string ;
}

/**
 * Switch controlado que envuelve un `<input type="checkbox">` accesible.
 */
export function ToggleSwitch( {
  checked ,
  onChange ,
  disabled = false ,
  id
}: ToggleSwitchProps ) {
  function handleChange( e: React.ChangeEvent< HTMLInputElement > ) {
    onChange( e.target.checked ) ;
  }

  return(
    <label className={ `${styles.switch} ${disabled ? styles.disabled : ""}` }>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className={styles.input}
      />
      <span className={styles.slider} />
    </label>
  ) ;
}
