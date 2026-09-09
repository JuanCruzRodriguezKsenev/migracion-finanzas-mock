// Librerías externas
import { describe , it , expect , beforeEach , afterEach } from "vitest" ;
import { eq } from "drizzle-orm" ;

// Shared
import { db } from "@/shared/db/client" ;

// Feature: Accounting
import { accounts , categories , categoryAccounts } from "@/features/accounting/schema.db" ;

// Feature: Auth
import { organizations , users } from "../schema.db" ;
import { userRepository }        from "./userRepository" ;


/**
 * Suite de pruebas para el repositorio de usuarios.
 * Cubre la normalización de emails y la resolución de identidad vigente que usa el callback `jwt`
 * para invalidar sesiones huérfanas.
 */
describe( "userRepository" , () => {
  let orgId:  string ;
  let userId: string ;

  const cleanDatabase = async () => {
    await db.delete( categoryAccounts ) ;
    await db.delete( categories ) ;
    await db.delete( accounts ) ;
    await db.delete( users ) ;
    await db.delete( organizations ) ;
  } ;

  beforeEach( async () => {
    await cleanDatabase() ;

    const [ org ] = await db
      .insert( organizations )
      .values( {name: "Org de Prueba" , slug: `org-prueba-${Date.now()}`} )
      .returning() ;

    orgId = org.id ;

    const [ usuario ] = await db
      .insert( users )
      .values( {
        organizationId: orgId ,
        email:          "persona@ejemplo.com" ,
        name:           "Persona de Prueba" ,
        role:           "member" ,
        passwordHash:   "0".repeat( 128 ) ,
        salt:           "0123456789abcdef0123456789abcdef"
      } )
      .returning() ;

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
   * Caso de prueba: el rol se lee de la base, no del token.
   * Es lo que permite que un cambio de rol se refleje en la sesión sin esperar a que expire.
   */
  it( "debería devolver el rol actualizado tras cambiarlo en la base" , async () => {
    await db.update( users ).set( {role: "owner"} ).where( eq(users.id , userId) ) ;

    const identidad = await userRepository.findIdentidadVigente( userId ) ;

    expect( identidad?.role ).toBe( "owner" ) ;
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
   * Caso de prueba: organización eliminada (arrastra al usuario por ON DELETE CASCADE).
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
} ) ;
