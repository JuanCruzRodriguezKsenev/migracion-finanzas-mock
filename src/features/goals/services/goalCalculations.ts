/**
 * @file goalCalculations.ts
 * Funciones puras del módulo de Metas (RFC 011 §3). No importan la base de datos.
 * Todo importe viaja en centavos enteros.
 */
// Shared
import { claveDeMes }         from "@/shared/lib/monthKey" ;
import { obtenerHoyCivil }    from "@/features/subscriptions/services/recurrenceService" ;

// Feature: Goals
import type { GoalStatus } from "../types" ;


/**
 * Porcentaje real de avance, sin tope (el excedente cuenta: RN-8).
 *
 * @param ahorrado - Ahorrado en centavos.
 * @param objetivo - Objetivo en centavos (> 0).
 * @returns Porcentaje entero redondeado hacia abajo; 0 si el objetivo no es positivo.
 */
export function porcentaje( ahorrado: number , objetivo: number ): number {
  if( objetivo <= 0 ) {
    return( 0 ) ;
  }
  return( Math.floor( (Math.max( ahorrado , 0 ) * 100) / objetivo ) ) ;
}

/**
 * Porcentaje para dibujar la barra, topado en 100.
 *
 * @param ahorrado - Ahorrado en centavos.
 * @param objetivo - Objetivo en centavos (> 0).
 * @returns Entero entre 0 y 100.
 */
export function porcentajeParaBarra( ahorrado: number , objetivo: number ): number {
  return( Math.min( porcentaje( ahorrado , objetivo ) , 100 ) ) ;
}

/**
 * Normaliza una fecha límite a su mes "YYYY-MM". Una fecha civil "YYYY-MM-DD" no se
 * reinterpreta por zona: el mes es el que escribe la cadena.
 */
function mesDeFechaLimite( fecha: string | Date , zona: string ): string {
  if( (typeof fecha === "string") && /^\d{4}-\d{2}-\d{2}/.test( fecha ) ) {
    return( fecha.slice( 0 , 7 ) ) ;
  }
  return( claveDeMes( fecha , zona ) ) ;
}

/**
 * Meses calendario entre el mes de hoy y el mes de la fecha límite, en la zona del usuario.
 * Mínimo 1: una fecha dentro del mes en curso cuenta como 1 (RN-13).
 *
 * @param hoy - Instante de referencia.
 * @param fecha - Fecha límite (civil "YYYY-MM-DD" o Date).
 * @param zona - Zona horaria IANA del usuario.
 * @returns Cantidad de meses, ≥ 1.
 */
export function mesesRestantes( hoy: Date , fecha: string | Date , zona: string ): number {
  const [ ay , am ] = claveDeMes( hoy , zona ).split( "-" ).map( Number ) ;
  const [ fy , fm ] = mesDeFechaLimite( fecha , zona ).split( "-" ).map( Number ) ;
  return( Math.max( ((fy - ay) * 12) + (fm - am) , 1 ) ) ;
}

/**
 * Aporte mensual sugerido, con aritmética entera.
 *
 * @param restante - Lo que falta, en centavos.
 * @param meses - Meses restantes (se fuerza a ≥ 1).
 * @returns `Math.ceil( restante / meses )`; 0 si no falta nada.
 */
export function aporteSugerido( restante: number , meses: number ): number {
  if( restante <= 0 ) {
    return( 0 ) ;
  }
  return( Math.ceil( restante / Math.max( meses , 1 ) ) ) ;
}

/**
 * Indica si la fecha límite ya pasó (estrictamente anterior al día de hoy en la zona del usuario).
 *
 * @param hoy - Instante de referencia.
 * @param fecha - Fecha límite civil "YYYY-MM-DD" o Date.
 * @param zona - Zona horaria IANA del usuario.
 */
export function estaVencida( hoy: Date , fecha: string | Date , zona: string ): boolean {
  const fechaCivil = ( typeof fecha === "string" ) ? fecha.slice( 0 , 10 ) : obtenerHoyCivil( zona , fecha ) ;
  return( fechaCivil < obtenerHoyCivil( zona , hoy ) ) ;
}

/**
 * Transición automática de estado según lo ahorrado (RN-11).
 * `abandoned` no cambia nunca.
 *
 * @param estado - Estado actual.
 * @param ahorrado - Ahorrado en centavos.
 * @param objetivo - Objetivo en centavos.
 * @returns El estado resultante.
 */
export function transicionDeEstado( estado: GoalStatus , ahorrado: number , objetivo: number ): GoalStatus {
  if( estado === "abandoned" ) {
    return( "abandoned" ) ;
  }
  if( (estado === "active") && (ahorrado >= objetivo) ) {
    return( "completed" ) ;
  }
  if( (estado === "completed") && (ahorrado < objetivo) ) {
    return( "active" ) ;
  }
  return( estado ) ;
}
