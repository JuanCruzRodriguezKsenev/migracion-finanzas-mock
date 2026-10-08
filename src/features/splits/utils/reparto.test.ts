// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Splits
import { decidirReparto , calcularPesos , repartir , porcentajeComoTexto , porcentajeABp , importeACentavos , centavosComoTexto , porcentajesIguales , type EntradaDecision } from "./reparto" ;


/** Entrada que aplica; cada prueba rompe una sola condición. */
const base: EntradaDecision = {
  esGastoManual:            true ,
  tipo:                     "expense" ,
  modo:                     "fixed_percentages" ,
  cantidadMiembrosNoViewer: 2 ,
  algunaCuentaEsCajaComun:  false ,
  titularEsViewer:          false ,
} ;

describe( "decidirReparto - tabla de decisión" , () => {
  it( "fila 1: un gasto no manual no se reparte" , () => {
    expect( decidirReparto( { ...base , esGastoManual: false } ) ).toEqual( { aplica: false , motivo: "no_manual" } ) ;
  } ) ;

  it( "fila 1: un movimiento que no es gasto no se reparte" , () => {
    for( const tipo of [ "income" , "transfer" , "exchange" ] ) {
      expect( decidirReparto( { ...base , tipo } ).motivo ).toBe( "no_manual" ) ;
    }
  } ) ;

  it( "fila 2: modo none" , () => {
    expect( decidirReparto( { ...base , modo: "none" } ) ).toEqual( { aplica: false , motivo: "modo_none" } ) ;
  } ) ;

  it( "fila 3: menos de dos miembros no viewer" , () => {
    expect( decidirReparto( { ...base , cantidadMiembrosNoViewer: 1 } ) ).toEqual( { aplica: false , motivo: "pocos_miembros" } ) ;
  } ) ;

  it( "fila 4: alguna cuenta es caja común" , () => {
    expect( decidirReparto( { ...base , algunaCuentaEsCajaComun: true } ) ).toEqual( { aplica: false , motivo: "caja_comun" } ) ;
  } ) ;

  it( "fila 5: titular viewer" , () => {
    expect( decidirReparto( { ...base , titularEsViewer: true } ) ).toEqual( { aplica: false , motivo: "titular_viewer" } ) ;
  } ) ;

  it( "fila 6: aplica" , () => {
    expect( decidirReparto( base ) ).toEqual( { aplica: true , motivo: "aplica" } ) ;
    expect( decidirReparto( { ...base , modo: "monthly_contributions" } ).aplica ).toBe( true ) ;
  } ) ;

  it( "el orden importa: caja común + titular viewer da caja_comun (la fila 4 gana a la 5)" , () => {
    expect( decidirReparto( { ...base , algunaCuentaEsCajaComun: true , titularEsViewer: true } ).motivo ).toBe( "caja_comun" ) ;
  } ) ;

  it( "el orden importa: modo none gana a pocos miembros, y no manual gana a todo" , () => {
    expect( decidirReparto( { ...base , modo: "none" , cantidadMiembrosNoViewer: 1 } ).motivo ).toBe( "modo_none" ) ;
    expect( decidirReparto( { ...base , esGastoManual: false , modo: "none" } ).motivo ).toBe( "no_manual" ) ;
  } ) ;

  it( "AC-13 / AC-16: absorbe con todo aplicable devuelve motivo absorbido y aplica false" , () => {
    expect( decidirReparto( { ...base , absorbe: true } ) ).toEqual( { aplica: false , motivo: "absorbido" } ) ;
  } ) ;

  it( "AC-13 / AC-16: absorbe con modo none devuelve modo_none (no absorbido)" , () => {
    expect( decidirReparto( { ...base , modo: "none" , absorbe: true } ) ).toEqual( { aplica: false , motivo: "modo_none" } ) ;
  } ) ;

  it( "absorbe false deja aplicar el reparto normalmente" , () => {
    expect( decidirReparto( { ...base , absorbe: false } ) ).toEqual( { aplica: true , motivo: "aplica" } ) ;
  } ) ;
} ) ;

describe( "calcularPesos" , () => {
  const miembros = [ "ana" , "beto" ] ;
  const mes      = { year: 2026 , month: 10 } ;

  it( "porcentajes: el peso es el porcentaje; sin fila cuenta como 0 (S-S)" , () => {
    const r = calcularPesos( { modo: "fixed_percentages" , miembros: [ "ana" , "beto" , "caro" ] , porcentajesBp: new Map( [ [ "ana" , 6000 ] , [ "beto" , 4000 ] ] ) , aportes: [] , mes } ) ;

    expect( [ ...r.pesos ] ).toEqual( [ [ "ana" , 6000 ] , [ "beto" , 4000 ] , [ "caro" , 0 ] ] ) ;
    expect( r.partesIguales ).toBe( false ) ;
  } ) ;

  it( "AC-10: sin aporte del mes usa el último anterior" , () => {
    const aportes = [
      { userId: "ana"  , year: 2026 , month: 7 , amountInCents: 100 } ,
      { userId: "ana"  , year: 2026 , month: 8 , amountInCents: 600 } ,
      { userId: "beto" , year: 2026 , month: 9 , amountInCents: 400 } ,
    ] ;
    const r = calcularPesos( { modo: "monthly_contributions" , miembros , porcentajesBp: new Map() , aportes , mes } ) ;

    expect( r.pesos.get( "ana" ) ).toBe( 600 ) ;
    expect( r.pesos.get( "beto" ) ).toBe( 400 ) ;
    expect( r.partesIguales ).toBe( false ) ;
  } ) ;

  it( "usa el aporte del mes aunque haya otro posterior (un mes futuro no cuenta)" , () => {
    const aportes = [
      { userId: "ana" , year: 2026 , month: 10 , amountInCents: 700 } ,
      { userId: "ana" , year: 2026 , month: 11 , amountInCents: 900 } ,
    ] ;
    const r = calcularPesos( { modo: "monthly_contributions" , miembros: [ "ana" ] , porcentajesBp: new Map() , aportes , mes } ) ;

    expect( r.pesos.get( "ana" ) ).toBe( 700 ) ;
  } ) ;

  it( "AC-11: nadie declaró jamás: partes iguales con aviso" , () => {
    const r = calcularPesos( { modo: "monthly_contributions" , miembros , porcentajesBp: new Map() , aportes: [] , mes } ) ;

    expect( r.partesIguales ).toBe( true ) ;
    expect( r.pesos.get( "ana" ) ).toBe( r.pesos.get( "beto" ) ) ;
  } ) ;

  it( "S-T: un miembro que nunca declaró pesa 0 cuando otros sí" , () => {
    const r = calcularPesos( { modo: "monthly_contributions" , miembros , porcentajesBp: new Map() , aportes: [ { userId: "ana" , year: 2026 , month: 9 , amountInCents: 500 } ] , mes } ) ;

    expect( r.pesos.get( "beto" ) ).toBe( 0 ) ;
    expect( r.partesIguales ).toBe( false ) ;
  } ) ;
} ) ;

describe( "repartir" , () => {
  const suma = ( r: ReturnType< typeof repartir > ) => r.deudas.reduce( ( s , d ) => ( s + d.montoEnCentavos ) , r.parteTitular ) ;

  it( "AC-8: 10001 centavos al 50/50: Beto 5000, el titular 5001" , () => {
    const r = repartir( { montoEnCentavos: 10001 , titularId: "ana" , pesos: new Map( [ [ "ana" , 5000 ] , [ "beto" , 5000 ] ] ) } ) ;

    expect( r.deudas ).toEqual( [ { userId: "beto" , montoEnCentavos: 5000 } ] ) ;
    expect( r.parteTitular ).toBe( 5001 ) ;
  } ) ;

  it( "AC-9: aportes 60/40 -> deuda 400000; 50/50 -> 500000; 100/0 -> 0 (sin fila)" , () => {
    const caso = ( a: number , b: number ) => repartir( { montoEnCentavos: 1000000 , titularId: "ana" , pesos: new Map( [ [ "ana" , a ] , [ "beto" , b ] ] ) } ) ;

    expect( caso( 60000000 , 40000000 ).deudas ).toEqual( [ { userId: "beto" , montoEnCentavos: 400000 } ] ) ;
    expect( caso( 50000000 , 50000000 ).deudas ).toEqual( [ { userId: "beto" , montoEnCentavos: 500000 } ] ) ;
    expect( caso( 100 , 0 ).deudas ).toEqual( [] ) ;
    expect( caso( 100 , 0 ).parteTitular ).toBe( 1000000 ) ;
  } ) ;

  it( "A7: tres partes iguales de 100 centavos: los no titulares 33 y 33, el titular 34" , () => {
    const r = repartir( { montoEnCentavos: 100 , titularId: "ana" , pesos: new Map( [ [ "ana" , 1 ] , [ "beto" , 1 ] , [ "caro" , 1 ] ] ) } ) ;

    expect( r.deudas.map( ( d ) => d.montoEnCentavos ) ).toEqual( [ 33 , 33 ] ) ;
    expect( r.parteTitular ).toBe( 34 ) ;
  } ) ;

  it( "un monto grande (producto mayor a 2^53) no pierde precisión" , () => {
    const monto = 9_000_000_000_000 ; // 90 mil millones de pesos, en centavos
    const r     = repartir( { montoEnCentavos: monto , titularId: "ana" , pesos: new Map( [ [ "ana" , 5000_0000_0000 ] , [ "beto" , 5000_0000_0000 ] ] ) } ) ;

    expect( monto * 5000_0000_0000 ).toBeGreaterThan( Number.MAX_SAFE_INTEGER ) ;
    expect( r.deudas ).toEqual( [ { userId: "beto" , montoEnCentavos: 4_500_000_000_000 } ] ) ;
    expect( suma( r ) ).toBe( monto ) ;
  } ) ;

  it( "la suma es siempre exacta, con muchos montos y pesos" , () => {
    const pesos = new Map( [ [ "ana" , 3333 ] , [ "beto" , 3333 ] , [ "caro" , 3334 ] ] ) ;

    for( let monto = 1 ; monto < 400 ; monto++ ) {
      expect( suma( repartir( { montoEnCentavos: monto , titularId: "caro" , pesos } ) ) ).toBe( monto ) ;
    }
  } ) ;

  it( "las deudas de 0 no se devuelven" , () => {
    const r = repartir( { montoEnCentavos: 1 , titularId: "ana" , pesos: new Map( [ [ "ana" , 1 ] , [ "beto" , 1 ] ] ) } ) ;

    expect( r.deudas ).toEqual( [] ) ;
    expect( r.parteTitular ).toBe( 1 ) ;
  } ) ;
} ) ;

describe( "conversiones de porcentajes e importes" , () => {
  it( "porcentajeComoTexto y porcentajeABp son inversas con hasta dos decimales" , () => {
    expect( porcentajeComoTexto( 9000 ) ).toBe( "90" ) ;
    expect( porcentajeComoTexto( 3333 ) ).toBe( "33,33" ) ;
    expect( porcentajeComoTexto( 1050 ) ).toBe( "10,5" ) ;
    expect( porcentajeABp( "33,33" ) ).toBe( 3333 ) ;
    expect( porcentajeABp( "33.3" ) ).toBe( 3330 ) ;
    expect( porcentajeABp( "100" ) ).toBe( 10000 ) ;
    expect( porcentajeABp( "100,01" ) ).toBeNull() ;
    expect( porcentajeABp( "abc" ) ).toBeNull() ;
    expect( porcentajeABp( "1,234" ) ).toBeNull() ;
  } ) ;

  it( "importeACentavos no pasa por punto flotante y rechaza lo inválido" , () => {
    expect( importeACentavos( "600000,50" ) ).toBe( 60000050 ) ;
    expect( importeACentavos( "0,1" ) ).toBe( 10 ) ;
    expect( importeACentavos( "-5" ) ).toBeNull() ;
    expect( importeACentavos( "1,234" ) ).toBeNull() ;
    expect( centavosComoTexto( 60000050 ) ).toBe( "600000,50" ) ;
    expect( centavosComoTexto( 5 ) ).toBe( "0,05" ) ;
  } ) ;

  it( "porcentajesIguales suma siempre 10000" , () => {
    for( const n of [ 1 , 2 , 3 , 7 ] ) {
      expect( porcentajesIguales( n ).reduce( ( s , v ) => ( s + v ) , 0 ) ).toBe( 10000 ) ;
    }
    expect( porcentajesIguales( 3 ) ).toEqual( [ 3334 , 3333 , 3333 ] ) ;
  } ) ;
} ) ;
