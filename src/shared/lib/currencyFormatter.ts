/**
 * @file currencyFormatter.ts
 * Utilidad compartida de internacionalización (i18n) para el formateo de monedas locales de manera escalable.
 */

/** Cache en memoria para almacenar los decimales de cada divisa consultada y evitar instanciaciones redundantes de Intl. */
const decimalPlacesCache: Record< string , number > = {} ;

/**
 * Obtiene dinámicamente la cantidad de decimales de una divisa usando las API de internacionalización nativas.
 * 
 * @param currencyCode - Código ISO de la divisa (ej: 'ARS', 'USD', 'JPY', 'KWD').
 * @returns El número de dígitos decimales que corresponden a la divisa.
 */
export function getCurrencyDecimalPlaces( currencyCode: string ): number {
  const code = currencyCode.toUpperCase() ;
  
  if( decimalPlacesCache[code] !== undefined ) { return( decimalPlacesCache[code] ) ; }

  try {
    const formatter = new Intl.NumberFormat( "en-US" , {
      style:    "currency" ,
      currency: code ,
    } ) ;
    
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2 ;
    
    decimalPlacesCache[code] = digits ;
    
    return( digits ) ;
  } catch( error ) {
    // Si la divisa no es soportada o es inválida, se asume el estándar de 2 decimales
    return( 2 ) ;
  }
}

/**
 * Formatea un monto en la sub-unidad entera (centavos o equivalente) a su representación en divisa local.
 * Soporta de manera escalable e internacionalizada cualquier divisa del mundo resolviendo su factor en runtime.
 * 
 * @param amount - Monto en la unidad más pequeña de la divisa (ej: centavos).
 * @param currencyCode - Código ISO de la divisa (ej: 'ARS', 'USD').
 * @param locale - Localización del formateo (ej: 'es-AR', 'en-US').
 * @returns El monto formateado como cadena de texto (ej: "$1.234,56").
 */
export function formatCurrency( amount: number , currencyCode: string , locale: string ): string {
  const decimals     = getCurrencyDecimalPlaces( currencyCode ) ;
  const factor       = Math.pow( 10 , decimals ) ;
  const decimalValue = ( amount / factor ) ;
  
  return( new Intl.NumberFormat(locale , {style: "currency" , currency: currencyCode}).format(decimalValue) ) ;
}
