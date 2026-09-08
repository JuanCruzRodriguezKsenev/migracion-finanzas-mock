/**
 * @file ciclo.ts
 * Cálculo de ciclos de facturación, vencimientos y períodos para tarjetas de crédito (RFC 007).
 * Funciones puras con soporte de zonas horarias IANA, años bisiestos y recortes de fin de mes.
 */

/**
 * Fechas límites del ciclo de facturación de una tarjeta de crédito.
 */
export interface PeriodosCiclo {
  cierreAnterior: Date ;
  cierreActual:   Date ;
  vencimiento:    Date ;
}

/**
 * Convierte el saldo contable de una cuenta de pasivo de tarjeta a deuda exigible positiva.
 * En partida doble, los consumos acreditan la tarjeta (balance negativo); la deuda es -balance.
 *
 * @param cuenta - Objeto con balance contable en centavos.
 * @returns Deuda positiva en centavos.
 */
export function deudaDe( cuenta: { balance: number } ): number {
  return( (cuenta.balance === 0) ? 0 : -cuenta.balance ) ;
}

/**
 * Obtiene la cantidad de días de un mes específico respetando años bisiestos.
 *
 * @param year - Año de cuatro dígitos.
 * @param month - Mes (1-12).
 * @returns Cantidad de días (28, 29, 30 o 31).
 */
export function diasEnMes( year: number , month: number ): number {
  return( new Date( Date.UTC( year , month , 0 ) ).getUTCDate() ) ;
}

/**
 * Recorta un día solicitado al último día real del mes si lo excede (ej: 31 en febrero).
 *
 * @param day - Día nominal solicitado (1-31).
 * @param year - Año.
 * @param month - Mes (1-12).
 * @returns Día recortado válido para ese mes y año.
 */
export function recortarDia( day: number , year: number , month: number ): number {
  const maxDias = diasEnMes( year , month ) ;
  return( Math.min( day , maxDias ) ) ;
}

/**
 * Calcula el desfase en milisegundos de una zona horaria respecto a UTC en un instante dado.
 *
 * @param fecha - Instante de referencia.
 * @param timeZone - Identificador de zona horaria IANA.
 * @returns Desfase en milisegundos (local - UTC).
 */
function obtenerOffsetMs( fecha: Date , timeZone: string ): number {
  const formatter = new Intl.DateTimeFormat( "en-US" , {
    timeZone ,
    year:      "numeric" ,
    month:     "numeric" ,
    day:       "numeric" ,
    hour:      "numeric" ,
    minute:    "numeric" ,
    second:    "numeric" ,
    hourCycle: "h23" ,
  } ) ;

  const parts = formatter.formatToParts( fecha ) ;
  const mapping: Record< string , number > = {} ;
  for( const p of parts ) {
    if( p.type !== "literal" ) {
      mapping[p.type] = parseInt( p.value , 10 ) ;
    }
  }

  const asUtc = Date.UTC(
    mapping.year ,
    mapping.month - 1 ,
    mapping.day ,
    mapping.hour ,
    mapping.minute ,
    mapping.second ,
    fecha.getUTCMilliseconds()
  ) ;

  return( asUtc - fecha.getTime() ) ;
}

/**
 * Crea un Date ubicado al final del día (23:59:59.999) en la zona horaria indicada.
 *
 * @param year - Año.
 * @param month - Mes (1-12).
 * @param day - Día del mes.
 * @param timeZone - Identificador de zona horaria IANA.
 * @returns Instante Date absoluto (UTC).
 */
export function crearFinDeDiaEnZona( year: number , month: number , day: number , timeZone: string ): Date {
  const diaValido    = recortarDia( day , year , month ) ;
  const utcTentativo = Date.UTC( year , month - 1 , diaValido , 23 , 59 , 59 , 999 ) ;
  const offset1      = obtenerOffsetMs( new Date( utcTentativo ) , timeZone ) ;
  const timestamp    = ( utcTentativo - offset1 ) ;
  const offset2      = obtenerOffsetMs( new Date( timestamp ) , timeZone ) ;

  return( new Date( utcTentativo - offset2 ) ) ;
}

/**
 * Descompone una fecha en sus componentes locales según la zona horaria del usuario.
 *
 * @param fecha - Instante a descomponer.
 * @param timeZone - Identificador IANA de zona horaria.
 * @returns Componentes numéricos de año, mes, día y hora.
 */
export function descomponerFechaEnZona( fecha: Date , timeZone: string ): {
  year:   number ;
  month:  number ;
  day:    number ;
  hour:   number ;
  minute: number ;
  second: number ;
} {
  const formatter = new Intl.DateTimeFormat( "en-US" , {
    timeZone ,
    year:      "numeric" ,
    month:     "numeric" ,
    day:       "numeric" ,
    hour:      "numeric" ,
    minute:    "numeric" ,
    second:    "numeric" ,
    hourCycle: "h23" ,
  } ) ;

  const parts = formatter.formatToParts( fecha ) ;
  const mapping: Record< string , number > = {} ;
  for( const p of parts ) {
    if( p.type !== "literal" ) {
      mapping[p.type] = parseInt( p.value , 10 ) ;
    }
  }

  return( {
    year:   mapping.year ,
    month:  mapping.month ,
    day:    mapping.day ,
    hour:   mapping.hour ,
    minute: mapping.minute ,
    second: mapping.second ,
  } ) ;
}

/**
 * Resta meses a un par año-mes retornando el año y mes resultante normalizado.
 */
function restarMeses( year: number , month: number , cantidad: number ): { year: number ; month: number } {
  let y = year ;
  let m = ( month - cantidad ) ;
  while( m <= 0 ) {
    m += 12 ;
    y -= 1 ;
  }
  return( { year: y , month: m } ) ;
}

/**
 * Suma meses a un par año-mes retornando el año y mes resultante normalizado.
 */
function sumarMeses( year: number , month: number , cantidad: number ): { year: number ; month: number } {
  let y = year ;
  let m = ( month + cantidad ) ;
  while( m > 12 ) {
    m -= 12 ;
    y += 1 ;
  }
  return( { year: y , month: m } ) ;
}

/**
 * Calcula los períodos de cierre anterior, cierre actual y vencimiento para una tarjeta de crédito.
 * Soporta zonas horarias IANA, recorta fechas inválidas (como 31 de febrero) y resuelve si el vencimiento
 * cae en el mismo mes o en el mes siguiente al cierre.
 *
 * @param closingDay - Día de cierre del ciclo (1-31).
 * @param dueDay - Día de vencimiento del pago (1-31).
 * @param hoy - Instante de tiempo actual o fecha de corte de evaluación.
 * @param zonaHoraria - Identificador IANA de la zona horaria del usuario.
 * @returns Objeto con fechas de cierreAnterior, cierreActual y vencimiento.
 */
export function calcularPeriodos(
  closingDay:  number ,
  dueDay:      number ,
  hoy:         Date ,
  zonaHoraria: string = "America/Argentina/Buenos_Aires"
): PeriodosCiclo {
  const localHoy = descomponerFechaEnZona( hoy , zonaHoraria ) ;

  // Cierre nominal correspondiente al mes actual de 'hoy'
  const cierreEsteMes = crearFinDeDiaEnZona( localHoy.year , localHoy.month , closingDay , zonaHoraria ) ;

  let anioCierreActual: number ;
  let mesCierreActual:  number ;

  if( hoy.getTime() > cierreEsteMes.getTime() ) {
    // Si ya pasó el cierre de este mes, el cierre actual que ya congeló consumos es el de este mes
    anioCierreActual = localHoy.year ;
    mesCierreActual  = localHoy.month ;
  } else {
    // Si todavía no cerró este mes, el último cierre congelado ocurrió el mes pasado
    const anterior = restarMeses( localHoy.year , localHoy.month , 1 ) ;
    anioCierreActual = anterior.year ;
    mesCierreActual  = anterior.month ;
  }

  const cierreActual = crearFinDeDiaEnZona( anioCierreActual , mesCierreActual , closingDay , zonaHoraria ) ;

  // Cierre anterior es exactamente un mes antes del cierre actual
  const previoMes = restarMeses( anioCierreActual , mesCierreActual , 1 ) ;
  const cierreAnterior = crearFinDeDiaEnZona( previoMes.year , previoMes.month , closingDay , zonaHoraria ) ;

  // Vencimiento: si dueDay < closingDay cae en el mes siguiente al cierre; si dueDay >= closingDay cae en el mismo mes
  let anioVencimiento = anioCierreActual ;
  let mesVencimiento  = mesCierreActual ;

  if( dueDay < closingDay ) {
    const siguiente = sumarMeses( anioCierreActual , mesCierreActual , 1 ) ;
    anioVencimiento = siguiente.year ;
    mesVencimiento  = siguiente.month ;
  }

  const vencimiento = crearFinDeDiaEnZona( anioVencimiento , mesVencimiento , dueDay , zonaHoraria ) ;

  return( {
    cierreAnterior ,
    cierreActual ,
    vencimiento ,
  } ) ;
}
