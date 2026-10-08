/**
 * @file reparto.ts
 * Algoritmo puro del reparto de un gasto entre los miembros (sin base, sin red). Lo usan por igual el
 * guardado y la vista previa: lo que se muestra es lo que se fija (RN-17). Todo en enteros: los porcentajes
 * en puntos básicos (`10000` = 100 %) y los montos en centavos.
 */

/** Modo del acuerdo de la organización. */
export type ModoAcuerdo = "none" | "fixed_percentages" | "monthly_contributions" ;

/** Por qué el reparto aplica o no aplica (primera fila de la tabla de decisión que coincide). */
export type MotivoReparto = "no_manual" | "modo_none" | "pocos_miembros" | "caja_comun" | "titular_viewer" | "absorbido" | "aplica" ;

/** Datos de la tabla de decisión. */
export interface EntradaDecision {
  esGastoManual:            boolean ;
  tipo:                     string ;
  modo:                     ModoAcuerdo ;
  cantidadMiembrosNoViewer: number ;
  algunaCuentaEsCajaComun:  boolean ;
  titularEsViewer:          boolean ;
  absorbe?:                 boolean ;
}

/**
 * Decide si un gasto se reparte. Evalúa la tabla de la spec en orden y la primera fila que coincide decide:
 * (1) no es manual o no es un gasto; (2) modo `none`; (3) menos de dos miembros no `viewer`;
 * (4) alguna cuenta es caja común; (5) el titular es `viewer`; (6) absorbe el dueño; (7) aplica.
 *
 * @param datos - Los hechos de la tabla de decisión.
 * @returns Si aplica y el motivo.
 */
export function decidirReparto( datos: EntradaDecision ): { aplica: boolean ; motivo: MotivoReparto } {
  const { esGastoManual , tipo , modo , cantidadMiembrosNoViewer , algunaCuentaEsCajaComun , titularEsViewer , absorbe } = datos ;

  if( !esGastoManual || (tipo !== "expense") )   { return( { aplica: false , motivo: "no_manual"      } ) ; }
  if( modo === "none" )                          { return( { aplica: false , motivo: "modo_none"      } ) ; }
  if( cantidadMiembrosNoViewer < 2 )             { return( { aplica: false , motivo: "pocos_miembros" } ) ; }
  if( algunaCuentaEsCajaComun )                  { return( { aplica: false , motivo: "caja_comun"     } ) ; }
  if( titularEsViewer )                          { return( { aplica: false , motivo: "titular_viewer" } ) ; }
  if( absorbe )                                  { return( { aplica: false , motivo: "absorbido"      } ) ; }

  return( { aplica: true , motivo: "aplica" } ) ;
}

/** Aporte declarado por un miembro para un mes. */
export interface AporteMensual {
  userId:        string ;
  year:          number ;
  month:         number ;
  amountInCents: number ;
}

/** Datos para calcular el peso de cada miembro. */
export interface EntradaPesos {
  modo:          ModoAcuerdo ;
  /** Miembros no `viewer` actuales. */
  miembros:      string[] ;
  porcentajesBp: Map< string , number > ;
  aportes:       AporteMensual[] ;
  /** Mes del gasto, con `month` de 1 a 12. */
  mes:           { year: number ; month: number } ;
}

/**
 * Peso de cada miembro en el reparto.
 *
 * - Porcentajes: el peso es el porcentaje (en bp); sin fila cuenta como 0 (S-S).
 * - Aportes: el del mes; si no hay, el último anterior; si nunca declaró, 0 (S-T). Si **ninguno** declaró
 *   jamás, partes iguales y `partesIguales: true` (RN-16).
 *
 * @param datos - Modo, miembros, porcentajes, aportes y mes.
 * @returns Pesos por usuario y si se cayó a partes iguales.
 */
export function calcularPesos( datos: EntradaPesos ): { pesos: Map< string , number > ; partesIguales: boolean } {
  const { modo , miembros , porcentajesBp , aportes , mes } = datos ;
  const pesos = new Map< string , number >() ;

  if( modo === "fixed_percentages" ) {
    for( const userId of miembros ) {
      pesos.set( userId , ( porcentajesBp.get( userId ) ?? 0 ) ) ;
    }

    return( { pesos , partesIguales: false } ) ;
  }

  const claveMes = ( mes.year * 12 ) + mes.month ;
  let alguienDeclaro = false ;

  for( const userId of miembros ) {
    const propios = aportes.filter( ( a ) => (a.userId === userId) && ( ((a.year * 12) + a.month) <= claveMes ) ) ;
    const elegido = propios.reduce< AporteMensual | null >(
      ( mejor , a ) => ( (mejor === null) || ( ((a.year * 12) + a.month) > ((mejor.year * 12) + mejor.month) ) ) ? a : mejor ,
      null
    ) ;

    if( elegido ) {
      alguienDeclaro = true ;
    }

    pesos.set( userId , ( elegido?.amountInCents ?? 0 ) ) ;
  }

  if( !alguienDeclaro ) {
    for( const userId of miembros ) {
      pesos.set( userId , 1 ) ;
    }

    return( { pesos , partesIguales: true } ) ;
  }

  return( { pesos , partesIguales: false } ) ;
}

/** Datos para repartir un monto. */
export interface EntradaRepartir {
  montoEnCentavos: number ;
  titularId:       string ;
  pesos:           Map< string , number > ;
}

/** Resultado del reparto: deudas de los no titulares y parte que absorbe el titular. */
export interface ResultadoReparto {
  deudas:       { userId: string ; montoEnCentavos: number }[] ;
  parteTitular: number ;
}

/**
 * Reparte un monto según los pesos. Cada no titular debe `floor( monto × peso / sumaPesos )`, en aritmética
 * entera (`BigInt`: `monto × peso` puede pasar de 2^53); el titular absorbe el resto (RN-19). Las deudas de 0
 * no se devuelven. Deudas + parte del titular suman exactamente el monto.
 *
 * @param datos - Monto, titular y pesos (el titular puede o no figurar entre ellos).
 * @returns Deudas por miembro y parte del titular.
 */
export function repartir( datos: EntradaRepartir ): ResultadoReparto {
  const { montoEnCentavos , titularId , pesos } = datos ;
  let suma = BigInt( 0 ) ;

  for( const peso of pesos.values() ) {
    suma += BigInt( peso ) ;
  }

  if( suma === BigInt( 0 ) ) {
    return( { deudas: [] , parteTitular: montoEnCentavos } ) ;
  }

  const deudas: ResultadoReparto["deudas"] = [] ;
  let asignado = 0 ;

  for( const [ userId , peso ] of pesos ) {
    if( userId === titularId ) {
      continue ;
    }

    const monto = Number( (BigInt( montoEnCentavos ) * BigInt( peso )) / suma ) ;

    if( monto > 0 ) {
      deudas.push( { userId , montoEnCentavos: monto } ) ;
      asignado += monto ;
    }
  }

  return( { deudas , parteTitular: montoEnCentavos - asignado } ) ;
}

/**
 * Puntos básicos como texto de porcentaje: `9000` → `"90"`, `3333` → `"33,33"`, `1050` → `"10,5"`.
 *
 * @param bp - Puntos básicos enteros.
 * @returns Porcentaje con coma decimal y sin ceros sobrantes.
 */
export function porcentajeComoTexto( bp: number ): string {
  const entero  = Math.trunc( bp / 100 ) ;
  const decimal = String( Math.abs( bp % 100 ) ).padStart( 2 , "0" ).replace( /0+$/ , "" ) ;

  return( decimal ? `${entero},${decimal}` : String( entero ) ) ;
}

/**
 * Convierte el texto que escribe el usuario (`"33,33"`, `"33.3"`, `"50"`) a puntos básicos enteros.
 *
 * @param texto - Porcentaje con hasta dos decimales.
 * @returns Puntos básicos, o `null` si el texto no es un porcentaje válido de 0 a 100.
 */
export function porcentajeABp( texto: string ): number | null {
  const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec( texto.trim() ) ;

  if( !m ) {
    return( null ) ;
  }

  const bp = ( (Number( m[1] ) * 100) + Number( (m[2] ?? "").padEnd( 2 , "0" ) || 0 ) ) ;

  return( (bp <= 10000) ? bp : null ) ;
}

/**
 * Convierte un importe escrito por el usuario (`"600000,50"`) a centavos enteros, sin pasar por punto flotante.
 *
 * @param texto - Importe con hasta dos decimales.
 * @returns Centavos, o `null` si no es un importe válido.
 */
export function importeACentavos( texto: string ): number | null {
  const m = /^(\d{1,13})(?:[.,](\d{1,2}))?$/.exec( texto.trim() ) ;

  if( !m ) {
    return( null ) ;
  }

  return( (Number( m[1] ) * 100) + Number( (m[2] ?? "").padEnd( 2 , "0" ) || 0 ) ) ;
}

/**
 * Centavos como texto editable: `60000050` → `"600000,50"`.
 *
 * @param centavos - Centavos enteros.
 * @returns Importe con coma decimal.
 */
export function centavosComoTexto( centavos: number ): string {
  return( `${Math.trunc( centavos / 100 )},${String( centavos % 100 ).padStart( 2 , "0" )}` ) ;
}

/**
 * Reparte `10000` bp en partes iguales entre `cantidad` miembros: los primeros absorben el resto, así que
 * la suma es siempre exacta.
 *
 * @param cantidad - Cantidad de miembros (`>= 1`).
 * @returns Puntos básicos de cada miembro.
 */
export function porcentajesIguales( cantidad: number ): number[] {
  const base  = Math.floor( 10000 / cantidad ) ;
  const resto = ( 10000 % cantidad ) ;

  return( Array.from( { length: cantidad } , ( _ , i ) => ( base + ((i < resto) ? 1 : 0) ) ) ) ;
}
