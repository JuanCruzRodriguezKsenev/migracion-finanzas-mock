/**
 * @file parametrosPagina.test.ts
 * Tests de la resolución de mes y divisa de la ruta /budgets.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Budgets
import { resolverParametros } from "./parametrosPagina" ;


const base = { mesActual: "2026-10" , divisaPerfil: "ARS" , divisasConPresupuesto: [ "ARS" , "USD" ] } ;

describe( "resolverParametros - mes" , () => {
  it( "respeta un mes pasado válido" , () => {
    expect( resolverParametros( { ...base , month: "2026-03" } ).monthKey ).toBe( "2026-03" ) ;
  } ) ;

  it( "sin mes, inválido o futuro cae al mes en curso" , () => {
    expect( resolverParametros( { ...base } ).monthKey ).toBe( "2026-10" ) ;
    expect( resolverParametros( { ...base , month: "2026-13" } ).monthKey ).toBe( "2026-10" ) ;
    expect( resolverParametros( { ...base , month: "abc" } ).monthKey ).toBe( "2026-10" ) ;
    expect( resolverParametros( { ...base , month: "2026-11" } ).monthKey ).toBe( "2026-10" ) ;
  } ) ;
} ) ;

describe( "resolverParametros - divisa" , () => {
  it( "respeta una divisa válida del query" , () => {
    expect( resolverParametros( { ...base , currency: "USD" } ).currency ).toBe( "USD" ) ;
  } ) ;

  it( "ignora una divisa mal formada" , () => {
    expect( resolverParametros( { ...base , currency: "usd" } ).currency ).toBe( "ARS" ) ;
  } ) ;

  it( "usa la del perfil si tiene presupuestos" , () => {
    expect( resolverParametros( { ...base } ).currency ).toBe( "ARS" ) ;
  } ) ;

  it( "si la del perfil no tiene presupuestos, la primera que sí tiene" , () => {
    expect( resolverParametros( { ...base , divisaPerfil: "EUR" , divisasConPresupuesto: [ "USD" , "BRL" ] } ).currency ).toBe( "BRL" ) ;
  } ) ;

  it( "si no hay presupuestos, la del perfil" , () => {
    expect( resolverParametros( { ...base , divisasConPresupuesto: [] } ).currency ).toBe( "ARS" ) ;
  } ) ;
} ) ;
