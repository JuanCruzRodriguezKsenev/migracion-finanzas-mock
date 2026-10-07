/**
 * @file limite.test.ts
 * Tests de la conversión texto <-> centavos del campo de límite.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Budgets
import { limiteACentavos , centavosALimite } from "./limite" ;


describe( "limiteACentavos" , () => {
  it( "convierte enteros y decimales con punto o coma" , () => {
    expect( limiteACentavos( "1500" , "ARS" ) ).toEqual( { ok: true , centavos: 150000 } ) ;
    expect( limiteACentavos( "1500.5" , "ARS" ) ).toEqual( { ok: true , centavos: 150050 } ) ;
    expect( limiteACentavos( "1500,05" , "ARS" ) ).toEqual( { ok: true , centavos: 150005 } ) ;
  } ) ;

  it( "no pierde precisión donde la coma flotante falla (1.005 * 100)" , () => {
    expect( limiteACentavos( "1.01" , "USD" ) ).toEqual( { ok: true , centavos: 101 } ) ;
    expect( limiteACentavos( "0.29" , "USD" ) ).toEqual( { ok: true , centavos: 29 } ) ;
  } ) ;

  it( "respeta los decimales de la divisa (JPY no tiene)" , () => {
    expect( limiteACentavos( "500" , "JPY" ) ).toEqual( { ok: true , centavos: 500 } ) ;
    expect( limiteACentavos( "500.5" , "JPY" ) ).toEqual( { ok: false , motivo: "invalido" } ) ;
  } ) ;

  it( "rechaza más decimales de los que admite la divisa" , () => {
    expect( limiteACentavos( "1.005" , "ARS" ) ).toEqual( { ok: false , motivo: "invalido" } ) ;
  } ) ;

  it( "rechaza texto, vacío y separadores de miles" , () => {
    expect( limiteACentavos( "abc" , "ARS" ) ).toEqual( { ok: false , motivo: "invalido" } ) ;
    expect( limiteACentavos( "" , "ARS" ) ).toEqual( { ok: false , motivo: "invalido" } ) ;
    expect( limiteACentavos( "1.500,00" , "ARS" ) ).toEqual( { ok: false , motivo: "invalido" } ) ;
  } ) ;

  it( "rechaza cero y negativos como no positivos" , () => {
    expect( limiteACentavos( "0" , "ARS" ) ).toEqual( { ok: false , motivo: "no_positivo" } ) ;
    expect( limiteACentavos( "0.00" , "ARS" ) ).toEqual( { ok: false , motivo: "no_positivo" } ) ;
    expect( limiteACentavos( "-5" , "ARS" ) ).toEqual( { ok: false , motivo: "no_positivo" } ) ;
  } ) ;
} ) ;

describe( "centavosALimite" , () => {
  it( "arma el texto editable con los decimales de la divisa" , () => {
    expect( centavosALimite( 150050 , "ARS" ) ).toBe( "1500.50" ) ;
    expect( centavosALimite( 5 , "ARS" ) ).toBe( "0.05" ) ;
    expect( centavosALimite( 500 , "JPY" ) ).toBe( "500" ) ;
  } ) ;

  it( "ida y vuelta sin pérdida" , () => {
    const texto = centavosALimite( 123457 , "USD" ) ;
    expect( limiteACentavos( texto , "USD" ) ).toEqual( { ok: true , centavos: 123457 } ) ;
  } ) ;
} ) ;
