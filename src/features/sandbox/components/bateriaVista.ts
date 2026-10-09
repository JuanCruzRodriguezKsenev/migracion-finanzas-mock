/**
 * @file bateriaVista.ts
 * Utilidades puras para el procesamiento y resumen visual de las baterías del Laboratorio de Marcas.
 */

// Feature: Sandbox
import type {
  IdEstrategiaDominio ,
  CandidatoDominio
} from "../services/marcas/tipos" ;
import type { IdentidadMarcaLab } from "./CeldaIdentidad" ;

export type { IdentidadMarcaLab } ;

/**
 * Normaliza un texto de dominio a minúsculas, sin protocolo, sin www y sin rutas.
 *
 * @param texto - URL o nombre de dominio.
 * @returns Nombre de dominio base limpio.
 */
export function dominioBase( texto: string ): string {
  if( !texto ) return( "" ) ;
  let s = texto.trim().toLowerCase() ;
  s = s.replace( /^https?:\/\// , "" ) ;
  s = s.replace( /^www\./ , "" ) ;
  s = s.split( "/" )[0] ;
  s = s.split( "?" )[0] ;
  s = s.split( "#" )[0] ;
  return( s.trim() ) ;
}

/**
 * Busca la posición (índice 0-based) del primer candidato cuyo dominioBase coincide con algún esperado.
 *
 * @param candidatos - Lista de candidatos con dominio.
 * @param esperados - Lista de dominios esperados para la consulta.
 * @returns Índice del primer candidato esperado, o -1 si ninguno coincide.
 */
export function posicionEsperado(
  candidatos: { dominio: string }[] ,
  esperados: string[]
): number {
  const esperadosBase = esperados.map( ( e ) => dominioBase( e ) ) ;
  for( let i = 0 ; i < candidatos.length ; i++ ) {
    const candBase = dominioBase( candidatos[i].dominio ) ;
    if( candBase && esperadosBase.includes( candBase ) ) {
      return( i ) ;
    }
  }
  return( -1 ) ;
}

/**
 * Determina el primer candidato relevante para una estrategia dada.
 * Para "candidatos", busca el primero con resuelve === true.
 * Para las demás, toma el primero de la lista.
 *
 * @param estrategia - Identificador de la estrategia de dominio.
 * @param candidatos - Lista de candidatos retornados.
 * @returns Dominio del primer candidato válido o null si no hay ninguno.
 */
export function primerCandidato(
  estrategia: IdEstrategiaDominio ,
  candidatos: CandidatoDominio[]
): string | null {
  if( !candidatos || (candidatos.length === 0) ) {
    return( null ) ;
  }

  if( estrategia === "candidatos" ) {
    const resuelto = candidatos.find( ( c ) => c.resuelve === true ) ;
    return( resuelto ? resuelto.dominio : null ) ;
  }

  return( candidatos[0]?.dominio || null ) ;
}

/**
 * Mapea el origen de un ícono a la columna correspondiente en la batería por dominio.
 *
 * @param origen - Origen del ícono en la estructura de identidad.
 * @returns "sitio" o "google-s2", o null para otros orígenes.
 */
export function columnaDeOrigen(
  origen?: string | null
): "sitio" | "google-s2" | null {
  if( (origen === "sitio") || (origen === "google-s2") ) {
    return( origen ) ;
  }
  return( null ) ;
}

export type TipoVeredicto = "usada" | "fallo" | "no-consultada" | "sin-resolutor" ;

export interface VeredictoFuente {
  tipo:      TipoVeredicto ;
  respaldo?: boolean ;
  motivo?:   string ;
}

/**
 * Determina el veredicto visual de una fuente de ícono frente al resultado del resolutor de identidad.
 *
 * @param fuente - Fuente a evaluar ("sitio" o "google-s2").
 * @param identidad - Resultado devuelto por el resolutor de identidad.
 * @returns Objeto VeredictoFuente con el tipo ("usada", "fallo", "no-consultada", "sin-resolutor"), respaldo y motivo.
 */
export function veredictoFuente(
  fuente:    string ,
  identidad?: IdentidadMarcaLab | null
): VeredictoFuente {
  if( !identidad ) {
    return( { tipo: "sin-resolutor" } ) ;
  }

  const intentos = identidad.intentos || [] ;
  const intentoFuente = intentos.find( ( it ) => it.fuente === fuente ) ;

  if( identidad.icono?.origen === fuente ) {
    const tieneFalloPrevio = intentos.some( ( it ) => (it.fuente === fuente) && !it.ok ) ;
    return( {
      tipo:     "usada" ,
      respaldo: tieneFalloPrevio
    } ) ;
  }

  if( intentoFuente && !intentoFuente.ok ) {
    return( {
      tipo:   "fallo" ,
      motivo: intentoFuente.motivo || "falló"
    } ) ;
  }

  if( !intentoFuente ) {
    return( { tipo: "no-consultada" } ) ;
  }

  return( { tipo: "sin-resolutor" } ) ;
}

export interface FilaEstrategiaNombres {
  estrategia:        IdEstrategiaDominio ;
  ok:                boolean ;
  estado:            string ;
  ms:                number ;
  candidatos:        CandidatoDominio[] ;
  primero: {
    dominio:          string | null ;
    esperado:         boolean ;
    posicionEsperado: number ;
    identidad?:       IdentidadMarcaLab | null ;
    msIdentidad?:     number ;
  } ;
}

export interface FilaBateriaNombres {
  consulta:    string ;
  esperados:   string[] ;
  parcial?:    boolean ;
  estrategias: FilaEstrategiaNombres[] ;
}

export interface MetricasEstrategiaNombres {
  estrategia: IdEstrategiaDominio ;
  enPrimero:  number ;
  enTop3:     number ;
  conIcono:   number ;
  conColor:   number ;
  msPromedio: number ;
}

export interface ResumenNombres {
  total:          number ;
  estrategias:    Record< string , MetricasEstrategiaNombres > ;
  ningunaAcierta: number ;
  alMenosUna:     number ;
}

/**
 * Calcula el resumen cuantitativo de la batería «nombre → ícono».
 *
 * @param filas - Filas procesadas de la batería por nombre.
 * @returns Estructura con métricas agrupadas por estrategia y conteos globales de acierto.
 */
export function resumenNombres(
  filas: FilaBateriaNombres[]
): ResumenNombres {
  const total = filas.length ;
  const acumulado: Record< string , {
    enPrimero: number ;
    enTop3:    number ;
    conIcono:  number ;
    conColor:  number ;
    sumaMs:    number ;
    conteo:    number ;
  } > = {} ;

  let alMenosUna = 0 ;
  let ningunaAcierta = 0 ;

  for( const f of filas ) {
    let algunaFilaAcierta = false ;

    for( const est of f.estrategias ) {
      const nombreEst = est.estrategia ;
      if( !acumulado[nombreEst] ) {
        acumulado[nombreEst] = {
          enPrimero: 0 ,
          enTop3:    0 ,
          conIcono:  0 ,
          conColor:  0 ,
          sumaMs:    0 ,
          conteo:    0
        } ;
      }

      const acc = acumulado[nombreEst] ;
      acc.conteo++ ;
      acc.sumaMs += est.ms ;

      const pos = est.primero.posicionEsperado ;
      if( pos === 0 ) {
        acc.enPrimero++ ;
      }
      if( (pos >= 0) && (pos < 3) ) {
        acc.enTop3++ ;
        algunaFilaAcierta = true ;
      }

      if( est.primero.identidad?.icono ) {
        acc.conIcono++ ;
      }
      if( est.primero.identidad?.color ) {
        acc.conColor++ ;
      }
    }

    if( algunaFilaAcierta ) {
      alMenosUna++ ;
    } else {
      ningunaAcierta++ ;
    }
  }

  const metricasEstrategias: Record< string , MetricasEstrategiaNombres > = {} ;
  for( const [ k , v ] of Object.entries( acumulado ) ) {
    metricasEstrategias[k] = {
      estrategia: k as IdEstrategiaDominio ,
      enPrimero:  v.enPrimero ,
      enTop3:     v.enTop3 ,
      conIcono:   v.conIcono ,
      conColor:   v.conColor ,
      msPromedio: v.conteo > 0 ? Math.round( v.sumaMs / v.conteo ) : 0
    } ;
  }

  return( {
    total ,
    estrategias:    metricasEstrategias ,
    ningunaAcierta ,
    alMenosUna
  } ) ;
}
