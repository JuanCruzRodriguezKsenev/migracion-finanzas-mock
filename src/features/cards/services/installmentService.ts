/**
 * @file installmentService.ts
 * Servicio puro de cálculo para compras en cuotas con tarjeta de crédito (RFC 025).
 * Funciones puras de proyección temporal, cálculo de punteros, cuotas futuras y propuesta de primera cuota.
 */
// Feature: Subscriptions
import { ocurrenciaN , ventanaAbierta , obtenerHoyCivil } from "@/features/subscriptions/services/recurrenceService" ;

// Feature: Cards
import { recortarDia , calcularPeriodos , descomponerFechaEnZona } from "../utils/ciclo" ;
import { CardInstallmentPlan , PendienteCuota }                     from "../types" ;


/**
 * Formatea componentes numéricos de año, mes y día a cadena civil ISO YYYY-MM-DD.
 */
function formatCivil( year: number , month: number , day: number ): string {
  const y = String( year ).padStart( 4 , "0" ) ;
  const m = String( month ).padStart( 2 , "0" ) ;
  const d = String( day ).padStart( 2 , "0" ) ;

  return( `${y}-${m}-${d}` ) ;
}

/**
 * Proyecta la fecha civil YYYY-MM-DD de la cuota con índice n (0-indexed).
 * La cuota 0 es la primera (firstInstallmentDate).
 *
 * @param plan - Plan con su fecha civil de primera cuota.
 * @param n - Índice ordinal de cuota (0 a totalInstallments - 1).
 * @returns Cadena con fecha civil YYYY-MM-DD.
 */
export function ocurrenciaDeCuota(
  plan: Pick< CardInstallmentPlan , "firstInstallmentDate" > ,
  n:    number
): string {
  return( ocurrenciaN( plan.firstInstallmentDate , "monthly" , 1 , n ) ) ;
}

/**
 * Cuenta cuántas cuotas del plan ya fueron imputadas (fecha civil <= resolvedThrough).
 *
 * @param plan - Plan con su ancla, puntero de resolución y total de cuotas.
 * @returns Cantidad entera de cuotas ya imputadas (entre 0 y totalInstallments).
 */
export function cuotasImputadasDe(
  plan: Pick< CardInstallmentPlan , "firstInstallmentDate" | "resolvedThrough" | "totalInstallments" >
): number {
  if( !plan.resolvedThrough ) {
    return( 0 ) ;
  }

  let imputadas = 0 ;
  for( let n = 0 ; n < plan.totalInstallments ; n++ ) {
    const fecha = ocurrenciaDeCuota( plan , n ) ;
    if( fecha <= plan.resolvedThrough ) {
      imputadas++ ;
    } else {
      break ;
    }
  }

  return( imputadas ) ;
}

/**
 * Retorna las cuotas pendientes de un plan cuya ventana de propuesta mensual ya abrió
 * y cuya fecha es posterior a resolvedThrough, acotadas estrictamente a totalInstallments.
 * Retorna lista vacía si el plan está archivado.
 *
 * @param plan - Registro del plan de cuotas.
 * @param hoyCivil - Fecha civil actual del usuario (YYYY-MM-DD).
 * @returns Lista de cuotas pendientes con su número ordinal (1-indexed) y fecha civil.
 */
export function pendientesDeCuotas(
  plan:     CardInstallmentPlan ,
  hoyCivil: string
): PendienteCuota[] {
  if( plan.archivedAt ) {
    return( [] ) ;
  }

  const pendientes: PendienteCuota[] = [] ;

  for( let n = 0 ; n < plan.totalInstallments ; n++ ) {
    const fecha = ocurrenciaDeCuota( plan , n ) ;

    if( plan.resolvedThrough && (fecha <= plan.resolvedThrough) ) {
      continue ;
    }

    if( !ventanaAbierta( fecha , "monthly" , hoyCivil ) ) {
      break ;
    }

    pendientes.push( {
      planId:      plan.id ,
      numeroCuota: ( n + 1 ) ,
      fechaCuota:  fecha ,
      plan ,
    } ) ;
  }

  return( pendientes ) ;
}

/**
 * Calcula el importe total remanente en cuotas no imputadas de un plan (en centavos).
 *
 * @param plan - Plan de cuotas.
 * @returns Centavos enteros pendientes de imputar (nunca negativo).
 */
export function cuotasFuturasDe( plan: CardInstallmentPlan ): number {
  if( plan.archivedAt ) {
    return( 0 ) ;
  }

  const imputadas = cuotasImputadasDe( plan ) ;
  const restantes = Math.max( 0 , (plan.totalInstallments - imputadas) ) ;
  return( plan.installmentAmount * restantes ) ;
}

/**
 * Agrupa las cuotas futuras de un lote de planes por divisa.
 * Es el mapa consumido por CicloTarjeta para deducir compromisos del disponible.
 *
 * @param planes - Lista de planes de cuotas.
 * @returns Diccionario divisa -> centavos no imputados.
 */
export function cuotasFuturasPorDivisa( planes: CardInstallmentPlan[] ): Record< string , number > {
  const acumulador: Record< string , number > = {} ;

  for( const plan of planes ) {
    if( plan.archivedAt ) {
      continue ;
    }
    const moneda = ( plan.currency || "ARS" ) ;
    const monto  = cuotasFuturasDe( plan ) ;
    acumulador[moneda] = ( (acumulador[moneda] || 0) + monto ) ;
  }

  return( acumulador ) ;
}

/**
 * Propone la fecha civil para la primera cuota en el alta de un plan (RFC §3.2).
 * Usa calcularPeriodos(): si purchasedAt es posterior al cierre del mes de compra,
 * la primera cuota cae en el mes siguiente; si no, en el vigente.
 *
 * @param closingDay - Día de cierre de la tarjeta (1-31 o null).
 * @param dueDay - Día de vencimiento de la tarjeta (1-31 o null).
 * @param purchasedAt - Fecha/instante en que se realizó la compra.
 * @param zonaHoraria - Identificador IANA de zona horaria.
 * @returns Fecha civil YYYY-MM-DD propuesta para el primer vencimiento.
 */
export function proponerPrimeraCuota(
  closingDay:  number | null | undefined ,
  dueDay:      number | null | undefined ,
  purchasedAt: Date ,
  zonaHoraria: string = "America/Argentina/Buenos_Aires"
): string {
  if( !closingDay ) {
    return( obtenerHoyCivil( zonaHoraria , purchasedAt ) ) ;
  }

  calcularPeriodos( closingDay , (dueDay || closingDay) , purchasedAt , zonaHoraria ) ;
  const local = descomponerFechaEnZona( purchasedAt , zonaHoraria ) ;

  const caeEnMesSiguiente = ( local.day > closingDay ) ;

  let targetYear  = local.year ;
  let targetMonth = local.month ;

  if( caeEnMesSiguiente ) {
    if( targetMonth === 12 ) {
      targetYear++ ;
      targetMonth = 1 ;
    } else {
      targetMonth++ ;
    }
  }

  const nominalDay = ( dueDay || closingDay ) ;
  const targetDay  = recortarDia( nominalDay , targetYear , targetMonth ) ;

  return( formatCivil( targetYear , targetMonth , targetDay ) ) ;
}
