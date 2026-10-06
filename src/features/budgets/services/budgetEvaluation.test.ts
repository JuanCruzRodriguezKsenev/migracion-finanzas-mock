/**
 * @file budgetEvaluation.test.ts
 * Pruebas de las funciones puras de evaluación de presupuestos (RFC 028 §3 y §7).
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Accounting
import type { CategoryTreeNode , Category } from "@/features/accounting/types" ;

// Feature: Budgets
import { limiteVigente , presupuestoActivoEn , estadoDe , raicesYSublimites , resumen } from "./budgetEvaluation" ;
import type { PresupuestoEvaluado }                                                    from "../types" ;


const evaluado = ( parcial: Partial< PresupuestoEvaluado > ): PresupuestoEvaluado => {
  return( {
    budgetId:     "b" ,
    categoryId:   "c" ,
    categoryName: "Cat" ,
    parentId:     null ,
    esPadre:      false ,
    archivada:    false ,
    currency:     "ARS" ,
    limite:       0 ,
    gastado:      0 ,
    restante:     0 ,
    porcentaje:   0 ,
    estado:       "en_orden" ,
    esSublimite:  false ,
    ...parcial ,
  } ) ;
} ;

describe( "estadoDe — umbrales con enteros (AC-3)" , () => {
  const LIMITE = 10_000_000 ;

  it.each( [
    [ 8_499_999  , "en_orden"  ] ,
    [ 8_500_000  , "en_alerta" ] ,
    [ 10_000_000 , "en_alerta" ] ,
    [ 10_000_001 , "excedido"  ] ,
    [ 0          , "en_orden"  ] ,
  ] )( "gastado %i con límite 10.000.000 → %s" , ( gastado , esperado ) => {
    expect( estadoDe( gastado , LIMITE ) ).toBe( esperado ) ;
  } ) ;

  it( "84.999 de 100.000 es en orden y 85.000 es en alerta aunque ambos redondeen a 85 %" , () => {
    expect( estadoDe( 84_999 , 100_000 ) ).toBe( "en_orden" ) ;
    expect( estadoDe( 85_000 , 100_000 ) ).toBe( "en_alerta" ) ;
    expect( estadoDe( 100_001 , 100_000 ) ).toBe( "excedido" ) ;
  } ) ;

  it( "límite no positivo no divide: excedido con gasto, en orden sin gasto" , () => {
    expect( estadoDe( 1 , 0 ) ).toBe( "excedido" ) ;
    expect( estadoDe( 0 , 0 ) ).toBe( "en_orden" ) ;
    expect( estadoDe( 5 , -10 ) ).toBe( "excedido" ) ;
  } ) ;
} ) ;

describe( "limiteVigente (AC-4, RN-7)" , () => {
  const limites = [
    { effectiveFrom: "2026-04" , amount: 100 } ,
    { effectiveFrom: "2026-05" , amount: 300 } ,
    { effectiveFrom: "2026-02" , amount: 50 } ,
  ] ;

  it( "usa el de mayor effectiveFrom menor o igual al mes" , () => {
    expect( limiteVigente( limites , "2026-04" )?.amount ).toBe( 100 ) ;
    expect( limiteVigente( limites , "2026-05" )?.amount ).toBe( 300 ) ;
    expect( limiteVigente( limites , "2026-11" )?.amount ).toBe( 300 ) ;
    expect( limiteVigente( limites , "2026-03" )?.amount ).toBe( 50 ) ;
  } ) ;

  it( "devuelve null antes del primer límite" , () => {
    expect( limiteVigente( limites , "2026-01" ) ).toBeNull() ;
    expect( limiteVigente( [] , "2026-05" ) ).toBeNull() ;
  } ) ;
} ) ;

describe( "presupuestoActivoEn (AC-5, AC-6)" , () => {
  const base = { limits: [ { effectiveFrom: "2026-05" , amount: 100 } ] } ;

  it( "no rige antes de su creación" , () => {
    expect( presupuestoActivoEn( { ...base , endedFrom: null } , "2026-04" ) ).toBe( false ) ;
  } ) ;

  it( "rige desde el mes de creación mientras no termine" , () => {
    expect( presupuestoActivoEn( { ...base , endedFrom: null } , "2026-05" ) ).toBe( true ) ;
    expect( presupuestoActivoEn( { ...base , endedFrom: null } , "2027-01" ) ).toBe( true ) ;
  } ) ;

  it( "eliminado desde un mes: ese mes y los siguientes no, el anterior sí" , () => {
    const eliminado = { ...base , endedFrom: "2026-08" } ;
    expect( presupuestoActivoEn( eliminado , "2026-07" ) ).toBe( true ) ;
    expect( presupuestoActivoEn( eliminado , "2026-08" ) ).toBe( false ) ;
    expect( presupuestoActivoEn( eliminado , "2026-09" ) ).toBe( false ) ;
  } ) ;

  it( "creado y eliminado en el mismo mes nunca rige" , () => {
    expect( presupuestoActivoEn( { ...base , endedFrom: "2026-05" } , "2026-05" ) ).toBe( false ) ;
  } ) ;

  it( "sin límites no rige" , () => {
    expect( presupuestoActivoEn( { limits: [] , endedFrom: null } , "2026-05" ) ).toBe( false ) ;
  } ) ;
} ) ;

describe( "raicesYSublimites y resumen (AC-8)" , () => {
  const hoja  = { id: "hoja"  , parentId: "padre" } as unknown as Category ;
  const otra  = { id: "otra"  , parentId: "padre" } as unknown as Category ;
  const arbol = [ { id: "padre" , parentId: null , children: [ hoja , otra ] } as unknown as CategoryTreeNode ] ;

  it( "la hoja con padre presupuestado en la misma divisa es sub-límite" , () => {
    const subs = raicesYSublimites( [
      { budgetId: "bp" , categoryId: "padre" , currency: "ARS" } ,
      { budgetId: "bh" , categoryId: "hoja"  , currency: "ARS" } ,
    ] , arbol ) ;
    expect( Array.from( subs ) ).toEqual( [ "bh" ] ) ;
  } ) ;

  it( "la hoja es raíz si el padre está presupuestado en otra divisa o no lo está" , () => {
    expect( raicesYSublimites( [
      { budgetId: "bp" , categoryId: "padre" , currency: "USD" } ,
      { budgetId: "bh" , categoryId: "hoja"  , currency: "ARS" } ,
    ] , arbol ).size ).toBe( 0 ) ;
    expect( raicesYSublimites( [ { budgetId: "bh" , categoryId: "hoja" , currency: "ARS" } ] , arbol ).size ).toBe( 0 ) ;
  } ) ;

  it( "padre 300.000 + hoja 100.000 con 80.000 gastados: límite 300.000 y gasto 80.000 una vez" , () => {
    const r = resumen( [
      evaluado( { budgetId: "bp" , limite: 300_000 , gastado: 80_000 , estado: "en_orden" } ) ,
      evaluado( { budgetId: "bh" , limite: 100_000 , gastado: 80_000 , estado: "en_alerta" , esSublimite: true } ) ,
    ] ) ;
    expect( r.limiteTotal ).toBe( 300_000 ) ;
    expect( r.gastadoTotal ).toBe( 80_000 ) ;
    expect( r.restanteTotal ).toBe( 220_000 ) ;
    expect( r.porcentaje ).toBe( 27 ) ;
    expect( r.enAlerta ).toBe( 1 ) ;
    expect( r.excedidas ).toBe( 0 ) ;
  } ) ;

  it( "los contadores incluyen raíces y sub-límites" , () => {
    const r = resumen( [
      evaluado( { limite: 10 , gastado: 20 , estado: "excedido" } ) ,
      evaluado( { limite: 10 , gastado: 20 , estado: "excedido" , esSublimite: true } ) ,
    ] ) ;
    expect( r.excedidas ).toBe( 2 ) ;
    expect( r.limiteTotal ).toBe( 10 ) ;
  } ) ;

  it( "sin presupuestos el resumen es cero" , () => {
    expect( resumen( [] ) ).toEqual( { limiteTotal: 0 , gastadoTotal: 0 , restanteTotal: 0 , porcentaje: 0 , excedidas: 0 , enAlerta: 0 } ) ;
  } ) ;
} ) ;
