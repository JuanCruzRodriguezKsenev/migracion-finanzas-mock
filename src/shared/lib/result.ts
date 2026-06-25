/**
 * @file result.ts
 * Implementación del Result Pattern para el manejo tipado y seguro de retornos y errores de negocio.
 * Evita el uso de excepciones lanzadas (throw) en flujos de control previsibles.
 */

/**
 * Representa el resultado de una operación que puede ser exitosa o fallida.
 */
export type Result< T , E = string > =
  | { success: true  ; value: T ; error?: never }
  | { success: false ; error: E ; value?: never } ;

/**
 * Genera un resultado exitoso que encapsula el valor de retorno.
 * 
 * @param value - El valor retornado por la operación exitosa.
 * @returns Un objeto Result representando éxito.
 */
export function ok< T >( value: T ): Result< T , never > {
  return( {success: true , value} ) ;
}

/**
 * Genera un resultado fallido que encapsula el error descriptivo.
 * 
 * @param error - El error de negocio (generalmente un string constante o clase de error).
 * @returns Un objeto Result representando falla.
 */
export function fail< E >( error: E ): Result< never , E > {
  return( {success: false , error} ) ;
}
