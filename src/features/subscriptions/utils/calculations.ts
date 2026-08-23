/**
 * @file calculations.ts
 * Utilidades puras para normalizar montos de suscripciones a base mensual/anual
 * y construir el resumen agregado del dashboard. Todos los montos en centavos enteros.
 */
// Feature: Subscriptions
import { Subscription , SubscriptionWithStats , SubscriptionSummary , SubscriptionFrequency } from "../types" ;


// Factor de conversión de cada frecuencia a "cobros por mes" (para intervalCount = 1)
const MONTHLY_FACTOR: Record< SubscriptionFrequency , number > = {
  weekly:    52 / 12 ,
  monthly:   1 ,
  quarterly: 1 / 3 ,
  yearly:    1 / 12 ,
  custom:    1 , // 'custom' se interpreta como base mensual escalada por intervalCount
} ;

/**
 * Normaliza un monto al equivalente mensual según su frecuencia de cobro.
 * El resultado se redondea a centavos enteros.
 *
 * @param amount - Monto del cobro en centavos.
 * @param frequency - Frecuencia del ciclo de cobro.
 * @param intervalCount - Cantidad de períodos entre cobros (ej: cada 2 meses).
 * @returns El gasto mensual equivalente en centavos enteros.
 */
export function toMonthlyAmount( amount: number , frequency: SubscriptionFrequency , intervalCount: number = 1 ): number {
  const safeInterval = ( intervalCount > 0 ? intervalCount : 1 ) ;
  const factor       = ( MONTHLY_FACTOR[frequency] ?? 1 ) ;

  return( Math.round( (amount * factor) / safeInterval ) ) ;
}

/**
 * Proyecta un monto al equivalente anual según su frecuencia de cobro.
 *
 * @param amount - Monto del cobro en centavos.
 * @param frequency - Frecuencia del ciclo de cobro.
 * @param intervalCount - Cantidad de períodos entre cobros.
 * @returns La proyección anual en centavos enteros.
 */
export function toYearlyAmount( amount: number , frequency: SubscriptionFrequency , intervalCount: number = 1 ): number {
  return( toMonthlyAmount( amount , frequency , intervalCount ) * 12 ) ;
}

/**
 * Suma la fecha del próximo cobro a partir de una fecha base y la frecuencia.
 *
 * @param from - Fecha base del cálculo.
 * @param frequency - Frecuencia del ciclo de cobro.
 * @param intervalCount - Cantidad de períodos entre cobros.
 * @returns La fecha del siguiente cobro.
 */
export function addInterval( from: Date , frequency: SubscriptionFrequency , intervalCount: number = 1 ): Date {
  const next         = new Date( from ) ;
  const safeInterval = ( intervalCount > 0 ? intervalCount : 1 ) ;

  if( frequency === "weekly" ){
    next.setDate( next.getDate() + (7 * safeInterval) ) ;
  } else if( frequency === "quarterly" ){
    next.setMonth( next.getMonth() + (3 * safeInterval) ) ;
  } else if( frequency === "yearly" ){
    next.setFullYear( next.getFullYear() + safeInterval ) ;
  } else {
    // 'monthly' y 'custom' (base mensual)
    next.setMonth( next.getMonth() + safeInterval ) ;
  }

  return( next ) ;
}

/**
 * Enriquece las suscripciones con montos normalizados y porcentaje del gasto total,
 * ordenadas por gasto mensual descendente sin mutar el arreglo de entrada.
 *
 * @param items - Suscripciones planas de la base de datos.
 * @returns Suscripciones enriquecidas ordenadas de mayor a menor gasto mensual.
 */
export function enrichSubscriptions( items: Subscription[] ): SubscriptionWithStats[] {
  const totalMonthly = items.reduce(
    ( acc , sub ) => acc + toMonthlyAmount( sub.amount , sub.frequency as SubscriptionFrequency , sub.intervalCount ) ,
    0
  ) ;

  return( items
    .map( ( sub ) => {
      const monthlyAmount = toMonthlyAmount( sub.amount , sub.frequency as SubscriptionFrequency , sub.intervalCount ) ;

      return( {
        ...sub ,
        monthlyAmount ,
        yearlyAmount:   monthlyAmount * 12 ,
        percentOfTotal: totalMonthly > 0
          ? Math.round( (monthlyAmount / totalMonthly) * 100 )
          : 0 ,
      } ) ;
    } )
    .toSorted( ( a , b ) => b.monthlyAmount - a.monthlyAmount ) ) ;
}

/**
 * Construye el resumen agregado del gasto en suscripciones para el dashboard.
 *
 * @param items - Suscripciones planas de la base de datos.
 * @returns Totales mensual/anual en centavos, cantidad y listado enriquecido.
 */
export function buildSummary( items: Subscription[] ): SubscriptionSummary {
  const enriched     = enrichSubscriptions( items ) ;
  const totalMonthly = enriched.reduce( ( acc , s ) => acc + s.monthlyAmount , 0 ) ;

  return( {
    totalMonthly ,
    totalYearly:   totalMonthly * 12 ,
    count:         items.length ,
    subscriptions: enriched ,
  } ) ;
}
