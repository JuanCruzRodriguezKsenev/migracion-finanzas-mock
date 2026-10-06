/**
 * @file budgetsService.test.ts
 * Pruebas de integración contra la base real de la evaluación mensual de presupuestos (RFC 028 §7).
 */
// Librerías externas
import { describe , it , expect , beforeEach , afterEach } from "vitest" ;
import { eq }                                              from "drizzle-orm" ;

// Shared
import { db }          from "@/shared/db/client" ;
import { limpiarBase } from "@/shared/db/testCleanup" ;

// Feature: Auth
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;

// Feature: Profile
import { profiles } from "@/features/profile/schema.db" ;

// Feature: Accounting
import { categories }                  from "@/features/accounting/schema.db" ;
import { reverseLedgerTransaction }    from "@/features/accounting/services/accountingService" ;

// Feature: Budgets
import { budgetsService }    from "./budgetsService" ;
import { budgetsRepository } from "../repositories/budgetsRepository" ;
import { crearEscenario , registrarGasto , type EscenarioPresupuestos } from "../testing/presupuestosFactory" ;


describe( "budgetsService.evaluarMes — integración (RFC 028)" , () => {
  let e: EscenarioPresupuestos ;

  beforeEach( async () => {
    await limpiarBase() ;
    e = await crearEscenario( "org-bud-service" ) ;
  } ) ;

  afterEach( async () => {
    await limpiarBase() ;
  } ) ;

  const evaluar = ( monthKey = "2026-05" , orgId = e.orgId ) => {
    return( budgetsService.evaluarMes( { orgId , monthKey , currency: "ARS" } ) ) ;
  } ;

  it( "un presupuesto de hoja cuenta sólo el gasto de esa hoja" , async () => {
    await budgetsRepository.create( { orgId: e.orgId , categoryId: e.hoja , currency: "ARS" , monthKey: "2026-05" , amount: 10_000_000 } ) ;
    await registrarGasto( e , e.hoja     , 8_500_000 , "2026-05-10T15:00:00Z" ) ;
    await registrarGasto( e , e.otraHoja , 3_000_000 , "2026-05-11T15:00:00Z" ) ;

    const r = await evaluar() ;

    expect( r.presupuestos ).toHaveLength( 1 ) ;
    expect( r.presupuestos[ 0 ].gastado ).toBe( 8_500_000 ) ;
    expect( r.presupuestos[ 0 ].estado ).toBe( "en_alerta" ) ;
    expect( r.presupuestos[ 0 ].restante ).toBe( 1_500_000 ) ;
  } ) ;

  it( "padre incluye sus hojas y su hoja General (AC-7)" , async () => {
    await budgetsRepository.create( { orgId: e.orgId , categoryId: e.padre , currency: "ARS" , monthKey: "2026-05" , amount: 30_000_000 } ) ;
    await registrarGasto( e , e.hoja    , 1_000_000 , "2026-05-10T15:00:00Z" ) ;
    await registrarGasto( e , e.general , 2_000_000 , "2026-05-12T15:00:00Z" ) ;
    await registrarGasto( e , e.otraHoja , 9_000_000 , "2026-05-12T15:00:00Z" ) ;

    const r = await evaluar() ;

    expect( r.presupuestos[ 0 ].esPadre ).toBe( true ) ;
    expect( r.presupuestos[ 0 ].gastado ).toBe( 3_000_000 ) ;
  } ) ;

  it( "no hay doble conteo entre padre y hoja (AC-8)" , async () => {
    await budgetsRepository.create( { orgId: e.orgId , categoryId: e.padre , currency: "ARS" , monthKey: "2026-05" , amount: 30_000_000 } ) ;
    await budgetsRepository.create( { orgId: e.orgId , categoryId: e.hoja  , currency: "ARS" , monthKey: "2026-05" , amount: 10_000_000 } ) ;
    await registrarGasto( e , e.hoja , 8_000_000 , "2026-05-10T15:00:00Z" ) ;

    const r = await evaluar() ;

    expect( r.presupuestos.filter( ( p ) => { return( p.esSublimite ) ; } ) ).toHaveLength( 1 ) ;
    expect( r.resumen.limiteTotal ).toBe( 30_000_000 ) ;
    expect( r.resumen.gastadoTotal ).toBe( 8_000_000 ) ;
  } ) ;

  it( "lo reversado no suma (AC-9)" , async () => {
    await budgetsRepository.create( { orgId: e.orgId , categoryId: e.hoja , currency: "ARS" , monthKey: "2026-05" , amount: 10_000_000 } ) ;
    await registrarGasto( e , e.hoja , 2_000_000 , "2026-05-10T15:00:00Z" ) ;
    const aReversar = await registrarGasto( e , e.hoja , 5_000_000 , "2026-05-11T15:00:00Z" ) ;
    await reverseLedgerTransaction( aReversar , e.orgId , "error de carga" ) ;

    const r = await evaluar() ;

    expect( r.presupuestos[ 0 ].gastado ).toBe( 2_000_000 ) ;
  } ) ;

  it( "vigencia: límite de abril, otro de mayo y un mes sin nada (AC-4, RN-7)" , async () => {
    const p = await budgetsRepository.create( { orgId: e.orgId , categoryId: e.hoja , currency: "ARS" , monthKey: "2026-04" , amount: 100 } ) ;
    await budgetsRepository.upsertLimit( p.id , "2026-05" , 200 ) ;
    await budgetsRepository.upsertLimit( p.id , "2026-05" , 300 ) ;

    expect( ( await evaluar( "2026-04" ) ).presupuestos[ 0 ].limite ).toBe( 100 ) ;
    expect( ( await evaluar( "2026-05" ) ).presupuestos[ 0 ].limite ).toBe( 300 ) ;
    expect( ( await evaluar( "2026-03" ) ).presupuestos ).toHaveLength( 0 ) ;
  } ) ;

  it( "antes de crearlo no existe y desde endedFrom ya no rige (AC-5, AC-6)" , async () => {
    const p = await budgetsRepository.create( { orgId: e.orgId , categoryId: e.hoja , currency: "ARS" , monthKey: "2026-05" , amount: 100 } ) ;
    await budgetsRepository.end( p.id , "2026-08" , e.orgId ) ;

    expect( ( await evaluar( "2026-04" ) ).presupuestos ).toHaveLength( 0 ) ;
    expect( ( await evaluar( "2026-07" ) ).presupuestos ).toHaveLength( 1 ) ;
    expect( ( await evaluar( "2026-08" ) ).presupuestos ).toHaveLength( 0 ) ;
  } ) ;

  it( "zona horaria: gasto a las 22:00 del 31 de mayo en Buenos Aires cuenta en mayo (AC-12)" , async () => {
    const usuario = await crearUsuarioConMembresia( { organizationId: e.orgId } ) ;
    await db.insert( profiles ).values( { userId: usuario.id , timezone: "America/Argentina/Buenos_Aires" , currency: "ARS" } ) ;
    await budgetsRepository.create( { orgId: e.orgId , categoryId: e.hoja , currency: "ARS" , monthKey: "2026-05" , amount: 1_000 } ) ;
    // 22:00 ART del 31/05 = 01:00 UTC del 01/06
    await registrarGasto( e , e.hoja , 400 , "2026-06-01T01:00:00Z" ) ;

    const mayo  = await budgetsService.evaluarMes( { orgId: e.orgId , userId: usuario.id , monthKey: "2026-05" , currency: "ARS" } ) ;
    const junio = await budgetsService.evaluarMes( { orgId: e.orgId , userId: usuario.id , monthKey: "2026-06" , currency: "ARS" } ) ;

    expect( mayo.presupuestos[ 0 ].gastado ).toBe( 400 ) ;
    expect( junio.presupuestos ).toHaveLength( 1 ) ;
    expect( junio.presupuestos[ 0 ].gastado ).toBe( 0 ) ;
  } ) ;

  it( "una categoría archivada sigue evaluándose (AC-13)" , async () => {
    await budgetsRepository.create( { orgId: e.orgId , categoryId: e.hoja , currency: "ARS" , monthKey: "2026-05" , amount: 1_000 } ) ;
    await registrarGasto( e , e.hoja , 400 , "2026-05-10T15:00:00Z" ) ;
    await db.update( categories ).set( { archivedAt: new Date() } ).where( eq( categories.id , e.hoja ) ) ;

    const r = await evaluar() ;

    expect( r.presupuestos ).toHaveLength( 1 ) ;
    expect( r.presupuestos[ 0 ].archivada ).toBe( true ) ;
    expect( r.presupuestos[ 0 ].gastado ).toBe( 400 ) ;
  } ) ;

  it( "aislamiento: otra organización no ve presupuestos ni gasto ajeno" , async () => {
    await budgetsRepository.create( { orgId: e.orgId , categoryId: e.hoja , currency: "ARS" , monthKey: "2026-05" , amount: 1_000 } ) ;
    const otra = await crearEscenario( "org-bud-otra" ) ;

    const r = await evaluar( "2026-05" , otra.orgId ) ;

    expect( r.presupuestos ).toHaveLength( 0 ) ;
  } ) ;

  it( "diasRestantes es null fuera del mes en curso" , async () => {
    const r = await evaluar( "2020-01" ) ;
    expect( r.diasRestantes ).toBeNull() ;
    expect( r.monthKey ).toBe( "2020-01" ) ;
  } ) ;

  it( "diasRestantes en el mes en curso es al menos 1 y a lo sumo 31" , async () => {
    const r = await budgetsService.evaluarMes( { orgId: e.orgId , currency: "ARS" } ) ;
    expect( r.diasRestantes ).toBeGreaterThanOrEqual( 1 ) ;
    expect( r.diasRestantes ).toBeLessThanOrEqual( 31 ) ;
  } ) ;
} ) ;
