/**
 * @file FormError.tsx
 * Banner de error de formulario, accesible vía `role="alert"`. No renderiza nada si `error` está vacío.
 */
// Librerías externas
import React from "react" ;

// Local styles
import styles from "./Form.module.css" ;


interface FormErrorProps {
  error:      string ;
  className?: string ;
}

/**
 * Muestra un mensaje de error de formulario, o `null` si no hay error.
 */
export function FormError( { error , className = "" }: FormErrorProps ) {
  if( !error ) {
    return( null ) ;
  }
  return(
    <div 
      className={ `${styles.formErrorAlert} ${className}` } 
      role="alert"
    >
      { error }
    </div>
  ) ;
}
