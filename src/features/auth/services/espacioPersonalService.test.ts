/**
 * @file espacioPersonalService.test.ts
 * Pruebas de integración del alta del espacio Personal contra PostgreSQL (RN-1, RN-2, A9).
 */
// Librerías externas
import { describe , it , expect , beforeEach , afterAll } from "vitest" ;
import { eq }                                             from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Accounting
import { categories , accounts } from "@/features/accounting/schema.db" ;

// Feature: Auth
import { crearEspacioPersonal , asegurarEspacioPersonal } from "./espacioPersonalService" ;
import { organizationRepository }                         from "../repositories/organizationRepository" ;
import { organizations , memberships , users }            from "../schema.db" ;


describe( "espacioPersonalService" , () => {
  let userId: string ;

  beforeEach( async () => {
    await limpiarBase() ;

    const [ org ] = await db.insert( organizations ).values( {name: "Casa" , slug: "casa-espacio-personal"} ).returning() ;
    const usuario = await crearUsuarioConMembresia( {organizationId: org.id , email: "dueno-espacio@ejemplo.com" , role: "member"} ) ;
    userId        = usuario.id ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "RN-1 / RN-2: crea la organización marcada, con catálogo, Patrimonio Neto y el usuario como único owner" , async () => {
    const personalId = await db.transaction( ( tx ) => crearEspacioPersonal( userId , tx ) ) ;

    const [ org ] = await db.select().from( organizations ).where( eq(organizations.id , personalId) ) ;
    expect( org.name ).toBe( "Personal" ) ;
    expect( org.personalOwnerUserId ).toBe( userId ) ;

    const miembros = await db.select().from( memberships ).where( eq(memberships.organizationId , personalId) ) ;
    expect( miembros.map( ( m ) => ( {userId: m.userId , role: m.role} ) ) ).toEqual( [ {userId , role: "owner"} ] ) ;

    const categorias = await db.select().from( categories ).where( eq(categories.organizationId , personalId) ) ;
    expect( categorias.length ).toBeGreaterThan( 0 ) ;

    const cuentas = await db.select().from( accounts ).where( eq(accounts.organizationId , personalId) ) ;
    expect( cuentas.some( ( c ) => c.type === "equity" ) ).toBe( true ) ;
  } ) ;

  it( "RN-7: no cambia la organización activa del usuario" , async () => {
    const [ antes ] = await db.select().from( users ).where( eq(users.id , userId) ) ;

    await db.transaction( ( tx ) => crearEspacioPersonal( userId , tx ) ) ;

    const [ despues ] = await db.select().from( users ).where( eq(users.id , userId) ) ;
    expect( despues.lastOrganizationId ).toBe( antes.lastOrganizationId ) ;
  } ) ;

  it( "A9: asegurarEspacioPersonal es idempotente y devuelve siempre el mismo espacio" , async () => {
    const primero = await db.transaction( ( tx ) => asegurarEspacioPersonal( userId , tx ) ) ;
    const segundo = await db.transaction( ( tx ) => asegurarEspacioPersonal( userId , tx ) ) ;

    expect( segundo ).toBe( primero ) ;
    expect( await organizationRepository.findPersonalDe( userId ) ).toBe( primero ) ;

    const personales = await db.select().from( organizations ).where( eq(organizations.personalOwnerUserId , userId) ) ;
    expect( personales.length ).toBe( 1 ) ;
  } ) ;

  it( "RN-1: el índice único impide un segundo espacio para el mismo usuario" , async () => {
    await db.transaction( ( tx ) => crearEspacioPersonal( userId , tx ) ) ;

    await expect( db.transaction( ( tx ) => crearEspacioPersonal( userId , tx ) ) ).rejects.toThrow() ;

    const personales = await db.select().from( organizations ).where( eq(organizations.personalOwnerUserId , userId) ) ;
    expect( personales.length ).toBe( 1 ) ;
  } ) ;

  it( "esPersonal distingue el espacio de una organización común" , async () => {
    const personalId = await db.transaction( ( tx ) => crearEspacioPersonal( userId , tx ) ) ;
    const [ casa ]   = await db.select().from( organizations ).where( eq(organizations.slug , "casa-espacio-personal") ) ;

    expect( await organizationRepository.esPersonal( personalId ) ).toBe( true ) ;
    expect( await organizationRepository.esPersonal( casa.id ) ).toBe( false ) ;
  } ) ;
} ) ;
