// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                   from "next-auth" ;
import type { Session }                                       from "next-auth" ;
import { sql }                                                from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Auth
import { habilitacionRepository }                 from "@/features/auth/repositories/habilitacionRepository" ;
import { organizations , holderAuthorizations } from "@/features/auth/schema.db" ;

// Feature: Organizations
import {
  otorgarHabilitacionAction ,
  revocarHabilitacionAction ,
  listarHabilitacionesAction ,
  listarTitularesPosiblesAction
} from "./habilitacionesActions" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

function sesionDe( userId: string , organizationId: string , role = "member" ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

describe( "habilitacionesActions" , () => {
  let orgA:   string ;
  let orgB:   string ;
  let ownerA: string ;
  let ana:    string ;
  let beto:   string ;
  let lector: string ;
  let ownerB: string ;
  let carla:  string ; // member de B

  async function totalHabilitaciones(): Promise< number > {
    return( ( await db.select().from( holderAuthorizations ) ).length ) ;
  }

  beforeEach( async () => {
    vi.restoreAllMocks() ;
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-hab-act"   } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-hab-act" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;

    ownerA = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "owner-a@ejemplo.com" , role: "owner"  , name: "Dueña" } ) ).id ;
    ana    = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "ana@ejemplo.com"     , role: "member" , name: "Ana"   } ) ).id ;
    beto   = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "beto@ejemplo.com"    , role: "member" , name: "Beto"  } ) ).id ;
    lector = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "lector@ejemplo.com"  , role: "viewer" , name: "Lola"  } ) ).id ;
    ownerB = ( await crearUsuarioConMembresia( { organizationId: orgB , email: "owner-b@ejemplo.com" , role: "owner"  } ) ).id ;
    carla  = ( await crearUsuarioConMembresia( { organizationId: orgB , email: "carla@ejemplo.com"   , role: "member" } ) ).id ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  describe( "otorgar" , () => {
    it( "un member habilita a otro member" , async () => {
      sesionDe( ana , orgA ) ;

      expect( (await otorgarHabilitacionAction( { habilitadoUserId: beto } )).success ).toBe( true ) ;
      expect( await habilitacionRepository.existeVigente( orgA , ana , beto ) ).toBe( true ) ;
    } ) ;

    it( "otorgar dos veces no duplica" , async () => {
      sesionDe( ana , orgA ) ;

      await otorgarHabilitacionAction( { habilitadoUserId: beto } ) ;
      const segunda = await otorgarHabilitacionAction( { habilitadoUserId: beto } ) ;

      expect( segunda.success ).toBe( true ) ;
      expect( await totalHabilitaciones() ).toBe( 1 ) ;
    } ) ;

    it( "no se puede otorgar a uno mismo" , async () => {
      sesionDe( ana , orgA ) ;

      expect( (await otorgarHabilitacionAction( { habilitadoUserId: ana } )).success ).toBe( false ) ;
      expect( await totalHabilitaciones() ).toBe( 0 ) ;
    } ) ;

    it( "no se puede otorgar a un owner ni a un viewer" , async () => {
      sesionDe( ana , orgA ) ;

      expect( (await otorgarHabilitacionAction( { habilitadoUserId: ownerA } )).success ).toBe( false ) ;
      expect( (await otorgarHabilitacionAction( { habilitadoUserId: lector } )).success ).toBe( false ) ;
      expect( await totalHabilitaciones() ).toBe( 0 ) ;
    } ) ;

    it( "un viewer no otorga habilitaciones (el rol se lee de la base, no del token)" , async () => {
      sesionDe( lector , orgA , "owner" ) ; // el token miente: dice owner, la base dice viewer

      expect( (await otorgarHabilitacionAction( { habilitadoUserId: beto } )).success ).toBe( false ) ;
      expect( await totalHabilitaciones() ).toBe( 0 ) ;
    } ) ;

    it( "un id que no es uuid se rechaza" , async () => {
      sesionDe( ana , orgA ) ;

      expect( (await otorgarHabilitacionAction( { habilitadoUserId: "nadie" } )).success ).toBe( false ) ;
    } ) ;

    it( "sin sesión falla" , async () => {
      vi.mocked( getServerSession ).mockResolvedValue( null ) ;

      expect( (await otorgarHabilitacionAction( { habilitadoUserId: beto } )).success ).toBe( false ) ;
    } ) ;
  } ) ;

  describe( "revocar" , () => {
    it( "revoca la habilitación vigente" , async () => {
      await habilitacionRepository.otorgar( orgA , ana , beto ) ;
      sesionDe( ana , orgA ) ;

      expect( (await revocarHabilitacionAction( { habilitadoUserId: beto } )).success ).toBe( true ) ;
      expect( await habilitacionRepository.existeVigente( orgA , ana , beto ) ).toBe( false ) ;
    } ) ;

    it( "revocar una inexistente es ok y no escribe" , async () => {
      sesionDe( ana , orgA ) ;

      expect( (await revocarHabilitacionAction( { habilitadoUserId: beto } )).success ).toBe( true ) ;
      expect( await totalHabilitaciones() ).toBe( 0 ) ;
    } ) ;

    it( "sólo revoca lo que otorgó la sesión: no toca la habilitación de otro otorgante" , async () => {
      await habilitacionRepository.otorgar( orgA , beto , ana ) ;
      sesionDe( ana , orgA ) ;

      await revocarHabilitacionAction( { habilitadoUserId: beto } ) ;

      expect( await habilitacionRepository.existeVigente( orgA , beto , ana ) ).toBe( true ) ;
    } ) ;
  } ) ;

  describe( "listar" , () => {
    it( "listarHabilitaciones devuelve otorgadas, candidatos (members menos uno mismo) y recibidas" , async () => {
      await habilitacionRepository.otorgar( orgA , ana , beto ) ;
      await habilitacionRepository.otorgar( orgA , beto , ana ) ;
      sesionDe( ana , orgA ) ;

      const res = await listarHabilitacionesAction() ;

      expect( res.success ).toBe( true ) ;
      if( res.success ) {
        expect( res.value.otorgadas.map( ( u ) => u.userId ) ).toEqual( [ beto ] ) ;
        expect( res.value.recibidas.map( ( u ) => u.userId ) ).toEqual( [ beto ] ) ;
        expect( res.value.candidatos.map( ( u ) => u.userId ) ).toEqual( [ beto ] ) ;
        expect( res.value.candidatos[0].nombre ).toBe( "Beto" ) ;
      }
    } ) ;

    it( "el nombre cae a la parte local del correo si el usuario no tiene nombre" , async () => {
      const sinNombre = await crearUsuarioConMembresia( { organizationId: orgA , email: "sinnombre@ejemplo.com" , role: "member" , name: "" } ) ;
      await db.execute( sql`update users set name = null where id = ${sinNombre.id}` ) ;
      sesionDe( ana , orgA ) ;

      const res = await listarHabilitacionesAction() ;

      expect( res.success ).toBe( true ) ;
      if( res.success ) {
        expect( res.value.candidatos.find( ( c ) => c.userId === sinNombre.id )?.nombre ).toBe( "sinnombre" ) ;
      }
    } ) ;

    it( "titulares posibles de un member: uno mismo primero y quienes lo habilitaron" , async () => {
      await habilitacionRepository.otorgar( orgA , beto , ana ) ;
      sesionDe( ana , orgA ) ;

      const res = await listarTitularesPosiblesAction() ;

      expect( res.success ).toBe( true ) ;
      if( res.success ) {
        expect( res.value.map( ( t ) => t.userId ) ).toEqual( [ ana , beto ] ) ;
      }
    } ) ;

    it( "titulares posibles de un member sin habilitaciones: sólo uno mismo" , async () => {
      sesionDe( ana , orgA ) ;

      const res = await listarTitularesPosiblesAction() ;

      expect( res.success && res.value.map( ( t ) => t.userId ) ).toEqual( [ ana ] ) ;
    } ) ;

    it( "titulares posibles de un owner: uno mismo primero y todos los miembros, incluido el viewer (RN-5)" , async () => {
      sesionDe( ownerA , orgA , "owner" ) ;

      const res = await listarTitularesPosiblesAction() ;

      expect( res.success ).toBe( true ) ;
      if( res.success ) {
        expect( res.value[0].userId ).toBe( ownerA ) ;
        expect( res.value.map( ( t ) => t.userId ).sort() ).toEqual( [ ownerA , ana , beto , lector ].sort() ) ;
      }
    } ) ;

    it( "titulares posibles de un viewer: sólo uno mismo" , async () => {
      sesionDe( lector , orgA , "viewer" ) ;

      const res = await listarTitularesPosiblesAction() ;

      expect( res.success && res.value.map( ( t ) => t.userId ) ).toEqual( [ lector ] ) ;
    } ) ;
  } ) ;

  describe( "AC-29: aislamiento entre organizaciones" , () => {
    it( "un owner de B no puede otorgar, revocar ni listar con ids de usuarios de A" , async () => {
      await habilitacionRepository.otorgar( orgA , ana , beto ) ;
      sesionDe( ownerB , orgB , "owner" ) ;
      const antes = await totalHabilitaciones() ;

      const otorgar = await otorgarHabilitacionAction( { habilitadoUserId: beto } ) ;
      const revocar = await revocarHabilitacionAction( { habilitadoUserId: beto } ) ;
      const listar  = await listarHabilitacionesAction() ;

      expect( otorgar.success ).toBe( false ) ;
      expect( revocar.success ).toBe( true ) ; // ok sin escribir: no hay nada suyo que revocar
      expect( await totalHabilitaciones() ).toBe( antes ) ;
      expect( await habilitacionRepository.existeVigente( orgA , ana , beto ) ).toBe( true ) ;

      expect( listar.success ).toBe( true ) ;
      if( listar.success ) {
        const ids = [ ...listar.value.otorgadas , ...listar.value.candidatos , ...listar.value.recibidas ].map( ( u ) => u.userId ) ;
        expect( ids ).not.toContain( ana ) ;
        expect( ids ).not.toContain( beto ) ;
        expect( ids ).toEqual( [ carla ] ) ;
      }
    } ) ;

    it( "listarTitularesPosibles de un owner de B no devuelve usuarios de A" , async () => {
      sesionDe( ownerB , orgB , "owner" ) ;

      const res = await listarTitularesPosiblesAction() ;

      expect( res.success ).toBe( true ) ;
      if( res.success ) {
        const ids = res.value.map( ( t ) => t.userId ) ;
        for( const deA of [ ownerA , ana , beto , lector ] ) {
          expect( ids ).not.toContain( deA ) ;
        }
      }
    } ) ;
  } ) ;
} ) ;
