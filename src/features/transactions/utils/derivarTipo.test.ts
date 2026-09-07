// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Accounting
import { Account } from "@/features/accounting/types" ;

// Feature: Transactions
import { derivarTipoTransaccion , calcularResumenTransaccion } from "./derivarTipo" ;


function makeAccount( overrides: Partial<Account> ): Account {
  return( {
    id:             "acc-1" ,
    organizationId: "org-1" ,
    code:           "1.1.01.01" ,
    name:           "Cuenta de prueba" ,
    type:           "asset" ,
    balance:        0 ,
    currency:       "ARS" ,
    entityId:       null ,
    createdAt:      new Date() ,
    ...overrides ,
  } ) ;
}

describe( "derivarTipo" , () => {
  const accounts: Account[] = [
    makeAccount( { id: "acc-bank"    , type: "asset"     , name: "Banco Galicia" } ) ,
    makeAccount( { id: "acc-cash"    , type: "asset"     , name: "Efectivo" } ) ,
    makeAccount( { id: "acc-salary"  , type: "revenue"   , name: "Sueldo" } ) ,
    makeAccount( { id: "acc-food"    , type: "expense"   , name: "Supermercado" } ) ,
    makeAccount( { id: "acc-credit"  , type: "liability" , name: "Tarjeta Visa" } ) ,
  ] ;

  describe( "derivarTipoTransaccion" , () => {
    it( "debería clasificar como 'income' cuando una de las cuentas es de tipo revenue" , () => {
      const entries = [
        { accountId: "acc-bank"   , debit: 100000 , credit: 0      } ,
        { accountId: "acc-salary" , debit: 0      , credit: 100000 } ,
      ] ;

      const tipo = derivarTipoTransaccion( entries , accounts ) ;
      expect( tipo ).toBe( "income" ) ;
    } ) ;

    it( "debería clasificar como 'expense' cuando una de las cuentas es de tipo expense" , () => {
      const entries = [
        { accountId: "acc-food" , debit: 4500 , credit: 0    } ,
        { accountId: "acc-bank" , debit: 0    , credit: 4500 } ,
      ] ;

      const tipo = derivarTipoTransaccion( entries , accounts ) ;
      expect( tipo ).toBe( "expense" ) ;
    } ) ;

    it( "debería clasificar como 'transfer' cuando ambas cuentas son de balance (asset <-> asset)" , () => {
      const entries = [
        { accountId: "acc-cash" , debit: 10000 , credit: 0     } ,
        { accountId: "acc-bank" , debit: 0     , credit: 10000 } ,
      ] ;

      const tipo = derivarTipoTransaccion( entries , accounts ) ;
      expect( tipo ).toBe( "transfer" ) ;
    } ) ;

    it( "debería clasificar como 'transfer' cuando se paga un pasivo con activo (asset <-> liability)" , () => {
      const entries = [
        { accountId: "acc-credit" , debit: 20000 , credit: 0     } ,
        { accountId: "acc-bank"   , debit: 0     , credit: 20000 } ,
      ] ;

      const tipo = derivarTipoTransaccion( entries , accounts ) ;
      expect( tipo ).toBe( "transfer" ) ;
    } ) ;
  } ) ;

  describe( "calcularResumenTransaccion" , () => {
    it( "debería calcular el monto en centavos y cuenta de activo para ingresos" , () => {
      const entries = [
        { accountId: "acc-bank"   , debit: 150000 , credit: 0      } ,
        { accountId: "acc-salary" , debit: 0      , credit: 150000 } ,
      ] ;

      const resumen = calcularResumenTransaccion( entries , accounts ) ;
      expect( resumen.type ).toBe( "income" ) ;
      expect( resumen.amountInCents ).toBe( 150000 ) ;
      expect( resumen.primaryAccountId ).toBe( "acc-bank" ) ;
    } ) ;

    it( "debería calcular el monto en centavos y cuenta de origen para gastos" , () => {
      const entries = [
        { accountId: "acc-food" , debit: 8900 , credit: 0    } ,
        { accountId: "acc-bank" , debit: 0    , credit: 8900 } ,
      ] ;

      const resumen = calcularResumenTransaccion( entries , accounts ) ;
      expect( resumen.type ).toBe( "expense" ) ;
      expect( resumen.amountInCents ).toBe( 8900 ) ;
      expect( resumen.primaryAccountId ).toBe( "acc-bank" ) ;
    } ) ;

    it( "debería calcular cuentas origen y destino en transferencias" , () => {
      const entries = [
        { accountId: "acc-cash" , debit: 5000 , credit: 0    } ,
        { accountId: "acc-bank" , debit: 0    , credit: 5000 } ,
      ] ;

      const resumen = calcularResumenTransaccion( entries , accounts ) ;
      expect( resumen.type ).toBe( "transfer" ) ;
      expect( resumen.amountInCents ).toBe( 5000 ) ;
      expect( resumen.primaryAccountId ).toBe( "acc-bank" ) ;
      expect( resumen.counterpartAccountId ).toBe( "acc-cash" ) ;
      expect( resumen.currency ).toBe( "ARS" ) ;
    } ) ;

    it( "debería heredar la divisa de una cuenta en USD" , () => {
      const usdAccounts: Account[] = [
        makeAccount( { id: "acc-usd" , type: "asset" , name: "Caja Ahorro USD" , currency: "USD" } ) ,
        makeAccount( { id: "acc-exp" , type: "expense" , name: "Software USD" , currency: "USD" } ) ,
      ] ;
      const entries = [
        { accountId: "acc-exp" , debit: 2000 , credit: 0 } ,
        { accountId: "acc-usd" , debit: 0 , credit: 2000 } ,
      ] ;

      const resumen = calcularResumenTransaccion( entries , usdAccounts ) ;
      expect( resumen.currency ).toBe( "USD" ) ;
    } ) ;
  } ) ;
} ) ;
