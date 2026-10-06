// Librerías externas
import { describe , it , expect , beforeEach , afterEach , afterAll } from "vitest" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { db }                       from "@/shared/db/client" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;

// Feature: Auth
import { membershipRepository }        from "./membershipRepository" ;
import { organizations , memberships } from "../schema.db" ;


describe( "membershipRepository" , () => {
  let org1Id: string ;
  let org2Id: string ;
  let userId: string ;

  const cleanDatabase = async () => {
    await limpiarBase() ;
  } ;

  beforeEach( async () => {
    await cleanDatabase() ;

    const [ org1 ] = await db
      .insert( organizations )
      .values( { name: "Org Primaria" , slug: `org-primaria-${Date.now()}` } )
      .returning() ;
    org1Id = org1.id ;

    const [ org2 ] = await db
      .insert( organizations )
      .values( { name: "Org Secundaria" , slug: `org-secundaria-${Date.now()}` } )
      .returning() ;
    org2Id = org2.id ;

    const usuario = await crearUsuarioConMembresia( {
      organizationId: org1Id ,
      email:          "miembro@ejemplo.com" ,
      name:           "Miembro Test" ,
      role:           "owner" ,
    } ) ;
    userId = usuario.id ;
  } ) ;

  afterEach( async () => {
    await cleanDatabase() ;
  } ) ;

  it( "debería encontrar la membresía específica de un usuario y organización" , async () => {
    const memb = await membershipRepository.findMembership( userId , org1Id ) ;

    expect( memb ).toBeDefined() ;
    expect( memb?.userId ).toBe( userId ) ;
    expect( memb?.organizationId ).toBe( org1Id ) ;
    expect( memb?.role ).toBe( "owner" ) ;
  } ) ;

  it( "debería retornar null para una organización en la que el usuario no tiene membresía" , async () => {
    const memb = await membershipRepository.findMembership( userId , org2Id ) ;

    expect( memb ).toBeNull() ;
  } ) ;

  it( "debería listar todas las membresías del usuario con los nombres de las organizaciones" , async () => {
    await db.insert( memberships ).values( {
      userId ,
      organizationId: org2Id ,
      role:           "member" ,
    } ) ;

    const lista = await membershipRepository.findByUser( userId ) ;

    expect( lista ).toHaveLength( 2 ) ;
    const nombres = lista.map( ( m ) => m.organizationName ) ;
    expect( nombres ).toContain( "Org Primaria" ) ;
    expect( nombres ).toContain( "Org Secundaria" ) ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;
} ) ;
