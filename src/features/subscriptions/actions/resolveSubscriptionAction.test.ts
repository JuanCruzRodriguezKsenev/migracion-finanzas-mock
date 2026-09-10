// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach , afterAll } from "vitest" ;
import { getServerSession }                                                from "next-auth" ;
import { eq }                                                              from "drizzle-orm" ;

// Shared
import { db }          from "@/shared/db/client" ;
import { limpiarBase } from "@/shared/db/testCleanup" ;

// Feature: Auth
import { organizations , users } from "@/features/auth/schema.db" ;

// Feature: Profile
import { profiles } from "@/features/profile/schema.db" ;

// Feature: Accounting
import {
  accounts ,
  categories ,
  categoryAccounts ,
  ledgerEntries ,
  ledgerTransactions ,
  idempotencyKeys ,
  outboxEvents ,
  monthlySummaries
} from "@/features/accounting/schema.db" ;

// Feature: Subscriptions
import { subscriptions }            from "../schema.db" ;
import { resolveSubscriptionAction } from "./resolveSubscriptionAction" ;
import { pendientesDe }              from "../services/recurrenceService" ;
import { makeSubscription }         from "../testing/subscriptionFactory" ;
import { Subscription }              from "../types" ;

vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

describe( "resolveSubscriptionAction (RFC 023)" , () => {
  let orgId:      string ;
  let userId:     string ;
  let cajaArsId:  string ;
  let catPadreId: string ;

  const cleanAll = async () => {
    await limpiarBase() ;
  } ;

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await cleanAll() ;

    const [ org ] = await db
      .insert( organizations )
      .values( { name: "Org Pruebas RFC 023" , slug: "org-rfc-023" } )
      .returning() ;

    orgId = org.id ;

    const [ usr ] = await db
      .insert( users )
      .values( {
        organizationId: orgId ,
        email:          "tester@ejemplo.com" ,
        name:           "Tester" ,
        passwordHash:   "hash-invalido" ,
        salt:           "salt-invalido" ,
        role:           "owner" ,
      } )
      .returning() ;

    userId = usr.id ;

    await db.insert( profiles ).values( {
      userId ,
      timezone:     "America/Argentina/Buenos_Aires" ,
      currency:     "ARS" ,
      numberFormat: "es-AR" ,
    } ) ;

    const [ cajaArs ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "1.1.01" ,
        name:           "Caja ARS" ,
        type:           "asset" ,
        balance:        50000000 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    cajaArsId = cajaArs.id ;

    await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "1.1.02" ,
        name:           "Caja USD" ,
        type:           "asset" ,
        balance:        100000 ,
        currency:       "USD" ,
      } ) ;

    // Categoría padre 5.1.09 (Servicios y suscripciones)
    const [ cat ] = await db
      .insert( categories )
      .values( {
        organizationId: orgId ,
        name:           "Suscripciones" ,
        type:           "expense" ,
        accountCode:    "5.1.09" ,
        isSystemLeaf:   false ,
      } )
      .returning() ;

    catPadreId = cat.id ;

    // Configurar sesión activa para Server Actions
    vi.mocked( getServerSession ).mockResolvedValue( {
      user: {
        id:             userId ,
        email:          "tester@ejemplo.com" ,
        organizationId: orgId ,
      } ,
      expires: new Date( Date.now() + 3600000 ).toISOString() ,
    } ) ;
  } ) ;

  afterEach( async () => {
    await cleanAll() ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "Paso 7.5 — Resolver confirmar: nace el asiento con occurredAt de la ocurrencia, Debe = Haber y puntero avanza" , async () => {
    const inicio = new Date( 2026 , 5 , 5 , 9 , 0 ) ; // 2026-06-05

    const [ sub ] = await db
      .insert( subscriptions )
      .values( {
        organizationId:  orgId ,
        name:            "Netflix" ,
        amount:          1599000 ,
        currency:        "ARS" ,
        frequency:       "monthly" ,
        intervalCount:   1 ,
        startDate:       inicio ,
        nextPaymentDate: new Date( 2026 , 8 , 5 , 9 , 0 ) ,
        resolvedThrough: "2026-08-05" , // Resuelto hasta agosto
        accountId:       cajaArsId ,
        categoryId:      catPadreId ,
      } )
      .returning() ;

    const res = await resolveSubscriptionAction( {
      subscriptionId: sub.id ,
      occurrenceDate: "2026-09-05" ,
      action:         "confirm" ,
    } ) ;

    expect( res.success ).toBe( true ) ;
    if( !res.success ){ return ; }

    expect( res.value.transactionId ).toBeDefined() ;
    expect( res.value.subscription.resolvedThrough ).toBe( "2026-09-05" ) ;

    // Verificar asiento contable en el libro mayor
    const txRow = await db
      .select()
      .from( ledgerTransactions )
      .where( eq( ledgerTransactions.id , res.value.transactionId! ) ) ;

    expect( txRow.length ).toBe( 1 ) ;
    expect( txRow[0].description ).toBe( "Netflix" ) ;

    // occurredAt debe corresponder a la fecha de la ocurrencia (2026-09-05), no a la fecha de hoy
    const occurred = new Date( txRow[0].occurredAt ) ;
    expect( occurred.getUTCFullYear() ).toBe( 2026 ) ;
    expect( occurred.getUTCMonth() ).toBe( 8 ) ; // Septiembre (0-indexed: 8)
    expect( occurred.getUTCDate() ).toBe( 5 ) ;

    // Verificar entradas de Debe y Haber
    const entries = await db
      .select()
      .from( ledgerEntries )
      .where( eq( ledgerEntries.transactionId , txRow[0].id ) ) ;

    expect( entries.length ).toBe( 2 ) ;
    const debitEntry  = entries.find( ( e ) => e.debit > 0 ) ;
    const creditEntry = entries.find( ( e ) => e.credit > 0 ) ;

    expect( debitEntry?.debit ).toBe( 1599000 ) ;
    expect( creditEntry?.credit ).toBe( 1599000 ) ;
    expect( creditEntry?.accountId ).toBe( cajaArsId ) ;

    // El puntero avanzó en la base de datos
    const [ subActualizada ] = await db
      .select()
      .from( subscriptions )
      .where( eq( subscriptions.id , sub.id ) ) ;

    expect( subActualizada.resolvedThrough ).toBe( "2026-09-05" ) ;
  } ) ;

  it( "Paso 7.6 — Resolver la guarda: resolver dos veces la misma ocurrencia falla la segunda y no duplica asiento" , async () => {
    const inicio = new Date( 2026 , 5 , 5 , 9 , 0 ) ;

    const [ sub ] = await db
      .insert( subscriptions )
      .values( {
        organizationId:  orgId ,
        name:            "Spotify" ,
        amount:          649900 ,
        currency:        "ARS" ,
        frequency:       "monthly" ,
        startDate:       inicio ,
        nextPaymentDate: new Date( 2026 , 8 , 5 , 9 , 0 ) ,
        resolvedThrough: "2026-08-05" ,
        accountId:       cajaArsId ,
        categoryId:      catPadreId ,
      } )
      .returning() ;

    // Primera resolución: éxito
    const res1 = await resolveSubscriptionAction( {
      subscriptionId: sub.id ,
      occurrenceDate: "2026-09-05" ,
      action:         "confirm" ,
    } ) ;
    expect( res1.success ).toBe( true ) ;

    // Segunda resolución idéntica (ej: dos pestañas simultáneas): debe fallar por guarda de secuencia
    const res2 = await resolveSubscriptionAction( {
      subscriptionId: sub.id ,
      occurrenceDate: "2026-09-05" ,
      action:         "confirm" ,
    } ) ;

    expect( res2.success ).toBe( false ) ;

    // No debe haber dejado un segundo asiento
    const txs = await db
      .select()
      .from( ledgerTransactions )
      .where( eq( ledgerTransactions.organizationId , orgId ) ) ;

    expect( txs.length ).toBe( 1 ) ;
  } ) ;

  it( "Paso 7.7 — Resolver divisa distinta: falla con error explícito y no escribe nada" , async () => {
    const inicio = new Date( 2026 , 5 , 5 , 9 , 0 ) ;

    const [ subUsd ] = await db
      .insert( subscriptions )
      .values( {
        organizationId:  orgId ,
        name:            "ChatGPT Plus" ,
        amount:          2000 , // USD 20.00
        currency:        "USD" ,
        frequency:       "monthly" ,
        startDate:       inicio ,
        nextPaymentDate: new Date( 2026 , 8 , 5 , 9 , 0 ) ,
        resolvedThrough: "2026-08-05" ,
        accountId:       cajaArsId , // Cuenta en ARS, incompatibilidad de moneda
        categoryId:      catPadreId ,
      } )
      .returning() ;

    const res = await resolveSubscriptionAction( {
      subscriptionId: subUsd.id ,
      occurrenceDate: "2026-09-05" ,
      action:         "confirm" ,
    } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ){
      expect( res.error ).toContain( "divisa" ) ;
    }

    // No se emitió ningún asiento en el libro mayor
    const txs = await db.select().from( ledgerTransactions ) ;
    expect( txs.length ).toBe( 0 ) ;

    // El puntero no avanzó
    const [ subDb ] = await db
      .select()
      .from( subscriptions )
      .where( eq( subscriptions.id , subUsd.id ) ) ;

    expect( subDb.resolvedThrough ).toBe( "2026-08-05" ) ;
  } ) ;

  it( "Paso 7.8 — Resolver no me lo cobraron: avanza el puntero y no hay asiento contable" , async () => {
    const inicio = new Date( 2026 , 5 , 5 , 9 , 0 ) ;

    const [ sub ] = await db
      .insert( subscriptions )
      .values( {
        organizationId:  orgId ,
        name:            "Gimnasio" ,
        amount:          3500000 ,
        currency:        "ARS" ,
        frequency:       "monthly" ,
        startDate:       inicio ,
        nextPaymentDate: new Date( 2026 , 8 , 5 , 9 , 0 ) ,
        resolvedThrough: "2026-08-05" ,
        accountId:       cajaArsId ,
        categoryId:      catPadreId ,
      } )
      .returning() ;

    const res = await resolveSubscriptionAction( {
      subscriptionId: sub.id ,
      occurrenceDate: "2026-09-05" ,
      action:         "not_charged" ,
    } ) ;

    expect( res.success ).toBe( true ) ;

    // No debe haber creado ningún asiento
    const txs = await db.select().from( ledgerTransactions ) ;
    expect( txs.length ).toBe( 0 ) ;

    // El puntero sí avanzó
    const [ subDb ] = await db
      .select()
      .from( subscriptions )
      .where( eq( subscriptions.id , sub.id ) ) ;

    expect( subDb.resolvedThrough ).toBe( "2026-09-05" ) ;
  } ) ;

  it( "Paso 7.9 — Backfill: con el puntero correcto las 8 sembradas no proponen 32 pendientes" , async () => {
    const inicio = new Date( 2026 , 5 , 5 , 9 , 0 ) ; // 2026-06-05

    // Simular las 8 suscripciones sembradas con puntero según la migración y el seed
    const subsSembradas: Subscription[] = [
      makeSubscription( { id: "s1" , organizationId: orgId , name: "Netflix"              , amount: 1599000 , frequency: "monthly" , startDate: inicio , resolvedThrough: "2026-08-05" } ) ,
      makeSubscription( { id: "s2" , organizationId: orgId , name: "Spotify"              , amount: 649900  , frequency: "monthly" , startDate: inicio , resolvedThrough: "2026-08-05" } ) ,
      makeSubscription( { id: "s3" , organizationId: orgId , name: "ChatGPT Plus"         , amount: 2000000 , frequency: "monthly" , startDate: inicio , resolvedThrough: "2026-08-05" } ) ,
      makeSubscription( { id: "s4" , organizationId: orgId , name: "Adobe Creative Cloud" , amount: 5499000 , frequency: "monthly" , startDate: inicio , resolvedThrough: "2026-08-05" } ) ,
      makeSubscription( { id: "s5" , organizationId: orgId , name: "Gimnasio"             , amount: 3500000 , frequency: "monthly" , startDate: inicio , resolvedThrough: "2026-08-05" } ) ,
      makeSubscription( { id: "s6" , organizationId: orgId , name: "iCloud+"              , amount: 129900  , frequency: "monthly" , startDate: inicio , resolvedThrough: "2026-08-05" } ) ,
      makeSubscription( { id: "s7" , organizationId: orgId , name: "NordVPN"              , amount: 4800000 , frequency: "yearly"  , startDate: inicio , resolvedThrough: "2026-06-05" } ) ,
      makeSubscription( { id: "s8" , organizationId: orgId , name: "Figma"                , amount: 1200000 , frequency: "monthly" , startDate: inicio , resolvedThrough: "2026-08-05" } ) ,
    ] ;

    // Si resolvedThrough fuera null o startDate, aparecerían 32 ocurrencias (junio, julio, agosto, septiembre x 8)
    const sinPuntero = subsSembradas.flatMap( ( s ) => pendientesDe( { ...s , resolvedThrough: null } , "2026-09-10" ) ) ;
    expect( sinPuntero.length ).toBeGreaterThanOrEqual( 28 ) ; // 4 x 7 mensuales = 28 + 1 anual = 29

    // Con el puntero fijado en el período anterior (backfill RFC 023 §3.4):
    const conPuntero = subsSembradas.flatMap( ( s ) => pendientesDe( s , "2026-09-10" ) ) ;

    // Las 7 mensuales proponen únicamente el período actual (septiembre 2026)
    // NordVPN (anual que cobró en junio 2026) no propone nada porque su cobro es en junio 2027
    expect( conPuntero.length ).toBe( 7 ) ;
    for( const p of conPuntero ) {
      expect( p.fechaCobro ).toBe( "2026-09-05" ) ;
    }
  } ) ;

  it( "Paso 1 — Concurrencia: dos resoluciones concurrentes sobre la misma ocurrencia permiten sólo una y crean un solo asiento" , async () => {
    const inicio = new Date( 2026 , 5 , 5 , 9 , 0 ) ;

    const [ sub ] = await db
      .insert( subscriptions )
      .values( {
        organizationId:  orgId ,
        name:            "Netflix Concurrente" ,
        amount:          1599000 ,
        currency:        "ARS" ,
        frequency:       "monthly" ,
        startDate:       inicio ,
        nextPaymentDate: new Date( 2026 , 8 , 5 , 9 , 0 ) ,
        resolvedThrough: "2026-08-05" ,
        accountId:       cajaArsId ,
        categoryId:      catPadreId ,
      } )
      .returning() ;

    const [ res1 , res2 ] = await Promise.all( [
      resolveSubscriptionAction( {
        subscriptionId: sub.id ,
        occurrenceDate: "2026-09-05" ,
        action:         "confirm" ,
      } ) ,
      resolveSubscriptionAction( {
        subscriptionId: sub.id ,
        occurrenceDate: "2026-09-05" ,
        action:         "confirm" ,
      } ) ,
    ] ) ;

    const exitos = [ res1 , res2 ].filter( ( r ) => r.success ) ;
    const fallos = [ res1 , res2 ].filter( ( r ) => !r.success ) ;

    expect( exitos.length ).toBe( 1 ) ;
    expect( fallos.length ).toBe( 1 ) ;
    expect( fallos[0].error ).toBe( "Otra confirmación resolvió esta ocurrencia mientras se procesaba." ) ;

    const txs = await db
      .select()
      .from( ledgerTransactions )
      .where( eq( ledgerTransactions.organizationId , orgId ) ) ;

    // Debe haber un solo asiento contable registrado para esta confirmación
    expect( txs.length ).toBe( 1 ) ;
    expect( txs[0].description ).toBe( "Netflix Concurrente" ) ;
  } ) ;
} ) ;
