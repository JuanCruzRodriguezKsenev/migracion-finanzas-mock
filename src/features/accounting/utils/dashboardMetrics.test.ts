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
    cbuCvu:         null ,
    alias:          null ,
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
  const date = overrides.occurredAt ?? overrides.createdAt ?? new Date() ;
  return( {
    id:             "tx-1" ,
    organizationId: "org-1" ,
    categoryId:     null ,
    description:    "Transacción de prueba" ,
    merchantName:   null ,
    merchantDomain: null ,
    createdAt:      date ,
    occurredAt:     date ,
    reversesTransactionId: null ,
    reversedAt:            null ,
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
    totalExpense:        0 ,
    balanceSnapshot:     0 ,
    assetsSnapshot:      0 ,
    liabilitiesSnapshot: 0 ,
    createdAt:           new Date() ,
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
    const refDate = new Date( 2026 , 2 , 15 ) ; // Marzo 2026

    it( "debería retornar solo los meses existentes ordenados cronológicamente sin rellenar con ceros ficticios" , () => {
      const accounts = [ makeAccount( {type: "asset" , balance: 40000} ) ] ; // $400 actual
      const monthlySummaries = [
        makeSummary( {year: 2026 , month: 1 , balanceSnapshot: 30000} ) , // Feb 2026 ($300)
        makeSummary( {year: 2026 , month: 0 , balanceSnapshot: 20000} ) , // Ene 2026 ($200)
      ] ;

      const serie = calcularSparklineBalance( monthlySummaries , accounts , 5 , refDate ) ;

      expect( serie ).toEqual( [
        { value: 200 , monthKey: "2026-01" } ,
        { value: 300 , monthKey: "2026-02" } ,
        { value: 400 , monthKey: "2026-03" }
      ] ) ;
    } ) ;

    it( "debería respetar el límite de meses" , () => {
      const accounts = [ makeAccount( {type: "asset" , balance: 40000} ) ] ;
      const monthlySummaries = [
        makeSummary( {year: 2026 , month: 1 , balanceSnapshot: 30000} ) ,
        makeSummary( {year: 2026 , month: 0 , balanceSnapshot: 20000} ) ,
      ] ;

      const serie = calcularSparklineBalance( monthlySummaries , accounts , 2 , refDate ) ;

      expect( serie ).toEqual( [
        { value: 300 , monthKey: "2026-02" } ,
        { value: 400 , monthKey: "2026-03" }
      ] ) ;
    } ) ;

    it( "debería manejar series discontinuas con huecos preservando monthKey exactos" , () => {
      const accounts = [ makeAccount( {type: "asset" , balance: 50000} ) ] ;
      const monthlySummaries = [
        makeSummary( {year: 2025 , month: 11 , balanceSnapshot: 10000} ) , // Dic 2025
      ] ;

      const serie = calcularSparklineBalance( monthlySummaries , accounts , 6 , refDate ) ;

      expect( serie ).toEqual( [
        { value: 100 , monthKey: "2025-12" } ,
        { value: 500 , monthKey: "2026-03" }
      ] ) ;
    } ) ;
  } ) ;

  describe( "calcularSparklineIngresos / Gastos / Ahorro" , () => {
    const refDate = new Date( 2026 , 1 , 15 ) ; // Feb 2026
    const monthlySummaries = [
      makeSummary( {year: 2026 , month: 0 , totalRevenue: 30000 , totalExpense: 10000} ) ,
    ] ;

    it( "calcularSparklineIngresos debería anexar el valor del mes actual al final con monthKey" , () => {
      const serie = calcularSparklineIngresos( monthlySummaries , 50000 , 5 , refDate ) ;
      expect( serie ).toEqual( [
        { value: 300 , monthKey: "2026-01" } ,
        { value: 500 , monthKey: "2026-02" }
      ] ) ;
    } ) ;

    it( "calcularSparklineGastos debería anexar el valor del mes actual al final con monthKey" , () => {
      const serie = calcularSparklineGastos( monthlySummaries , 15000 , 5 , refDate ) ;
      expect( serie ).toEqual( [
        { value: 100 , monthKey: "2026-01" } ,
        { value: 150 , monthKey: "2026-02" }
      ] ) ;
    } ) ;

    it( "calcularSparklineAhorro debería calcular ingresos menos gastos por mes con monthKey" , () => {
      const serie = calcularSparklineAhorro( monthlySummaries , 20000 , 5 , refDate ) ;
      expect( serie ).toEqual( [
        { value: 200 , monthKey: "2026-01" } ,
        { value: 200 , monthKey: "2026-02" }
      ] ) ;
    } ) ;
  } ) ;

  describe( "calcularTendenciaDesdeSparkline" , () => {
    it( "debería retornar undefined con menos de 2 puntos de datos" , () => {
      expect( calcularTendenciaDesdeSparkline( [] ) ).toBeUndefined() ;
      expect( calcularTendenciaDesdeSparkline( [ { value: 100 , monthKey: "2026-01" } ] ) ).toBeUndefined() ;
    } ) ;

    it( "debería retornar undefined cuando el punto anterior es cero para evitar porcentajes inventados" , () => {
      expect( calcularTendenciaDesdeSparkline( [
        { value: 0 , monthKey: "2026-01" } ,
        { value: 100 , monthKey: "2026-02" }
      ] ) ).toBeUndefined() ;
    } ) ;

    it( "debería calcular el porcentaje de cambio entre los dos últimos puntos" , () => {
      const resultado = calcularTendenciaDesdeSparkline( [
        { value: 100 , monthKey: "2026-01" } ,
        { value: 150 , monthKey: "2026-02" }
      ] ) ;

      expect( resultado ).toBeDefined() ;
      expect( resultado?.value ).toBe( "50.0%" ) ;
      expect( resultado?.isPositive ).toBe( true ) ;
      expect( resultado?.isRising ).toBe( true ) ;
    } ) ;

    it( "debería invertir la interpretación de positivo/negativo cuando isInverted es true" , () => {
      const resultado = calcularTendenciaDesdeSparkline( [
        { value: 100 , monthKey: "2026-01" } ,
        { value: 150 , monthKey: "2026-02" }
      ] , true ) ;

      expect( resultado ).toBeDefined() ;
      expect( resultado?.isRising ).toBe( true ) ;
      expect( resultado?.isPositive ).toBe( false ) ;
    } ) ;

    it( "debería calcular correctamente una caída (valor negativo)" , () => {
      const resultado = calcularTendenciaDesdeSparkline( [
        { value: 200 , monthKey: "2026-01" } ,
        { value: 100 , monthKey: "2026-02" }
      ] ) ;

      expect( resultado ).toBeDefined() ;
      expect( resultado?.value ).toBe( "50.0%" ) ;
      expect( resultado?.isPositive ).toBe( false ) ;
      expect( resultado?.isRising ).toBe( false ) ;
    } ) ;
  } ) ;
} ) ;
