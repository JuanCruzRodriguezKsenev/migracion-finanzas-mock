/**
 * @file claveIdempotencia.ts
 * Clave de envío de formularios para la idempotencia de las acciones de servidor.
 * Sin imports de Node: la usan componentes cliente.
 */

/**
 * UUID v4 para identificar un envío de formulario. Funciona también fuera de contexto seguro.
 *
 * `randomUUID` sólo existe en contexto seguro (HTTPS o localhost): contra una IP local por HTTP
 * no está, y se arma el v4 a mano con `getRandomValues`.
 *
 * @returns Un UUID v4 en minúsculas.
 */
export function nuevaClaveDeEnvio(): string {
  const webCrypto = globalThis.crypto ;

  if( typeof webCrypto?.randomUUID === "function" ) {
    return( webCrypto.randomUUID() ) ;
  }

  const bytes = webCrypto.getRandomValues( new Uint8Array( 16 ) ) ;

  bytes[6] = ( (bytes[6] & 0x0f) | 0x40 ) ;
  bytes[8] = ( (bytes[8] & 0x3f) | 0x80 ) ;

  const hex = Array.from( bytes , ( b ) => b.toString( 16 ).padStart( 2 , "0" ) ).join( "" ) ;

  return( `${hex.slice(0 , 8)}-${hex.slice(8 , 12)}-${hex.slice(12 , 16)}-${hex.slice(16 , 20)}-${hex.slice(20)}` ) ;
}
