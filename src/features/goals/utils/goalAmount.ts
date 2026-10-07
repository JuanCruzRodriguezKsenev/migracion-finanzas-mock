/**
 * @file goalAmount.ts
 * Conversión única entre el texto de un monto tecleado y centavos enteros, según los decimales de la divisa.
 * Nunca multiplica por 100 a mano ni pasa por punto flotante (`.agents/AGENTS.md` §8.2).
 */
// Shared
import { getCurrencyDecimalPlaces } from "@/shared/lib/currencyFormatter" ;


/**
 * Convierte un monto tecleado ("1500", "1500,50", "1500.5") a centavos enteros de la divisa.
 *
 * @param text - Texto del campo (acepta coma o punto como separador decimal, sin miles).
 * @param currency - Código ISO de la divisa.
 * @returns Centavos enteros, o `null` si el texto no es un monto válido (vacío, negativo, de más decimales que la divisa).
 */
export function parseAmountToCents( text: string , currency: string ): number | null {
  const clean = text.trim().replace( "," , "." ) ;
  if( !/^\d+(\.\d+)?$/.test( clean ) ) {
    return( null ) ;
  }

  const decimals          = getCurrencyDecimalPlaces( currency ) ;
  const [ whole , frac="" ] = clean.split( "." ) ;
  if( frac.length > decimals ) {
    return( null ) ;
  }

  const cents = Number( whole + frac.padEnd( decimals , "0" ) ) ;
  if( !Number.isSafeInteger( cents ) ) {
    return( null ) ;
  }
  return( cents ) ;
}

/**
 * Convierte centavos a texto editable (para precargar un campo): "150050" ARS → "1500.50".
 *
 * @param cents - Monto en centavos enteros.
 * @param currency - Código ISO de la divisa.
 */
export function centsToInput( cents: number , currency: string ): string {
  const decimals = getCurrencyDecimalPlaces( currency ) ;
  if( decimals === 0 ) {
    return( String( cents ) ) ;
  }

  const digits = String( Math.abs( cents ) ).padStart( decimals + 1 , "0" ) ;
  const whole  = digits.slice( 0 , digits.length - decimals ) ;
  const frac   = digits.slice( digits.length - decimals ) ;
  return( `${cents < 0 ? "-" : ""}${whole}.${frac}` ) ;
}
