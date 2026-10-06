/**
 * @file organizationProvisioningService.test.ts
 * Pruebas de integración para el servicio de aprovisionamiento de organizaciones (RN-18, AC-12, AC-13, AC-15).
 */
// Librerías externas
import { describe , it , expect , beforeEach } from "vitest" ;
import { eq , and }                            from "drizzle-orm" ;

// Shared
import { db }          from "@/shared/db/client" ;
import { limpiarBase } from "@/shared/db/testCleanup" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { provisionarOrganizacion }                  from "./organizationProvisioningService" ;
import { INITIAL_CATEGORIES_CATALOG }               from "../constants/initialCatalog" ;
import { categories , accounts , categoryAccounts } from "../schema.db" ;


describe( "organizationProvisioningService" , () => {
  let orgId: string ;

  const totalPadres        = INITIAL_CATEGORIES_CATALOG.length ;
  const totalSubcategorias = INITIAL_CATEGORIES_CATALOG.reduce( ( acc , cat ) => ( acc + cat.subcategories.length ) , 0 ) ;
  const totalCategorias    = ( totalPadres + totalSubcategorias ) ;
  const totalCuentas       = ( totalCategorias + 1 ) ;

  beforeEach( async () => {
    await limpiarBase() ;

    const [ org ] = await db
      .insert( organizations )
      .values( {
        name: "Organización Test Aprovisionamiento" ,
        slug: "org-test-aprovisionamiento" ,
      } )
      .returning() ;

    orgId = org.id ;
  } ) ;

  // 1. Conteo exacto derivado de INITIAL_CATEGORIES_CATALOG
  it( "aprovisiona el conteo exacto de categorias, cuentas y vinculos segun el catalogo" , async () => {
    const resultado = await provisionarOrganizacion( orgId , db ) ;

    const categoriasEnDb = await db
      .select()
      .from( categories )
      .where( eq( categories.organizationId , orgId ) ) ;

    const cuentasEnDb = await db
      .select()
      .from( accounts )
      .where( eq( accounts.organizationId , orgId ) ) ;

    const vinculosEnDb = await db
      .select()
      .from( categoryAccounts )
      .innerJoin( categories , eq( categoryAccounts.categoryId , categories.id ) )
      .where( eq( categories.organizationId , orgId ) ) ;

    expect( categoriasEnDb.length ).toBe( totalCategorias ) ;
    expect( cuentasEnDb.length ).toBe( totalCuentas ) ;
    expect( vinculosEnDb.length ).toBe( totalCategorias ) ;
    expect( resultado.categoriasPorCodigo.size ).toBe( totalCategorias ) ;
    expect( resultado.cuentasPorCodigo.size ).toBe( totalCuentas ) ;
  } ) ;

  // 2. Cada categoría tiene su cuenta asociada en ARS con el mismo tipo
  it( "garantiza que cada categoria tenga su cuenta asociada en ARS y el vinculo correspondiente" , async () => {
    await provisionarOrganizacion( orgId , db ) ;

    const categoriasEnDb = await db
      .select()
      .from( categories )
      .where( eq( categories.organizationId , orgId ) ) ;

    const cuentasEnDb = await db
      .select()
      .from( accounts )
      .where( eq( accounts.organizationId , orgId ) ) ;

    const vinculosEnDb = await db
      .select()
      .from( categoryAccounts )
      .innerJoin( categories , eq( categoryAccounts.categoryId , categories.id ) )
      .where( eq( categories.organizationId , orgId ) ) ;

    const cuentasPorCodigo = new Map( cuentasEnDb.map( ( cta ) => [ cta.code , cta ] ) ) ;
    const vinculosPorCatId = new Map( vinculosEnDb.map( ( v ) => [ v.category_accounts.categoryId , v.category_accounts ] ) ) ;

    for( const cat of categoriasEnDb ) {
      const codigoEsperado = `${cat.accountCode}-ARS` ;
      const ctaAsociada    = cuentasPorCodigo.get( codigoEsperado ) ;

      expect( ctaAsociada ).toBeDefined() ;
      expect( ctaAsociada?.type ).toBe( cat.type ) ;
      expect( ctaAsociada?.currency ).toBe( "ARS" ) ;

      const vinculo = vinculosPorCatId.get( cat.id ) ;
      expect( vinculo ).toBeDefined() ;
      expect( vinculo?.accountId ).toBe( ctaAsociada?.id ) ;
      expect( vinculo?.currency ).toBe( "ARS" ) ;
    }
  } ) ;

  // 3. Cuenta de Patrimonio Neto Inicial
  it( "crea la cuenta de patrimonio neto inicial 3.1.01.01 de tipo equity con saldo cero" , async () => {
    const resultado = await provisionarOrganizacion( orgId , db ) ;

    const [ ctaPatrimonio ] = await db
      .select()
      .from( accounts )
      .where(
        and(
          eq( accounts.organizationId , orgId ) ,
          eq( accounts.code , "3.1.01.01" )
        )
      ) ;

    expect( ctaPatrimonio ).toBeDefined() ;
    expect( ctaPatrimonio.name ).toBe( "Patrimonio Neto Inicial" ) ;
    expect( ctaPatrimonio.type ).toBe( "equity" ) ;
    expect( ctaPatrimonio.balance ).toBe( 0 ) ;
    expect( ctaPatrimonio.currency ).toBe( "ARS" ) ;

    expect( resultado.cuentaPatrimonio.id ).toBe( ctaPatrimonio.id ) ;
    expect( resultado.cuentaPatrimonio.code ).toBe( "3.1.01.01" ) ;
  } ) ;

  // 4. Ninguna categoría es hoja de sistema
  it( "asegura que ninguna categoria aprovisionada tenga isSystemLeaf en true" , async () => {
    await provisionarOrganizacion( orgId , db ) ;

    const hojasDeSistema = await db
      .select()
      .from( categories )
      .where(
        and(
          eq( categories.organizationId , orgId ) ,
          eq( categories.isSystemLeaf , true )
        )
      ) ;

    expect( hojasDeSistema.length ).toBe( 0 ) ;
  } ) ;

  // 5. No es idempotente: una segunda llamada lanza error por clave duplicada
  it( "lanza un error al intentar aprovisionar dos veces la misma organizacion" , async () => {
    await provisionarOrganizacion( orgId , db ) ;

    await expect( provisionarOrganizacion( orgId , db ) ).rejects.toThrow() ;
  } ) ;

  // 6. Rollback transaccional (AC-13)
  it( "revierte todas las inserciones ante un error dentro de la transaccion (AC-13)" , async () => {
    await expect(
      db.transaction( async ( tx ) => {
        await provisionarOrganizacion( orgId , tx ) ;
        throw( new Error( "Fallo forzado para probar rollback" ) ) ;
      } )
    ).rejects.toThrow( "Fallo forzado para probar rollback" ) ;

    const categoriasRestantes = await db
      .select()
      .from( categories )
      .where( eq( categories.organizationId , orgId ) ) ;

    const cuentasRestantes = await db
      .select()
      .from( accounts )
      .where( eq( accounts.organizationId , orgId ) ) ;

    expect( categoriasRestantes.length ).toBe( 0 ) ;
    expect( cuentasRestantes.length ).toBe( 0 ) ;
  } ) ;

  // 7. Aislamiento entre organizaciones (AC-15)
  it( "garantiza aislamiento estricto entre dos organizaciones aprovisionadas (AC-15)" , async () => {
    const [ segundaOrg ] = await db
      .insert( organizations )
      .values( {
        name: "Segunda Organizacion Test" ,
        slug: "segunda-org-test" ,
      } )
      .returning() ;

    await provisionarOrganizacion( orgId , db ) ;
    await provisionarOrganizacion( segundaOrg.id , db ) ;

    const categoriasOrg1 = await db
      .select()
      .from( categories )
      .where( eq( categories.organizationId , orgId ) ) ;

    const categoriasOrg2 = await db
      .select()
      .from( categories )
      .where( eq( categories.organizationId , segundaOrg.id ) ) ;

    const cuentasOrg1 = await db
      .select()
      .from( accounts )
      .where( eq( accounts.organizationId , orgId ) ) ;

    const cuentasOrg2 = await db
      .select()
      .from( accounts )
      .where( eq( accounts.organizationId , segundaOrg.id ) ) ;

    expect( categoriasOrg1.length ).toBe( totalCategorias ) ;
    expect( categoriasOrg2.length ).toBe( totalCategorias ) ;
    expect( cuentasOrg1.length ).toBe( totalCuentas ) ;
    expect( cuentasOrg2.length ).toBe( totalCuentas ) ;

    const idsCatOrg1 = new Set( categoriasOrg1.map( ( c ) => c.id ) ) ;
    const idsCatOrg2 = new Set( categoriasOrg2.map( ( c ) => c.id ) ) ;
    for( const id of idsCatOrg1 ) {
      expect( idsCatOrg2.has( id ) ).toBe( false ) ;
    }
  } ) ;
} ) ;
