// Librerías externas
import { describe , it , expect , beforeEach , afterEach , afterAll } from "vitest" ;
import { JWT }                                                         from "next-auth/jwt" ;
import { Session }                                                     from "next-auth" ;

// Shared
import { db }          from "@/shared/db/client" ;
import { limpiarBase } from "@/shared/db/testCleanup" ;
import { authOptions } from "./auth" ;


// Feature: Auth
import { organizations , users } from "@/features/auth/schema.db" ;

/**
 * Los callbacks de NextAuth declaran un objeto de parámetros con más campos de los que estas
 * pruebas necesitan (`account`, `profile`, `trigger`...). Estos alias acotan el casteo a un solo
 * lugar en vez de repetirlo en cada llamada.
 */
type ParametrosJwt     = Parameters< NonNullable< NonNullable< typeof authOptions.callbacks >[ "jwt" ] > > [0] ;
type ParametrosSession = Parameters< NonNullable< NonNullable< typeof authOptions.callbacks >[ "session" ] > > [0] ;

describe( "authOptions callbacks (JWT & Session)" , () => {
  let orgId:  string ;
  let userId: string ;

  const cleanDatabase = async () => {
    await limpiarBase() ;
  } ;

  beforeEach( async () => {
    await cleanDatabase() ;

    const [ org ] = await db
      .insert( organizations )
      .values( { name: "Test Org Auth" , slug: "test-org-auth" } )
      .returning() ;
    orgId = org.id ;

    const [ u ] = await db
      .insert( users )
      .values( {
        organizationId: orgId ,
        email:          "auth-test@ejemplo.com" ,
        name:           "Auth Test User" ,
        role:           "owner" ,
        passwordHash:   "dummy_hash" ,
        salt:           "dummy_salt" ,
      } )
      .returning() ;
    userId = u.id ;
  } ) ;

  afterEach( async () => {
    await cleanDatabase() ;
  } ) ;

  describe( "jwt callback" , () => {
    it( "debería inicializar los claims y lastVerified cuando se provee user (sign-in)" , async () => {
      const jwtFn = authOptions.callbacks?.jwt ;
      expect( jwtFn ).toBeDefined() ;

      const mockUser = {
        id:             userId ,
        organizationId: orgId ,
        role:           "owner" ,
        email:          "auth-test@ejemplo.com" ,
      } ;

      const token = await jwtFn!( {
        token:   {} as JWT ,
        user:    mockUser ,
        account: null ,
      } as unknown as ParametrosJwt ) ;

      expect( token.id ).toBe( userId ) ;
      expect( token.organizationId ).toBe( orgId ) ;
      expect( token.role ).toBe( "owner" ) ;
      expect( token.lastVerified ).toBeDefined() ;
      expect( typeof token.lastVerified ).toBe( "number" ) ;
    } ) ;

    it( "debería mantener el token válido si la organización existe al revalidar" , async () => {
      const jwtFn = authOptions.callbacks?.jwt ;
      const timestampAnterior = ( Date.now() - 60000 ) ;

      const tokenExistente: JWT = {
        id:             userId ,
        organizationId: orgId ,
        role:           "owner" ,
        lastVerified:   timestampAnterior , // Expirado para forzar revalidación
      } ;

      const token = await jwtFn!( {token: tokenExistente} as unknown as ParametrosJwt ) ;

      expect( token.invalid ).toBeFalsy() ;
      expect( token.organizationId ).toBe( orgId ) ;
      expect( token.id ).toBe( userId ) ;
      expect( token.lastVerified ).toBeGreaterThan( timestampAnterior ) ;
    } ) ;

    it( "debería invalidar el token si la organización ya no existe en la base de datos (sesión huérfana)" , async () => {
      const jwtFn = authOptions.callbacks?.jwt ;

      const tokenHuerfano: JWT = {
        id:             userId ,
        organizationId: "9c74aa32-f8e1-498e-bb9c-45cf19b683b7" , // UUID inexistente
        role:           "owner" ,
        lastVerified:   ( Date.now() - 60000 ) ,
      } ;

      const token = await jwtFn!( {token: tokenHuerfano} as unknown as ParametrosJwt ) ;

      expect( token.invalid ).toBe( true ) ;
      expect( token.organizationId ).toBe( "" ) ;
      expect( token.id ).toBe( "" ) ;
    } ) ;
  } ) ;

  describe( "session callback" , () => {
    it( "debería inyectar usuario y organización cuando el token es válido" , async () => {
      const sessionFn = authOptions.callbacks?.session ;
      expect( sessionFn ).toBeDefined() ;

      const validToken: JWT = {
        id:             userId ,
        organizationId: orgId ,
        role:           "owner" ,
        lastVerified:   Date.now() ,
      } ;

      const mockSession = {
        user:    { name: "Demo" , email: "demo@test.com" } ,
        expires: new Date( Date.now() + 86400000 ).toISOString() ,
      } as unknown as Session ;

      // El callback declara `Session | DefaultSession`; acá interesa la forma extendida del proyecto.
      const session = await sessionFn!( {
        session: mockSession ,
        token:   validToken ,
      } as unknown as ParametrosSession ) as Session ;

      expect( session.user ).toBeDefined() ;
      expect( session.user?.id ).toBe( userId ) ;
      expect( session.user?.organizationId ).toBe( orgId ) ;
      expect( session.user?.role ).toBe( "owner" ) ;
    } ) ;

    it( "debería retornar sesión vacía cuando el token está marcado como inválido o sin organización" , async () => {
      const sessionFn = authOptions.callbacks?.session ;

      const invalidToken: JWT = {
        id:             "" ,
        organizationId: "" ,
        role:           "" ,
        invalid:        true ,
      } ;

      const mockSession = {
        user:    { name: "Demo" , email: "demo@test.com" } ,
        expires: new Date( Date.now() + 86400000 ).toISOString() ,
      } as unknown as Session ;

      const session = await sessionFn!( {
        session: mockSession ,
        token:   invalidToken ,
      } as unknown as ParametrosSession ) ;

      expect( Object.keys( session ).length ).toBe( 0 ) ;
      expect( session.user ).toBeUndefined() ;
    } ) ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;
} ) ;
