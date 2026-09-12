/**
 * @file loanSummaryService.ts
 * Servicio de agregación y resumen para Préstamos (RFC 008).
 * Función pura sin acceso a base de datos ni directiva server-only.
 */
// Feature: Subscriptions
import { ocurrenciaN } from "@/features/subscriptions/services/recurrenceService" ;

// Feature: Cards
import { deudaDe } from "@/features/cards/utils/ciclo" ;

// Feature: Loans
import { pendientesDeLoan }                                                        from "./loanScheduleService" ;
import type { Loan , LoanWithAccounts , LoanConResumen , SubscriptionFrequency } from "../types" ;


/**
 * Calcula la cantidad de cuotas ya saldadas de un préstamo a partir de su puntero resolvedThrough.
 *
 * @param loan - Registro del préstamo con firstInstallmentDate, totalInstallments, frequency e intervalCount.
 * @returns Cantidad de cuotas pagadas (entre 0 y totalInstallments).
 */
export function cuotasPagadasDe( loan: Loan ): number {
  if( !loan.resolvedThrough ) {
    return( 0 ) ;
  }

  const frequency     = ( loan.frequency || "monthly" ) as SubscriptionFrequency ;
  const intervalCount = ( loan.intervalCount || 1 ) ;
  let pagadas         = 0 ;

  for( let n = 0 ; n < loan.totalInstallments ; n++ ) {
    const fecha = ocurrenciaN( loan.firstInstallmentDate , frequency , intervalCount , n ) ;
    if( fecha <= loan.resolvedThrough ) {
      pagadas++ ;
    } else {
      break ;
    }
  }

  return( pagadas ) ;
}

/**
 * Calcula las métricas derivadas y el resumen de un préstamo enriquecido con sus cuentas.
 *
 * @param loan - Préstamo con sus cuentas contables asociadas.
 * @param hoyCivil - Fecha civil actual de referencia YYYY-MM-DD.
 * @returns Préstamo con su resumen, saldo pendiente, progreso y cuotas exigibles.
 */
export function resumirLoan( loan: LoanWithAccounts , hoyCivil: string ): LoanConResumen {
  const matchingAccount = loan.accounts.find( ( la ) => la.currency === loan.currency ) ;

  let saldoPendiente: number | null = null ;
  if( matchingAccount ) {
    saldoPendiente = (
      loan.direction === "borrowed"
        ? deudaDe( matchingAccount.account )
        : matchingAccount.account.balance
    ) ;
  }

  let progreso: number | null = null ;
  if( saldoPendiente !== null ) {
    if( loan.principalAmount <= 0 ) {
      progreso = 0 ;
    } else {
      const pct = Math.round( ( ( loan.principalAmount - saldoPendiente ) / loan.principalAmount ) * 100 ) ;
      progreso  = Math.min( 100 , Math.max( 0 , pct ) ) ;
    }
  }

  const cuotasPagadas = cuotasPagadasDe( loan ) ;
  const pendientes    = pendientesDeLoan( loan , hoyCivil ) ;

  return( {
    ...loan ,
    saldoPendiente ,
    cuotasPagadas ,
    progreso ,
    pendientes
  } ) ;
}

/**
 * Aplica el resumen a una lista de préstamos.
 *
 * @param loans - Lista de préstamos con relaciones.
 * @param hoyCivil - Fecha civil actual de referencia YYYY-MM-DD.
 * @returns Lista de préstamos con métricas derivadas.
 */
export function resumirLoans( loans: LoanWithAccounts[] , hoyCivil: string ): LoanConResumen[] {
  return( loans.map( ( loan ) => resumirLoan( loan , hoyCivil ) ) ) ;
}
