/**
 * @file loanScheduleService.ts
 * Servicio de proyección de cuotas pendientes para préstamos (RFC 008).
 * Proyecta el cronograma a partir de firstInstallmentDate respetando resolvedThrough y la ventana de cobro.
 */
// Feature: Subscriptions
import { ocurrenciaN , ventanaAbierta } from "@/features/subscriptions/services/recurrenceService" ;
import type { SubscriptionFrequency }   from "@/features/subscriptions/types" ;

// Feature: Loans
import { cronogramaFrances }            from "./amortizacion" ;
import type { Loan , PendienteCuota }   from "../types" ;


/**
 * Retorna las cuotas pendientes de un préstamo cuya ventana de exigibilidad ya abrió
 * y cuya fecha es posterior a resolvedThrough, en estricto orden cronológico.
 *
 * @param loan - Registro del préstamo.
 * @param hoyCivil - Fecha civil actual del usuario (YYYY-MM-DD).
 * @returns Lista de cuotas pendientes de pago/cobro.
 */
export function pendientesDeLoan(
  loan:     Loan ,
  hoyCivil: string
): PendienteCuota[] {
  if( loan.archivedAt !== null ) {
    return( [] ) ;
  }

  const pendientes: PendienteCuota[] = [] ;
  const frequency     = ( loan.frequency as SubscriptionFrequency ) ;
  const intervalCount = ( loan.intervalCount || 1 ) ;
  const resolved      = loan.resolvedThrough ;

  const MAX_PENDIENTES = 24 ;
  const MAX_BUSQUEDA   = 2000 ;

  const cronograma = cronogramaFrances(
    loan.principalAmount ,
    loan.interestRateAnnual ,
    loan.totalInstallments ,
    frequency ,
    intervalCount
  ) ;

  const total = Math.min( loan.totalInstallments , MAX_BUSQUEDA ) ;

  for( let i = 0 ; i < total ; i++ ) {
    if( pendientes.length >= MAX_PENDIENTES ) {
      break ;
    }

    const fecha = ocurrenciaN( loan.firstInstallmentDate , frequency , intervalCount , i ) ;

    if( resolved && (fecha <= resolved) ) {
      continue ;
    }

    if( !ventanaAbierta( fecha , frequency , hoyCivil ) ) {
      // Al ser la serie monótona creciente, ninguna ocurrencia posterior tendrá la ventana abierta
      break ;
    }

    const filaCrono = cronograma[ i ] ;
    if( !filaCrono ) {
      break ;
    }

    pendientes.push( {
      loanId:        loan.id ,
      n:             filaCrono.n ,
      fechaCuota:    fecha ,
      cuota:         filaCrono.cuota ,
      interes:       filaCrono.interes ,
      capital:       filaCrono.capital ,
      saldoRestante: filaCrono.saldoRestante ,
      loan
    } ) ;
  }

  return( pendientes ) ;
}
