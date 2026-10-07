// Librerías externas
import { describe , it , expect , beforeEach , afterAll } from "vitest" ;
import { eq }                                             from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Auth
import { habilitacionRepository }                 from "./habilitacionRepository" ;
import { organizations , holderAuthorizations } from "../schema.db" ;


describe( "habilitacionRepository" , () => {
  let orgA:     string ;
  let orgB:     string ;
  let titular:  string ;
  let cargador: string ;

  beforeEach( async () => {
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-hab"   } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-hab" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;

    titular  = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "titular@ejemplo.com"  , role: "member" } ) ).id ;
    cargador = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "cargador@ejemplo.com" , role: "member" } ) ).id ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "otorgar crea una habilitación vigente y no duplica si ya hay una" , async () => {
    await habilitacionRepository.otorgar( orgA , titular , cargador ) ;
    await habilitacionRepository.otorgar( orgA , titular , cargador ) ;

    const filas = await db.select().from( holderAuthorizations ).where( eq( holderAuthorizations.organizationId , orgA ) ) ;

    expect( filas ).toHaveLength( 1 ) ;
    expect( await habilitacionRepository.existeVigente( orgA , titular , cargador ) ).toBe( true ) ;
  } ) ;

  it( "la habilitación tiene sentido: titular→cargador no implica cargador→titular" , async () => {
    await habilitacionRepository.otorgar( orgA , titular , cargador ) ;

    expect( await habilitacionRepository.existeVigente( orgA , cargador , titular ) ).toBe( false ) ;
  } ) ;

  it( "una habilitación no vale en otra organización" , async () => {
    await habilitacionRepository.otorgar( orgA , titular , cargador ) ;

    expect( await habilitacionRepository.existeVigente( orgB , titular , cargador ) ).toBe( false ) ;
  } ) ;

  it( "revocar marca revoked_at, existeVigente pasa a false y revocar de nuevo devuelve false" , async () => {
    await habilitacionRepository.otorgar( orgA , titular , cargador ) ;

    expect( await habilitacionRepository.revocar( orgA , titular , cargador ) ).toBe( true ) ;
    expect( await habilitacionRepository.existeVigente( orgA , titular , cargador ) ).toBe( false ) ;
    expect( await habilitacionRepository.revocar( orgA , titular , cargador ) ).toBe( false ) ;

    const [ fila ] = await db.select().from( holderAuthorizations ) ;
    expect( fila.revokedAt ).not.toBeNull() ;
  } ) ;

  it( "se puede volver a otorgar después de revocar (queda el historial y una sola vigente)" , async () => {
    await habilitacionRepository.otorgar( orgA , titular , cargador ) ;
    await habilitacionRepository.revocar( orgA , titular , cargador ) ;
    await habilitacionRepository.otorgar( orgA , titular , cargador ) ;

    const filas = await db.select().from( holderAuthorizations ) ;

    expect( filas ).toHaveLength( 2 ) ;
    expect( filas.filter( ( f ) => f.revokedAt === null ) ).toHaveLength( 1 ) ;
  } ) ;

  it( "no se puede habilitar a uno mismo (CHECK de la base)" , async () => {
    await expect( habilitacionRepository.otorgar( orgA , titular , titular ) ).rejects.toThrow() ;
  } ) ;

  it( "listarOtorgadas y listarRecibidas devuelven sólo las vigentes de la organización" , async () => {
    const tercero = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "tercero@ejemplo.com" , role: "member" } ) ).id ;

    await habilitacionRepository.otorgar( orgA , titular , cargador ) ;
    await habilitacionRepository.otorgar( orgA , titular , tercero ) ;
    await habilitacionRepository.revocar( orgA , titular , tercero ) ;

    const otorgadas = await habilitacionRepository.listarOtorgadas( orgA , titular ) ;
    const recibidas = await habilitacionRepository.listarRecibidas( orgA , cargador ) ;

    expect( otorgadas.map( ( u ) => u.userId ) ).toEqual( [ cargador ] ) ;
    expect( recibidas.map( ( u ) => u.userId ) ).toEqual( [ titular ] ) ;
    expect( await habilitacionRepository.listarOtorgadas( orgB , titular ) ).toEqual( [] ) ;
  } ) ;

  it( "eliminarDeUsuario borra vigentes y revocadas como otorgante o habilitado, sólo en esa organización" , async () => {
    await habilitacionRepository.otorgar( orgA , titular , cargador ) ;
    await habilitacionRepository.otorgar( orgA , cargador , titular ) ;
    await habilitacionRepository.revocar( orgA , cargador , titular ) ;
    await habilitacionRepository.otorgar( orgB , titular , cargador ) ;

    await db.transaction( async ( tx ) => {
      await habilitacionRepository.eliminarDeUsuario( orgA , titular , tx ) ;
    } ) ;

    expect( await db.select().from( holderAuthorizations ).where( eq( holderAuthorizations.organizationId , orgA ) ) ).toHaveLength( 0 ) ;
    expect( await habilitacionRepository.existeVigente( orgB , titular , cargador ) ).toBe( true ) ;
  } ) ;
} ) ;
