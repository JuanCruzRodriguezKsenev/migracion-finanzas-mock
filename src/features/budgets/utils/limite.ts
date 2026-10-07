/**
 * @file limite.ts
 * Conversión entre el texto del campo "límite" y centavos enteros (RFC 028 §5).
 * Es el único punto donde un texto se vuelve centavos; no hay aritmética de coma flotante.
 */
// Shared
import { getCurrencyDecimalPlaces } from "@/shared/lib/currencyFormatter" ;


export type ResultadoLimite =
  | { ok: true ; centavos: number }
  | { ok: false ; motivo: "invalido" | "no_positivo" } ;

/**
 * Convierte el texto de un importe a centavos enteros según los decimales de la divisa.
 * Acepta punto o coma como separador decimal; rechaza miles, texto y más decimales de los que admite la divisa.
 *
 * @param texto - Lo que escribió el usuario.
 * @param divisa - Código ISO de la divisa (define los decimales).
 * @returns Los centavos, o el motivo del rechazo.
 */
export function limiteACentavos( texto: string , divisa: string ): ResultadoLimite {
  const limpio = texto.trim().replace( "," , "." ) ;

  if( !/^-?[0-9]+(\.[0-9]+)?$/.test( limpio ) ) {
    return( { ok: false , motivo: "invalido" } ) ;
  }

  const negativo  = limpio.startsWith( "-" ) ;
  const [ entera , fraccion = "" ] = limpio.replace( "-" , "" ).split( "." ) ;
  const decimales = getCurrencyDecimalPlaces( divisa ) ;

  if( fraccion.length > decimales ) {
    return( { ok: false , motivo: "invalido" } ) ;
  }

  const centavos = Number( entera + fraccion.padEnd( decimales , "0" ) ) ;

  if( !Number.isSafeInteger( centavos ) ) {
    return( { ok: false , motivo: "invalido" } ) ;
  }
  if( negativo || (centavos <= 0) ) {
    return( { ok: false , motivo: "no_positivo" } ) ;
  }

  return( { ok: true , centavos } ) ;
}

/**
 * Texto editable de un importe en centavos, con los decimales de la divisa (ej: 150050 ARS -> "1500.50").
 *
 * @param centavos - Importe entero en la unidad mínima.
 * @param divisa - Código ISO de la divisa.
 * @returns Texto sin separador de miles.
 */
export function centavosALimite( centavos: number , divisa: string ): string {
  const decimales = getCurrencyDecimalPlaces( divisa ) ;
  const digitos   = String( Math.abs( centavos ) ).padStart( decimales + 1 , "0" ) ;

  if( decimales === 0 ) {
    return( digitos ) ;
  }

  return( `${digitos.slice( 0 , -decimales )}.${digitos.slice( -decimales )}` ) ;
}
