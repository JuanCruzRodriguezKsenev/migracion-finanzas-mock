// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach , afterAll } from "vitest" ;
import { getServerSession }                                               from "next-auth" ;
import type { Session }                                                   from "next-auth" ;
import { eq , and , sql }                                                 from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Accounting
import { createLedgerTransactionAction , reverseLedgerTransactionAction } from "@/features/accounting/actions/accountingActions" ;
import { accounts , ledgerTransactions , ledgerEntries }                  from "@/features/accounting/schema.db" ;

// Feature: Auth
import { organizations , users , memberships } from "@/features/auth/schema.db" ;

// Feature: Notifications
import { notifications } from "@/features/notifications/schema.db" ;

// Feature: Splits
import { obtenerSaldosAction , registrarPagoAction , solicitarPagoAction } from "./actions/saldosActions" ;
import { guardarAcuerdoAction }                                            from "./actions/acuerdoActions" ;
import { expenseSplits , memberPayments , paymentRequests }                from "./schema.db" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

function sesionDe( userId: string , organizationId: string ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role: "owner" } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

describe( "saldos, pagos y solicitudes de pago (plan 20)" , () => {
  let orgA:   string ;
  let orgB:   string ;
  let ana:    string ; // owner
  let beto:   string ; // member
  let lector: string ; // viewer
  let ajeno:  string ; // owner de la organización B

  /** Una deuda directa: el titular `acreedor` es el acreedor y `deudor` debe `monto`. */
  async function deuda( org: string , acreedor: string | null , deudor: string | null , monto: number , divisa = "ARS" ) {
    const [ tx ] = await db.insert( ledgerTransactions ).values( { organizationId: org , description: "Gasto repartido" , holderUserId: acreedor } ).returning() ;
    await db.insert( expenseSplits ).values( { organizationId: org , transactionId: tx.id , debtorUserId: deudor , amountInCents: monto , currency: divisa } ) ;
    return( tx.id ) ;
  }

  async function saldosDe( userId: string ) {
    sesionDe( userId , orgA ) ;
    const res = await obtenerSaldosAction() ;
    expect( res.success ).toBe( true ) ;
    return( res.success ? res.value : null ) ;
  }

  async function avisos( userId: string , tipo: string ) {
    return( await db.select().from( notifications ).where( and( eq( notifications.recipientUserId , userId ) , eq( notifications.type , tipo ) ) ) ) ;
  }

  async function contarAsientos(): Promise< [ number , number ] > {
    const [ t ] = await db.select( { n: sql< number >`count(*)::int` } ).from( ledgerTransactions ) ;
    const [ e ] = await db.select( { n: sql< number >`count(*)::int` } ).from( ledgerEntries ) ;
    return( [ t.n , e.n ] ) ;
  }

  beforeEach( async () => {
    vi.restoreAllMocks() ;
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-saldos"   } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-saldos" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;

    ana    = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "ana@ejemplo.com"    , name: "Ana"  , role: "owner"  } ) ).id ;
    beto   = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "beto@ejemplo.com"   , name: "Beto" , role: "member" } ) ).id ;
    lector = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "lector@ejemplo.com" , name: "Lector" , role: "viewer" } ) ).id ;
    ajeno  = ( await crearUsuarioConMembresia( { organizationId: orgB , email: "ajeno@ejemplo.com"  , name: "Ajeno" , role: "owner"  } ) ).id ;
  } ) ;

  afterEach( () => {
    vi.useRealTimers() ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "AC-17: Beto debe 4.800 ARS y 20 USD a Ana, Ana debe 1.800 ARS a Beto: Ana ve 3.000 ARS y 20 USD sin compensar divisas" , async () => {
    await deuda( orgA , ana  , beto , 480000 ) ;
    await deuda( orgA , ana  , beto , 2000 , "USD" ) ;
    await deuda( orgA , beto , ana  , 180000 ) ;

    const vistaAna = await saldosDe( ana ) ;

    expect( vistaAna?.visible ).toBe( true ) ;
    expect( vistaAna?.saldos ).toEqual( [
      { contraparteId: beto , nombre: "Beto" , divisa: "ARS" , montoEnCentavos: 300000 } ,
      { contraparteId: beto , nombre: "Beto" , divisa: "USD" , montoEnCentavos: 2000 } ,
    ] ) ;

    const vistaBeto = await saldosDe( beto ) ;
    expect( vistaBeto?.saldos.map( ( s ) => [ s.divisa , s.montoEnCentavos ] ) ).toEqual( [ [ "ARS" , -300000 ] , [ "USD" , -2000 ] ] ) ;
  } ) ;

  it( "idempotencia: repetir el pago con la misma clave registra un solo pago" , async () => {
    await deuda( orgA , ana , beto , 480000 ) ;

    sesionDe( ana , orgA ) ;
    const clave = "3f2b8c1e-9d4a-4b6f-8a1c-2e7d5f0a9b31" ;
    const datos = { contraparteId: beto , divisa: "ARS" , montoEnCentavos: 200000 } ;

    expect( ( await registrarPagoAction( datos , clave ) ).success ).toBe( true ) ;
    expect( ( await registrarPagoAction( datos , clave ) ).success ).toBe( true ) ;

    expect( ( await db.select().from( memberPayments ).where( eq( memberPayments.organizationId , orgA ) ) ).length ).toBe( 1 ) ;
  } ) ;

  it( "AC-18: un pago de 2.000 deja el saldo en 2.800, avisa a Beto y no crea asientos" , async () => {
    await deuda( orgA , ana , beto , 480000 ) ;
    const antes = await contarAsientos() ;

    sesionDe( ana , orgA ) ;
    const res = await registrarPagoAction( { contraparteId: beto , divisa: "ARS" , montoEnCentavos: 200000 } ) ;

    expect( res.success ).toBe( true ) ;
    expect( ( await saldosDe( ana ) )?.saldos ).toEqual( [ { contraparteId: beto , nombre: "Beto" , divisa: "ARS" , montoEnCentavos: 280000 } ] ) ;

    const deBeto = await avisos( beto , "payment_received" ) ;
    expect( deBeto ).toHaveLength( 1 ) ;
    expect( deBeto[0] ).toMatchObject( { amountInCents: 200000 , currency: "ARS" , actorUserId: ana , transactionId: null } ) ;
    expect( await contarAsientos() ).toEqual( antes ) ;

    const pagos = await db.select().from( memberPayments ) ;
    expect( pagos ).toHaveLength( 1 ) ;
    expect( pagos[0] ).toMatchObject( { fromUserId: beto , toUserId: ana , registeredByUserId: ana } ) ;
  } ) ;

  it( "AC-19: Beto, que es el deudor, no puede registrar un pago y no queda ninguna fila" , async () => {
    await deuda( orgA , ana , beto , 480000 ) ;

    sesionDe( beto , orgA ) ;
    const res = await registrarPagoAction( { contraparteId: ana , divisa: "ARS" , montoEnCentavos: 1000 } ) ;

    expect( res.success ).toBe( false ) ;
    expect( await db.select().from( memberPayments ) ).toHaveLength( 0 ) ;
    expect( await avisos( ana , "payment_received" ) ).toHaveLength( 0 ) ;
  } ) ;

  it( "AC-20: Beto debe 1.000 y Ana registra 1.500: ahora Ana debe 500 a Beto" , async () => {
    await deuda( orgA , ana , beto , 100000 ) ;

    sesionDe( ana , orgA ) ;
    const res = await registrarPagoAction( { contraparteId: beto , divisa: "ARS" , montoEnCentavos: 150000 } ) ;

    expect( res.success ).toBe( true ) ;
    expect( ( await saldosDe( ana ) )?.saldos ).toEqual( [ { contraparteId: beto , nombre: "Beto" , divisa: "ARS" , montoEnCentavos: -50000 } ] ) ;
  } ) ;

  it( "AC-21 / A10: la segunda solicitud del mismo día se rechaza; al día siguiente vuelve a permitirse" , async () => {
    await deuda( orgA , ana , beto , 480000 ) ;
    sesionDe( ana , orgA ) ;

    vi.useFakeTimers( { toFake: [ "Date" ] } ) ;
    vi.setSystemTime( new Date( "2030-03-10T15:00:00Z" ) ) ;

    const primera = await solicitarPagoAction( { contraparteId: beto , divisa: "ARS" } ) ;
    const segunda = await solicitarPagoAction( { contraparteId: beto , divisa: "ARS" } ) ;

    expect( primera.success ).toBe( true ) ;
    expect( segunda.success ).toBe( false ) ;
    expect( await avisos( beto , "payment_requested" ) ).toHaveLength( 1 ) ;

    vi.setSystemTime( new Date( "2030-03-11T15:00:00Z" ) ) ;
    const tercera = await solicitarPagoAction( { contraparteId: beto , divisa: "ARS" } ) ;

    expect( tercera.success ).toBe( true ) ;
    expect( await avisos( beto , "payment_requested" ) ).toHaveLength( 2 ) ;

    const aviso = ( await avisos( beto , "payment_requested" ) )[0] ;
    expect( aviso ).toMatchObject( { amountInCents: 480000 , currency: "ARS" , actorUserId: ana , transactionId: null } ) ;
  } ) ;

  it( "NFR-3: dos solicitudes simultáneas dejan una sola fila y un solo aviso" , async () => {
    await deuda( orgA , ana , beto , 480000 ) ;
    sesionDe( ana , orgA ) ;

    const resultados = await Promise.all( [
      solicitarPagoAction( { contraparteId: beto , divisa: "ARS" } ) ,
      solicitarPagoAction( { contraparteId: beto , divisa: "ARS" } ) ,
    ] ) ;

    expect( resultados.filter( ( r ) => r.success ) ).toHaveLength( 1 ) ;
    expect( await db.select().from( paymentRequests ) ).toHaveLength( 1 ) ;
    expect( await avisos( beto , "payment_requested" ) ).toHaveLength( 1 ) ;
  } ) ;

  it( "NFR-3: dos pagos simultáneos del mismo par dejan dos filas y el saldo suma ambos" , async () => {
    await deuda( orgA , ana , beto , 480000 ) ;
    sesionDe( ana , orgA ) ;

    const resultados = await Promise.all( [
      registrarPagoAction( { contraparteId: beto , divisa: "ARS" , montoEnCentavos: 100000 } ) ,
      registrarPagoAction( { contraparteId: beto , divisa: "ARS" , montoEnCentavos: 50000 } ) ,
    ] ) ;

    expect( resultados.every( ( r ) => r.success ) ).toBe( true ) ;
    expect( await db.select().from( memberPayments ) ).toHaveLength( 2 ) ;
    expect( ( await saldosDe( ana ) )?.saldos[0].montoEnCentavos ).toBe( 330000 ) ;
  } ) ;

  it( "AC-22 / A8: reversar el gasto saca la deuda del saldo, el pago queda y Ana pasa a deberle a Beto" , async () => {
    const cuentas = await db
      .insert( accounts )
      .values( [
        { organizationId: orgA , code: "1.1.01" , name: "Caja"   , type: "asset"   , balance: 10000000 } ,
        { organizationId: orgA , code: "5.1.01" , name: "Comida" , type: "expense" , balance: 0        } ,
      ] )
      .returning() ;

    sesionDe( ana , orgA ) ;
    const acuerdo = await guardarAcuerdoAction( { modo: "fixed_percentages" , usesCommonPot: false , porcentajes: [ { userId: ana , percentageBp: 5000 } , { userId: beto , percentageBp: 5000 } ] } ) ;
    expect( acuerdo.success ).toBe( true ) ;

    const original = await createLedgerTransactionAction( {
      description: "Súper" ,
      entries: [
        { accountId: cuentas[1].id , debit: 960000 , credit: 0 } ,
        { accountId: cuentas[0].id , debit: 0 , credit: 960000 } ,
      ] ,
    } ) ;
    expect( original.success ).toBe( true ) ;
    if( !original.success ) { return ; }

    expect( ( await saldosDe( ana ) )?.saldos[0].montoEnCentavos ).toBe( 480000 ) ;

    sesionDe( ana , orgA ) ;
    expect( ( await registrarPagoAction( { contraparteId: beto , divisa: "ARS" , montoEnCentavos: 480000 } ) ).success ).toBe( true ) ;
    expect( ( await saldosDe( ana ) )?.saldos ).toEqual( [] ) ;

    sesionDe( ana , orgA ) ;
    const reverso = await reverseLedgerTransactionAction( { transactionId: original.value.id } ) ;
    expect( reverso.success ).toBe( true ) ;

    // La deuda se excluye (no se borra); el pago queda: Ana pasa a deberle 4.800 a Beto
    expect( await db.select().from( expenseSplits ).where( eq( expenseSplits.organizationId , orgA ) ) ).toHaveLength( 1 ) ;
    expect( await db.select().from( memberPayments ) ).toHaveLength( 1 ) ;
    expect( ( await saldosDe( ana ) )?.saldos ).toEqual( [ { contraparteId: beto , nombre: "Beto" , divisa: "ARS" , montoEnCentavos: -480000 } ] ) ;
  } ) ;

  it( "A11: borrado el deudor, su deuda aparece como «Miembro anterior» sin acciones y los demás saldos no cambian" , async () => {
    const [ ex ] = await db.insert( users ).values( { email: "ex@ejemplo.com" , name: "Ex" , passwordHash: "0".repeat( 128 ) , salt: "0123456789abcdef0123456789abcdef" } ).returning() ;
    await db.insert( memberships ).values( { userId: ex.id , organizationId: orgA , role: "member" } ) ;
    await deuda( orgA , ana , ex.id , 70000 ) ;
    await deuda( orgA , ana , beto , 30000 ) ;

    await db.delete( memberships ).where( eq( memberships.userId , ex.id ) ) ;
    await db.delete( users ).where( eq( users.id , ex.id ) ) ;

    const vista = await saldosDe( ana ) ;

    expect( vista?.saldos ).toEqual( [
      { contraparteId: null , nombre: null  , divisa: "ARS" , montoEnCentavos: 70000 } ,
      { contraparteId: beto , nombre: "Beto" , divisa: "ARS" , montoEnCentavos: 30000 } ,
    ] ) ;
  } ) ;

  it( "NFR-1: las deudas de una organización ajena no aparecen en los saldos" , async () => {
    const otro = ( await crearUsuarioConMembresia( { organizationId: orgB , email: "otro@ejemplo.com" , role: "member" } ) ).id ;
    await deuda( orgB , ajeno , otro , 99900 ) ;
    await deuda( orgA , ana , beto , 100 ) ;

    expect( ( await saldosDe( ana ) )?.saldos ).toEqual( [ { contraparteId: beto , nombre: "Beto" , divisa: "ARS" , montoEnCentavos: 100 } ] ) ;
    // Y un usuario de otra organización no puede operar con una contraparte que no es miembro de la suya
    sesionDe( ajeno , orgB ) ;
    expect( ( await registrarPagoAction( { contraparteId: beto , divisa: "ARS" , montoEnCentavos: 100 } ) ).success ).toBe( false ) ;
  } ) ;

  it( "un viewer no registra ni solicita, pero sí lee los saldos con puedeEscribir en falso" , async () => {
    await deuda( orgA , lector , beto , 5000 ) ;

    sesionDe( lector , orgA ) ;
    expect( ( await registrarPagoAction( { contraparteId: beto , divisa: "ARS" , montoEnCentavos: 100 } ) ).success ).toBe( false ) ;
    expect( ( await solicitarPagoAction( { contraparteId: beto , divisa: "ARS" } ) ).success ).toBe( false ) ;

    const vista = await saldosDe( lector ) ;
    expect( vista?.puedeEscribir ).toBe( false ) ;
    expect( vista?.saldos ).toHaveLength( 1 ) ;
    expect( await db.select().from( memberPayments ) ).toHaveLength( 0 ) ;
  } ) ;

  it( "la pestaña no es visible sin acuerdo ni historia (NFR-6) y sí con una deuda" , async () => {
    expect( ( await saldosDe( ana ) )?.visible ).toBe( false ) ;

    await deuda( orgA , ana , beto , 100 ) ;
    expect( ( await saldosDe( ana ) )?.visible ).toBe( true ) ;
  } ) ;

  it( "rechaza datos inválidos del cliente (monto cero, divisa en minúscula, campos de más)" , async () => {
    await deuda( orgA , ana , beto , 480000 ) ;
    sesionDe( ana , orgA ) ;

    expect( ( await registrarPagoAction( { contraparteId: beto , divisa: "ARS" , montoEnCentavos: 0 } ) ).success ).toBe( false ) ;
    expect( ( await registrarPagoAction( { contraparteId: beto , divisa: "ars" , montoEnCentavos: 10 } ) ).success ).toBe( false ) ;
    expect( ( await registrarPagoAction( { contraparteId: beto , divisa: "ARS" , montoEnCentavos: 10 , fromUserId: ana } as never ) ).success ).toBe( false ) ;
    expect( await db.select().from( memberPayments ) ).toHaveLength( 0 ) ;
  } ) ;
} ) ;
