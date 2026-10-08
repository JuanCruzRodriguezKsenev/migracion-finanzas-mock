/**
 * @file cuentasListado.test.ts
 * Datos de la interfaz de cuentas propias y compartidas (plan 25): lo que ve cada miembro en `/accounts`
 * (RN-11, RN-16), lo que ofrece el formulario de movimientos (RN-10) y dónde se puede compartir (RN-3).
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
import {
  obtenerCuentasDeListadoAction ,
  obtenerCuentasParaMovimientoAction ,
  listarOrganizacionesParaCompartirAction
} from "./actions/cuentasPersonalesActions" ;
import { accounts }  from "./schema.db" ;

// Feature: Auth
import { organizations }        from "@/features/auth/schema.db" ;
import { membershipRepository } from "@/features/auth/repositories/membershipRepository" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

function sesionDe( userId: string , organizationId: string ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role: "owner" } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

describe( "interfaz de cuentas propias y compartidas — datos (plan 25)" , () => {
  let orgA:     string ;
  let orgB:     string ;
  let ana:      string ; // member de A y de B, dueña de las personales
  let beto:     string ; // member de A
  let lector:   string ; // viewer de A
  let efectivo: string ;
  let bancoAna: string ; // personal de Ana, compartida con A y con B
  let ahorros:  string ; // personal de Ana, privada

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-lst"   } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-lst" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;

    ana    = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "ana@lst.com"    , role: "member" } ) ).id ;
    beto   = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "beto@lst.com"   , role: "member" } ) ).id ;
    lector = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "lector@lst.com" , role: "viewer" } ) ).id ;
    await membershipRepository.add( ana , orgB , "member" ) ;

    const [ caja ] = await db.insert( accounts ).values( { organizationId: orgA , code: "1.1.01.01" , name: "Caja Casa" , type: "asset" , balance: 1000 } ).returning() ;
    efectivo = caja.id ;

    bancoAna = ( await crearCuentaPersonal( { ownerUserId: ana , organizationId: orgA , name: "Banco Ana" , code: "1.1.80.01" , balance: 500000 , compartidaCon: [ orgA , orgB ] } ) ).id ;
    ahorros  = ( await crearCuentaPersonal( { ownerUserId: ana , organizationId: orgA , name: "Ahorros Ana" , code: "1.1.80.02" , balance: 9000 } ) ).id ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  describe( "obtenerCuentasDeListadoAction (RN-11, RN-16, AC-1, AC-3)" , () => {
    it( "Beto ve las de la organización y la compartida, sin la privada (AC-1)" , async () => {
      sesionDe( beto , orgA ) ;

      const res = await obtenerCuentasDeListadoAction() ;

      expect( res.success ).toBe( true ) ;
      if( !res.success ) { return ; }

      expect( res.value.map( ( c ) => c.id ).sort() ).toEqual( [ efectivo , bancoAna ].sort() ) ;
    } ) ;

    it( "el saldo de la personal ajena viaja como null: se omite en el servidor (AC-3)" , async () => {
      sesionDe( beto , orgA ) ;

      const res = await obtenerCuentasDeListadoAction() ;
      if( !res.success ) { throw new Error( res.error ) ; }

      const ajena = res.value.find( ( c ) => c.id === bancoAna )! ;
      const deLaOrg = res.value.find( ( c ) => c.id === efectivo )! ;

      expect( ajena.balance ).toBeNull() ;
      expect( JSON.stringify( ajena ) ).not.toContain( "500000" ) ;
      expect( deLaOrg.balance ).toBe( 1000 ) ;
      expect( deLaOrg.etiqueta ).toEqual( { tipo: "organizacion" } ) ;
    } ) ;

    it( "la etiqueta nombra sólo la organización activa, no las otras donde se comparte" , async () => {
      sesionDe( beto , orgA ) ;

      const res = await obtenerCuentasDeListadoAction() ;
      if( !res.success ) { throw new Error( res.error ) ; }

      expect( res.value.find( ( c ) => c.id === bancoAna )!.etiqueta )
        .toEqual( { tipo: "compartida" , organizaciones: [ { id: orgA , nombre: "Casa" } ] } ) ;
    } ) ;

    it( "la dueña ve su propio saldo" , async () => {
      sesionDe( ana , orgA ) ;

      const res = await obtenerCuentasDeListadoAction() ;
      if( !res.success ) { throw new Error( res.error ) ; }

      expect( res.value.find( ( c ) => c.id === bancoAna )!.balance ).toBe( 500000 ) ;
      expect( res.value.some( ( c ) => c.id === ahorros ) ).toBe( false ) ;
    } ) ;

    it( "sin sesión falla" , async () => {
      vi.mocked( getServerSession ).mockResolvedValue( null ) ;

      expect( (await obtenerCuentasDeListadoAction()).success ).toBe( false ) ;
    } ) ;
  } ) ;

  describe( "obtenerCuentasParaMovimientoAction (RN-10)" , () => {
    it( "Ana: usables = organización + su compartida; compartibles = su privada" , async () => {
      sesionDe( ana , orgA ) ;

      const res = await obtenerCuentasParaMovimientoAction() ;
      if( !res.success ) { throw new Error( res.error ) ; }

      expect( res.value.usables.map( ( c ) => c.id ).sort() ).toEqual( [ efectivo , bancoAna ].sort() ) ;
      expect( res.value.compartibles.map( ( c ) => c.id ) ).toEqual( [ ahorros ] ) ;
      expect( res.value.organizacionId ).toBe( orgA ) ;
      expect( res.value.organizacionNombre ).toBe( "Casa" ) ;
      expect( res.value.compartibles[0].etiqueta ).toEqual( { tipo: "privada" } ) ;
    } ) ;

    it( "Beto no ofrece la personal de Ana ni como usable ni como compartible" , async () => {
      sesionDe( beto , orgA ) ;

      const res = await obtenerCuentasParaMovimientoAction() ;
      if( !res.success ) { throw new Error( res.error ) ; }

      expect( res.value.usables.map( ( c ) => c.id ) ).toEqual( [ efectivo ] ) ;
      expect( res.value.compartibles ).toEqual( [] ) ;
    } ) ;

    it( "un viewer con cuentas propias no recibe compartibles (el servidor rechazaría compartir)" , async () => {
      await crearCuentaPersonal( { ownerUserId: lector , organizationId: orgA , name: "Del lector" , code: "1.1.80.09" } ) ;
      sesionDe( lector , orgA ) ;

      const res = await obtenerCuentasParaMovimientoAction() ;
      if( !res.success ) { throw new Error( res.error ) ; }

      expect( res.value.compartibles ).toEqual( [] ) ;
    } ) ;
  } ) ;

  describe( "listarOrganizacionesParaCompartirAction (RN-3)" , () => {
    it( "Ana puede compartir con las dos organizaciones donde es member" , async () => {
      sesionDe( ana , orgA ) ;

      const res = await listarOrganizacionesParaCompartirAction() ;
      if( !res.success ) { throw new Error( res.error ) ; }

      expect( res.value.map( ( o ) => o.nombre ).sort() ).toEqual( [ "Casa" , "Taller" ] ) ;
    } ) ;

    it( "un viewer no tiene dónde compartir" , async () => {
      sesionDe( lector , orgA ) ;

      const res = await listarOrganizacionesParaCompartirAction() ;

      expect( res.success && res.value ).toEqual( [] ) ;
    } ) ;
  } ) ;
} ) ;
