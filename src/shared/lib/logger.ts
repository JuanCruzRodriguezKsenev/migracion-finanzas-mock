/**
 * @file logger.ts
 * Logger estructurado para la trazabilidad técnica de la aplicación.
 * Produce logs estructurados en JSON en producción para indexado, y texto coloreado en desarrollo.
 */
const isProduction = ( process.env.NODE_ENV === "production" ) ;

/**
 * Función interna de escritura estructurada de registros en consola.
 * 
 * @param level - Severidad del registro ('info' | 'warn' | 'error').
 * @param message - Mensaje descriptivo principal.
 * @param metadata - Metadatos estructurados opcionales de auditoría.
 */
function writeLog( level: ("info" | "warn" | "error") , message: string , metadata?: Record<string , unknown> ) {
  const timestamp = new Date().toISOString() ;

  if( isProduction ){
    console.log( JSON.stringify({timestamp , level , message , ...metadata}) ) ;
  } else {
    const color = (level === "error") ? "\x1b[31m" : (level === "warn") ? "\x1b[33m" : "\x1b[32m" ;
    const reset = "\x1b[0m" ;
  
    console.log( `[${timestamp}] ${color}${level.toUpperCase()}${reset}: ${message}` , metadata ? metadata : "" ) ;
  }
}

/**
 * Instancia del Logger centralizado para la trazabilidad del sistema.
 */
export const logger = {
  info( message: string , metadata?: Record<string , unknown> ) {
    writeLog( "info" , message , metadata ) ;
  } ,
  warn( message: string , metadata?: Record<string , unknown> ) {
    writeLog( "warn" , message , metadata ) ;
  } ,
  error( message: string , metadata?: Record<string , unknown> ) {
    writeLog( "error" , message , metadata ) ;
  } ,
} ;
