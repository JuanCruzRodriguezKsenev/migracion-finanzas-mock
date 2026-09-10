/**
 * @file safeStorage.ts
 * Acceso tolerante a `localStorage`. El Storage no está garantizado en todos los runtimes:
 * en SSR no existe, en Safari y en Firefox con cookies de terceros bloqueadas leer la
 * propiedad `window.localStorage` lanza `SecurityError`, y bajo jsdom + Node el accessor
 * nativo devuelve `undefined`. Toda lectura o escritura de preferencias pasa por acá.
 */

/**
 * Lee una clave del almacenamiento local sin propagar errores del entorno.
 *
 * @param key - Clave a leer.
 * @returns El valor almacenado, o `null` si no existe o el Storage no está disponible.
 */
export function readStorage( key: string ): string | null {
  if( typeof window === "undefined" ) { return( null ) ; }

  try {
    return( window.localStorage?.getItem( key ) ?? null ) ;
  } catch {
    // Storage bloqueado o no disponible — se opera sin preferencia persistida
    return( null ) ;
  }
}

/**
 * Escribe una clave en el almacenamiento local sin propagar errores del entorno.
 *
 * @param key - Clave a escribir.
 * @param value - Valor a persistir.
 * @returns `true` si la escritura se concretó, `false` si el Storage no estaba disponible.
 */
export function writeStorage( key: string , value: string ): boolean {
  if( typeof window === "undefined" ) { return( false ) ; }

  try {
    window.localStorage?.setItem( key , value ) ;
    return( true ) ;
  } catch {
    // Storage bloqueado o cuota excedida — la preferencia no se persiste
    return( false ) ;
  }
}
