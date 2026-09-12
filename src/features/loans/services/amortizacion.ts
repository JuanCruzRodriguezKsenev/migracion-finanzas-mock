/**
 * @file amortizacion.ts
 * Cálculo de amortización francesa pura para préstamos (RFC 008).
 * Opera exclusivamente con centavos enteros en los importes de salida.
 */
// Feature: Subscriptions (para tipos de frecuencia compatibles)
import type { SubscriptionFrequency } from "@/features/subscriptions/types" ;


/**
 * Fila del cronograma proyectado de amortización francesa.
 */
export interface CuotaFrancesaRow {
  n:             number ;
  cuota:         number ;
  interes:       number ;
  capital:       number ;
  saldoRestante: number ;
}

/**
 * Calcula la tasa periódica decimal a partir de la tasa nominal anual.
 *
 * @param interestRateAnnual - TNA en puntos básicos x100 (ej: 8550 para 85.5%).
 * @param frequency - Frecuencia de pagos.
 * @param intervalCount - Intervalo de períodos (utilizado cuando frequency es custom).
 * @returns Tasa periódica en valor decimal.
 */
export function calcularTasaPeriodica(
  interestRateAnnual: number ,
  frequency:          SubscriptionFrequency | string ,
  intervalCount:      number
): number {
  if( interestRateAnnual <= 0 ) {
    return( 0 ) ;
  }

  const iAnual       = ( interestRateAnnual / 10000 ) ;
  const safeInterval = ( intervalCount > 0 ? intervalCount : 1 ) ;

  if( frequency === "weekly" ) {
    return( iAnual / 52 ) ;
  }
  if( frequency === "quarterly" ) {
    return( iAnual / 4 ) ;
  }
  if( frequency === "yearly" ) {
    return( iAnual / 1 ) ;
  }
  if( frequency === "custom" ) {
    return( ( iAnual * safeInterval ) / 12 ) ;
  }

  // Por defecto 'monthly'
  return( iAnual / 12 ) ;
}

/**
 * Calcula el importe constante de la cuota en el sistema francés.
 *
 * @param principal - Capital prestado en centavos enteros.
 * @param interestRateAnnual - Tasa anual en puntos básicos x100.
 * @param totalInstallments - Cantidad total de cuotas.
 * @param frequency - Frecuencia de cuotas.
 * @param intervalCount - Intervalo multiplicador de frecuencia.
 * @returns Importe de la cuota en centavos enteros redondeados.
 */
export function cuotaFrancesa(
  principal:          number ,
  interestRateAnnual: number ,
  totalInstallments:  number ,
  frequency:          SubscriptionFrequency | string ,
  intervalCount:      number
): number {
  if( totalInstallments <= 0 ) {
    return( 0 ) ;
  }

  const i = calcularTasaPeriodica( interestRateAnnual , frequency , intervalCount ) ;

  if( i === 0 ) {
    return( Math.round( principal / totalInstallments ) ) ;
  }

  const factor = Math.pow( 1 + i , -totalInstallments ) ;
  const cuota  = ( principal * i ) / ( 1 - factor ) ;

  return( Math.round( cuota ) ) ;
}

/**
 * Genera el cronograma proyectado completo bajo el sistema de amortización francés.
 * Garantiza que la suma de capital amortizado sea estrictamente igual al principal
 * absorbiendo diferencias de redondeo en la última cuota.
 *
 * @param principal - Capital prestado en centavos enteros.
 * @param interestRateAnnual - Tasa anual en puntos básicos x100.
 * @param totalInstallments - Cantidad total de cuotas.
 * @param frequency - Frecuencia de cuotas.
 * @param intervalCount - Intervalo multiplicador de frecuencia.
 * @returns Array con el desglose de cada cuota.
 */
export function cronogramaFrances(
  principal:          number ,
  interestRateAnnual: number ,
  totalInstallments:  number ,
  frequency:          SubscriptionFrequency | string ,
  intervalCount:      number
): CuotaFrancesaRow[] {
  if( totalInstallments <= 0 ) {
    return( [] ) ;
  }

  const i           = calcularTasaPeriodica( interestRateAnnual , frequency , intervalCount ) ;
  const cuotaBase   = cuotaFrancesa( principal , interestRateAnnual , totalInstallments , frequency , intervalCount ) ;
  const cronograma: CuotaFrancesaRow[] = [] ;
  let saldoVivo     = principal ;

  for( let n = 1 ; n <= totalInstallments ; n++ ) {
    const esUltima = ( n === totalInstallments ) ;

    if( esUltima ) {
      const capital       = saldoVivo ;
      const interes       = ( i === 0 ? 0 : Math.round( saldoVivo * i ) ) ;
      const cuota         = ( capital + interes ) ;
      const saldoRestante = 0 ;

      cronograma.push( {
        n ,
        cuota ,
        interes ,
        capital ,
        saldoRestante
      } ) ;
    } else {
      const interes = ( i === 0 ? 0 : Math.round( saldoVivo * i ) ) ;
      let capital   = ( cuotaBase - interes ) ;

      if( capital > saldoVivo ) {
        capital = saldoVivo ;
      }

      const cuota         = ( capital + interes ) ;
      const saldoRestante = ( saldoVivo - capital ) ;

      cronograma.push( {
        n ,
        cuota ,
        interes ,
        capital ,
        saldoRestante
      } ) ;

      saldoVivo = saldoRestante ;
    }
  }

  return( cronograma ) ;
}
