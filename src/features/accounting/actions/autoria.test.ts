// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                   from "next-auth" ;
import type { Session }                                       from "next-auth" ;
import { eq }                                                 from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Auth
import { habilitacionRepository } from "@/features/auth/repositories/habilitacionRepository" ;
import { organizations }          from "@/features/auth/schema.db" ;

// Feature: Accounting
import { createLedgerTransactionAction , reverseLedgerTransactionAction } from "./accountingActions" ;
import { createLedgerTransaction }                                        from "../services/accountingService" ;
import { accounts , ledgerTransactions }                                  from "../schema.db" ;
import { ledgerRepository }                                           from "../repositories/ledgerRepository" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

function sesionDe( userId: string , organizationId: string , role = "member" ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

describe( "autoría y titular de los movimientos" , () => {
  let orgA:     string ;
  let orgB:     string ;
  let owner:    string ;
  let ana:      string ; // member, titular
  let beto:     string ; // member, carga a nombre de Ana
  let lector:   string ; // viewer
  let cajaId:   string ;
  let bancoId:  string ;

  /** Un asiento simple de partida doble entre las dos cuentas de la organización A. */
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

  async function contarMovimientos(): Promise< number > {
    return( ( await db.select().from( ledgerTransactions ).where( eq( ledgerTransactions.organizationId , orgA ) ) ).length ) ;
  }

  beforeEach( async () => {
    vi.restoreAllMocks() ;
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-autoria"   } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-autoria" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;

    owner  = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "owner@ejemplo.com"  , role: "owner"  } ) ).id ;
    ana    = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "ana@ejemplo.com"    , role: "member" } ) ).id ;
    beto   = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "beto@ejemplo.com"   , role: "member" } ) ).id ;
    lector = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "lector@ejemplo.com" , role: "viewer" } ) ).id ;

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

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "AC-1: el autor es siempre la sesión, aunque el cliente mande otro createdByUserId" , async () => {
    sesionDe( beto , orgA ) ;

    // Campo extra que la firma tipada no admite: se fuerza como lo haría un cliente malicioso
    const res = await createLedgerTransactionAction( movimiento( { createdByUserId: owner } ) as never ) ;

    expect( res.success ).toBe( true ) ;
    if( res.success ) {
      expect( res.value.createdByUserId ).toBe( beto ) ;
      expect( res.value.holderUserId ).toBeNull() ;
    }
  } ) ;

  it( "un movimiento propio (sin titular) guarda autor y deja el titular en nulo" , async () => {
    sesionDe( ana , orgA ) ;

    const res = await createLedgerTransactionAction( movimiento() ) ;

    expect( res.success ).toBe( true ) ;
    if( res.success ) {
      expect( res.value.createdByUserId ).toBe( ana ) ;
      expect( res.value.holderUserId ).toBeNull() ;
    }
  } ) ;

  it( "AC-2 (parte del plan 15): un member habilitado carga a nombre de otro, con titular y autor correctos" , async () => {
    await habilitacionRepository.otorgar( orgA , ana , beto ) ;
    sesionDe( beto , orgA ) ;

    const res = await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;

    expect( res.success ).toBe( true ) ;
    if( res.success ) {
      expect( res.value.holderUserId ).toBe( ana ) ;
      expect( res.value.createdByUserId ).toBe( beto ) ;
    }
  } ) ;

  it( "AC-3: un member sin habilitación no puede cargar a nombre de otro y no se crea ninguna fila" , async () => {
    sesionDe( beto , orgA ) ;
    const antes = await contarMovimientos() ;

    const res = await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;

    expect( res.success ).toBe( false ) ;
    expect( await contarMovimientos() ).toBe( antes ) ;
  } ) ;

  it( "la habilitación es direccional: Ana habilitó a Beto, pero Ana no puede cargar a nombre de Beto" , async () => {
    await habilitacionRepository.otorgar( orgA , ana , beto ) ;
    sesionDe( ana , orgA ) ;

    const res = await createLedgerTransactionAction( movimiento( { holderUserId: beto } ) ) ;

    expect( res.success ).toBe( false ) ;
  } ) ;

  it( "AC-4: si el otorgante revoca entre dos llamadas, la segunda falla (se lee de la base, no del token)" , async () => {
    await habilitacionRepository.otorgar( orgA , ana , beto ) ;
    sesionDe( beto , orgA ) ;

    const primera = await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;
    expect( primera.success ).toBe( true ) ;

    await habilitacionRepository.revocar( orgA , ana , beto ) ;
    const antes = await contarMovimientos() ;

    const segunda = await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;

    expect( segunda.success ).toBe( false ) ;
    expect( await contarMovimientos() ).toBe( antes ) ;
  } ) ;

  it( "AC-5 / AC-9: un owner carga a nombre de un member que no lo habilitó, pero no de un viewer" , async () => {
    sesionDe( owner , orgA , "owner" ) ;
    const antes = await contarMovimientos() ;

    const aMember = await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;
    const aViewer = await createLedgerTransactionAction( movimiento( { holderUserId: lector } ) ) ;

    expect( aMember.success ).toBe( true ) ;
    expect( aViewer.success ).toBe( false ) ;
    if( aMember.success ) {
      expect( aMember.value.holderUserId ).toBe( ana ) ;
    }
    expect( await contarMovimientos() ).toBe( antes + 1 ) ;
  } ) ;

  it( "AC-10: un movimiento ya cargado con titular viewer se sigue listando" , async () => {
    const creado = await createLedgerTransaction( {
      organizationId:  orgA ,
      description:     "Viejo" ,
      createdByUserId: owner ,
      holderUserId:    lector ,
      entries: [
        { accountId: cajaId  , debit: 0    , credit: 700 } ,
        { accountId: bancoId , debit: 700  , credit: 0   } ,
      ] ,
    } ) ;
    expect( creado.success ).toBe( true ) ;

    const pagina = await ledgerRepository.findTransactionsPage( { organizationId: orgA } ) ;

    expect( pagina.items.map( ( t ) => t.holderUserId ) ).toEqual( [ lector ] ) ;
  } ) ;

  it( "A4: el titular tiene que ser miembro de la organización (de otra organización, o inventado)" , async () => {
    const deOtraOrg = ( await crearUsuarioConMembresia( { organizationId: orgB , email: "afuera@ejemplo.com" , role: "member" } ) ).id ;
    sesionDe( owner , orgA , "owner" ) ;
    const antes = await contarMovimientos() ;

    const ajeno     = await createLedgerTransactionAction( movimiento( { holderUserId: deOtraOrg } ) ) ;
    const inventado = await createLedgerTransactionAction( movimiento( { holderUserId: "00000000-0000-4000-8000-000000000000" } ) ) ;

    expect( ajeno.success ).toBe( false ) ;
    expect( inventado.success ).toBe( false ) ;
    expect( await contarMovimientos() ).toBe( antes ) ;
  } ) ;

  it( "un titular que no es un uuid se rechaza en la validación" , async () => {
    sesionDe( owner , orgA , "owner" ) ;

    const res = await createLedgerTransactionAction( movimiento( { holderUserId: "no-es-uuid" } ) ) ;

    expect( res.success ).toBe( false ) ;
  } ) ;

  it( "el titular propio explícito se acepta y se guarda" , async () => {
    sesionDe( ana , orgA ) ;

    const res = await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;

    expect( res.success ).toBe( true ) ;
    if( res.success ) {
      expect( res.value.holderUserId ).toBe( ana ) ;
    }
  } ) ;

  it( "AC-7 (parte del plan 15): el contra-asiento hereda el titular y tiene como autor al que reversa" , async () => {
    await habilitacionRepository.otorgar( orgA , ana , beto ) ;
    sesionDe( beto , orgA ) ;
    const original = await createLedgerTransactionAction( movimiento( { holderUserId: ana } ) ) ;
    expect( original.success ).toBe( true ) ;
    if( !original.success ) { return ; }

    sesionDe( ana , orgA ) ;
    const reverso = await reverseLedgerTransactionAction( { transactionId: original.value.id } ) ;

    expect( reverso.success ).toBe( true ) ;
    if( reverso.success ) {
      expect( reverso.value.holderUserId ).toBe( ana ) ;
      expect( reverso.value.createdByUserId ).toBe( ana ) ;
      expect( reverso.value.reversesTransactionId ).toBe( original.value.id ) ;
    }
  } ) ;

  it( "reversar un movimiento sin titular deja el titular en nulo y a quien reversa como autor" , async () => {
    sesionDe( beto , orgA ) ;
    const original = await createLedgerTransactionAction( movimiento() ) ;
    expect( original.success ).toBe( true ) ;
    if( !original.success ) { return ; }

    sesionDe( owner , orgA , "owner" ) ;
    const reverso = await reverseLedgerTransactionAction( { transactionId: original.value.id } ) ;

    expect( reverso.success ).toBe( true ) ;
    if( reverso.success ) {
      expect( reverso.value.holderUserId ).toBeNull() ;
      expect( reverso.value.createdByUserId ).toBe( owner ) ;
    }
  } ) ;

  it( "un asiento generado por el servicio sin autor queda con autor y titular en nulo (movimientos viejos / cron)" , async () => {
    const res = await createLedgerTransaction( {
      organizationId: orgA ,
      description:    "Asiento generado" ,
      entries: [
        { accountId: cajaId  , debit: 0    , credit: 500 } ,
        { accountId: bancoId , debit: 500  , credit: 0   } ,
      ] ,
    } ) ;

    expect( res.success ).toBe( true ) ;
    if( res.success ) {
      expect( res.value.createdByUserId ).toBeNull() ;
      expect( res.value.holderUserId ).toBeNull() ;
    }
  } ) ;
} ) ;
