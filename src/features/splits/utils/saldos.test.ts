// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Splits
import { calcularSaldos } from "./saldos" ;


const ana  = "ana" ;
const beto = "beto" ;
const caro = "caro" ;

describe( "calcularSaldos" , () => {
  it( "AC-17: no compensa divisas y resta lo que Ana le debe a Beto" , () => {
    const saldos = calcularSaldos(
      ana ,
      [
        { acreedorId: ana  , deudorId: beto , monto: 480000 , divisa: "ARS" } ,
        { acreedorId: ana  , deudorId: beto , monto: 2000   , divisa: "USD" } ,
        { acreedorId: beto , deudorId: ana  , monto: 180000 , divisa: "ARS" } ,
      ] ,
      []
    ) ;

    expect( saldos ).toEqual( [
      { contraparteId: beto , divisa: "ARS" , montoEnCentavos: 300000 } ,
      { contraparteId: beto , divisa: "USD" , montoEnCentavos: 2000 } ,
    ] ) ;
  } ) ;

  it( "un pago del deudor baja el saldo; uno mayor lo invierte" , () => {
    const deudas = [ { acreedorId: ana , deudorId: beto , monto: 100000 , divisa: "ARS" } ] ;

    expect( calcularSaldos( ana , deudas , [ { deId: beto , aId: ana , monto: 40000 , divisa: "ARS" } ] ) )
      .toEqual( [ { contraparteId: beto , divisa: "ARS" , montoEnCentavos: 60000 } ] ) ;
    expect( calcularSaldos( ana , deudas , [ { deId: beto , aId: ana , monto: 150000 , divisa: "ARS" } ] ) )
      .toEqual( [ { contraparteId: beto , divisa: "ARS" , montoEnCentavos: -50000 } ] ) ;
  } ) ;

  it( "omite los saldos en cero" , () => {
    const saldos = calcularSaldos(
      ana ,
      [ { acreedorId: ana , deudorId: beto , monto: 500 , divisa: "ARS" } ] ,
      [ { deId: beto , aId: ana , monto: 500 , divisa: "ARS" } ]
    ) ;

    expect( saldos ).toEqual( [] ) ;
  } ) ;

  it( "mira desde el deudor: el saldo es negativo" , () => {
    const saldos = calcularSaldos( beto , [ { acreedorId: ana , deudorId: beto , monto: 700 , divisa: "ARS" } ] , [] ) ;

    expect( saldos ).toEqual( [ { contraparteId: ana , divisa: "ARS" , montoEnCentavos: -700 } ] ) ;
  } ) ;

  it( "agrega todos los extremos nulos en una sola contraparte (S-AE)" , () => {
    const saldos = calcularSaldos(
      ana ,
      [
        { acreedorId: ana  , deudorId: null , monto: 300 , divisa: "ARS" } ,
        { acreedorId: ana  , deudorId: null , monto: 200 , divisa: "ARS" } ,
        { acreedorId: null , deudorId: ana  , monto: 100 , divisa: "ARS" } ,
      ] ,
      [ { deId: null , aId: ana , monto: 50 , divisa: "ARS" } ]
    ) ;

    expect( saldos ).toEqual( [ { contraparteId: null , divisa: "ARS" , montoEnCentavos: 350 } ] ) ;
  } ) ;

  it( "ignora las filas ajenas al usuario y ordena por divisa y monto absoluto" , () => {
    const saldos = calcularSaldos(
      ana ,
      [
        { acreedorId: beto , deudorId: caro , monto: 999 , divisa: "ARS" } ,
        { acreedorId: ana  , deudorId: beto , monto: 100 , divisa: "USD" } ,
        { acreedorId: caro , deudorId: ana  , monto: 900 , divisa: "ARS" } ,
        { acreedorId: ana  , deudorId: beto , monto: 300 , divisa: "ARS" } ,
      ] ,
      []
    ) ;

    expect( saldos.map( ( s ) => [ s.divisa , s.contraparteId , s.montoEnCentavos ] ) ).toEqual( [
      [ "ARS" , caro  , -900 ] ,
      [ "ARS" , beto  , 300 ] ,
      [ "USD" , beto  , 100 ] ,
    ] ) ;
  } ) ;
} ) ;
