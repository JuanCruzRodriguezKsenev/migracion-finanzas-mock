// Librerías externas
import { describe , it , expect , beforeEach , afterAll } from "vitest" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Accounting
import { accounts , accountShares } from "@/features/accounting/schema.db" ;

// Feature: Auth
import { autorizarTitular , autorizarTitularPorCuenta , titularesPosibles } from "./titularService" ;
import { habilitacionRepository }                                           from "../repositories/habilitacionRepository" ;
import { membershipRepository }                                             from "../repositories/membershipRepository" ;
import { organizations }                                                    from "../schema.db" ;


describe( "titularService: un viewer no es titular (RN-17)" , () => {
  let orgA:   string ;
  let owner:  string ;
  let ana:    string ; // member
  let beto:   string ; // member
  let lector: string ; // viewer

  beforeEach( async () => {
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa" , slug: "casa-titular-svc" } ).returning() ;
    orgA = a.id ;

    owner  = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "owner@ejemplo.com"  , role: "owner"  } ) ).id ;
    ana    = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "ana@ejemplo.com"    , role: "member" } ) ).id ;
    beto   = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "beto@ejemplo.com"   , role: "member" } ) ).id ;
    lector = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "lector@ejemplo.com" , role: "viewer" } ) ).id ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  describe( "autorizarTitular (servidor)" , () => {
    it( "AC-9: un owner no puede cargar a nombre de un viewer" , async () => {
      const res = await autorizarTitular( orgA , owner , lector ) ;

      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "AC-9: un member habilitado por un usuario que ahora es viewer tampoco" , async () => {
      await habilitacionRepository.otorgar( orgA , lector , ana ) ;

      const res = await autorizarTitular( orgA , ana , lector ) ;

      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "un owner sigue pudiendo a nombre de un member" , async () => {
      const res = await autorizarTitular( orgA , owner , ana ) ;

      expect( res.success && res.value ).toBe( ana ) ;
    } ) ;

    it( "el propio autor como titular sigue saliendo antes (el viewer como autor es del plan 07)" , async () => {
      const res = await autorizarTitular( orgA , lector , lector ) ;

      expect( res.success && res.value ).toBe( lector ) ;
    } ) ;
  } ) ;

  describe( "autorizarTitularPorCuenta (RN-3, RN-9)" , () => {
    let cuentaAnaCompartida: string ;
    let cuentaBetoPrivada:   string ;

    beforeEach( async () => {
      const [ ca ] = await db.insert( accounts ).values( {
        organizationId: orgA , code: "1.1.91" , name: "Banco Ana" , type: "asset" , ownerUserId: ana ,
      } ).returning() ;
      cuentaAnaCompartida = ca.id ;
      await db.insert( accountShares ).values( { accountId: ca.id , organizationId: orgA } ) ;

      const [ cb ] = await db.insert( accounts ).values( {
        organizationId: orgA , code: "1.1.92" , name: "Banco Beto Privado" , type: "asset" , ownerUserId: beto ,
      } ).returning() ;
      cuentaBetoPrivada = cb.id ;
    } ) ;

    it( "RN-3: autor con su cuenta propia personal es autorizado a su propio nombre" , async () => {
      const res = await autorizarTitularPorCuenta( orgA , ana , ana , [ cuentaAnaCompartida ] ) ;

      expect( res.success && res.value ).toBe( ana ) ;
    } ) ;

    it( "RN-3: autor Beto con cuenta compartida de Ana a nombre de Ana (sin habilitación previa) es autorizado" , async () => {
      const res = await autorizarTitularPorCuenta( orgA , beto , ana , [ cuentaAnaCompartida ] ) ;

      expect( res.success && res.value ).toBe( ana ) ;
    } ) ;

    it( "RN-9: autor Beto con cuenta compartida de Ana intentando poner a Beto como titular es rechazado" , async () => {
      const res = await autorizarTitularPorCuenta( orgA , beto , beto , [ cuentaAnaCompartida ] ) ;

      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "RN-9: autor Ana con cuenta privada no compartida de Beto a nombre de Beto es rechazado sin habilitación" , async () => {
      const res = await autorizarTitularPorCuenta( orgA , ana , beto , [ cuentaBetoPrivada ] ) ;

      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "un viewer no puede operar cuentas personales como autor" , async () => {
      const res = await autorizarTitularPorCuenta( orgA , lector , ana , [ cuentaAnaCompartida ] ) ;

      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "un viewer no puede ser titular aunque tenga una personal compartida" , async () => {
      const [ cl ] = await db.insert( accounts ).values( {
        organizationId: orgA , code: "1.1.93" , name: "Banco Lector" , type: "asset" , ownerUserId: lector ,
      } ).returning() ;
      await db.insert( accountShares ).values( { accountId: cl.id , organizationId: orgA } ) ;

      const res = await autorizarTitularPorCuenta( orgA , ana , lector , [ cl.id ] ) ;

      expect( res.success ).toBe( false ) ;
    } ) ;
  } ) ;

  describe( "titularesPosibles (selector)" , () => {
    it( "AC-9: el owner ve a los members pero no al viewer" , async () => {
      const res = await titularesPosibles( orgA , owner ) ;

      expect( res.map( ( t ) => t.userId ).sort() ).toEqual( [ owner , ana , beto ].sort() ) ;
    } ) ;

    it( "un member habilitado por alguien que pasó a viewer no lo ve" , async () => {
      await habilitacionRepository.otorgar( orgA , beto , ana ) ;
      await habilitacionRepository.otorgar( orgA , owner , ana ) ;
      await membershipRepository.cambiarRol( beto , orgA , "viewer" ) ;

      const res = await titularesPosibles( orgA , ana ) ;

      expect( res.map( ( t ) => t.userId ) ).toEqual( [ ana , owner ] ) ;
    } ) ;

    it( "un viewer sigue viéndose sólo a sí mismo" , async () => {
      const res = await titularesPosibles( orgA , lector ) ;

      expect( res.map( ( t ) => t.userId ) ).toEqual( [ lector ] ) ;
    } ) ;
  } ) ;
} ) ;
