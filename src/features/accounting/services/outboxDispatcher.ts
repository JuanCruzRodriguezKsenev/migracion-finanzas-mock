/**
 * @file outboxDispatcher.ts
 * Servicio despachador de eventos del Transactional Outbox (RFC 020).
 * Implementa consumo en 3 pasos (reclamo atómico, despacho desacoplado, asentamiento),
 * recuperación de eventos en PROCESSING huérfanos, reintentos con backoff y purga periódica.
 */
// Librerías externas
import { eq , and , lte , inArray , asc , isNull , or , sql } from "drizzle-orm" ;

// Shared
import { logger } from "@/shared/lib/logger" ;
import { db }     from "@/shared/db/client" ;

// Feature: Accounting
import { outboxEvents } from "../schema.db" ;


/** Cantidad máxima de reintentos antes de marcar un evento como FAILED definitivamente. */
export const MAX_ATTEMPTS = 5 ;

/** Tiempo máximo de tolerancia (5 minutos) en PROCESSING antes de considerar el proceso huérfano. */
export const PROCESSING_TTL_MS = ( 5 * 60 * 1000 ) ;

/** Tamaño de lote predeterminado para el reclamo de eventos PENDING. */
export const DEFAULT_BATCH_SIZE = 50 ;

/** Días de retención predeterminados para la purga de eventos SENT históricos. */
export const DEFAULT_RETENTION_DAYS = 30 ;

/** Tipos de eventos canónicos emitidos por el core contable. */
export const OUTBOX_EVENT_TYPES = [
  "TRANSACTION_CREATED" ,
  "TRANSACTION_DELETED" ,
  "TRANSACTION_METADATA_UPDATED" ,
  "TRANSACTION_REVERSED" ,
] as const ;

export type OutboxEventType = typeof OUTBOX_EVENT_TYPES[ number ] ;

export type OutboxEventRecord = typeof outboxEvents.$inferSelect ;

export type EventHandler = ( event: OutboxEventRecord ) => Promise< void > ;

export interface DispatchOptions {
  batchSize?:    number ;
  skipRecovery?: boolean ;
}

export interface DispatchItemResult {
  id:        string ;
  eventType: string ;
  success:   boolean ;
  error?:    string ;
}

export interface DispatchResult {
  recoveredStale: number ;
  processed:      number ;
  successful:     number ;
  failed:         number ;
  events:         DispatchItemResult[] ;
}

// Registry en memoria para manejadores de eventos (punto de extensión para RFC 012)
const eventHandlers = new Map< string , EventHandler >() ;

/**
 * Registra un manejador personalizado para un tipo de evento específico.
 * 
 * @param eventType - Nombre del evento (ej: 'TRANSACTION_CREATED').
 * @param handler - Función asíncrona que procesa el evento.
 */
export function registerEventHandler( eventType: string , handler: EventHandler ): void {
  eventHandlers.set( eventType , handler ) ;
}

/**
 * Elimina todos los manejadores personalizados registrados (útil para pruebas unitarias).
 */
export function resetEventHandlers(): void {
  eventHandlers.clear() ;
}

/**
 * Retorna la lista de tipos de eventos con manejadores registrados.
 */
export function getRegisteredEventTypes(): string[] {
  return( Array.from( eventHandlers.keys() ) ) ;
}

/**
 * Manejador por defecto para eventos que no tienen un handler específico registrado.
 * Emite un log estructurado confirmando la recepción y los metadatos del evento.
 */
async function defaultHandler( event: OutboxEventRecord ): Promise< void > {
  logger.info( `[OutboxDispatcher] Procesando evento ${event.eventType}` , {
    eventId:        event.id ,
    organizationId: event.organizationId ,
    eventType:      event.eventType ,
  } ) ;
}

/**
 * Barrido de recuperación para eventos colgados en estado PROCESSING.
 * Si un worker falló repentinamente durante el despacho, devuelve los eventos a PENDING.
 * 
 * @param ttlMs - Tiempo de expiración en milisegundos (por defecto 5 minutos).
 * @returns Cantidad de eventos recuperados.
 */
export async function recoverStaleProcessing( ttlMs: number = PROCESSING_TTL_MS ): Promise< number > {
  const cutoff = new Date( Date.now() - ttlMs ) ;

  const stale = await db
    .select( { id: outboxEvents.id } )
    .from( outboxEvents )
    .where(
      and(
        eq( outboxEvents.status , "PROCESSING" ) ,
        or(
          lte( outboxEvents.processedAt , cutoff ) ,
          and( isNull( outboxEvents.processedAt ) , lte( outboxEvents.createdAt , cutoff ) )
        )
      )
    ) ;

  if( stale.length === 0 ) {
    return( 0 ) ;
  }

  const ids = stale.map( ( s ) => s.id ) ;

  await db
    .update( outboxEvents )
    .set( {
      status:      sql`case when attempts + 1 >= ${MAX_ATTEMPTS} then 'FAILED' else 'PENDING' end` ,
      attempts:    sql`attempts + 1` ,
      processedAt: null ,
    } )
    .where( inArray( outboxEvents.id , ids ) ) ;

  logger.warn( `[OutboxDispatcher] Recuperados ${ids.length} eventos colgados en PROCESSING.` , {
    count: ids.length ,
    ids ,
  } ) ;

  return( ids.length ) ;
}

/**
 * Ejecuta un ciclo de despacho de eventos pendientes en tres fases desacopladas:
 * 1. Reclamo atómico en transacción corta con SELECT ... FOR UPDATE SKIP LOCKED marcando PROCESSING.
 * 2. Despacho asíncrono fuera de transacción de base de datos ejecutando handlers.
 * 3. Asentamiento final actualizando a SENT o PENDING/FAILED con incremento de attempts.
 * 
 * @param options - Opciones de configuración (batchSize y control de recuperación).
 * @returns Resumen estructurado de la ejecución.
 */
export async function dispatchPendingEvents( options: DispatchOptions = {} ): Promise< DispatchResult > {
  const batchSize    = ( options.batchSize || DEFAULT_BATCH_SIZE ) ;
  const skipRecovery = Boolean( options.skipRecovery ) ;

  let recoveredCount = 0 ;
  if( !skipRecovery ) {
    recoveredCount = await recoverStaleProcessing() ;
  }

  // ── Paso 1: Reclamo atómico en micro-transacción corta ────────────────────
  const claimedEvents = await db.transaction( async ( tx ) => {
    const pending = await tx
      .select()
      .from( outboxEvents )
      .where( eq( outboxEvents.status , "PENDING" ) )
      .orderBy( asc( outboxEvents.createdAt ) )
      .limit( batchSize )
      .for( "update" , { skipLocked: true } ) ;

    if( pending.length === 0 ) {
      return( [] ) ;
    }

    const ids = pending.map( ( e ) => e.id ) ;
    const now = new Date() ;

    await tx
      .update( outboxEvents )
      .set( {
        status:      "PROCESSING" ,
        processedAt: now ,
      } )
      .where( inArray( outboxEvents.id , ids ) ) ;

    return( pending ) ;
  } ) ;

  if( claimedEvents.length === 0 ) {
    return( {
      recoveredStale: recoveredCount ,
      processed:      0 ,
      successful:     0 ,
      failed:         0 ,
      events:         [] ,
    } ) ;
  }

  // ── Paso 2: Despacho fuera de la transacción de DB ─────────────────────────
  const dispatchResults: DispatchItemResult[] = [] ;

  for( const event of claimedEvents ) {
    const handler = ( eventHandlers.get( event.eventType ) || defaultHandler ) ;

    try {
      await handler( event ) ;
      dispatchResults.push( {
        id:        event.id ,
        eventType: event.eventType ,
        success:   true ,
      } ) ;
    } catch( error ) {
      const errorMsg = ( (error as Error).message || String(error) ) ;
      logger.error( `[OutboxDispatcher] Error al despachar evento ${event.id}` , {
        eventId:   event.id ,
        eventType: event.eventType ,
        error:     errorMsg ,
      } ) ;
      dispatchResults.push( {
        id:        event.id ,
        eventType: event.eventType ,
        success:   false ,
        error:     errorMsg ,
      } ) ;
    }
  }

  // ── Paso 3: Asentamiento final en base de datos ───────────────────────────
  const successfulItems = dispatchResults.filter( ( r ) => r.success ) ;
  const failedItems     = dispatchResults.filter( ( r ) => !r.success ) ;

  if( successfulItems.length > 0 ) {
    const successIds = successfulItems.map( ( r ) => r.id ) ;
    await db
      .update( outboxEvents )
      .set( {
        status:      "SENT" ,
        processedAt: new Date() ,
      } )
      .where(
        and(
          inArray( outboxEvents.id , successIds ) ,
          eq( outboxEvents.status , "PROCESSING" )
        )
      ) ;
  }

  // Actualizar individualmente los fallidos para calcular el nuevo estado de reintento
  const claimedMap = new Map( claimedEvents.map( ( e ) => [ e.id , e ] ) ) ;

  for( const failedItem of failedItems ) {
    const original = claimedMap.get( failedItem.id ) ;
    const currentAttempts = ( original?.attempts || 0 ) ;
    const newAttempts     = ( currentAttempts + 1 ) ;
    const newStatus       = ( newAttempts >= MAX_ATTEMPTS ) ? "FAILED" : "PENDING" ;

    await db
      .update( outboxEvents )
      .set( {
        status:      newStatus ,
        attempts:    newAttempts ,
        processedAt: null ,
      } )
      .where(
        and(
          eq( outboxEvents.id , failedItem.id ) ,
          eq( outboxEvents.status , "PROCESSING" )
        )
      ) ;
  }

  return( {
    recoveredStale: recoveredCount ,
    processed:      claimedEvents.length ,
    successful:     successfulItems.length ,
    failed:         failedItems.length ,
    events:         dispatchResults ,
  } ) ;
}

/**
 * Purga de eventos históricos con estado SENT cuya antigüedad supere la retención indicada.
 * 
 * @param retentionDays - Días de retención histórica (por defecto 30 días).
 * @returns Cantidad de eventos eliminados.
 */
export async function purgeOldSentEvents( retentionDays: number = DEFAULT_RETENTION_DAYS ): Promise< number > {
  const cutoff = new Date( Date.now() - (retentionDays * 24 * 60 * 60 * 1000) ) ;

  const deleted = await db
    .delete( outboxEvents )
    .where(
      and(
        eq( outboxEvents.status , "SENT" ) ,
        lte( outboxEvents.processedAt , cutoff )
      )
    )
    .returning( { id: outboxEvents.id } ) ;

  if( deleted.length > 0 ) {
    logger.info( `[OutboxDispatcher] Purgados ${deleted.length} eventos SENT históricos con más de ${retentionDays} días.` , {
      count: deleted.length ,
      retentionDays ,
    } ) ;
  }

  return( deleted.length ) ;
}
