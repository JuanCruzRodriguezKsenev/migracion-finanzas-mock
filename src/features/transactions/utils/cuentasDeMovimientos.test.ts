/**
 * @file cuentasDeMovimientos.test.ts
 * Fusión de las personales referenciadas por cada página de movimientos y armado del mapa de cuentas.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Accounting
import type { CuentaPersonalReferenciada } from "@/features/accounting/repositories/ledgerRepository" ;
import type { CuentaReferenciada }         from "@/features/accounting/types" ;

// Feature: Transactions
import { fusionarPersonales , cuentasParaMovimientos } from "./cuentasDeMovimientos" ;
import { derivarTipoTransaccion }                      from "./derivarTipo" ;


function personal( id: string , compartida: boolean ): CuentaPersonalReferenciada {
  return( {id , code: id , name: `Cuenta ${id}` , type: "asset" , currency: "ARS" , ownerUserId: "u" , compartida} ) ;
}

describe( "fusionarPersonales" , () => {
  it( "suma las nuevas sin duplicar por id" , () => {
    const res = fusionarPersonales( [ personal( "a" , true ) ] , [ personal( "a" , true ) , personal( "b" , true ) ] ) ;

    expect( res.map( ( c ) => c.id ) ).toEqual( [ "a" , "b" ] ) ;
  } ) ;

  it( "si una vuelve a llegar gana la versión nueva (hoy ya no se comparte)" , () => {
    const res = fusionarPersonales( [ personal( "a" , true ) ] , [ personal( "a" , false ) ] ) ;

    expect( res ).toHaveLength( 1 ) ;
    expect( res[0].compartida ).toBe( false ) ;
  } ) ;
} ) ;

describe( "cuentasParaMovimientos" , () => {
  const gasto: CuentaReferenciada = {id: "g" , code: "5" , name: "Gasto" , type: "expense" , currency: "ARS"} ;

  it( "las personales entran sin saldo y con su marca de compartida" , () => {
    const res = cuentasParaMovimientos( [ gasto ] , [ personal( "a" , false ) ] ) ;
    const a   = res.find( ( c ) => c.id === "a" )! ;

    expect( a.compartida ).toBe( false ) ;
    expect( "balance" in a ).toBe( false ) ;
  } ) ;

  it( "si una id está entre las de la organización, esa gana" , () => {
    const res = cuentasParaMovimientos( [ {...gasto , id: "a" , name: "De la lista"} ] , [ personal( "a" , true ) ] ) ;

    expect( res ).toHaveLength( 1 ) ;
    expect( res[0].name ).toBe( "De la lista" ) ;
  } ) ;

  it( "con la personal en el mapa el movimiento se clasifica; sin ella cae a transferencia" , () => {
    const entradas = [
      {accountId: "a" , debit: 0    , credit: 100} ,
      {accountId: "g" , debit: 100  , credit: 0} ,
    ] ;

    expect( derivarTipoTransaccion( entradas , cuentasParaMovimientos( [ gasto ] , [ personal( "a" , true ) ] ) ) ).toBe( "expense" ) ;
    expect( derivarTipoTransaccion( entradas , [ gasto ] ) ).toBe( "expense" ) ;
    expect( derivarTipoTransaccion( [ {accountId: "a" , debit: 0 , credit: 100} , {accountId: "x" , debit: 100 , credit: 0} ] , [] ) ).toBe( "transfer" ) ;
  } ) ;
} ) ;
