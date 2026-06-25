/**
 * @file idempotencyService.ts
 * Servicio para asegurar la idempotencia en transacciones mutables críticas de FinanzIA.
 */
import { db } from "@/shared/db/client" ;
import { idempotencyKeys } from "@/features/accounting/schema.db" ;
import { eq } from "drizzle-orm" ;
import { Result , ok , fail } from "@/shared/lib/result" ;
import { logger } from "@/shared/lib/logger" ;

/**
 * Envuelve la ejecución de una operación mutable crítica en un validador de idempotencia.
 * 
 * @param key - Clave única de idempotencia enviada por el cliente.
 * @param callback - Función que ejecuta la lógica de negocio y retorna datos serializables.
 * @returns Un objeto Result con los datos de respuesta (nuevos o cacheados) o error de conflicto.
 */
export async function executeIdempotent< T >(
  key: string ,
  callback: () => Promise< T >
): Promise< Result<T , string> > {
  if( !key || key.trim() === "" ){
    // Si no se provee key, ejecutar el callback sin idempotencia
    try {
      const val = await callback() ;
      return( ok(val) ) ;
    } catch( error ) {
      return( fail((error as Error).message || "Error durante la ejecución.") ) ;
    }
  }

  try {
    // 1. Intentar buscar si la clave ya existe
    let recordExists = false ;
    let existingRecord ;

    try {
      const results = await db
        .select()
        .from( idempotencyKeys )
        .where( eq(idempotencyKeys.key , key) )
        .limit( 1 ) ;
      
      existingRecord = results[ 0 ] ;
      if( existingRecord ){
        recordExists = true ;
      }
    } catch( err ) {
      logger.error( "Error al verificar la clave de idempotencia." , { err: String(err) , key } ) ;
      return( fail("Error al verificar la clave de idempotencia en la base de datos.") ) ;
    }

    if( recordExists && existingRecord ){
      if( existingRecord.status === "PROCESSING" ){
        logger.warn( "Operación duplicada en curso (409 Conflict)." , { key } ) ;
        return( fail("CONFLICT_PROCESSING") ) ;
      }

      if( existingRecord.status === "COMPLETED" && existingRecord.responseBody ){
        logger.info( "Operación cacheada recuperada con éxito." , { key } ) ;
        try {
          const cachedResponse = JSON.parse( existingRecord.responseBody ) as T ;
          return( ok(cachedResponse) ) ;
        } catch( parseErr ) {
          logger.error( "Error al parsear el cuerpo de respuesta cacheado." , { parseErr: String(parseErr) , key } ) ;
          return( fail("Error al parsear la respuesta cacheada.") ) ;
        }
      }

      return( fail("Estado de idempotencia inválido.") ) ;
    }

    // 2. Insertar nueva clave como PROCESSING
    try {
      await db
        .insert( idempotencyKeys )
        .values( {
          key ,
          status: "PROCESSING" ,
        } ) ;
    } catch( insertErr ) {
      // Por si ocurre una condición de carrera entre el select y la inserción
      logger.warn( "Colisión de inserción de clave detectada en carrera." , { key , insertErr: String(insertErr) } ) ;
      return( fail("CONFLICT_PROCESSING") ) ;
    }

    // 3. Ejecutar la operación de negocio real
    let resultValue: T ;
    try {
      resultValue = await callback() ;
    } catch( bizErr ) {
      // Si la operación de negocio falla, limpiamos el registro PROCESSING para permitir reintentos
      logger.error( "Fallo en operación de negocio. Limpiando clave de idempotencia." , { bizErr: String(bizErr) , key } ) ;
      await db
        .delete( idempotencyKeys )
        .where( eq(idempotencyKeys.key , key) ) ;
      return( fail((bizErr as Error).message || "Fallo en la operación de negocio.") ) ;
    }

    // 4. Marcar clave como COMPLETED y guardar respuesta serializada
    try {
      const responseStr = JSON.stringify( resultValue ) ;
      await db
        .update( idempotencyKeys )
        .set( {
          status:       "COMPLETED" ,
          responseBody: responseStr ,
        } )
        .where( eq(idempotencyKeys.key , key) ) ;
    } catch( updateErr ) {
      logger.error( "Error al guardar el cuerpo de la respuesta de idempotencia." , { updateErr: String(updateErr) , key } ) ;
    }

    return( ok(resultValue) ) ;

  } catch( error ) {
    logger.error( "Error general en flujo de idempotencia." , { error: String(error) , key } ) ;
    return( fail("Error crítico interno en el manejador de idempotencia.") ) ;
  }
}