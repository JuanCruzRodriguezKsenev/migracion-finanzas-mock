// Librerías externas
import { describe , it , expect , beforeEach , afterEach , afterAll } from "vitest" ;
import { JWT }                                                         from "next-auth/jwt" ;
import { Session }                                                     from "next-auth" ;
import { eq }                                                          from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { db }                       from "@/shared/db/client" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { authOptions }              from "./auth" ;

// Feature: Auth
import { organizations , users , memberships } from "@/features/auth/schema.db" ;
import { hashPassword }                        from "@/features/auth/services/authService" ;

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

    const u = await crearUsuarioConMembresia( {
      organizationId: orgId ,
      email:          "auth-test@ejemplo.com" ,
      name:           "Auth Test User" ,
      role:           "owner" ,
      passwordHash:   "dummy_hash" ,
      salt:           "dummy_salt" ,
    } ) ;
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

      // Eliminar la organización de la base de datos
      await db.delete( organizations ).where( eq(organizations.id , orgId) ) ;

      const tokenHuerfano: JWT = {
        id:             userId ,
        organizationId: orgId ,
        role:           "owner" ,
        lastVerified:   ( Date.now() - 60000 ) ,
      } ;

      const token = await jwtFn!( {token: tokenHuerfano} as unknown as ParametrosJwt ) ;

      expect( token.invalid ).toBe( true ) ;
      expect( token.organizationId ).toBe( "" ) ;
      expect( token.id ).toBe( "" ) ;
    } ) ;

    it( "debería actualizar la organización activa y persistirla en lastOrganizationId cuando trigger es update" , async () => {
      const jwtFn = authOptions.callbacks?.jwt ;

      const [ org2 ] = await db
        .insert( organizations )
        .values( { name: "Org Alternativa" , slug: `org-alt-${Date.now()}` } )
        .returning() ;

      await db.insert( memberships ).values( {
        userId ,
        organizationId: org2.id ,
        role:           "viewer" ,
      } ) ;

      const tokenActual: JWT = {
        id:             userId ,
        organizationId: orgId ,
        role:           "owner" ,
      } ;

      const token = await jwtFn!( {
        token:   tokenActual ,
        trigger: "update" ,
        session: { organizationId: org2.id } ,
      } as unknown as ParametrosJwt ) ;

      expect( token.organizationId ).toBe( org2.id ) ;
      expect( token.role ).toBe( "viewer" ) ;

      const [ usuarioDb ] = await db.select().from( users ).where( eq(users.id , userId) ) ;
      expect( usuarioDb.lastOrganizationId ).toBe( org2.id ) ;
    } ) ;

    it( "no debería modificar el token si se intenta update a una organización ajena (AC-8)" , async () => {
      const jwtFn = authOptions.callbacks?.jwt ;

      const [ orgAjena ] = await db
        .insert( organizations )
        .values( { name: "Org Ajena" , slug: `org-ajena-${Date.now()}` } )
        .returning() ;

      const tokenActual: JWT = {
        id:             userId ,
        organizationId: orgId ,
        role:           "owner" ,
      } ;

      const token = await jwtFn!( {
        token:   tokenActual ,
        trigger: "update" ,
        session: { organizationId: orgAjena.id } ,
      } as unknown as ParametrosJwt ) ;

      expect( token.organizationId ).toBe( orgId ) ;
      expect( token.role ).toBe( "owner" ) ;
    } ) ;

    it( "no debería modificar el token si trigger es update pero organizationId no es un string" , async () => {
      const jwtFn = authOptions.callbacks?.jwt ;

      const tokenActual: JWT = {
        id:             userId ,
        organizationId: orgId ,
        role:           "owner" ,
      } ;

      const tokenNumero = await jwtFn!( {
        token:   { ...tokenActual } ,
        trigger: "update" ,
        session: { organizationId: 12345 } ,
      } as unknown as ParametrosJwt ) ;
      expect( tokenNumero.organizationId ).toBe( orgId ) ;

      const tokenSinOrg = await jwtFn!( {
        token:   { ...tokenActual } ,
        trigger: "update" ,
        session: {} ,
      } as unknown as ParametrosJwt ) ;
      expect( tokenSinOrg.organizationId ).toBe( orgId ) ;
    } ) ;

    it( "debería conmutar a otra organización disponible si el usuario perdió acceso a la activa (RN-15, AC-10)" , async () => {
      const jwtFn = authOptions.callbacks?.jwt ;

      const [ org2 ] = await db
        .insert( organizations )
        .values( { name: "Org de Respaldo" , slug: `org-respaldo-${Date.now()}` } )
        .returning() ;

      await db.insert( memberships ).values( {
        userId ,
        organizationId: org2.id ,
        role:           "member" ,
      } ) ;

      // Quitar membresía de la organización activa actual
      await db
        .delete( memberships )
        .where( eq(memberships.organizationId , orgId) ) ;

      const tokenExistente: JWT = {
        id:             userId ,
        organizationId: orgId ,
        role:           "owner" ,
        lastVerified:   ( Date.now() - 60000 ) , // Forzar revalidación
      } ;

      const token = await jwtFn!( {token: tokenExistente} as unknown as ParametrosJwt ) ;

      expect( token.invalid ).toBeFalsy() ;
      expect( token.organizationId ).toBe( org2.id ) ;
      expect( token.role ).toBe( "member" ) ;

      const [ usuarioDb ] = await db.select().from( users ).where( eq(users.id , userId) ) ;
      expect( usuarioDb.lastOrganizationId ).toBe( org2.id ) ;
    } ) ;

    it( "debería invalidar el token si el usuario perdió acceso a la organización y no tiene otra membresía" , async () => {
      const jwtFn = authOptions.callbacks?.jwt ;

      // Quitar la única membresía del usuario
      await db
        .delete( memberships )
        .where( eq(memberships.userId , userId) ) ;

      const tokenExistente: JWT = {
        id:             userId ,
        organizationId: orgId ,
        role:           "owner" ,
        lastVerified:   ( Date.now() - 60000 ) ,
      } ;

      const token = await jwtFn!( {token: tokenExistente} as unknown as ParametrosJwt ) ;

      expect( token.invalid ).toBe( true ) ;
      expect( token.organizationId ).toBe( "" ) ;
      expect( token.id ).toBe( "" ) ;
    } ) ;
  } ) ;

  describe( "credentials provider authorize" , () => {
    it( "debería rechazar con null si el usuario no tiene ninguna membresía activa (RN-5)" , async () => {
      const { hash , salt , params } = await hashPassword( "ValidaPassword123!" ) ;

      await db
        .insert( users )
        .values( {
          email:        "sin-membresia-auth@ejemplo.com" ,
          name:         "Sin Org" ,
          passwordHash: hash ,
          salt:         salt ,
          hashParams:   params ,
        } ) ;

      const credentialsProvider = authOptions.providers[0] as unknown as {
        authorize: ( credentials: Record< string , string > , req: unknown ) => Promise< unknown > ;
      } ;

      const resultado = await credentialsProvider.authorize( {
        email:    "sin-membresia-auth@ejemplo.com" ,
        password: "ValidaPassword123!" ,
      } , { headers: {} } ) ;

      expect( resultado ).toBeNull() ;
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
