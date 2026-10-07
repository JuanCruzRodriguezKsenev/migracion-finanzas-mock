// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                   from "next-auth" ;
import type { Session }                                       from "next-auth" ;
import { eq }                                                 from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Accounting
import * as provisioning                  from "@/features/accounting/services/organizationProvisioningService" ;
import { createLedgerTransaction }        from "@/features/accounting/services/accountingService" ;
import { accounts , categories }          from "@/features/accounting/schema.db" ;

// Feature: Auth
import { membershipRepository }          from "@/features/auth/repositories/membershipRepository" ;
import { organizations , memberships , users } from "@/features/auth/schema.db" ;

// Feature: Organizations
import { crearOrganizacionAction , listarOrganizacionesAction } from "./organizationActions" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

describe( "organizationActions — crear y listar organizaciones" , () => {
  let orgId:  string ;
  let userId: string ;

  beforeEach( async () => {
    vi.restoreAllMocks() ;
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ org ] = await db.insert( organizations ).values( { name: "Casa" , slug: "casa" } ).returning() ;
    orgId  = org.id ;
    userId = ( await crearUsuarioConMembresia( { organizationId: orgId , role: "member" } ) ).id ;

    vi.mocked( getServerSession ).mockResolvedValue( {
      user:    { id: userId , organizationId: orgId , role: "member" } ,
      expires: new Date().toISOString() ,
    } as unknown as Session ) ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "sin sesión ambas acciones fallan" , async () => {
    vi.mocked( getServerSession ).mockResolvedValue( null ) ;

    expect( (await crearOrganizacionAction( { nombre: "X" } )).success ).toBe( false ) ;
    expect( (await listarOrganizacionesAction()).success ).toBe( false ) ;
  } ) ;

  it( "RN-17: un member (no owner) puede crear una organización y queda como owner de ella" , async () => {
    const res = await crearOrganizacionAction( { nombre: "  Prueba  " } ) ;

    expect( res.success ).toBe( true ) ;
    if( !res.success ) { return ; }

    const [ org ] = await db.select().from( organizations ).where( eq( organizations.id , res.value.organizationId ) ) ;
    expect( org.name ).toBe( "Prueba" ) ;

    const m = await membershipRepository.findMembership( userId , res.value.organizationId ) ;
    expect( m?.role ).toBe( "owner" ) ;

    const [ u ] = await db.select().from( users ).where( eq( users.id , userId ) ) ;
    expect( u.lastOrganizationId ).toBe( res.value.organizationId ) ;
  } ) ;

  it( "AC-12: la organización nueva nace con catálogo, cuenta de Patrimonio Neto y admite un gasto sin categoría" , async () => {
    const res = await crearOrganizacionAction( { nombre: "Nueva" } ) ;
    if( !res.success ) { throw( new Error( res.error ) ) ; }
    const nuevaId = res.value.organizationId ;

    const cats   = await db.select().from( categories ).where( eq( categories.organizationId , nuevaId ) ) ;
    const cuentas = await db.select().from( accounts ).where( eq( accounts.organizationId , nuevaId ) ) ;
    const patrimonio = cuentas.find( ( c ) => c.code === "3.1.01.01" ) ;
    const gasto      = cuentas.find( ( c ) => c.type === "expense" ) ;

    expect( cats.length ).toBeGreaterThan( 0 ) ;
    expect( patrimonio ).toBeDefined() ;
    expect( gasto ).toBeDefined() ;

    const mov = await createLedgerTransaction( {
      organizationId: nuevaId ,
      categoryId:     null ,
      description:    "Gasto sin categoría" ,
      entries:        [
        { accountId: gasto!.id      , debit: 500 , credit: 0 } ,
        { accountId: patrimonio!.id , debit: 0 , credit: 500 } ,
      ] ,
    } ) ;

    expect( mov.success ).toBe( true ) ;
  } ) ;

  it( "AC-13: si el aprovisionamiento lanza, no queda organización ni membresía" , async () => {
    vi.spyOn( provisioning , "provisionarOrganizacion" ).mockRejectedValue( new Error( "falla simulada" ) ) ;

    const res = await crearOrganizacionAction( { nombre: "Fallida" } ) ;

    expect( res.success ).toBe( false ) ;
    expect( await db.select().from( organizations ) ).toHaveLength( 1 ) ;
    expect( await db.select().from( memberships ) ).toHaveLength( 1 ) ;
  } ) ;

  it( "slug repetido: dos organizaciones con el mismo nombre existen con slugs distintos" , async () => {
    const r1 = await crearOrganizacionAction( { nombre: "Mismo Nombre" } ) ;
    const r2 = await crearOrganizacionAction( { nombre: "Mismo Nombre" } ) ;

    expect( r1.success && r2.success ).toBe( true ) ;
    const orgs = await db.select().from( organizations ).where( eq( organizations.name , "Mismo Nombre" ) ) ;
    expect( orgs ).toHaveLength( 2 ) ;
    expect( new Set( orgs.map( ( o ) => o.slug ) ).size ).toBe( 2 ) ;
  } ) ;

  it( "Zod: nombre vacío o de 101 caracteres falla" , async () => {
    expect( (await crearOrganizacionAction( { nombre: "   " } )).success ).toBe( false ) ;
    expect( (await crearOrganizacionAction( { nombre: "a".repeat( 101 ) } )).success ).toBe( false ) ;
    expect( (await crearOrganizacionAction( { nombre: "a".repeat( 100 ) } )).success ).toBe( true ) ;
  } ) ;

  it( "listarOrganizaciones devuelve las del usuario con su rol y la activa" , async () => {
    await crearOrganizacionAction( { nombre: "Segunda" } ) ;

    const res = await listarOrganizacionesAction() ;

    expect( res.success ).toBe( true ) ;
    if( res.success ) {
      expect( res.value.activaId ).toBe( orgId ) ;
      expect( res.value.organizaciones.map( ( o ) => `${o.nombre}:${o.rol}` ).sort() ).toEqual( [ "Casa:member" , "Segunda:owner" ] ) ;
    }
  } ) ;
} ) ;
