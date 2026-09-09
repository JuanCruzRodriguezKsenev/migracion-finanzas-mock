// Librerías externas
import { describe , it , expect , beforeEach , afterEach } from "vitest" ;
import { eq }                                              from "drizzle-orm" ;

// Shared
import { db } from "@/shared/db/client" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import {
  dispatchPendingEvents ,
  recoverStaleProcessing ,
  purgeOldSentEvents ,
  registerEventHandler ,
  resetEventHandlers ,
  MAX_ATTEMPTS ,
  PROCESSING_TTL_MS
} from "./outboxDispatcher" ;
import { accounts , categories , categoryAccounts , outboxEvents } from "../schema.db" ;


/**
 * Suite de pruebas para el Transactional Outbox Dispatcher (RFC 020).
 * Valida el ciclo de vida desacoplado en 3 pasos, reintentos con backoff,
 * recuperación de eventos en PROCESSING huérfanos, SKIP LOCKED y purga histórica.
 */
describe( "outboxDispatcher" , () => {
  let orgId: string ;

  beforeEach( async () => {
    resetEventHandlers() ;

    await db.delete( outboxEvents  ) ;
    await db.delete( categoryAccounts ) ;
    await db.delete( categories ) ;
    await db.delete( accounts ) ;
    await db.delete( organizations ) ;

    const [ org ] = await db
      .insert( organizations )
      .values( {
        name: "Org Outbox Test" ,
        slug: "org-outbox-test" ,
      } )
      .returning() ;

    orgId = org.id ;
  } ) ;

  afterEach( () => {
    resetEventHandlers() ;
  } ) ;

  it( "debería despachar exitosamente los 4 tipos de eventos a estado SENT con processedAt" , async () => {
    // 1. Insertar un evento para cada tipo canónico emitido por el core contable
    const eventTypes = [
      "TRANSACTION_CREATED" ,
      "TRANSACTION_DELETED" ,
      "TRANSACTION_METADATA_UPDATED" ,
      "TRANSACTION_REVERSED" ,
    ] as const ;

    for( const eventType of eventTypes ) {
      await db.insert( outboxEvents ).values( {
        organizationId: orgId ,
        eventType ,
        payload: { sample: true , type: eventType } ,
        status:  "PENDING" ,
      } ) ;
    }

    // 2. Ejecutar el ciclo del despachador
    const result = await dispatchPendingEvents() ;

    expect( result.processed ).toBe( 4 ) ;
    expect( result.successful ).toBe( 4 ) ;
    expect( result.failed ).toBe( 0 ) ;

    // 3. Verificar estado en base de datos
    const dbEvents = await db.select().from( outboxEvents ) ;
    expect( dbEvents.length ).toBe( 4 ) ;

    for( const evt of dbEvents ) {
      expect( evt.status ).toBe( "SENT" ) ;
      expect( evt.processedAt ).not.toBeNull() ;
      expect( evt.attempts ).toBe( 0 ) ;
    }
  } ) ;

  it( "debería reintentar ante fallo del handler incrementando attempts y volviendo a PENDING" , async () => {
    // Registrar un handler que falle intencionalmente
    registerEventHandler( "TRANSACTION_CREATED" , async () => {
      throw new Error( "Falla simulada en webhook de destino." ) ;
    } ) ;

    const [ inserted ] = await db
      .insert( outboxEvents )
      .values( {
        organizationId: orgId ,
        eventType:      "TRANSACTION_CREATED" ,
        payload:        { amount: 1500 } ,
        status:         "PENDING" ,
        attempts:       0 ,
      } )
      .returning() ;

    const result = await dispatchPendingEvents() ;

    expect( result.processed ).toBe( 1 ) ;
    expect( result.successful ).toBe( 0 ) ;
    expect( result.failed ).toBe( 1 ) ;

    const [ dbEvt ] = await db
      .select()
      .from( outboxEvents )
      .where( eq(outboxEvents.id , inserted.id) ) ;

    expect( dbEvt.status ).toBe( "PENDING" ) ;
    expect( dbEvt.attempts ).toBe( 1 ) ;
    expect( dbEvt.processedAt ).toBeNull() ;
  } ) ;

  it( "debería marcar como FAILED al alcanzar el límite de MAX_ATTEMPTS (5)" , async () => {
    registerEventHandler( "TRANSACTION_CREATED" , async () => {
      throw new Error( "Falla permanente de conexión." ) ;
    } ) ;

    // Insertar evento que ya tiene 4 fallos previos
    const [ inserted ] = await db
      .insert( outboxEvents )
      .values( {
        organizationId: orgId ,
        eventType:      "TRANSACTION_CREATED" ,
        payload:        { amount: 1500 } ,
        status:         "PENDING" ,
        attempts:       MAX_ATTEMPTS - 1 ,
      } )
      .returning() ;

    const result = await dispatchPendingEvents() ;

    expect( result.processed ).toBe( 1 ) ;
    expect( result.failed ).toBe( 1 ) ;

    const [ dbEvt ] = await db
      .select()
      .from( outboxEvents )
      .where( eq(outboxEvents.id , inserted.id) ) ;

    expect( dbEvt.status ).toBe( "FAILED" ) ;
    expect( dbEvt.attempts ).toBe( MAX_ATTEMPTS ) ;
  } ) ;

  it( "debería recuperar eventos huérfanos en PROCESSING que superen el TTL" , async () => {
    const diezMinutosAtras = new Date( Date.now() - (10 * 60 * 1000) ) ;
    const treintaSegAtras  = new Date( Date.now() - (30 * 1000) ) ;

    // Evento huérfano (proceso muerto hace 10 min)
    const [ huerfano ] = await db
      .insert( outboxEvents )
      .values( {
        organizationId: orgId ,
        eventType:      "TRANSACTION_CREATED" ,
        payload:        { test: "huerfano" } ,
        status:         "PROCESSING" ,
        processedAt:    diezMinutosAtras ,
      } )
      .returning() ;

    // Evento en procesamiento activo reciente (30 segundos)
    const [ activo ] = await db
      .insert( outboxEvents )
      .values( {
        organizationId: orgId ,
        eventType:      "TRANSACTION_DELETED" ,
        payload:        { test: "activo" } ,
        status:         "PROCESSING" ,
        processedAt:    treintaSegAtras ,
      } )
      .returning() ;

    const recoveredCount = await recoverStaleProcessing( PROCESSING_TTL_MS ) ;

    expect( recoveredCount ).toBe( 1 ) ;

    const [ dbHuerfano ] = await db
      .select()
      .from( outboxEvents )
      .where( eq(outboxEvents.id , huerfano.id) ) ;

    expect( dbHuerfano.status ).toBe( "PENDING" ) ;
    expect( dbHuerfano.attempts ).toBe( 1 ) ;
    expect( dbHuerfano.processedAt ).toBeNull() ;

    const [ dbActivo ] = await db
      .select()
      .from( outboxEvents )
      .where( eq(outboxEvents.id , activo.id) ) ;

    expect( dbActivo.status ).toBe( "PROCESSING" ) ;
  } ) ;

  it( "debería marcar como FAILED un evento huérfano que alcance MAX_ATTEMPTS al ser recuperado" , async () => {
    const diezMinutosAtras = new Date( Date.now() - (10 * 60 * 1000) ) ;

    const [ huerfanoLimite ] = await db
      .insert( outboxEvents )
      .values( {
        organizationId: orgId ,
        eventType:      "TRANSACTION_CREATED" ,
        payload:        { test: "limite" } ,
        status:         "PROCESSING" ,
        attempts:       MAX_ATTEMPTS - 1 ,
        processedAt:    diezMinutosAtras ,
      } )
      .returning() ;

    const recoveredCount = await recoverStaleProcessing( PROCESSING_TTL_MS ) ;

    expect( recoveredCount ).toBe( 1 ) ;

    const [ dbEvt ] = await db
      .select()
      .from( outboxEvents )
      .where( eq(outboxEvents.id , huerfanoLimite.id) ) ;

    expect( dbEvt.status ).toBe( "FAILED" ) ;
    expect( dbEvt.attempts ).toBe( MAX_ATTEMPTS ) ;
    expect( dbEvt.processedAt ).toBeNull() ;
  } ) ;

  it( "debería prevenir procesamiento duplicado concurrente mediante SKIP LOCKED" , async () => {
    // Insertar 10 eventos pendientes
    for( let i = 0 ; i < 10 ; i++ ) {
      await db.insert( outboxEvents ).values( {
        organizationId: orgId ,
        eventType:      "TRANSACTION_CREATED" ,
        payload:        { index: i } ,
        status:         "PENDING" ,
      } ) ;
    }

    // Ejecutar dos despachadores concurrentes con batchSize de 5
    const [ r1 , r2 ] = await Promise.all( [
      dispatchPendingEvents( { batchSize: 5 , skipRecovery: true } ) ,
      dispatchPendingEvents( { batchSize: 5 , skipRecovery: true } ) ,
    ] ) ;

    expect( r1.processed ).toBe( 5 ) ;
    expect( r2.processed ).toBe( 5 ) ;

    // Verificar que los IDs reclamados por r1 y r2 son disjuntos (sin solapamiento)
    const ids1 = new Set( r1.events.map( ( e ) => e.id ) ) ;
    const ids2 = new Set( r2.events.map( ( e ) => e.id ) ) ;

    for( const id of ids1 ) {
      expect( ids2.has( id ) ).toBe( false ) ;
    }

    // Todos los 10 eventos quedaron en SENT
    const dbEvents = await db.select().from( outboxEvents ) ;
    expect( dbEvents.length ).toBe( 10 ) ;
    expect( dbEvents.every( ( e ) => e.status === "SENT" ) ).toBe( true ) ;
  } ) ;

  it( "debería purgar eventos históricos SENT de más de 30 días y conservar los recientes" , async () => {
    const treintaYCincoDiasAtras = new Date( Date.now() - (35 * 24 * 60 * 60 * 1000) ) ;
    const cincoDiasAtras         = new Date( Date.now() - (5 * 24 * 60 * 60 * 1000) ) ;

    // Evento SENT antiguo (debe purgarse)
    const [ antiguo ] = await db
      .insert( outboxEvents )
      .values( {
        organizationId: orgId ,
        eventType:      "TRANSACTION_CREATED" ,
        payload:        { test: "antiguo" } ,
        status:         "SENT" ,
        processedAt:    treintaYCincoDiasAtras ,
      } )
      .returning() ;

    // Evento SENT reciente (debe conservarse)
    const [ reciente ] = await db
      .insert( outboxEvents )
      .values( {
        organizationId: orgId ,
        eventType:      "TRANSACTION_CREATED" ,
        payload:        { test: "reciente" } ,
        status:         "SENT" ,
        processedAt:    cincoDiasAtras ,
      } )
      .returning() ;

    // Evento PENDING (debe conservarse siempre)
    const [ pendiente ] = await db
      .insert( outboxEvents )
      .values( {
        organizationId: orgId ,
        eventType:      "TRANSACTION_CREATED" ,
        payload:        { test: "pendiente" } ,
        status:         "PENDING" ,
      } )
      .returning() ;

    const purgedCount = await purgeOldSentEvents( 30 ) ;

    expect( purgedCount ).toBe( 1 ) ;

    const remaining = await db.select().from( outboxEvents ) ;
    expect( remaining.length ).toBe( 2 ) ;

    const remainingIds = new Set( remaining.map( ( r ) => r.id ) ) ;
    expect( remainingIds.has( antiguo.id ) ).toBe( false ) ;
    expect( remainingIds.has( reciente.id ) ).toBe( true ) ;
    expect( remainingIds.has( pendiente.id ) ).toBe( true ) ;
  } ) ;

  it( "debería invocar handlers personalizados registrados para un tipo de evento" , async () => {
    let payloadRecibido: unknown = null ;

    registerEventHandler( "TRANSACTION_REVERSED" , async ( event ) => {
      payloadRecibido = event.payload ;
    } ) ;

    await db.insert( outboxEvents ).values( {
      organizationId: orgId ,
      eventType:      "TRANSACTION_REVERSED" ,
      payload:        { reversalId: "rev-123" , reason: "Error de monto" } ,
      status:         "PENDING" ,
    } ) ;

    const result = await dispatchPendingEvents() ;

    expect( result.successful ).toBe( 1 ) ;
    expect( payloadRecibido ).toEqual( { reversalId: "rev-123" , reason: "Error de monto" } ) ;
  } ) ;

  it( "debería evitar que un asentamiento tardío pise un evento que ya no esté en PROCESSING" , async () => {
    // Simulamos un worker rezagado: durante el despacho, otro proceso concurrente marca el evento como SENT
    const [ inserted ] = await db
      .insert( outboxEvents )
      .values( {
        organizationId: orgId ,
        eventType:      "TRANSACTION_CREATED" ,
        payload:        { test: "concurrencia" } ,
        status:         "PENDING" ,
      } )
      .returning() ;

    registerEventHandler( "TRANSACTION_CREATED" , async ( event ) => {
      // Simular que otro worker intervino y ya asentó este evento a SENT
      await db
        .update( outboxEvents )
        .set( { status: "SENT" , processedAt: new Date() } )
        .where( eq(outboxEvents.id , event.id) ) ;

      // Y este worker falla en su llamada
      throw new Error( "Fallo tardío en worker rezagado." ) ;
    } ) ;

    const result = await dispatchPendingEvents( { skipRecovery: true } ) ;

    expect( result.failed ).toBe( 1 ) ;

    // El evento en DB debe continuar como SENT y NO haber sido retrocedido a PENDING
    const [ dbEvt ] = await db
      .select()
      .from( outboxEvents )
      .where( eq(outboxEvents.id , inserted.id) ) ;

    expect( dbEvt.status ).toBe( "SENT" ) ;
  } ) ;
} ) ;
