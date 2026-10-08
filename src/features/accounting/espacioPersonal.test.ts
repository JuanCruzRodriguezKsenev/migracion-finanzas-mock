/**
 * @file espacioPersonal.test.ts
 * Pruebas de integración del espacio Personal y las entidades propias (plan 29): anclaje de las cuentas
 * personales, entidades del espacio, comparticiones y reglas del `viewer` invitado.
 */
// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                   from "next-auth" ;
import type { Session }                                       from "next-auth" ;
import { eq }                                                 from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Accounting
import { crearCuentaPersonalAction , compartirCuentaAction , obtenerMisCuentasAction , obtenerCuentasDeListadoAction } from "./actions/cuentasPersonalesActions" ;
import { createFinancialEntityAction , getFinancialEntitiesAction }                                                  from "./actions/accountingActions" ;
import { accountRepository }                                                                                         from "./repositories/accountRepository" ;
import { financialEntityRepository }                                                                                 from "./repositories/financialEntityRepository" ;
import { accounts }                                                                                                  from "./schema.db" ;

// Feature: Auth
import { crearEspacioPersonal }  from "@/features/auth/services/espacioPersonalService" ;
import { titularesPosibles }     from "@/features/auth/services/titularService" ;
import { membershipRepository }  from "@/features/auth/repositories/membershipRepository" ;
import { organizations }         from "@/features/auth/schema.db" ;

// Feature: Splits
import { resolverReparto } from "@/features/splits/services/acuerdoService" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

function sesionDe( userId: string , organizationId: string , role = "owner" ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

describe( "espacio Personal — cuentas y entidades propias (plan 29)" , () => {
  let casa:        string ; // organización real: juan member, ana owner
  let juan:        string ;
  let ana:         string ;
  let contador:    string ; // viewer invitado al Personal de juan
  let personalJ:   string ;
  let personalA:   string ;
  let galicia:     string ; // entidad propia de juan (en su Personal)
  let entidadCasa: string ; // entidad de Casa

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ c ] = await db.insert( organizations ).values( { name: "Casa" , slug: "casa-espacio-personal" } ).returning() ;
    casa     = c.id ;
    ana      = ( await crearUsuarioConMembresia( { organizationId: casa , email: "ana-ep@ejemplo.com"  , role: "owner"  } ) ).id ;
    juan     = ( await crearUsuarioConMembresia( { organizationId: casa , email: "juan-ep@ejemplo.com" , role: "member" } ) ).id ;
    contador = ( await crearUsuarioConMembresia( { organizationId: casa , email: "cont-ep@ejemplo.com" , role: "viewer" } ) ).id ;

    personalJ = await db.transaction( ( tx ) => crearEspacioPersonal( juan , tx ) ) ;
    personalA = await db.transaction( ( tx ) => crearEspacioPersonal( ana  , tx ) ) ;
    await membershipRepository.add( contador , personalJ , "viewer" ) ;

    galicia     = ( await financialEntityRepository.create( { organizationId: personalJ , name: "Banco Galicia" , logo: "bank" , brandDomain: "galicia.com.ar" , color: "#e67e22" } ) ).id ;
    entidadCasa = ( await financialEntityRepository.create( { organizationId: casa      , name: "Banco Casa"    , logo: "bank" } ) ).id ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  describe( "AC-3 — la cuenta personal se ancla en Personal" , () => {
    it( "creada desde Personal con una entidad propia, queda anclada en Personal, privada y del dueño" , async () => {
      sesionDe( juan , personalJ ) ;

      const res = await crearCuentaPersonalAction( { name: "Cuenta Sueldo" , balance: 150000 , currency: "ARS" , entityId: galicia } ) ;

      expect( res.success ).toBe( true ) ;
      if( !res.success ) { return ; }
      expect( res.value.organizationId ).toBe( personalJ ) ;
      expect( res.value.ownerUserId ).toBe( juan ) ;
      expect( res.value.entityId ).toBe( galicia ) ;
      expect( res.value.balance ).toBe( 150000 ) ;
    } ) ;

    it( "el código se calcula contra las cuentas ancladas en Personal, no en otras organizaciones" , async () => {
      await db.insert( accounts ).values( { organizationId: casa , code: "1.1.01.01" , name: "Efectivo" , type: "asset" } ) ;
      sesionDe( juan , personalJ ) ;

      const a = await crearCuentaPersonalAction( { name: "Una" } ) ;
      const b = await crearCuentaPersonalAction( { name: "Otra" } ) ;

      expect( a.success && b.success ).toBe( true ) ;
      if( a.success && b.success ) {
        expect( a.value.code ).not.toBe( b.value.code ) ;
        expect( a.value.organizationId ).toBe( personalJ ) ;
      }
    } ) ;
  } ) ;

  describe( "AC-6 / A3 — no se crea desde una organización" , () => {
    it( "llamar a la creación estando en «Casa» es rechazado y no deja ninguna cuenta" , async () => {
      sesionDe( juan , casa , "member" ) ;

      const res = await crearCuentaPersonalAction( { name: "Desde Casa" } ) ;

      expect( res.success ).toBe( false ) ;
      if( !res.success ) {
        expect( res.error ).toBe( "Las cuentas personales se crean desde tu espacio Personal." ) ;
      }
      expect( await db.select().from( accounts ).where( eq( accounts.ownerUserId , juan ) ) ).toEqual( [] ) ;
    } ) ;

    it( "estando en el Personal de otro (invitado) tampoco: la ancla es siempre el espacio propio" , async () => {
      await membershipRepository.add( ana , personalJ , "viewer" ) ;
      sesionDe( ana , personalJ , "viewer" ) ;

      expect( (await crearCuentaPersonalAction( { name: "Intento" } )).success ).toBe( false ) ;
    } ) ;
  } ) ;

  describe( "RN-11 — la entidad tiene que ser propia" , () => {
    it( "una entidad de otra organización es rechazada" , async () => {
      sesionDe( juan , personalJ ) ;

      const res = await crearCuentaPersonalAction( { name: "Con entidad ajena" , entityId: entidadCasa } ) ;

      expect( res.success ).toBe( false ) ;
      expect( await db.select().from( accounts ).where( eq( accounts.ownerUserId , juan ) ) ).toEqual( [] ) ;
    } ) ;

    it( "la entidad propia de otro usuario también es rechazada" , async () => {
      const deAna = await financialEntityRepository.create( { organizationId: personalA , name: "Banco de Ana" , logo: "bank" } ) ;
      sesionDe( juan , personalJ ) ;

      expect( (await crearCuentaPersonalAction( { name: "Con entidad de Ana" , entityId: deAna.id } )).success ).toBe( false ) ;
    } ) ;
  } ) ;

  describe( "AC-3 / AC-5 / AC-13 — compartida con una organización" , () => {
    let cuentaId: string ;

    beforeEach( async () => {
      sesionDe( juan , personalJ ) ;
      const creada = await crearCuentaPersonalAction( { name: "Cuenta Sueldo" , balance: 150000 , entityId: galicia } ) ;
      if( !creada.success ) { throw( new Error( creada.error ) ) ; }
      cuentaId = creada.value.id ;

      expect( (await compartirCuentaAction( { accountId: cuentaId , organizationId: casa } )).success ).toBe( true ) ;
    } ) ;

    it( "aparece en «Mis cuentas» estando en Personal y estando en «Casa»" , async () => {
      sesionDe( juan , personalJ ) ;
      const desdePersonal = await obtenerMisCuentasAction() ;
      sesionDe( juan , casa , "member" ) ;
      const desdeCasa = await obtenerMisCuentasAction() ;

      expect( desdePersonal.success && desdePersonal.value.map( ( v ) => v.cuenta.id ) ).toEqual( [ cuentaId ] ) ;
      expect( desdeCasa.success && desdeCasa.value.map( ( v ) => v.cuenta.id ) ).toEqual( [ cuentaId ] ) ;
    } ) ;

    it( "en el selector de movimientos de «Casa» sale con la etiqueta compartida y la entidad (nombre y logo), para el dueño y para otro miembro" , async () => {
      for( const quien of [ juan , ana ] ) {
        const usables = await accountRepository.findUsablesPara( casa , quien ) ;
        const cuenta  = usables.find( ( c ) => c.id === cuentaId ) ;

        expect( cuenta?.entity?.name ).toBe( "Banco Galicia" ) ;
        expect( cuenta?.entity?.logo ).toBe( "bank" ) ;
        expect( cuenta?.etiqueta.tipo ).toBe( "compartida" ) ;
      }
    } ) ;

    it( "el miembro ve la cuenta en /accounts de «Casa» sin saldo" , async () => {
      sesionDe( ana , casa ) ;

      const res = await obtenerCuentasDeListadoAction() ;

      expect( res.success ).toBe( true ) ;
      if( !res.success ) { return ; }
      const cuenta = res.value.find( ( c ) => c.id === cuentaId ) ;
      expect( cuenta?.balance ).toBeNull() ;
      expect( cuenta?.entity?.name ).toBe( "Banco Galicia" ) ;
    } ) ;

    it( "AC-5 / AC-13: la entidad propia no figura en la lista de entidades de «Casa», ni la de Casa en la de Personal" , async () => {
      sesionDe( ana , casa ) ;
      const deCasa = await getFinancialEntitiesAction() ;
      sesionDe( juan , personalJ ) ;
      const dePersonal = await getFinancialEntitiesAction() ;

      expect( deCasa.success && deCasa.value.map( ( e ) => e.name ) ).toEqual( [ "Banco Casa" ] ) ;
      expect( dePersonal.success && dePersonal.value.map( ( e ) => e.name ) ).toEqual( [ "Banco Galicia" ] ) ;
    } ) ;
  } ) ;

  describe( "RN-11 — las entidades se crean donde se está" , () => {
    it( "createFinancialEntityAction desde Personal crea una entidad propia y desde «Casa» una de la organización" , async () => {
      sesionDe( juan , personalJ ) ;
      const propia = await createFinancialEntityAction( { name: "Mercado Pago" } ) ;
      sesionDe( ana , casa ) ;
      const deCasa = await createFinancialEntityAction( { name: "Efectivo Casa" } ) ;

      expect( propia.success && propia.value.organizationId ).toBe( personalJ ) ;
      expect( deCasa.success && deCasa.value.organizationId ).toBe( casa ) ;
    } ) ;
  } ) ;

  describe( "RN-5 — en Personal no hay reparto ni «a nombre de»" , () => {
    it( "resolverReparto no aplica aunque haya un viewer invitado, y el único titular posible es el dueño" , async () => {
      const reparto = await resolverReparto( {
        orgId:           personalJ ,
        autorId:         juan ,
        tipo:            "expense" ,
        montoEnCentavos: 10000 ,
        currency:        "ARS" ,
        cuentas:         [] ,
        esGastoManual:   true ,
        absorbe:         false ,
      } ) ;

      expect( reparto.aplica ).toBe( false ) ;
      expect( reparto.deudas ).toEqual( [] ) ;

      const titulares = await titularesPosibles( personalJ , juan ) ;
      expect( titulares.map( ( t ) => t.userId ) ).toEqual( [ juan ] ) ;
    } ) ;
  } ) ;

  describe( "A4 — el viewer invitado a Personal no crea cuentas" , () => {
    it( "crearCuentaPersonalAction lo rechaza" , async () => {
      sesionDe( contador , personalJ , "viewer" ) ;

      expect( (await crearCuentaPersonalAction( { name: "Intento del contador" } )).success ).toBe( false ) ;
      expect( await db.select().from( accounts ).where( eq( accounts.ownerUserId , contador ) ) ).toEqual( [] ) ;
    } ) ;
  } ) ;
} ) ;
