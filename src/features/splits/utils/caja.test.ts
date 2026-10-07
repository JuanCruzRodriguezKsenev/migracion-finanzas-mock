// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Splits
import { calcularParticipaciones } from "./caja" ;


const ana  = "ana" ;
const beto = "beto" ;
const caro = "caro" ;

describe( "calcularParticipaciones" , () => {
  it( "AC-23: 300.000 y 100.000 dan 75,0 % y 25,0 %; con un retiro de 100.000 de Ana, 66,66 % y 33,33 %" , () => {
    const aportes = [
      { userId: ana  , monto: 30000000 , divisa: "ARS" } ,
      { userId: beto , monto: 10000000 , divisa: "ARS" } ,
    ] ;

    expect( calcularParticipaciones( aportes )[ 0 ].filas.map( ( f ) => [ f.userId , f.bp ] ) ).toEqual( [ [ ana , 7500 ] , [ beto , 2500 ] ] ) ;

    const conRetiro = calcularParticipaciones( [ ...aportes , { userId: ana , monto: -10000000 , divisa: "ARS" } ] ) ;

    expect( conRetiro[ 0 ].total ).toBe( 30000000 ) ;
    expect( conRetiro[ 0 ].filas.map( ( f ) => [ f.userId , f.neto , f.bp ] ) ).toEqual( [ [ ana , 20000000 , 6666 ] , [ beto , 10000000 , 3333 ] ] ) ;
  } ) ;

  it( "separa por divisa y no compensa entre ellas" , () => {
    const res = calcularParticipaciones( [
      { userId: ana  , monto: 1000 , divisa: "USD" } ,
      { userId: beto , monto: 3000 , divisa: "USD" } ,
      { userId: ana  , monto: 5000 , divisa: "ARS" } ,
    ] ) ;

    expect( res.map( ( p ) => p.divisa ) ).toEqual( [ "ARS" , "USD" ] ) ;
    expect( res[ 0 ].filas ).toEqual( [ { userId: ana , neto: 5000 , bp: 10000 } ] ) ;
    expect( res[ 1 ].filas.map( ( f ) => f.bp ) ).toEqual( [ 7500 , 2500 ] ) ;
  } ) ;

  it( "omite a quien quedó en cero y a la divisa donde todos quedaron en cero" , () => {
    const res = calcularParticipaciones( [
      { userId: ana  , monto: 1000  , divisa: "ARS" } ,
      { userId: beto , monto: 500   , divisa: "ARS" } ,
      { userId: beto , monto: -500  , divisa: "ARS" } ,
      { userId: caro , monto: 700   , divisa: "USD" } ,
      { userId: caro , monto: -700  , divisa: "USD" } ,
    ] ) ;

    expect( res ).toHaveLength( 1 ) ;
    expect( res[ 0 ].filas.map( ( f ) => f.userId ) ).toEqual( [ ana ] ) ;
  } ) ;

  it( "agrega a los ex miembros (userId nulo) en una sola fila, al final" , () => {
    const res = calcularParticipaciones( [
      { userId: null , monto: 1000 , divisa: "ARS" } ,
      { userId: ana  , monto: 1000 , divisa: "ARS" } ,
      { userId: null , monto: 2000 , divisa: "ARS" } ,
    ] ) ;

    expect( res[ 0 ].total ).toBe( 4000 ) ;
    expect( res[ 0 ].filas ).toEqual( [
      { userId: ana  , neto: 1000 , bp: 2500 } ,
      { userId: null , neto: 3000 , bp: 7500 } ,
    ] ) ;
  } ) ;

  it( "con total menor o igual a cero no hay porcentajes" , () => {
    const res = calcularParticipaciones( [
      { userId: ana  , monto: 1000 , divisa: "ARS" } ,
      { userId: beto , monto: -1000 , divisa: "ARS" } ,
      { userId: caro , monto: -500 , divisa: "ARS" } ,
    ] ) ;

    expect( res[ 0 ].total ).toBe( -500 ) ;
    expect( res[ 0 ].filas.every( ( f ) => (f.bp === null) ) ).toBe( true ) ;
  } ) ;

  it( "redondea hacia abajo con BigInt, sin perder precisión con montos grandes" , () => {
    const grande = 9007199254740 ; // ~ 9×10¹² centavos
    const res    = calcularParticipaciones( [
      { userId: ana  , monto: grande     , divisa: "ARS" } ,
      { userId: beto , monto: grande * 2 , divisa: "ARS" } ,
    ] ) ;

    expect( res[ 0 ].filas.map( ( f ) => f.bp ) ).toEqual( [ 6666 , 3333 ] ) ;
  } ) ;

  it( "sin aportes no hay participaciones" , () => {
    expect( calcularParticipaciones( [] ) ).toEqual( [] ) ;
  } ) ;
} ) ;
