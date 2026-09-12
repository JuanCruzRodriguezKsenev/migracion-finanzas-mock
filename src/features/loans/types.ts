/**
 * @file types.ts
 * Definición de tipos e interfaces TypeScript para el módulo de Préstamos (RFC 008).
 */
// Feature: Subscriptions
export type { SubscriptionFrequency } from "@/features/subscriptions/types" ;

// Feature: Accounting
import type { Account , FinancialEntity } from "@/features/accounting/types" ;

// Feature: Contacts
import type { Contact } from "@/features/contacts/types" ;

// Feature: Loans
import { loans , loanAccounts }  from "./schema.db" ;
import type { LOAN_FREQUENCIES } from "./schemas/loans.schema" ;


export type Loan = typeof loans.$inferSelect ;
export type InsertLoan = typeof loans.$inferInsert ;

export type LoanAccount = typeof loanAccounts.$inferSelect ;
export type InsertLoanAccount = typeof loanAccounts.$inferInsert ;

export type LoanFrequency = ( typeof LOAN_FREQUENCIES )[ number ] ;

export interface LoanAccountWithAccount extends LoanAccount {
  account: Account ;
}

/**
 * Representa una cuota vencida o exigible pendiente de pago/cobro para un préstamo.
 */
export interface PendienteCuota {
  loanId:        string ;
  n:             number ; // Número de cuota (1 a totalInstallments)
  fechaCuota:    string ; // Fecha civil nominal YYYY-MM-DD
  cuota:         number ; // Centavos totales de la cuota
  interes:       number ; // Centavos de interés
  capital:       number ; // Centavos de capital
  saldoRestante: number ; // Centavos de saldo vivo restante tras pagar la cuota
  loan:          Loan ;
}

/**
 * Préstamo enriquecido con sus cuentas contables y contraparte.
 */
export interface LoanWithAccounts extends Loan {
  entity?:   FinancialEntity | null ;
  contact?:  Contact | null ;
  accounts:  LoanAccountWithAccount[] ;
}

/**
 * Préstamo enriquecido con resumen derivado, métricas y cuotas pendientes de pago.
 */
export interface LoanConResumen extends LoanWithAccounts {
  saldoPendiente: number | null ;    // Centavos SIEMPRE positivos. null si falta la cuenta espejo de su divisa
  cuotasPagadas:  number ;           // Derivadas del puntero resolvedThrough
  progreso:       number | null ;    // 0..100 entero. null cuando saldoPendiente es null
  pendientes:     PendienteCuota[] ; // Las exigibles hoy, de la más antigua a la más nueva
}
