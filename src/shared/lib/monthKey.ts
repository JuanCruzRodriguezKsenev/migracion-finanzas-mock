/**
 * @file monthKey.ts
 * Utilidades puras para cálculo de claves de mes "YYYY-MM" en zonas horarias específicas (RFC 027 §3).
 */

/**
 * Devuelve la clave de mes "YYYY-MM" de una fecha evaluada en una zona horaria IANA específica.
 * Emplea Intl.DateTimeFormat para independizarse de la zona horaria física del servidor.
 *
 * @param fecha - Objeto Date o cadena de fecha parseable.
 * @param zona - Identificador de zona horaria IANA (ej: 'America/Argentina/Buenos_Aires').
 * @returns Cadena con formato "YYYY-MM".
 */
export function claveDeMes( fecha: Date | string , zona: string ): string {
  const f = ( fecha instanceof Date ) ? fecha : new Date( fecha ) ;
  if( isNaN( f.getTime() ) ) {
    throw( new Error( `Fecha inválida provista a claveDeMes: ${fecha}` ) ) ;
  }

  const formatter = new Intl.DateTimeFormat( "en-US" , {
    timeZone: zona ,
    year:     "numeric" ,
    month:    "2-digit" ,
  } ) ;

  const parts = formatter.formatToParts( f ) ;
  const year  = parts.find( ( p ) => { return( p.type === "year" ) ; } )?.value ;
  const month = parts.find( ( p ) => { return( p.type === "month" ) ; } )?.value ;

  return( `${year}-${month}` ) ;
}

/**
 * Devuelve la clave de mes "YYYY-MM" correspondiente al instante actual en la zona indicada.
 *
 * @param zona - Identificador de zona horaria IANA.
 * @returns Cadena con formato "YYYY-MM".
 */
export function claveDeMesActual( zona: string ): string {
  return( claveDeMes( new Date() , zona ) ) ;
}
