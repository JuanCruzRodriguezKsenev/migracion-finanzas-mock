/**
 * @file paisBusqueda.ts
 * Resolución de contexto de país y sufijos de dominio comercial para la búsqueda
 * de marcas a partir de la tabla compartida de países (@/shared/data/countries.json).
 */

// Shared: Data
import countriesData from "@/shared/data/countries.json" ;

/** Entrada de país definida en la tabla countries.json. */
interface EntradaPais {
  code:  string ;
  label: string ;
  name:  string ;
  tld:   string ;
}

/** Contexto de país que consume `estrategiaVerificados`. */
export interface ContextoPais {
  sufijo: string ;
  nombre: string ;
}

/**
 * Traduce un código ISO de dos letras (sin distinguir mayúsculas) al sufijo de dominio
 * comercial del país y su nombre, según `@/shared/data/countries.json`.
 * Devuelve `null` si el código está vacío, ausente o no figura en la tabla.
 * No valida el formato: eso lo hace quien recibe el parámetro.
 */
export function contextoPaisDeBusqueda( codigo: string | null | undefined ): ContextoPais | null {
  if( !codigo ) {
    return( null ) ;
  }

  const limpio = codigo.trim().toUpperCase() ;
  if( !limpio ) {
    return( null ) ;
  }

  const entrada = ( countriesData as EntradaPais[] ).find( ( c ) => c.code === limpio ) ;
  if( !entrada ) {
    return( null ) ;
  }

  return( {
    sufijo: entrada.tld ,
    nombre: entrada.name
  } ) ;
}
