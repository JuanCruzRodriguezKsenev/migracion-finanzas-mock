// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                    from "next-auth" ;
import type { Session }                                        from "next-auth" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Auth
import { obtenerSesionDeEscritura }       from "./authorizationService" ;
import { membershipRepository }           from "../repositories/membershipRepository" ;
import { ERROR_SIN_PERMISO_DE_ESCRITURA } from "../constants" ;
import { organizations }                  from "../schema.db" ;


vi.mock( "next-auth" , () => ( { getServerSession: vi.fn() } ) ) ;

const sesionDe = ( id: string , organizationId: string , role = "owner" ) => {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id , organizationId , role } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
} ;

describe( "obtenerSesionDeEscritura — la guarda de escritura (RN-23, RN-24)" , () => {
  let orgA: string ;
  let orgB: string ;

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa" , slug: "casa-guarda" } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Estudio" , slug: "estudio-guarda" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "owner y member reciben usuario y organización" , async () => {
    for( const role of [ "owner" , "member" ] ) {
      const u = await crearUsuarioConMembresia( { organizationId: orgA , role } ) ;
      sesionDe( u.id , orgA , role ) ;

      const res = await obtenerSesionDeEscritura() ;

      expect( res.success && res.value ).toEqual( { userId: u.id , organizationId: orgA } ) ;
    }
  } ) ;

  it( "un viewer recibe el texto exacto de sin permiso" , async () => {
    const u = await crearUsuarioConMembresia( { organizationId: orgA , role: "viewer" } ) ;
    sesionDe( u.id , orgA , "viewer" ) ;

    const res = await obtenerSesionDeEscritura() ;

    expect( res.success ).toBe( false ) ;
    expect( res.error ).toBe( "No tenés permiso para modificar esta organización" ) ;
    expect( res.error ).toBe( ERROR_SIN_PERMISO_DE_ESCRITURA ) ;
  } ) ;

  it( "sin membresía en la organización de la sesión: sesión inválida" , async () => {
    const u = await crearUsuarioConMembresia( { organizationId: orgA , role: "owner" } ) ;
    sesionDe( u.id , orgB ) ;

    const res = await obtenerSesionDeEscritura() ;

    expect( res.success ).toBe( false ) ;
    expect( res.error ).toBe( "Tu sesión ya no es válida. Volvé a iniciar sesión." ) ;
  } ) ;

  it( "sin sesión, o sin organización activa: no autorizado" , async () => {
    vi.mocked( getServerSession ).mockResolvedValue( null ) ;
    expect( ( await obtenerSesionDeEscritura() ).error ).toBe( "No autorizado." ) ;

    const u = await crearUsuarioConMembresia( { organizationId: orgA , role: "owner" } ) ;
    vi.mocked( getServerSession ).mockResolvedValue( { user: { id: u.id } , expires: new Date().toISOString() } as unknown as Session ) ;
    expect( ( await obtenerSesionDeEscritura() ).error ).toBe( "No autorizado." ) ;
  } ) ;

  it( "AC-20: el token dice member pero la base dice viewer → rechazada (la base manda)" , async () => {
    const u = await crearUsuarioConMembresia( { organizationId: orgA , role: "viewer" } ) ;
    sesionDe( u.id , orgA , "member" ) ;

    const res = await obtenerSesionDeEscritura() ;

    expect( res.error ).toBe( ERROR_SIN_PERMISO_DE_ESCRITURA ) ;
  } ) ;

  it( "AC-20: el token dice viewer pero la base dice member → aceptada" , async () => {
    const u = await crearUsuarioConMembresia( { organizationId: orgA , role: "member" } ) ;
    sesionDe( u.id , orgA , "viewer" ) ;

    expect( ( await obtenerSesionDeEscritura() ).success ).toBe( true ) ;
  } ) ;

  it( "AC-21: viewer en una organización y owner en otra: cada sesión activa decide" , async () => {
    const u = await crearUsuarioConMembresia( { organizationId: orgA , role: "viewer" } ) ;
    await membershipRepository.add( u.id , orgB , "owner" ) ;

    sesionDe( u.id , orgA , "viewer" ) ;
    expect( ( await obtenerSesionDeEscritura() ).error ).toBe( ERROR_SIN_PERMISO_DE_ESCRITURA ) ;

    sesionDe( u.id , orgB , "owner" ) ;
    expect( ( await obtenerSesionDeEscritura() ).success ).toBe( true ) ;
  } ) ;
} ) ;
