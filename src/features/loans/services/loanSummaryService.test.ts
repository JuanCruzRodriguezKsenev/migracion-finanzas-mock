/**
 * @file loanSummaryService.test.ts
 * Pruebas unitarias para loanSummaryService (RFC 008).
 * Entorno de ejecución puro "node" sin acceso a base de datos.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Accounting
import type { Account } from "@/features/accounting/types" ;

// Feature: Loans
import { resumirLoan , cuotasPagadasDe , resumirLoans } from "./loanSummaryService" ;
import { makeLoan }                                     from "../testing/loanFactory" ;
import type { Loan , LoanWithAccounts }                 from "../types" ;


function makeAccount( overrides?: Partial< Account > ): Account {
  return( {
    id:             "acc-test-1" ,
    organizationId: "org-test-1" ,
    code:           "2.1.01.01" ,
    name:           "Cuenta Préstamo" ,
    type:           "liability" ,
    balance:        0 ,
    currency:       "ARS" ,
    entityId:       null ,
    cbuCvu:         null ,
    alias:          null ,
    isCommonPot:    false ,
    ownerUserId:    null ,
    createdAt:      new Date( "2026-09-15T12:00:00Z" ) ,
    ...overrides
  } ) ;
}

function makeLoanWithAccounts(
  loan:                 Loan ,
  account?:             Account ,
  loanAccountCurrency?: string
): LoanWithAccounts {
  const acc = ( account || makeAccount( { currency: loan.currency } ) ) ;
  return( {
    ...loan ,
    entity:   null ,
    contact:  null ,
    accounts: [
      {
        id:        "la-test-1" ,
        loanId:    loan.id ,
        accountId: acc.id ,
        currency:  ( loanAccountCurrency ?? acc.currency ) ,
        createdAt: new Date( "2026-09-15T12:00:00Z" ) ,
        account:   acc
      }
    ]
  } ) ;
}

describe( "loanSummaryService — Resumen y agregación de préstamos" , () => {
  const hoyCivil = "2026-09-15" ;

  it( "1. borrowed con cuenta espejo en -660000 tiene saldoPendiente positivo 660000" , () => {
    const loan = makeLoan( {
      direction:       "borrowed" ,
      principalAmount: 1000000 ,
      currency:        "ARS"
    } ) ;
    const account = makeAccount( {
      type:     "liability" ,
      balance:  -660000 ,
      currency: "ARS"
    } ) ;
    const loanWithAcc = makeLoanWithAccounts( loan , account ) ;

    const resumen = resumirLoan( loanWithAcc , hoyCivil ) ;

    expect( resumen.saldoPendiente ).toBe( 660000 ) ;
    expect( resumen.progreso ).toBe( 34 ) ; // (1000000 - 660000) / 1000000 * 100 = 34%
  } ) ;

  it( "2. lent con cuenta espejo en +50000 tiene saldoPendiente 50000 (sin deudaDe)" , () => {
    const loan = makeLoan( {
      direction:       "lent" ,
      principalAmount: 100000 ,
      currency:        "USD"
    } ) ;
    const account = makeAccount( {
      type:     "asset" ,
      balance:  50000 ,
      currency: "USD"
    } ) ;
    const loanWithAcc = makeLoanWithAccounts( loan , account ) ;

    const resumen = resumirLoan( loanWithAcc , hoyCivil ) ;

    expect( resumen.saldoPendiente ).toBe( 50000 ) ;
    expect( resumen.progreso ).toBe( 50 ) ;
  } ) ;

  it( "3. préstamo cuya única fila de loan_accounts es de otra divisa tiene saldoPendiente y progreso en null" , () => {
    const loan = makeLoan( {
      currency: "ARS"
    } ) ;
    const account = makeAccount( {
      currency: "USD" ,
      balance:  -50000
    } ) ;
    // Se vincula con divisa USD mientras el préstamo es ARS
    const loanWithAcc = makeLoanWithAccounts( loan , account , "USD" ) ;

    const resumen = resumirLoan( loanWithAcc , hoyCivil ) ;

    expect( resumen.saldoPendiente ).toBeNull() ;
    expect( resumen.progreso ).toBeNull() ;
  } ) ;

  it( "4. cuotasPagadasDe con resolvedThrough nulo retorna 0; con puntero en la tercera ocurrencia retorna 3" , () => {
    const loan = makeLoan( {
      firstInstallmentDate: "2026-10-10" ,
      frequency:            "monthly" ,
      intervalCount:        1 ,
      totalInstallments:    12 ,
      resolvedThrough:      null
    } ) ;

    expect( cuotasPagadasDe( loan ) ).toBe( 0 ) ;

    // 1a cuota: 2026-10-10, 2a: 2026-11-10, 3a: 2026-12-10
    const loanCon3 = { ...loan , resolvedThrough: "2026-12-10" } ;
    expect( cuotasPagadasDe( loanCon3 ) ).toBe( 3 ) ;
  } ) ;

  it( "5. progreso acotado: saldo mayor que el capital original retorna 0, no negativo" , () => {
    const loan = makeLoan( {
      direction:       "borrowed" ,
      principalAmount: 1000000 ,
      currency:        "ARS"
    } ) ;
    // Deuda de 1.200.000 (mayor al capital de 1.000.000 por mora/intereses)
    const account = makeAccount( {
      type:     "liability" ,
      balance:  -1200000 ,
      currency: "ARS"
    } ) ;
    const loanWithAcc = makeLoanWithAccounts( loan , account ) ;

    const resumen = resumirLoan( loanWithAcc , hoyCivil ) ;

    expect( resumen.saldoPendiente ).toBe( 1200000 ) ;
    expect( resumen.progreso ).toBe( 0 ) ;
  } ) ;

  it( "resumirLoans mapea la lista correctamente" , () => {
    const loan = makeLoan( { currency: "ARS" } ) ;
    const loanWithAcc = makeLoanWithAccounts( loan ) ;

    const lista = resumirLoans( [ loanWithAcc ] , hoyCivil ) ;

    expect( lista ).toHaveLength( 1 ) ;
    expect( lista[ 0 ].id ).toBe( loan.id ) ;
  } ) ;
} ) ;
