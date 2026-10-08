/**
 * @file visibilidadPersonal.test.ts
 * Visibilidad del `viewer` en un espacio Personal ajeno (RN-12b, AC-8, A4): ve todas las cuentas ancladas ahí con
 * saldo y los movimientos con los nombres de cuenta. En una organización común sigue sin ver el saldo de una
 * personal ajena compartida (RN-11), y la nueva rama de visibilidad no ensancha lo que se puede usar al escribir.
 */
// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                   from "next-auth" ;
import type { Session }                                       from "next-auth" ;

// Shared
import { crearUsuarioConMembresia , crearCuentaPersonal } from "@/shared/db/testFixtures" ;
import { limpiarBase }                                    from "@/shared/db/testCleanup" ;
import { db }                                             from "@/shared/db/client" ;

// Feature: Accounting
import { obtenerCuentasDeListadoAction }                                    from "./actions/cuentasPersonalesActions" ;
import { createLedgerTransactionAction , getTransactionsPageAction }        from "./actions/accountingActions" ;
import { accountRepository }                                                from "./repositories/accountRepository" ;
import { accounts }                                                         from "./schema.db" ;

// Feature: Auth
import { crearEspacioPersonal }  from "@/features/auth/services/espacioPersonalService" ;
import { membershipRepository }  from "@/features/auth/repositories/membershipRepository" ;
import { organizations , users } from "@/features/auth/schema.db" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

function sesionDe( userId: string , organizationId: string , role = "owner" ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

describe( "viewer en un espacio Personal ajeno — visibilidad (plan 30, RN-12b)" , () => {
  let casa:        string ; // organización común: ana owner (con su personal compartida), vera viewer
  let personalJ:   string ; // Personal de Juan: vera es viewer invitada
  let juan:        string ;
  let ana:         string ;
  let vera:        string ;
  let sueldo:      string ; // personal de Juan en su Personal, privada, 7000
  let bancoAna:    string ; // personal de Ana anclada en Casa y compartida con Casa, 500000

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ c ] = await db.insert( organizations ).values( { name: "Casa" , slug: "casa-vis-personal" } ).returning() ;
    casa = c.id ;

    ana  = ( await crearUsuarioConMembresia( { organizationId: casa , email: "ana@vis.com"  , role: "owner"  } ) ).id ;
    vera = ( await crearUsuarioConMembresia( { organizationId: casa , email: "vera@vis.com" , role: "viewer" } ) ).id ;
    const [ j ] = await db.insert( users ).values( { email: "juan@vis.com" , name: "Juan" , passwordHash: "0".repeat( 128 ) , salt: "0123456789abcdef0123456789abcdef" } ).returning() ;
    juan = j.id ;

    personalJ = await db.transaction( async ( tx ) => await crearEspacioPersonal( juan , tx ) ) ;
    await membershipRepository.add( vera , personalJ , "viewer" ) ;

    sueldo   = ( await crearCuentaPersonal( { ownerUserId: juan , organizationId: personalJ , name: "Sueldo Juan" , code: "1.1.80.01" , balance: 7000 } ) ).id ;
    bancoAna = ( await crearCuentaPersonal( { ownerUserId: ana , organizationId: casa , name: "Banco Ana" , code: "1.1.80.01" , balance: 500000 , compartidaCon: [ casa ] } ) ).id ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "el viewer del Personal de Juan ve su cuenta privada, sin compartir, CON saldo (AC-8)" , async () => {
    sesionDe( vera , personalJ , "viewer" ) ;

    const res = await obtenerCuentasDeListadoAction() ;
    if( !res.success ) { throw new Error( res.error ) ; }

    const cuenta = res.value.find( ( c ) => c.id === sueldo ) ;
    expect( cuenta ).toBeDefined() ;
    expect( cuenta?.balance ).toBe( 7000 ) ;
    expect( cuenta?.etiqueta ).toEqual( { tipo: "privada" } ) ;
  } ) ;

  it( "el mismo viewer, en la organización común, NO ve el saldo de la personal ajena compartida (RN-11)" , async () => {
    sesionDe( vera , casa , "viewer" ) ;

    const res = await obtenerCuentasDeListadoAction() ;
    if( !res.success ) { throw new Error( res.error ) ; }

    const ajena = res.value.find( ( c ) => c.id === bancoAna ) ;
    expect( ajena ).toBeDefined() ;
    expect( ajena?.balance ).toBeNull() ;
    expect( JSON.stringify( res.value ) ).not.toContain( "500000" ) ;
    // y la personal de Juan, anclada en otra organización y sin compartir con Casa, no aparece
    expect( res.value.some( ( c ) => c.id === sueldo ) ).toBe( false ) ;
  } ) ;

  it( "en una organización común no se ensancha la visibilidad: una personal anclada ahí y privada sigue oculta" , async () => {
    await crearCuentaPersonal( { ownerUserId: ana , organizationId: casa , name: "Ahorros Ana" , code: "1.1.80.02" , balance: 9000 } ) ;
    sesionDe( vera , casa , "viewer" ) ;

    const res = await obtenerCuentasDeListadoAction() ;
    if( !res.success ) { throw new Error( res.error ) ; }

    expect( res.value.map( ( c ) => c.name ).sort() ).toEqual( [ "Banco Ana" ] ) ;
  } ) ;

  it( "findUsablesPara de una organización común no suma la rama de Personal; en Personal la ven el dueño y el viewer" , async () => {
    const enCasa = await accountRepository.findUsablesPara( casa , vera ) ;
    expect( enCasa.map( ( c ) => c.id ) ).not.toContain( sueldo ) ;

    // el dueño, además de la rama de actor, la tiene por anclaje
    const delDueno = await accountRepository.findUsablesPara( personalJ , juan ) ;
    expect( delDueno.map( ( c ) => c.id ) ).toContain( sueldo ) ;
  } ) ;

  it( "los movimientos del Personal se ven con el nombre de la cuenta (AC-8)" , async () => {
    // Juan carga un aporte en su Personal contra el Patrimonio Neto del catálogo
    sesionDe( juan , personalJ ) ;
    const [ patrimonio ] = ( await db.select().from( accounts ) ).filter( ( a ) => (a.organizationId === personalJ) && (a.type === "equity") ) ;
    const carga = await createLedgerTransactionAction( {
      description: "Aporte inicial" ,
      entries:     [
        { accountId: sueldo ,        debit: 1000 , credit: 0 } ,
        { accountId: patrimonio.id , debit: 0    , credit: 1000 } ,
      ] ,
    } as never ) ;
    expect( carga.success ).toBe( true ) ;

    sesionDe( vera , personalJ , "viewer" ) ;
    const pagina = await getTransactionsPageAction( {} ) ;
    if( !pagina.success ) { throw new Error( pagina.error ) ; }

    expect( pagina.value.items.map( ( t ) => t.description ) ).toEqual( [ "Aporte inicial" ] ) ;
    expect( pagina.value.cuentasPersonales.find( ( c ) => c.id === sueldo )?.name ).toBe( "Sueldo Juan" ) ;
  } ) ;
} ) ;
