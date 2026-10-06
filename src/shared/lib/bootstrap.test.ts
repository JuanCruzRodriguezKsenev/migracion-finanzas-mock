/**
 * @file bootstrap.test.ts
 * Pruebas de integración de las funciones de arranque bootstrap contra PostgreSQL (AC-17).
 */
// Librerías externas
import { describe , it , expect , beforeEach , afterEach } from "vitest" ;
import { eq }                                              from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;
import {
  crearOrganizacionBootstrap ,
  invitarUsuarioBootstrap ,
  retirarAdminBootstrap ,
  generarSlug
} from "@/shared/db/bootstrap" ;

// Feature: Accounting
import { categories , accounts } from "@/features/accounting/schema.db" ;

// Feature: Auth
import { organizations , memberships , users , invitations } from "@/features/auth/schema.db" ;


describe( "bootstrap subcomandos (AC-17)" , () => {
  beforeEach( async () => {
    await limpiarBase() ;
  } ) ;

  afterEach( async () => {
    await limpiarBase() ;
  } ) ;

  describe( "generarSlug" , () => {
    it( "debería convertir nombres con tildes, mayúsculas y caracteres especiales a slugs limpios" , () => {
      expect( generarSlug( "Organización de Prueba" ) ).toBe( "organizacion-de-prueba" ) ;
      expect( generarSlug( "   FinanzIA SaaS & Co.  " ) ).toBe( "finanzia-saas-co" ) ;
    } ) ;
  } ) ;

  describe( "crearOrganizacionBootstrap" , () => {
    it( "debería insertar la organización con su slug y aprovisionar categorías y cuentas contables" , async () => {
      const org = await crearOrganizacionBootstrap( { nombre: "Familia Gómez" } , db ) ;

      expect( org.id ).toBeDefined() ;
      expect( org.slug ).toBe( "familia-gomez" ) ;
      expect( org.name ).toBe( "Familia Gómez" ) ;

      const [ orgEnDb ] = await db.select().from( organizations ).where( eq( organizations.id , org.id ) ) ;
      expect( orgEnDb ).toBeDefined() ;

      // Verificar que se aprovisionó el catálogo contable
      const cats = await db.select().from( categories ).where( eq( categories.organizationId , org.id ) ) ;
      expect( cats.length ).toBeGreaterThan( 0 ) ;

      const accs = await db.select().from( accounts ).where( eq( accounts.organizationId , org.id ) ) ;
      expect( accs.length ).toBeGreaterThan( 0 ) ;
    } ) ;

    it( "debería fallar si ya existe una organización con el mismo slug derivado" , async () => {
      await crearOrganizacionBootstrap( { nombre: "Empresa Alfa" } , db ) ;

      await expect(
        crearOrganizacionBootstrap( { nombre: "Empresa Alfa" } , db )
      ).rejects.toThrow( "La organización con slug 'empresa-alfa' ya existe." ) ;
    } ) ;
  } ) ;

  describe( "invitarUsuarioBootstrap" , () => {
    it( "debería crear una invitación con rol especificado y fecha de expiración válida" , async () => {
      const org = await crearOrganizacionBootstrap( { nombre: "Organización Invitaciones" } , db ) ;

      const inv = await invitarUsuarioBootstrap( {
        orgSlug: org.slug ,
        email:   "   NuevoOwner@Ejemplo.COM   " ,
        rol:     "owner" ,
        dias:    14
      } , db ) ;

      expect( inv.id ).toBeDefined() ;
      expect( inv.organizationId ).toBe( org.id ) ;
      expect( inv.email ).toBe( "nuevoowner@ejemplo.com" ) ;
      expect( inv.role ).toBe( "owner" ) ;
      expect( inv.invitedBy ).toBeNull() ;
      expect( inv.status ).toBe( "pending" ) ;
      expect( inv.expiresAt.getTime() ).toBeGreaterThan( Date.now() + (13 * 24 * 60 * 60 * 1000) ) ;
    } ) ;

    it( "debería fallar si la organización solicitada no existe" , async () => {
      await expect(
        invitarUsuarioBootstrap( {
          orgSlug: "inexistente" ,
          email:   "test@ejemplo.com" ,
          rol:     "member"
        } , db )
      ).rejects.toThrow( "Organización con slug 'inexistente' no encontrada." ) ;
    } ) ;

    it( "debería revocar invitaciones pendientes vencidas antes de emitir una nueva para el mismo correo" , async () => {
      const org = await crearOrganizacionBootstrap( { nombre: "Org Re-invitacion" } , db ) ;

      // Invitación vieja vencida
      const [ invVieja ] = await db
        .insert( invitations )
        .values( {
          organizationId: org.id ,
          email:          "reinvitado@ejemplo.com" ,
          role:           "member" ,
          status:         "pending" ,
          expiresAt:      new Date( Date.now() - 3600000 )
        } )
        .returning() ;

      const invNueva = await invitarUsuarioBootstrap( {
        orgSlug: org.slug ,
        email:   "reinvitado@ejemplo.com" ,
        rol:     "owner"
      } , db ) ;

      expect( invNueva.id ).not.toBe( invVieja.id ) ;

      const [ invViejaActualizada ] = await db
        .select()
        .from( invitations )
        .where( eq( invitations.id , invVieja.id ) ) ;
      expect( invViejaActualizada.status ).toBe( "revoked" ) ;
    } ) ;
  } ) ;

  describe( "retirarAdminBootstrap (AC-17, RN-19)" , () => {
    it( "debería negarse si admin@ejemplo.com es el único owner de su organización" , async () => {
      const org = await crearOrganizacionBootstrap( { nombre: "Org Unico Owner" } , db ) ;

      await crearUsuarioConMembresia( {
        organizationId: org.id ,
        email:          "admin@ejemplo.com" ,
        role:           "owner"
      } , db ) ;

      await expect(
        retirarAdminBootstrap( db )
      ).rejects.toThrow( "No se puede retirar admin@ejemplo.com: es el único owner" ) ;

      // El usuario sigue existiendo
      const [ admin ] = await db.select().from( users ).where( eq( users.email , "admin@ejemplo.com" ) ) ;
      expect( admin ).toBeDefined() ;
    } ) ;

    it( "debería proceder y eliminar admin@ejemplo.com si la organización cuenta con otro owner" , async () => {
      const org = await crearOrganizacionBootstrap( { nombre: "Org Con Dos Owners" } , db ) ;

      const admin = await crearUsuarioConMembresia( {
        organizationId: org.id ,
        email:          "admin@ejemplo.com" ,
        role:           "owner"
      } , db ) ;

      // Segundo owner
      await crearUsuarioConMembresia( {
        organizationId: org.id ,
        email:          "segundo-owner@ejemplo.com" ,
        role:           "owner"
      } , db ) ;

      const resultado = await retirarAdminBootstrap( db ) ;

      expect( resultado.eliminado ).toBe( true ) ;
      expect( resultado.userId ).toBe( admin.id ) ;

      const [ adminEnDb ] = await db.select().from( users ).where( eq( users.email , "admin@ejemplo.com" ) ) ;
      expect( adminEnDb ).toBeUndefined() ;

      // El segundo owner conserva su membresía
      const [ otroOwnerMembresia ] = await db
        .select()
        .from( memberships )
        .where( eq( memberships.organizationId , org.id ) ) ;
      expect( otroOwnerMembresia.role ).toBe( "owner" ) ;
    } ) ;
  } ) ;
} ) ;
