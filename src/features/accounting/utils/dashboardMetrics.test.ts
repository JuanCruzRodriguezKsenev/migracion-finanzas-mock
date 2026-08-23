// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Accounting
import {
  formatCents ,
  calcularBalanceTotal ,
  calcularIngresosMes ,
  calcularGastosMes ,
  calcularSparklineBalance ,
  calcularSparklineIngresos ,
  calcularSparklineGastos ,
  calcularSparklineAhorro ,
  calcularTendenciaDesdeSparkline
} from "./dashboardMetrics" ;
import type { TransactionWithEntries } from "../repositories/ledgerRepository" ;
import type { Account , MonthlySummary , LedgerEntry } from "../types" ;


// ── Fixtures mínimas ──────────────────────────────────────────────────────

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

function makeEntry( overrides: Partial<LedgerEntry> ): LedgerEntry {
  return( {
    id:            "entry-1" ,
    transactionId: "tx-1" ,
    accountId:     "acc-1" ,
    debit:         0 ,
    credit:        0 ,
    currency:      "ARS" ,
    createdAt:     new Date() ,
    ...overrides ,
  } ) ;
}

function makeTransaction( overrides: Partial<TransactionWithEntries> ): TransactionWithEntries {
  return( {
    id:             "tx-1" ,
    organizationId: "org-1" ,
    categoryId:     null ,
    description:    "Transacción de prueba" ,
    merchantName:   null ,
    merchantDomain: null ,
    createdAt:      new Date() ,
    entries:        [] ,
    ...overrides ,
  } ) ;
}

function makeSummary( overrides: Partial<MonthlySummary> ): MonthlySummary {
  return( {
    id:              "summary-1" ,
    organizationId:  "org-1" ,
    year:            2026 ,
    month:           0 ,
    totalRevenue:    0 ,
    totalExpense:    0 ,
    balanceSnapshot: 0 ,
    createdAt:       new Date() ,
    ...overrides ,
  } ) ;
}


describe( "dashboardMetrics" , () => {
  describe( "formatCents" , () => {
    it( "debería formatear montos positivos con el prefijo '$' y formato es-AR" , () => {
      expect( formatCents(150000) ).toBe( "$1.500,00" ) ;
    } ) ;

    it( "debería formatear montos negativos con el prefijo '-$'" , () => {
      expect( formatCents(-150000) ).toBe( "-$1.500,00" ) ;
    } ) ;

    it( "debería formatear cero correctamente" , () => {
      expect( formatCents(0) ).toBe( "$0,00" ) ;
    } ) ;
  } ) ;

  describe( "calcularBalanceTotal" , () => {
    it( "debería retornar 0 con un array de cuentas vacío" , () => {
      expect( calcularBalanceTotal([]) ).toBe( 0 ) ;
    } ) ;

    it( "debería sumar únicamente las cuentas de tipo 'asset', ignorando otros tipos" , () => {
      const accounts = [
        makeAccount( {type: "asset"     , balance: 10000} ) ,
        makeAccount( {type: "asset"     , balance: 5000} ) ,
        makeAccount( {type: "liability" , balance: -3000} ) ,
        makeAccount( {type: "revenue"   , balance: 20000} ) ,
      ] ;

      expect( calcularBalanceTotal(accounts) ).toBe( 15000 ) ;
    } ) ;
  } ) ;

  describe( "calcularIngresosMes" , () => {
    const referenceDate = new Date( 2026 , 5 , 15 ) ; // Junio 2026

    it( "debería retornar 0 sin transacciones" , () => {
      expect( calcularIngresosMes([] , [] , referenceDate) ).toBe( 0 ) ;
    } ) ;

    it( "debería sumar solo los créditos de cuentas 'revenue' dentro del mes de referencia" , () => {
      const accounts = [ makeAccount( {id: "rev-1" , type: "revenue"} ) ] ;
      const transactions = [
        makeTransaction( {
          createdAt: referenceDate ,
          entries: [ makeEntry( {accountId: "rev-1" , credit: 5000} ) ] ,
        } ) ,
      ] ;

      expect( calcularIngresosMes(transactions , accounts , referenceDate) ).toBe( 5000 ) ;
    } ) ;

    it( "debería ignorar transacciones fuera del mes de referencia" , () => {
      const accounts = [ makeAccount( {id: "rev-1" , type: "revenue"} ) ] ;
      const mesAnterior = new Date( 2026 , 4 , 20 ) ;
      const transactions = [
        makeTransaction( {
          createdAt: mesAnterior ,
          entries: [ makeEntry( {accountId: "rev-1" , credit: 5000} ) ] ,
        } ) ,
      ] ;

      expect( calcularIngresosMes(transactions , accounts , referenceDate) ).toBe( 0 ) ;
    } ) ;

    it( "debería ignorar créditos en cuentas que no son de tipo 'revenue'" , () => {
      const accounts = [ makeAccount( {id: "asset-1" , type: "asset"} ) ] ;
      const transactions = [
        makeTransaction( {
          createdAt: referenceDate ,
          entries: [ makeEntry( {accountId: "asset-1" , credit: 5000} ) ] ,
        } ) ,
      ] ;

      expect( calcularIngresosMes(transactions , accounts , referenceDate) ).toBe( 0 ) ;
    } ) ;
  } ) ;

  describe( "calcularGastosMes" , () => {
    const referenceDate = new Date( 2026 , 5 , 15 ) ;

    it( "debería sumar solo los débitos de cuentas 'expense' dentro del mes de referencia" , () => {
      const accounts = [ makeAccount( {id: "exp-1" , type: "expense"} ) ] ;
      const transactions = [
        makeTransaction( {
          createdAt: referenceDate ,
          entries: [ makeEntry( {accountId: "exp-1" , debit: 3000} ) ] ,
        } ) ,
      ] ;

      expect( calcularGastosMes(transactions , accounts , referenceDate) ).toBe( 3000 ) ;
    } ) ;
  } ) ;

  describe( "calcularSparklineBalance" , () => {
    it( "debería rellenar con ceros al inicio cuando faltan meses históricos" , () => {
      const accounts = [ makeAccount( {type: "asset" , balance: 40000} ) ] ; // $400 actual
      const monthlySummaries = [
        makeSummary( {balanceSnapshot: 30000} ) , // mes más reciente anterior ($300)
        makeSummary( {balanceSnapshot: 20000} ) , // mes más antiguo disponible ($200)
      ] ;

      const serie = calcularSparklineBalance( monthlySummaries , accounts , 5 ) ;

      expect( serie ).toEqual( [ 0 , 0 , 200 , 300 , 400 ] ) ;
    } ) ;

    it( "no debería rellenar con ceros cuando hay suficiente historial" , () => {
      const accounts = [ makeAccount( {type: "asset" , balance: 40000} ) ] ;
      const monthlySummaries = [
        makeSummary( {balanceSnapshot: 30000} ) ,
        makeSummary( {balanceSnapshot: 20000} ) ,
      ] ;

      const serie = calcularSparklineBalance( monthlySummaries , accounts , 3 ) ;

      expect( serie ).toEqual( [ 200 , 300 , 400 ] ) ;
    } ) ;
  } ) ;

  describe( "calcularSparklineIngresos / Gastos / Ahorro" , () => {
    const monthlySummaries = [
      makeSummary( {totalRevenue: 30000 , totalExpense: 10000} ) ,
    ] ;

    it( "calcularSparklineIngresos debería anexar el valor del mes actual al final" , () => {
      const serie = calcularSparklineIngresos( monthlySummaries , 50000 , 2 ) ;
      expect( serie ).toEqual( [ 300 , 500 ] ) ;
    } ) ;

    it( "calcularSparklineGastos debería anexar el valor del mes actual al final" , () => {
      const serie = calcularSparklineGastos( monthlySummaries , 15000 , 2 ) ;
      expect( serie ).toEqual( [ 100 , 150 ] ) ;
    } ) ;

    it( "calcularSparklineAhorro debería calcular ingresos menos gastos por mes" , () => {
      const serie = calcularSparklineAhorro( monthlySummaries , 20000 , 2 ) ;
      expect( serie ).toEqual( [ 200 , 200 ] ) ; // (30000-10000)/100 = 200 histórico, 20000/100 = 200 actual
    } ) ;
  } ) ;

  describe( "calcularTendenciaDesdeSparkline" , () => {
    it( "debería retornar el valor por defecto con menos de 2 puntos de datos" , () => {
      expect( calcularTendenciaDesdeSparkline([]) ).toEqual( {value: "0.0%" , isPositive: true , isRising: true} ) ;
      expect( calcularTendenciaDesdeSparkline([100]) ).toEqual( {value: "0.0%" , isPositive: true , isRising: true} ) ;
    } ) ;

    it( "debería manejar de forma segura un punto anterior en cero (sin dividir por cero)" , () => {
      expect( calcularTendenciaDesdeSparkline([0 , 100]) ).toEqual( {value: "100.0%" , isPositive: true , isRising: true} ) ;
      expect( calcularTendenciaDesdeSparkline([0 , 0]) ).toEqual( {value: "0.0%" , isPositive: false , isRising: false} ) ;
    } ) ;

    it( "debería calcular el porcentaje de cambio entre los dos últimos puntos" , () => {
      const resultado = calcularTendenciaDesdeSparkline( [100 , 150] ) ;

      expect( resultado.value ).toBe( "50.0%" ) ;
      expect( resultado.isPositive ).toBe( true ) ;
      expect( resultado.isRising ).toBe( true ) ;
    } ) ;

    it( "debería invertir la interpretación de positivo/negativo cuando isInverted es true" , () => {
      // Un aumento (isRising=true) en una métrica invertida (ej. gastos) es una mala señal (isPositive=false)
      const resultado = calcularTendenciaDesdeSparkline( [100 , 150] , true ) ;

      expect( resultado.isRising ).toBe( true ) ;
      expect( resultado.isPositive ).toBe( false ) ;
    } ) ;

    it( "debería calcular correctamente una caída (valor negativo)" , () => {
      const resultado = calcularTendenciaDesdeSparkline( [200 , 100] ) ;

      expect( resultado.value ).toBe( "50.0%" ) ;
      expect( resultado.isPositive ).toBe( false ) ;
      expect( resultado.isRising ).toBe( false ) ;
    } ) ;
  } ) ;
} ) ;
