/**
 * @file idempotencyService.ts
 * Servicio para asegurar la idempotencia en transacciones mutables críticas de FinanzIA.
 */
// Librerías externas
import { createHash } from "node:crypto" ;
import { eq }         from "drizzle-orm" ;

// Shared
import { Result , ok , fail } from "@/shared/lib/result" ;
import { logger } from "@/shared/lib/logger" ;
import { db } from "@/shared/db/client" ;

// Feature: Accounting
import { idempotencyKeys } from "@/features/accounting/schema.db" ;

// Tiempo máximo que una clave puede permanecer en PROCESSING antes de considerarse huérfana.
// Debe superar holgadamente la duración máxima esperada de una transacción de negocio.
const PROCESSING_TTL_MS = ( 5 * 60 * 1000 ) ;

/**
 * Envuelve la ejecución de una operación mutable crítica en un validador de idempotencia.
 * 
 * @param key - Clave única de idempotencia enviada por el cliente.
 * @param callback - Función que ejecuta la lógica de negocio y retorna datos serializables.
 * @returns Un objeto Result con los datos de respuesta (nuevos o cacheados) o error de conflicto.
 */
export async function executeIdempotent< T >( key: string , callback: () => Promise<T> ): Promise< Result<T , string> > {
  if( !key || (key.trim() === "") ) {
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
      
      if( existingRecord ) {
        recordExists = true ;
      }
    } catch( err ) {
      logger.error( "Error al verificar la clave de idempotencia." , {err: String(err) , key} ) ;
      
      return( fail("Error al verificar la clave de idempotencia en la base de datos.") ) ;
    }

    if( recordExists && existingRecord ) {
      if( existingRecord.status === "PROCESSING" ) {
        // Si la clave lleva más tiempo del umbral en PROCESSING, se asume que el proceso
        // original murió (crash/timeout) y se reclama la clave para permitir el reintento.
        const edadMs = ( Date.now() - existingRecord.createdAt.getTime() ) ;

        if( edadMs > PROCESSING_TTL_MS ) {
          logger.warn( "Clave PROCESSING vencida. Reclamando para reintento." , {key , edadMs} ) ;

          await db
            .delete( idempotencyKeys )
            .where( eq(idempotencyKeys.key , key) ) ;
        } else {
          logger.warn( "Operación duplicada en curso (409 Conflict)." , {key} ) ;

          return( fail("CONFLICT_PROCESSING") ) ;
        }
      } else if( (existingRecord.status === "COMPLETED") && existingRecord.responseBody ) {
        logger.info( "Operación cacheada recuperada con éxito." , {key} ) ;

        try {
          const cachedResponse = JSON.parse( existingRecord.responseBody ) as T ;

          return( ok(cachedResponse) ) ;
        } catch( parseErr ) {
          logger.error( "Error al parsear el cuerpo de respuesta cacheado." , {parseErr: String(parseErr) , key} ) ;
          return( fail("Error al parsear la respuesta cacheada.") ) ;
        }
      } else {
        return( fail("Estado de idempotencia inválido.") ) ;
      }
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
      logger.warn( "Colisión de inserción de clave detectada en carrera." , {key , insertErr: String(insertErr)} ) ;
      
      return( fail("CONFLICT_PROCESSING") ) ;
    }

    // 3. Ejecutar la operación de negocio real
    let resultValue: T ;
    
    try {
      resultValue = await callback() ;
    } catch( bizErr ) {
      // Si la operación de negocio falla, limpiamos el registro PROCESSING para permitir reintentos
      logger.error( "Fallo en operación de negocio. Limpiando clave de idempotencia." , {bizErr: String(bizErr) , key} ) ;
      
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
      // Si no se pudo registrar COMPLETED, se elimina el registro PROCESSING:
      // un posible duplicado futuro es preferible a un 409 CONFLICT permanente e irrecuperable.
      logger.error( "Error al guardar la respuesta de idempotencia. Liberando clave." , {updateErr: String(updateErr) , key} ) ;

      try {
        await db
          .delete( idempotencyKeys )
          .where( eq(idempotencyKeys.key , key) ) ;
      } catch( cleanupErr ) {
        logger.error( "Error al liberar la clave de idempotencia." , {cleanupErr: String(cleanupErr) , key} ) ;
      }
    }

    return( ok(resultValue) ) ;

  } catch( error ) {
    logger.error( "Error general en flujo de idempotencia." , {error: String(error) , key} ) ;
    
    return( fail("Error crítico interno en el manejador de idempotencia.") ) ;
  }
}

// UUID v4: es el formato que genera `nuevaClaveDeEnvio()` en el cliente.
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i ;

const MENSAJE_EN_PROCESO = "Ese envío todavía se está procesando. Esperá unos segundos y revisá antes de reintentar." ;

/**
 * Arma la clave que se guarda en `idempotency_keys`: `<userId>:<accion>:<claveCliente>:<huella>`.
 * La huella son los primeros 16 hex del SHA-256 de `JSON.stringify( datos )`.
 * Devuelve `null` si no hay clave de cliente, y lanza si la clave no es un UUID.
 *
 * @param params - Usuario, nombre fijo de la acción, clave del cliente y datos ya validados.
 * @returns La clave compuesta, o `null` si el cliente no mandó clave.
 */
export function armarClaveIdempotencia( params: {
  userId:        string ;
  accion:        string ;
  claveCliente?: string ;
  datos:         unknown ;
} ): string | null {
  if( !params.claveCliente ) {
    return( null ) ;
  }

  if( !UUID_V4_REGEX.test( params.claveCliente ) ) {
    throw new Error( "Clave de envío inválida." ) ;
  }

  const huella = createHash( "sha256" ).update( JSON.stringify( params.datos ) ).digest( "hex" ).slice( 0 , 16 ) ;

  return( `${params.userId}:${params.accion}:${params.claveCliente}:${huella}` ) ;
}

/**
 * Ejecuta `operacion` con idempotencia si hay clave, o directo si es `null`.
 * Corrige dos trampas de `executeIdempotent`: un `fail` de la operación se convierte en
 * `throw` adentro (así la clave se libera y no se cachea el error), y `CONFLICT_PROCESSING`
 * sale como mensaje legible.
 *
 * @param clave - Clave armada con `armarClaveIdempotencia`, o `null` para ejecutar sin protección.
 * @param operacion - Cuerpo de la acción; devuelve un `Result`.
 * @returns El `Result` de la operación (nuevo o cacheado).
 */
export async function conIdempotencia< T >(
  clave:     string | null ,
  operacion: () => Promise< Result<T , string> >
): Promise< Result<T , string> > {
  if( clave === null ) {
    return( await operacion() ) ;
  }

  const resultado = await executeIdempotent( clave , async () => {
    const r = await operacion() ;

    if( !r.success ) {
      throw new Error( r.error ) ;
    }

    return( r.value ) ;
  } ) ;

  if( !resultado.success && (resultado.error === "CONFLICT_PROCESSING") ) {
    return( fail( MENSAJE_EN_PROCESO ) ) ;
  }

  return( resultado ) ;
}
