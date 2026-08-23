// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Accounting
import { getNextCode } from "./accountCodes" ;
import type { Account } from "../types" ;


function makeAccount( code: string , type: string ): Account {
  return( {
    id:             "acc-" + code ,
    organizationId: "org-1" ,
    code ,
    name:           "Cuenta de prueba" ,
    type ,
    balance:        0 ,
    currency:       "ARS" ,
    entityId:       null ,
    createdAt:      new Date() ,
  } ) ;
}

/**
 * Suite de pruebas unitarias para la generación de códigos contables correlativos.
 */
describe( "getNextCode" , () => {
  it( "debería retornar el código '01' del prefijo correspondiente cuando no hay cuentas existentes" , () => {
    expect( getNextCode("asset" , []) ).toBe( "1.1.01.01" ) ;
  } ) ;

  it( "debería usar el prefijo correcto según el tipo de cuenta" , () => {
    expect( getNextCode("liability" , []) ).toBe( "2.1.01.01" ) ;
    expect( getNextCode("equity"    , []) ).toBe( "3.1.01.01" ) ;
    expect( getNextCode("revenue"   , []) ).toBe( "4.1.01.01" ) ;
    expect( getNextCode("expense"   , []) ).toBe( "5.1.01.01" ) ;
  } ) ;

  it( "debería usar un prefijo por defecto para un tipo de cuenta desconocido" , () => {
    expect( getNextCode("desconocido" , []) ).toBe( "9.9.99.01" ) ;
  } ) ;

  it( "debería incrementar el sufijo al correlativo siguiente" , () => {
    const existentes = [
      makeAccount( "1.1.01.01" , "asset" ) ,
      makeAccount( "1.1.01.02" , "asset" ) ,
    ] ;

    expect( getNextCode("asset" , existentes) ).toBe( "1.1.01.03" ) ;
  } ) ;

  it( "debería saltar sobre huecos y usar el sufijo máximo + 1" , () => {
    const existentes = [
      makeAccount( "1.1.01.01" , "asset" ) ,
      makeAccount( "1.1.01.05" , "asset" ) ,
    ] ;

    expect( getNextCode("asset" , existentes) ).toBe( "1.1.01.06" ) ;
  } ) ;

  it( "debería ignorar cuentas de otro tipo o con un prefijo distinto al calcular el correlativo" , () => {
    const existentes = [
      makeAccount( "1.1.01.09" , "asset" ) ,
      makeAccount( "2.1.01.09" , "liability" ) , // Mismo sufijo, tipo distinto: no debe afectar
    ] ;

    expect( getNextCode("liability" , existentes) ).toBe( "2.1.01.10" ) ;
  } ) ;

  it( "debería ignorar sufijos no numéricos sin lanzar excepción" , () => {
    const existentes = [
      makeAccount( "1.1.01.XX" , "asset" ) ,
      makeAccount( "1.1.01.03" , "asset" ) ,
    ] ;

    expect( getNextCode("asset" , existentes) ).toBe( "1.1.01.04" ) ;
  } ) ;

  it( "debería continuar incrementando más allá de dos dígitos (ej. de 99 a 100)" , () => {
    const existentes = [ makeAccount( "1.1.01.99" , "asset" ) ] ;

    expect( getNextCode("asset" , existentes) ).toBe( "1.1.01.100" ) ;
  } ) ;
} ) ;
