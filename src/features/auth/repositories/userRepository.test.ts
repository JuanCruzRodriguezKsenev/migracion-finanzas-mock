// Librerías externas
import { describe , it , expect , beforeEach , afterEach , afterAll } from "vitest" ;
import { eq }                                                         from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { db }                       from "@/shared/db/client" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;

// Feature: Auth
import { organizations , users , memberships } from "../schema.db" ;
import { userRepository }                      from "./userRepository" ;


/**
 * Suite de pruebas para el repositorio de usuarios.
 * Cubre la normalización de emails, mutación de credenciales y la resolución de identidad
 * vigente y priorización de organizaciones que usa el callback `jwt`.
 */
describe( "userRepository" , () => {
  let orgId:  string ;
  let userId: string ;

  const cleanDatabase = async () => {
    await limpiarBase() ;
  } ;

  beforeEach( async () => {
    await cleanDatabase() ;

    const [ org ] = await db
      .insert( organizations )
      .values( {name: "Org de Prueba" , slug: `org-prueba-${Date.now()}`} )
      .returning() ;

    orgId = org.id ;

    const usuario = await crearUsuarioConMembresia( {
      organizationId: orgId ,
      email:          "persona@ejemplo.com" ,
      name:           "Persona de Prueba" ,
      role:           "member" ,
      passwordHash:   "0".repeat( 128 ) ,
      salt:           "0123456789abcdef0123456789abcdef" ,
    } ) ;

    userId = usuario.id ;
  } ) ;

  afterEach( async () => {
    await cleanDatabase() ;
  } ) ;

  /**
   * Caso de prueba: los emails se buscan sin distinguir mayúsculas ni espacios sobrantes.
   */
  it( "debería encontrar al usuario ignorando mayúsculas y espacios" , async () => {
    const encontrado = await userRepository.findByEmail( "  PERSONA@Ejemplo.COM  " ) ;

    expect( encontrado?.id ).toBe( userId ) ;
  } ) ;

  /**
   * Caso de prueba: identidad vigente de un usuario con su organización intacta.
   */
  it( "debería resolver la identidad vigente incluyendo el rol actual" , async () => {
    const identidad = await userRepository.findIdentidadVigente( userId ) ;

    expect( identidad ).toEqual( {
      id:             userId ,
      organizationId: orgId ,
      role:           "member"
    } ) ;
  } ) ;

  /**
   * Caso de prueba: el rol se lee de la base (en memberships), no del token.
   * Es lo que permite que un cambio de rol se refleje en la sesión sin esperar a que expire.
   */
  it( "debería devolver el rol actualizado tras cambiarlo en la base" , async () => {
    await db.update( memberships ).set( {role: "owner"} ).where( eq(memberships.userId , userId) ) ;

    const identidad = await userRepository.findIdentidadVigente( userId ) ;

    expect( identidad?.role ).toBe( "owner" ) ;
  } ) ;

  /**
   * Caso de prueba: preferencia explícita gana sobre la última organización utilizada.
   */
  it( "debería priorizar la organización preferida sobre la última registrada" , async () => {
    const [ org2 ] = await db
      .insert( organizations )
      .values( {name: "Segunda Org" , slug: `org-segunda-${Date.now()}`} )
      .returning() ;

    await db.insert( memberships ).values( {
      userId ,
      organizationId: org2.id ,
      role:           "viewer" ,
    } ) ;

    // La última registrada es orgId (por defecto en crearUsuarioConMembresia)
    const identidad = await userRepository.findIdentidadVigente( userId , org2.id ) ;

    expect( identidad ).toEqual( {
      id:             userId ,
      organizationId: org2.id ,
      role:           "viewer"
    } ) ;
  } ) ;

  /**
   * Caso de prueba: sin preferida, gana la última organización activa registrada.
   */
  it( "debería elegir la última organización cuando no se especifica preferida" , async () => {
    const [ orgVieja ] = await db
      .insert( organizations )
      .values( {name: "Org Vieja" , slug: `org-vieja-${Date.now()}`} )
      .returning() ;

    await db.insert( memberships ).values( {
      userId ,
      organizationId: orgVieja.id ,
      role:           "member" ,
      createdAt:      new Date( Date.now() - 100000 ) ,
    } ) ;

    const [ orgNueva ] = await db
      .insert( organizations )
      .values( {name: "Org Nueva" , slug: `org-nueva-${Date.now()}`} )
      .returning() ;

    await db.insert( memberships ).values( {
      userId ,
      organizationId: orgNueva.id ,
      role:           "owner" ,
      createdAt:      new Date( Date.now() + 50000 ) ,
    } ) ;

    // Establecemos orgVieja como lastOrganizationId explícitamente
    await userRepository.registrarUltimaOrganizacion( userId , orgVieja.id ) ;

    const identidad = await userRepository.findIdentidadVigente( userId ) ;

    expect( identidad?.organizationId ).toBe( orgVieja.id ) ;
    expect( identidad?.role ).toBe( "member" ) ;
  } ) ;

  /**
   * Caso de prueba: sin preferida ni última válida, gana la membresía más reciente.
   */
  it( "debería elegir la membresía más reciente si no hay preferida ni última válida" , async () => {
    // Quitar lastOrganizationId
    await db.update( users ).set( {lastOrganizationId: null} ).where( eq(users.id , userId) ) ;

    const [ orgReciente ] = await db
      .insert( organizations )
      .values( {name: "Org Reciente" , slug: `org-reciente-${Date.now()}`} )
      .returning() ;

    await db.insert( memberships ).values( {
      userId ,
      organizationId: orgReciente.id ,
      role:           "viewer" ,
      createdAt:      new Date( Date.now() + 60000 ) ,
    } ) ;

    const identidad = await userRepository.findIdentidadVigente( userId ) ;

    expect( identidad?.organizationId ).toBe( orgReciente.id ) ;
    expect( identidad?.role ).toBe( "viewer" ) ;
  } ) ;

  /**
   * Caso de prueba: usuario sin membresías devuelve null (RN-5).
   */
  it( "debería devolver null si el usuario no tiene ninguna membresía activa" , async () => {
    const [ usuarioHuerfano ] = await db
      .insert( users )
      .values( {
        email:        "sin-membresias@ejemplo.com" ,
        name:         "Sin Membresias" ,
        passwordHash: "dummy" ,
        salt:         "dummy" ,
      } )
      .returning() ;

    const identidad = await userRepository.findIdentidadVigente( usuarioHuerfano.id ) ;

    expect( identidad ).toBeNull() ;
  } ) ;

  /**
   * Caso de prueba: usuario borrado.
   * Comprobar únicamente la organización dejaría viva esta sesión, que es el hueco que cierra el JOIN.
   */
  it( "no debería resolver identidad si el usuario fue eliminado" , async () => {
    await db.delete( users ).where( eq(users.id , userId) ) ;

    const identidad = await userRepository.findIdentidadVigente( userId ) ;

    expect( identidad ).toBeNull() ;
  } ) ;

  /**
   * Caso de prueba: organización eliminada (arrastra membresías por ON DELETE CASCADE).
   * Es el escenario del reseed que dejaba sesiones apuntando a una organización inexistente.
   */
  it( "no debería resolver identidad si la organización fue eliminada" , async () => {
    await db.delete( organizations ).where( eq(organizations.id , orgId) ) ;

    const identidad = await userRepository.findIdentidadVigente( userId ) ;

    expect( identidad ).toBeNull() ;
  } ) ;

  /**
   * Caso de prueba: rehash transparente tras un login con parámetros de costo desactualizados.
   */
  it( "debería reemplazar hash, salt y parámetros al migrar una contraseña" , async () => {
    await userRepository.updatePasswordHash( userId , {
      hash:   "1".repeat( 128 ) ,
      salt:   "fedcba9876543210fedcba9876543210" ,
      params: "scrypt$131072$8$1$64"
    } ) ;

    const actualizado = await userRepository.findByEmail( "persona@ejemplo.com" ) ;

    expect( actualizado?.passwordHash ).toBe( "1".repeat( 128 ) ) ;
    expect( actualizado?.salt ).toBe( "fedcba9876543210fedcba9876543210" ) ;
    expect( actualizado?.hashParams ).toBe( "scrypt$131072$8$1$64" ) ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;
} ) ;
