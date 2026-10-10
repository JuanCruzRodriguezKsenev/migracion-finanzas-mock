// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach , afterAll } from "vitest" ;
import { getServerSession }                                               from "next-auth" ;
import type { Session }                                                   from "next-auth" ;
import { eq , and , sql }                                                 from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Auth
import { habilitacionRepository } from "@/features/auth/repositories/habilitacionRepository" ;
import { organizations }          from "@/features/auth/schema.db" ;

// Feature: Organizations
import { quitarMiembroAction } from "@/features/organizations/actions/membersActions" ;

// Feature: Accounting
import { createLedgerTransactionAction , reverseLedgerTransactionAction , createAccountAction } from "@/features/accounting/actions/accountingActions" ;
import { accounts , ledgerTransactions }                                                         from "@/features/accounting/schema.db" ;

// Feature: Notifications
import { listarNotificacionesAction , marcarLeidasAction } from "./notificationsActions" ;
import { notificationRepository }                          from "../repositories/notificationRepository" ;
import { notifications }                                   from "../schema.db" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

function sesionDe( userId: string , organizationId: string , role = "member" ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

describe( "avisos de autoría (plan 18)" , () => {
  let orgA:    string ;
  let orgB:    string ;
  let owner:   string ;
  let ana:     string ;
  let beto:    string ;
  let carla:   string ;
  let ownerB:  string ;
  let cajaId:  string ;
  let bancoId: string ;

  function movimiento( extra: Record< string , unknown > = {} ) {
    return( {
      description: "Súper" ,
      entries: [
        { accountId: cajaId  , debit: 0    , credit: 1200 } ,
        { accountId: bancoId , debit: 1200 , credit: 0    } ,
      ] ,
      ...extra ,
    } ) ;
  }

  async function avisosDe( userId: string , organizationId = orgA ) {
    return( await db.select().from( notifications ).where( and( eq( notifications.recipientUserId , userId ) , eq( notifications.organizationId , organizationId ) ) ) ) ;
  }

  async function totalAvisos(): Promise< number > {
    return( ( await db.select().from( notifications ) ).length ) ;
  }

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-avisos"   } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-avisos" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;

    owner  = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "owner@ejemplo.com"  , name: "Olga Owner" , role: "owner"  } ) ).id ;
    ana    = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "ana@ejemplo.com"    , name: "Ana Pérez"  , role: "member" } ) ).id ;
    beto   = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "beto@ejemplo.com"   , role: "member" } ) ).id ;
    carla  = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "carla@ejemplo.com"  , role: "member" } ) ).id ;
    ownerB = ( await crearUsuarioConMembresia( { organizationId: orgB , email: "ownerb@ejemplo.com" , role: "owner"  } ) ).id ;

    const [ caja , banco ] = await db
      .insert( accounts )
      .values( [
        { organizationId: orgA , code: "1.1.01" , name: "Caja"  , type: "asset" , balance: 100000 } ,
        { organizationId: orgA , code: "1.1.02" , name: "Banco" , type: "asset" , balance: 0      } ,
      ] )
      .returning() ;
    cajaId  = caja.id ;
    bancoId = banco.id ;
  } ) ;

  afterEach( () => {
    vi.restoreAllMocks() ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "AC-2: Beto habilitado carga a nombre de Ana; Ana recibe 1 aviso con actor, monto y divisa; Beto ninguno" , async () => {
    await habilitacionRepository.otorgar( orgA , ana , beto ) ;
    sesionDe( beto , orgA ) ;

    const res = await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;
    expect( res.success ).toBe( true ) ;

    const deAna = await avisosDe( ana ) ;
    expect( deAna ).toHaveLength( 1 ) ;
    expect( deAna[0].type ).toBe( "charged_to_holder" ) ;
    expect( deAna[0].actorUserId ).toBe( beto ) ;
    expect( deAna[0].amountInCents ).toBe( 1200 ) ;
    expect( deAna[0].currency ).toBe( "ARS" ) ;
    expect( deAna[0].readAt ).toBeNull() ;
    expect( await avisosDe( beto ) ).toHaveLength( 0 ) ;
  } ) ;

  it( "AC-5: el owner carga a nombre de un member que no lo habilitó y ese miembro recibe el aviso" , async () => {
    sesionDe( owner , orgA , "owner" ) ;

    const res = await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;

    expect( res.success ).toBe( true ) ;
    expect( await avisosDe( ana ) ).toHaveLength( 1 ) ;
    expect( await avisosDe( owner ) ).toHaveLength( 0 ) ;
  } ) ;

  it( "una carga a nombre propio o sin titular no crea ninguna fila" , async () => {
    sesionDe( ana , orgA ) ;

    await createLedgerTransactionAction( movimiento() ) ;
    await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;

    expect( await totalAvisos() ).toBe( 0 ) ;
  } ) ;

  it( "los movimientos generados por el sistema (apertura de cuenta con saldo) no emiten avisos" , async () => {
    sesionDe( owner , orgA , "owner" ) ;

    const res = await createAccountAction( { name: "Ahorros" , type: "asset" , balance: 5000 } ) ;

    expect( res.success ).toBe( true ) ;
    expect( await totalAvisos() ).toBe( 0 ) ;
  } ) ;

  it( "AC-7: reversar un movimiento de Ana cargado por Beto, siendo Carla el actor, avisa a Ana y a Beto y no a Carla" , async () => {
    await habilitacionRepository.otorgar( orgA , ana , beto ) ;
    sesionDe( beto , orgA ) ;
    const original = await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;
    expect( original.success ).toBe( true ) ;
    if( !original.success ) { return ; }

    sesionDe( carla , orgA ) ;
    const reverso = await reverseLedgerTransactionAction( { transactionId: original.value.id } ) ;
    expect( reverso.success ).toBe( true ) ;

    const deAna  = ( await avisosDe( ana ) ).filter( ( n ) => n.type === "transaction_reversed" ) ;
    const deBeto = ( await avisosDe( beto ) ).filter( ( n ) => n.type === "transaction_reversed" ) ;

    expect( deAna ).toHaveLength( 1 ) ;
    expect( deBeto ).toHaveLength( 1 ) ;
    expect( deAna[0].actorUserId ).toBe( carla ) ;
    expect( deAna[0].amountInCents ).toBe( 1200 ) ;
    expect( deAna[0].currency ).toBe( "ARS" ) ;
    expect( await avisosDe( carla ) ).toHaveLength( 0 ) ;
  } ) ;

  it( "atomicidad de la carga: si falla el aviso no queda ni el movimiento" , async () => {
    sesionDe( owner , orgA , "owner" ) ;
    const real = notificationRepository.insertar ;
    vi.spyOn( notificationRepository , "insertar" ).mockImplementation( async ( filas , tx ) => {
      await real( filas , tx ) ;
      throw new Error( "falla simulada después de insertar el aviso" ) ;
    } ) ;

    const res = await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;

    expect( res.success ).toBe( false ) ;
    expect( await totalAvisos() ).toBe( 0 ) ;
    expect( await db.select().from( ledgerTransactions ).where( eq( ledgerTransactions.organizationId , orgA ) ) ).toHaveLength( 0 ) ;
  } ) ;

  it( "atomicidad del reverso: si el reverso falla no queda ningún aviso nuevo ni la original queda reversada" , async () => {
    sesionDe( owner , orgA , "owner" ) ;
    const original = await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;
    expect( original.success ).toBe( true ) ;
    if( !original.success ) { return ; }

    const antes = await totalAvisos() ;
    const real  = notificationRepository.insertar ;
    vi.spyOn( notificationRepository , "insertar" ).mockImplementation( async ( filas , tx ) => {
      await real( filas , tx ) ;
      throw new Error( "falla simulada después de insertar el aviso" ) ;
    } ) ;

    sesionDe( carla , orgA ) ;
    const reverso = await reverseLedgerTransactionAction( { transactionId: original.value.id } ) ;

    expect( reverso.success ).toBe( false ) ;
    expect( await totalAvisos() ).toBe( antes ) ;
    const [ fila ] = await db.select().from( ledgerTransactions ).where( eq( ledgerTransactions.id , original.value.id ) ) ;
    expect( fila.reversedAt ).toBeNull() ;
  } ) ;

  it( "listar trae los avisos propios con los nombres resueltos y el total de no leídas; marcarLeidas lo deja en 0" , async () => {
    sesionDe( owner , orgA , "owner" ) ;
    await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;

    sesionDe( ana , orgA ) ;
    const antes = await listarNotificacionesAction() ;
    expect( antes.success ).toBe( true ) ;
    if( !antes.success ) { return ; }
    expect( antes.value.noLeidas ).toBe( 1 ) ;
    expect( antes.value.items ).toHaveLength( 1 ) ;
    expect( antes.value.items[0] ).toMatchObject( { tipo: "charged_to_holder" , actor: "Olga Owner" , titular: "Ana Pérez" , descripcion: "Súper" , montoEnCentavos: 1200 , divisa: "ARS" , leida: false } ) ;

    expect( ( await marcarLeidasAction() ).success ).toBe( true ) ;

    const despues = await listarNotificacionesAction() ;
    expect( despues.success && despues.value.noLeidas ).toBe( 0 ) ;
    expect( despues.success && despues.value.items[0].leida ).toBe( true ) ;
  } ) ;

  it( "AC-30: al listar se borra la leída de hace 31 días y se conserva la no leída de hace 90" , async () => {
    sesionDe( owner , orgA , "owner" ) ;
    await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;
    await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;

    const [ vieja , sinLeer ] = await db.select().from( notifications ).where( eq( notifications.recipientUserId , ana ) ) ;
    await db.execute( sql`update notifications set read_at = now() - interval '31 days' , created_at = now() - interval '40 days' where id = ${vieja.id}` ) ;
    await db.execute( sql`update notifications set created_at = now() - interval '90 days' where id = ${sinLeer.id}` ) ;

    sesionDe( ana , orgA ) ;
    const res = await listarNotificacionesAction() ;

    expect( res.success ).toBe( true ) ;
    const restantes = await avisosDe( ana ) ;
    expect( restantes.map( ( n ) => n.id ) ).toEqual( [ sinLeer.id ] ) ;
    expect( res.success && res.value.noLeidas ).toBe( 1 ) ;
  } ) ;

  it( "una leída reciente (menos de 30 días) no se borra" , async () => {
    sesionDe( owner , orgA , "owner" ) ;
    await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;
    sesionDe( ana , orgA ) ;
    await marcarLeidasAction() ;

    await listarNotificacionesAction() ;

    expect( await avisosDe( ana ) ).toHaveLength( 1 ) ;
  } ) ;

  it( "NFR-7: trae a lo sumo 30 avisos pero el contador cuenta todas las no leídas" , async () => {
    sesionDe( owner , orgA , "owner" ) ;
    for( let i = 0 ; i < 32 ; i++ ) {
      await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;
    }

    sesionDe( ana , orgA ) ;
    const res = await listarNotificacionesAction() ;

    expect( res.success && res.value.items ).toHaveLength( 30 ) ;
    expect( res.success && res.value.noLeidas ).toBe( 32 ) ;
  } ) ;

  it( "aislamiento (AC-29 / NFR-1): el owner de B no ve ni toca los avisos de A" , async () => {
    sesionDe( owner , orgA , "owner" ) ;
    await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;

    sesionDe( ownerB , orgB , "owner" ) ;
    const res = await listarNotificacionesAction() ;
    expect( res.success && res.value.items ).toHaveLength( 0 ) ;
    expect( res.success && res.value.noLeidas ).toBe( 0 ) ;

    await marcarLeidasAction() ;
    expect( ( await avisosDe( ana ) )[0].readAt ).toBeNull() ;

    // Plan 43 (AC-31 / AC-32): Ana ve sus avisos de todas sus organizaciones sin filtro; al filtrar por orgB no ve los de orgA
    await crearUsuarioConMembresiaEnB( ana ) ;
    sesionDe( ana , orgB ) ;
    const deTodas = await listarNotificacionesAction() ;
    expect( deTodas.success && deTodas.value.items ).toHaveLength( 1 ) ;
    const deOtra = await listarNotificacionesAction( { organizacionId: orgB } ) ;
    expect( deOtra.success && deOtra.value.items ).toHaveLength( 0 ) ;
  } ) ;

  async function crearUsuarioConMembresiaEnB( userId: string ) {
    const { membershipRepository } = await import( "@/features/auth/repositories/membershipRepository" ) ;
    await membershipRepository.add( userId , orgB , "member" ) ;
  }

  it( "sin sesión listar y marcarLeidas responden fail sin lanzar" , async () => {
    vi.mocked( getServerSession ).mockResolvedValue( null ) ;

    expect( ( await listarNotificacionesAction() ).success ).toBe( false ) ;
    expect( ( await marcarLeidasAction() ).success ).toBe( false ) ;
  } ) ;

  it( "quitar a un miembro borra sus avisos en esa organización y conserva los de otras" , async () => {
    await crearUsuarioConMembresiaEnB( ana ) ;
    sesionDe( owner , orgA , "owner" ) ;
    await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;

    // Un aviso de Ana en la organización B (transacción propia de B)
    const [ txB ] = await db.insert( ledgerTransactions ).values( { organizationId: orgB , description: "De B" } ).returning() ;
    await db.insert( notifications ).values( { organizationId: orgB , recipientUserId: ana , type: "charged_to_holder" , actorUserId: ownerB , transactionId: txB.id } ) ;

    expect( await avisosDe( ana , orgA ) ).toHaveLength( 1 ) ;

    sesionDe( owner , orgA , "owner" ) ;
    expect( ( await quitarMiembroAction( ana ) ).success ).toBe( true ) ;

    expect( await avisosDe( ana , orgA ) ).toHaveLength( 0 ) ;
    expect( await avisosDe( ana , orgB ) ).toHaveLength( 1 ) ;
  } ) ;
} ) ;
