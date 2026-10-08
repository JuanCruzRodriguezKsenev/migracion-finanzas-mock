/**
 * @file budgetsActions.test.ts
 * Pruebas de integración de las Server Actions de presupuestos (RFC 028 §4 y §7).
 */
// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach } from "vitest" ;
import { eq }                                                  from "drizzle-orm" ;
import { getServerSession }                                    from "next-auth" ;
import type { Session }                                        from "next-auth" ;

// Shared
import { db }               from "@/shared/db/client" ;
import { limpiarBase }      from "@/shared/db/testCleanup" ;
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { claveDeMesActual } from "@/shared/lib/monthKey" ;

// Feature: Accounting
import { categories } from "@/features/accounting/schema.db" ;

// Feature: Budgets
import { createBudgetAction , updateBudgetLimitAction , deleteBudgetAction , getBudgetsAction } from "./budgetsActions" ;
import { budgetsRepository }                                                                  from "../repositories/budgetsRepository" ;
import { budgets , budgetLimits }                                                             from "../schema.db" ;
import { crearEscenario , registrarGasto , type EscenarioPresupuestos }                       from "../testing/presupuestosFactory" ;


vi.mock( "next-auth" , () => ( { getServerSession: vi.fn() } ) ) ;
vi.mock( "next/cache" , () => ( { revalidatePath: vi.fn() } ) ) ;

const ZONA = "America/Argentina/Buenos_Aires" ;

/** Inicia sesión como un `member` real de la organización: la guarda de escritura consulta la membresía en la base. */
const comoOrg = async ( orgId: string ) => {
  const usuario = await crearUsuarioConMembresia( { organizationId: orgId , role: "member" } ) ;

  vi.mocked( getServerSession ).mockResolvedValue( {
    user: { organizationId: orgId , id: usuario.id } ,
  } as unknown as Session ) ;
} ;

describe( "budgetsActions — integración (RFC 028)" , () => {
  let e: EscenarioPresupuestos ;

  beforeEach( async () => {
    vi.restoreAllMocks() ;
    await limpiarBase() ;
    e = await crearEscenario( "org-bud-actions" ) ;
    await comoOrg( e.orgId ) ;
  } ) ;

  afterEach( async () => {
    vi.restoreAllMocks() ;
    await limpiarBase() ;
  } ) ;

  it( "crea el presupuesto con su primer límite vigente en el mes en curso" , async () => {
    const r = await createBudgetAction( { categoryId: e.hoja , currency: "ARS" , amount: 5_000_000 } ) ;

    expect( r.success ).toBe( true ) ;
    const limites = await db.select().from( budgetLimits ).where( eq( budgetLimits.budgetId , r.value!.id ) ) ;
    expect( limites ).toHaveLength( 1 ) ;
    expect( limites[ 0 ].effectiveFrom ).toBe( claveDeMesActual( ZONA ) ) ;
    expect( limites[ 0 ].amount ).toBe( 5_000_000 ) ;
  } ) ;

  it( "carrera: dos creaciones simultáneas iguales, una gana y queda una sola fila vigente (AC-10)" , async () => {
    const [ a , b ] = await Promise.all( [
      createBudgetAction( { categoryId: e.hoja , currency: "ARS" , amount: 100 } ) ,
      createBudgetAction( { categoryId: e.hoja , currency: "ARS" , amount: 100 } ) ,
    ] ) ;

    expect( [ a.success , b.success ].filter( Boolean ) ).toHaveLength( 1 ) ;
    const perdedor = a.success ? b : a ;
    expect( perdedor.error ).toBe( "Ya hay un presupuesto vigente para esa categoría y divisa." ) ;
    expect( await db.select().from( budgets ) ).toHaveLength( 1 ) ;
  } ) ;

  it( "atomicidad: si falla el insert del límite no queda el presupuesto (NFR-4)" , async () => {
    vi.spyOn( budgetsRepository , "upsertLimit" ).mockRejectedValueOnce( new Error( "fallo forzado" ) ) ;

    const r = await createBudgetAction( { categoryId: e.hoja , currency: "ARS" , amount: 100 } ) ;

    expect( r.success ).toBe( false ) ;
    expect( await db.select().from( budgets ) ).toHaveLength( 0 ) ;
  } ) ;

  it.each( [
    [ "monto 0"        , { amount: 0 } ] ,
    [ "monto negativo" , { amount: -5 } ] ,
    [ "monto decimal"  , { amount: 10.5 } ] ,
    [ "divisa inválida", { currency: "AR" } ] ,
    [ "divisa en minúsculas" , { currency: "ars" } ] ,
    [ "id inexistente" , { categoryId: "99999999-9999-4999-8999-999999999999" } ] ,
    [ "id no UUID"     , { categoryId: "no-es-uuid" } ] ,
  ] )( "validación (AC-14): %s" , async ( _nombre , cambio ) => {
    const r = await createBudgetAction( { categoryId: e.hoja , currency: "ARS" , amount: 100 , ...cambio } ) ;
    expect( r.success ).toBe( false ) ;
    expect( await db.select().from( budgets ) ).toHaveLength( 0 ) ;
  } ) ;

  it( "rechaza hoja de sistema y categoría de ingresos (AC-14)" , async () => {
    const sistema = await createBudgetAction( { categoryId: e.general , currency: "ARS" , amount: 100 } ) ;
    const ingreso = await createBudgetAction( { categoryId: e.ingreso , currency: "ARS" , amount: 100 } ) ;

    expect( sistema.success ).toBe( false ) ;
    expect( ingreso.success ).toBe( false ) ;
  } ) ;

  it( "categoría de otra organización se rechaza como inexistente (AC-14)" , async () => {
    const otra = await crearEscenario( "org-bud-otra-act" ) ;
    const r    = await createBudgetAction( { categoryId: otra.hoja , currency: "ARS" , amount: 100 } ) ;

    expect( r.success ).toBe( false ) ;
    expect( await db.select().from( budgets ) ).toHaveLength( 0 ) ;
  } ) ;

  it( "archivada: su presupuesto existente se sigue evaluando, crear uno nuevo falla (AC-13)" , async () => {
    const existente = await createBudgetAction( { categoryId: e.hoja , currency: "ARS" , amount: 1_000 } ) ;
    await registrarGasto( e , e.hoja , 300 , new Date().toISOString() ) ;
    await db.update( categories ).set( { archivedAt: new Date() } ).where( eq( categories.id , e.hoja ) ) ;

    const nuevo = await createBudgetAction( { categoryId: e.hoja , currency: "ARS" , amount: 1_000 } ) ;
    const lista = await getBudgetsAction( { currency: "ARS" } ) ;

    expect( existente.success ).toBe( true ) ;
    expect( nuevo.success ).toBe( false ) ;
    expect( lista.value!.presupuestos ).toHaveLength( 1 ) ;
    expect( lista.value!.presupuestos[ 0 ].gastado ).toBe( 300 ) ;
  } ) ;

  it( "cambiar el límite dos veces en el mismo mes deja el último (RN-7)" , async () => {
    const c = await createBudgetAction( { categoryId: e.hoja , currency: "ARS" , amount: 100 } ) ;
    await updateBudgetLimitAction( { budgetId: c.value!.id , amount: 200 } ) ;
    const u = await updateBudgetLimitAction( { budgetId: c.value!.id , amount: 300 } ) ;

    expect( u.success ).toBe( true ) ;
    const limites = await db.select().from( budgetLimits ).where( eq( budgetLimits.budgetId , c.value!.id ) ) ;
    expect( limites ).toHaveLength( 1 ) ;
    expect( limites[ 0 ].amount ).toBe( 300 ) ;
  } ) ;

  it( "eliminar no borra filas: fija endedFrom y el presupuesto deja de listarse (RN-8)" , async () => {
    const c = await createBudgetAction( { categoryId: e.hoja , currency: "ARS" , amount: 100 } ) ;
    const d = await deleteBudgetAction( { budgetId: c.value!.id } ) ;

    expect( d.success ).toBe( true ) ;
    const [ fila ] = await db.select().from( budgets ).where( eq( budgets.id , c.value!.id ) ) ;
    expect( fila.endedFrom ).toBe( claveDeMesActual( ZONA ) ) ;
    expect( ( await getBudgetsAction( { currency: "ARS" } ) ).value!.presupuestos ).toHaveLength( 0 ) ;
    expect( ( await deleteBudgetAction( { budgetId: c.value!.id } ) ).success ).toBe( false ) ;
    expect( ( await updateBudgetLimitAction( { budgetId: c.value!.id , amount: 5 } ) ).success ).toBe( false ) ;
  } ) ;

  it( "id inexistente en cambiar y eliminar falla" , async () => {
    const id = "99999999-9999-4999-8999-999999999999" ;
    expect( ( await updateBudgetLimitAction( { budgetId: id , amount: 5 } ) ).success ).toBe( false ) ;
    expect( ( await deleteBudgetAction( { budgetId: id } ) ).success ).toBe( false ) ;
    expect( ( await updateBudgetLimitAction( { budgetId: id , amount: 0 } ) ).success ).toBe( false ) ;
  } ) ;

  it( "aislamiento: otra organización no ve, cambia ni elimina lo ajeno (NFR-2)" , async () => {
    const c    = await createBudgetAction( { categoryId: e.hoja , currency: "ARS" , amount: 100 } ) ;
    const otra = await crearEscenario( "org-bud-aislada" ) ;
    await comoOrg( otra.orgId ) ;

    const lista = await getBudgetsAction( { currency: "ARS" } ) ;
    const upd   = await updateBudgetLimitAction( { budgetId: c.value!.id , amount: 999 } ) ;
    const del   = await deleteBudgetAction( { budgetId: c.value!.id } ) ;

    expect( lista.value!.presupuestos ).toHaveLength( 0 ) ;
    expect( upd.success ).toBe( false ) ;
    expect( del.success ).toBe( false ) ;

    const [ fila ] = await db.select().from( budgets ).where( eq( budgets.id , c.value!.id ) ) ;
    expect( fila.endedFrom ).toBeNull() ;
    const [ lim ] = await db.select().from( budgetLimits ).where( eq( budgetLimits.budgetId , c.value!.id ) ) ;
    expect( lim.amount ).toBe( 100 ) ;
  } ) ;

  it( "sin sesión todas las acciones fallan" , async () => {
    vi.mocked( getServerSession ).mockResolvedValue( null ) ;
    const id = "99999999-9999-4999-8999-999999999999" ;

    expect( ( await getBudgetsAction() ).success ).toBe( false ) ;
    expect( ( await createBudgetAction( { categoryId: id , currency: "ARS" , amount: 1 } ) ).success ).toBe( false ) ;
    expect( ( await updateBudgetLimitAction( { budgetId: id , amount: 1 } ) ).success ).toBe( false ) ;
    expect( ( await deleteBudgetAction( { budgetId: id } ) ).success ).toBe( false ) ;
  } ) ;
} ) ;
