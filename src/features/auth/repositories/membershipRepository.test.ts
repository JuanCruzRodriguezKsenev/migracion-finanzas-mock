// Librerías externas
import { describe , it , expect , beforeEach , afterEach , afterAll } from "vitest" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { db }                       from "@/shared/db/client" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;

// Feature: Auth
import { membershipRepository }        from "./membershipRepository" ;
import { crearEspacioPersonal }        from "../services/espacioPersonalService" ;
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

  it( "RN-15: findByUser trae esPersonal y lista el espacio Personal primero aunque sea el más nuevo" , async () => {
    await membershipRepository.add( userId , org2Id , "member" ) ;
    const personalId = await crearEspacioPersonal( userId , db ) ;

    const lista = await membershipRepository.findByUser( userId ) ;

    expect( lista.length ).toBe( 3 ) ;
    expect( lista[0].organizationId ).toBe( personalId ) ;
    expect( lista[0].esPersonal ).toBe( true ) ;
    expect( lista[0].role ).toBe( "owner" ) ;
    expect( lista.slice( 1 ).every( ( m ) => !m.esPersonal ) ).toBe( true ) ;

    // El resto conserva el orden de siempre: la membresía más reciente primero
    expect( lista.slice( 1 ).map( ( m ) => m.organizationId ) ).toEqual( [ org2Id , org1Id ] ) ;
  } ) ;

  it( "plan 30: findByUser trae el nombre del dueño del Personal (propio y ajeno) y null en una organización común" , async () => {
    const propio  = await crearEspacioPersonal( userId , db ) ;
    const otro    = await crearUsuarioConMembresia( { organizationId: org2Id , email: "juan@ejemplo.com" , name: "Juan Pérez" , role: "owner" } ) ;
    const ajeno   = await crearEspacioPersonal( otro.id , db ) ;
    const sinNombre = await crearUsuarioConMembresia( { organizationId: org2Id , email: "ana.gomez@ejemplo.com" , name: "" , role: "member" } ) ;
    const deAna   = await crearEspacioPersonal( sinNombre.id , db ) ;
    await membershipRepository.add( userId , ajeno , "viewer" ) ;
    await membershipRepository.add( userId , deAna , "viewer" ) ;

    const lista = await membershipRepository.findByUser( userId ) ;
    const de    = ( id: string ) => lista.find( ( m ) => m.organizationId === id ) ;

    expect( de( propio )?.duenoNombre ).toBe( "Miembro Test" ) ;
    expect( de( ajeno )?.duenoNombre ).toBe( "Juan Pérez" ) ;
    expect( de( deAna )?.duenoNombre ).toBe( "ana.gomez" ) ;
    expect( de( org1Id )?.duenoNombre ).toBeNull() ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;
} ) ;
