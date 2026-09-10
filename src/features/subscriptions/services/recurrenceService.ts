/**
 * @file recurrenceService.ts
 * Servicio puro para el cálculo de recurrencias, ocurrencias periódicas
 * y transacciones propuestas pendientes (RFC 023).
 * Todas las fechas del circuito son civiles (YYYY-MM-DD en string) para
 * evitar ambigüedades de zona horaria y desfases de medianoche.
 */
// Feature: Cards
import { recortarDia , descomponerFechaEnZona } from "@/features/cards/utils/ciclo" ;

// Feature: Subscriptions
import { Subscription , SubscriptionFrequency } from "../types" ;


/**
 * Representa una ocurrencia propuesta pendiente de confirmación en la bandeja.
 */
export interface PendienteRecurrencia {
  subscriptionId: string ;
  fechaCobro:     string ; // Fecha civil YYYY-MM-DD
  subscription:   Subscription ;
}

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
 * Descompone una fecha (Date o string civil) en componentes año, mes (1-12) y día.
 */
function extraerComponentesCiviles( fecha: Date | string ): { year: number ; month: number ; day: number } {
  if( typeof fecha === "string" ) {
    const match = fecha.match( /^(\d{4})-(\d{2})-(\d{2})/ ) ;
    if( match ) {
      return( {
        year:  parseInt( match[1] , 10 ) ,
        month: parseInt( match[2] , 10 ) ,
        day:   parseInt( match[3] , 10 ) ,
      } ) ;
    }
  }

  const d = ( fecha instanceof Date ? fecha : new Date( fecha ) ) ;
  return( {
    year:  d.getFullYear() ,
    month: d.getMonth() + 1 ,
    day:   d.getDate() ,
  } ) ;
}

/**
 * Obtiene la fecha civil de hoy en la zona horaria del usuario en formato YYYY-MM-DD.
 *
 * @param timeZone - Zona horaria IANA del perfil (ej: "America/Argentina/Buenos_Aires").
 * @param fecha - Instante de referencia opcional (por defecto now).
 * @returns Cadena civil YYYY-MM-DD.
 */
export function obtenerHoyCivil( timeZone: string , fecha: Date = new Date() ): string {
  const { year , month , day } = descomponerFechaEnZona( fecha , timeZone ) ;
  return( formatCivil( year , month , day ) ) ;
}

/**
 * Calcula la enésima fecha de cobro civil (YYYY-MM-DD) de una serie recurrente.
 * Ancla siempre en el día nominal de startDate para que una serie que cobra el 31
 * recorte a 28 en febrero y vuelva al 31 en marzo sin degradarse.
 *
 * @param startDate - Fecha de inicio de la serie.
 * @param frequency - Frecuencia de facturación.
 * @param intervalCount - Intervalo entre períodos (ej: cada 2 meses).
 * @param n - Índice de ocurrencia (0 = startDate, 1 = siguiente, ...).
 * @returns Cadena con la fecha civil YYYY-MM-DD.
 */
export function ocurrenciaN(
  startDate:     Date | string ,
  frequency:     SubscriptionFrequency ,
  intervalCount: number ,
  n:             number
): string {
  const safeInterval = ( intervalCount > 0 ? intervalCount : 1 ) ;
  const origen       = extraerComponentesCiviles( startDate ) ;

  if( n === 0 ) {
    const diaRecortado = recortarDia( origen.day , origen.year , origen.month ) ;
    return( formatCivil( origen.year , origen.month , diaRecortado ) ) ;
  }

  if( frequency === "weekly" ) {
    const diasASumar = ( 7 * safeInterval * n ) ;
    const utcDate    = new Date( Date.UTC( origen.year , origen.month - 1 , origen.day + diasASumar ) ) ;

    return( formatCivil( utcDate.getUTCFullYear() , utcDate.getUTCMonth() + 1 , utcDate.getUTCDate() ) ) ;
  }

  let mesesASumar: number ;
  if( frequency === "quarterly" ) {
    mesesASumar = ( 3 * safeInterval * n ) ;
  } else if( frequency === "yearly" ) {
    mesesASumar = ( 12 * safeInterval * n ) ;
  } else {
    // 'monthly' y 'custom'
    mesesASumar = ( safeInterval * n ) ;
  }

  const totalMonths = ( origen.year * 12 ) + ( origen.month - 1 ) + mesesASumar ;
  const targetYear  = Math.floor( totalMonths / 12 ) ;
  const targetMonth = ( (totalMonths % 12) + 1 ) ;
  const targetDay   = recortarDia( origen.day , targetYear , targetMonth ) ;

  return( formatCivil( targetYear , targetMonth , targetDay ) ) ;
}

/**
 * Determina si la ventana de propuesta de una ocurrencia está abierta (RFC 023 §3.2).
 * Para frecuencias mensuales o mayores, abre el 1° día del mes calendario del cobro.
 * Para semanal (weekly), abre el mismo día de la fecha de cobro.
 *
 * @param fechaCobro - Fecha civil de cobro de la ocurrencia (YYYY-MM-DD).
 * @param frequency - Frecuencia de la suscripción.
 * @param hoyCivil - Fecha civil actual del usuario (YYYY-MM-DD).
 * @returns true si la ocurrencia debe proponerse en la bandeja.
 */
export function ventanaAbierta(
  fechaCobro: string ,
  frequency:  SubscriptionFrequency ,
  hoyCivil:   string
): boolean {
  if( frequency === "weekly" ) {
    return( hoyCivil >= fechaCobro ) ;
  }

  const inicioMesCobro = `${fechaCobro.slice( 0 , 7 )}-01` ;
  return( hoyCivil >= inicioMesCobro ) ;
}

/**
 * Retorna las ocurrencias pendientes de una suscripción cuya ventana ya abrió
 * y cuya fecha es posterior al puntero resolvedThrough, en orden cronológico ascendente.
 * Retorna un arreglo vacío si la suscripción no está activa.
 * Aplica un tope de seguridad de 24 ocurrencias máximas.
 *
 * @param suscripcion - Registro de la suscripción.
 * @param hoyCivil - Fecha civil actual del usuario (YYYY-MM-DD).
 * @returns Lista de ocurrencias pendientes de confirmación.
 */
export function pendientesDe(
  suscripcion: Subscription ,
  hoyCivil:    string
): PendienteRecurrencia[] {
  if( suscripcion.status !== "active" ) {
    return( [] ) ;
  }

  const pendientes: PendienteRecurrencia[] = [] ;
  const frequency     = ( suscripcion.frequency as SubscriptionFrequency ) ;
  const intervalCount = ( suscripcion.intervalCount || 1 ) ;
  const resolved      = suscripcion.resolvedThrough ;

  const MAX_PENDIENTES = 24 ;
  const MAX_BUSQUEDA   = 2000 ;

  let n = 0 ;
  while( (n < MAX_BUSQUEDA) && (pendientes.length < MAX_PENDIENTES) ) {
    const fecha = ocurrenciaN( suscripcion.startDate , frequency , intervalCount , n ) ;

    if( resolved && (fecha <= resolved) ) {
      n++ ;
      continue ;
    }

    if( !ventanaAbierta( fecha , frequency , hoyCivil ) ) {
      // Al ser la serie monótona creciente, ninguna ocurrencia posterior tendrá la ventana abierta
      break ;
    }

    pendientes.push( {
      subscriptionId: suscripcion.id ,
      fechaCobro:     fecha ,
      subscription:   suscripcion ,
    } ) ;

    n++ ;
  }

  return( pendientes ) ;
}

/**
 * Calcula la fecha de puntero inicial (resolvedThrough) para una suscripción (RFC 023 §3.4).
 * Se ubica en la última ocurrencia anterior al período en curso, evitando que surjan
 * períodos históricos no registrados.
 *
 * @param startDate - Fecha de inicio de la suscripción.
 * @param frequency - Frecuencia del ciclo de cobro.
 * @param intervalCount - Intervalo entre períodos.
 * @param hoyCivil - Fecha civil actual del usuario (YYYY-MM-DD).
 * @returns Fecha civil YYYY-MM-DD para inicializar resolvedThrough.
 */
export function calcularPunteroInicial(
  startDate:     Date | string ,
  frequency:     SubscriptionFrequency ,
  intervalCount: number ,
  hoyCivil:      string
): string {
  const safeInterval = ( intervalCount > 0 ? intervalCount : 1 ) ;
  const origen       = extraerComponentesCiviles( startDate ) ;

  // Si la suscripción arranca hoy o en el futuro respecto a hoyCivil
  const fechaInicioCivil = formatCivil(
    origen.year ,
    origen.month ,
    recortarDia( origen.day , origen.year , origen.month )
  ) ;

  // Buscar el primer n cuya ventana esté abierta para hoyCivil
  let nActual = 0 ;
  while( nActual < 2000 ) {
    const fecha = ocurrenciaN( startDate , frequency , safeInterval , nActual ) ;
    if( fecha >= fechaInicioCivil && ventanaAbierta( fecha , frequency , hoyCivil ) ) {
      // Si la siguiente ocurrencia también tiene ventana abierta, avanzamos hasta la más actual
      const proxFecha = ocurrenciaN( startDate , frequency , safeInterval , nActual + 1 ) ;
      if( ventanaAbierta( proxFecha , frequency , hoyCivil ) ) {
        nActual++ ;
        continue ;
      }
      break ;
    }

    if( !ventanaAbierta( fecha , frequency , hoyCivil ) ) {
      break ;
    }

    nActual++ ;
  }

  if( nActual > 0 ) {
    return( ocurrenciaN( startDate , frequency , safeInterval , nActual - 1 ) ) ;
  }

  // Si nActual === 0, el puntero se coloca 1 intervalo previo a startDate
  if( frequency === "weekly" ) {
    const diasARestar = ( 7 * safeInterval ) ;
    const utcDate     = new Date( Date.UTC( origen.year , origen.month - 1 , origen.day - diasARestar ) ) ;

    return( formatCivil( utcDate.getUTCFullYear() , utcDate.getUTCMonth() + 1 , utcDate.getUTCDate() ) ) ;
  }

  let mesesARestar: number ;
  if( frequency === "quarterly" ) {
    mesesARestar = ( 3 * safeInterval ) ;
  } else if( frequency === "yearly" ) {
    mesesARestar = ( 12 * safeInterval ) ;
  } else {
    mesesARestar = safeInterval ;
  }

  const totalMonths = ( origen.year * 12 ) + ( origen.month - 1 ) - mesesARestar ;
  const prevYear    = Math.floor( totalMonths / 12 ) ;
  const prevMonth   = ( (totalMonths % 12) + 1 ) ;
  const prevDay     = recortarDia( origen.day , prevYear , prevMonth ) ;

  return( formatCivil( prevYear , prevMonth , prevDay ) ) ;
}

/**
 * Deriva la próxima fecha de cobro (Date) posterior al puntero resolvedThrough (RFC 023 §3.1).
 *
 * @param startDate - Fecha de inicio de la serie.
 * @param frequency - Frecuencia de cobro.
 * @param intervalCount - Intervalo entre cobros.
 * @param despuesDeCivil - Fecha civil del puntero actual (YYYY-MM-DD o null).
 * @returns Instante Date correspondiente a la próxima ocurrencia de cobro.
 */
export function proximaOcurrenciaPosteriorA(
  startDate:      Date | string ,
  frequency:      SubscriptionFrequency ,
  intervalCount:  number ,
  despuesDeCivil: string | null
): Date {
  const safeInterval = ( intervalCount > 0 ? intervalCount : 1 ) ;
  let n = 0 ;

  while( n < 2000 ) {
    const fecha = ocurrenciaN( startDate , frequency , safeInterval , n ) ;
    if( !despuesDeCivil || (fecha > despuesDeCivil) ) {
      const comp = extraerComponentesCiviles( fecha ) ;
      return( new Date( comp.year , comp.month - 1 , comp.day , 12 , 0 , 0 ) ) ;
    }
    n++ ;
  }

  // Fallback seguro
  return( new Date() ) ;
}
