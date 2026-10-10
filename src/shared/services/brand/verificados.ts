/**
 * @file verificados.ts
 * Estrategia de descubrimiento y verificación de dominios de marcas sin proveedores externos.
 */

// Shared: Brand
import { extraerNombreSitio } from "@/shared/services/brand/analisisHtml" ;
import {
  fetchSeguro ,
  hostEsPublico
} from "@/shared/services/brand/fetchSeguro" ;

// Feature: Sandbox
import type {
  CandidatoDominio ,
  ResultadoDominios
} from "@/features/sandbox/services/marcas/tipos" ;

export interface ContextoEstrategiaDominio {
  pais?: {
    sufijo: string ;
    nombre: string ;
  } | null ;
}

/** TLDs alternativos de producto para la segunda pasada si ningún candidato inicial coincide. */
export const TLDS_PRODUCTO: readonly string[] = [ ".app" , ".io" , ".so" , ".co" , ".ai" ] ;

/**
 * Normaliza una cadena a minúsculas, sin acentos ni signos y con espacios simples.
 */
function normalizarTexto( texto: string ): string {
  return(
    texto
      .toLowerCase()
      .normalize( "NFD" )
      .replace( /[\u0300-\u036f]/g , "" )
      .replace( /[^a-z0-9\s]/g , " " )
      .replace( /\s+/g , " " )
      .trim()
  ) ;
}

/**
 * Evalúa si el apex del dominio o el primer segmento sin `www` coincide exactamente con
 * el slug alfanumérico de la consulta (ej: slug === "chatgpt" y dominio === "chatgpt.com").
 *
 * @param dominio - Nombre de dominio a comprobar.
 * @param textoConsulta - Término de búsqueda de la marca.
 * @returns true si la primera etiqueta del dominio es idéntica al slug de la consulta.
 */
export function esEtiquetaExacta( dominio: string , textoConsulta: string ): boolean {
  const slugConsulta = normalizarTexto( textoConsulta ).replace( /\s+/g , "" ) ;
  if( !slugConsulta ) {
    return( false ) ;
  }

  const limpio   = dominio.toLowerCase().replace( /^(https?:\/\/)?(www\.)?/ , "" ) ;
  const etiqueta = limpio.split( "." )[0] ;

  return( etiqueta === slugConsulta ) ;
}

/**
 * Evalúa si el título HTML indica que el dominio está estacionado o a la venta.
 *
 * @param titulo - Título extraído de la página web.
 * @returns true si el título contiene frases de venta o aparcamiento conocidas.
 */
export function titulaDominioEnVenta( titulo: string ): boolean {
  const normalizado = normalizarTexto( titulo ) ;
  const patrones = [
    "for sale" ,
    "a la venta" ,
    "se vende" ,
    "hugedomains" ,
    "buy this domain" ,
    "domain is available" ,
    "parked"
  ] ;
  return( patrones.some( ( p ) => normalizado.includes( p ) ) ) ;
}

/**
 * Genera candidatos especulativos verificables basados en el texto y el país.
 * Función pura sin acceso a red.
 *
 * @param texto - Término de búsqueda de la marca.
 * @param pais - Configuración del país para sufijos y nombres locales.
 * @returns Lista de nombres de dominio candidatos (máximo 10).
 */
export function generarCandidatosVerificables(
  texto: string ,
  pais?: { sufijo: string ; nombre: string } | null
): string[] {
  const consultaLimpia = normalizarTexto( texto ) ;
  if( !consultaLimpia ) return( [] ) ;

  const palabras   = consultaLimpia.split( " " ).filter( Boolean ) ;
  const candidatos = new Set< string >() ;

  const slug  = palabras.join( "" ) ;
  const guion = (palabras.length > 1) ? palabras.join( "-" ) : null ;

  const tldsSlug: string[] = [] ;
  if( pais ) {
    tldsSlug.push( pais.sufijo ) ;
    const partes = pais.sufijo.split( "." ).filter( Boolean ) ;
    const ccTld  = partes.length > 0 ? `.${partes[partes.length - 1]}` : pais.sufijo ;
    if( !tldsSlug.includes( ccTld ) ) {
      tldsSlug.push( ccTld ) ;
    }
    if( !tldsSlug.includes( ".com" ) ) {
      tldsSlug.push( ".com" ) ;
    }
  } else {
    tldsSlug.push( ".com" ) ;
  }

  for( const tld of tldsSlug ) {
    candidatos.add( `${slug}${tld}` ) ;
  }

  if( guion ) {
    if( pais ) {
      candidatos.add( `${guion}${pais.sufijo}` ) ;
      candidatos.add( `${guion}.com` ) ;
    } else {
      candidatos.add( `${guion}.com` ) ;
    }
  }

  if( palabras.length > 1 ) {
    const sigla = palabras.map( ( p ) => p[0] ).join( "" ) ;
    if( pais ) {
      const siglaPais = `${sigla}${pais.nombre[0].toLowerCase()}` ;
      candidatos.add( `${sigla}${pais.sufijo}` ) ;
      candidatos.add( `${sigla}.com` ) ;
      candidatos.add( `${siglaPais}${pais.sufijo}` ) ;
      candidatos.add( `${siglaPais}.com` ) ;
    } else {
      candidatos.add( `${sigla}.com` ) ;
    }
  }

  return( Array.from( candidatos ).slice( 0 , 10 ) ) ;
}

/**
 * Consulta y valida dominios candidatos mediante DNS y extracción de título HTML.
 * Incorpora la bandera confianzaAlta indicando coincidencia de contenido o de slug.
 *
 * @param texto - Consulta de la marca.
 * @param contexto - Contexto con información opcional de país.
 * @returns Lista de candidatos ordenados por coincidencia, resolución y orden inicial.
 */
export async function estrategiaVerificados(
  texto:     string ,
  contexto?: ContextoEstrategiaDominio
): Promise< ResultadoDominios > {
  const inicio = performance.now() ;

  try {
    const lista = generarCandidatosVerificables( texto , contexto?.pais ) ;
    const candidatos: CandidatoDominio[] = [] ;
    const consultaNormalizada = normalizarTexto( texto ) ;
    const palabrasConsulta    = consultaNormalizada.split( " " ).filter( ( p ) => p.length >= 2 ) ;

    const verificarDominio = async( dominio: string ): Promise< CandidatoDominio > => {
      let hostParaFetch = dominio ;
      let resuelve      = await hostEsPublico( dominio ) ;

      if( !resuelve && !dominio.startsWith( "www." ) ) {
        const resuelveWww = await hostEsPublico( `www.${dominio}` ) ;
        if( resuelveWww ) {
          resuelve      = true ;
          hostParaFetch = `www.${dominio}` ;
        }
      }

      if( !resuelve ) {
        return( {
          dominio ,
          resuelve:      false ,
          coincide:      false ,
          confianzaAlta: false
        } as CandidatoDominio ) ;
      }

      let titulo: string | undefined ;
      let nombreSitio: string | undefined ;

      try {
        const res = await fetchSeguro( `https://${hostParaFetch}/` , {
          timeoutMs: 4000 ,
          maxBytes:  256 * 1024
        } ) ;

        if( res.ok && res.cuerpo ) {
          const html = res.cuerpo.toString( "utf-8" ) ;
          const info = extraerNombreSitio( html ) ;
          titulo      = info.titulo ;
          nombreSitio = info.nombreSitio ;
        }
      } catch {
        // Un fallo del pedido deja resuelve: true sin título
      }

      let coincide = false ;
      if( titulo ) {
        if( titulaDominioEnVenta( titulo ) ) {
          coincide = false ;
        } else {
          const textoSitio = normalizarTexto( `${titulo} ${nombreSitio || ""}` ) ;
          coincide = (palabrasConsulta.length > 0) && palabrasConsulta.every( ( p ) => textoSitio.includes( p ) ) ;
        }
      }

      const confianzaAlta = (coincide === true) || esEtiquetaExacta( dominio , texto ) ;

      return( {
        dominio ,
        resuelve: true ,
        ...( titulo ? { titulo } : {} ) ,
        ...( nombreSitio ? { nombre: nombreSitio } : {} ) ,
        coincide ,
        confianzaAlta
      } as CandidatoDominio ) ;
    } ;

    const procesarLotes = async( dominios: string[] ): Promise< CandidatoDominio[] > => {
      const acumulados: CandidatoDominio[] = [] ;
      for( let i = 0 ; i < dominios.length ; i += 4 ) {
        const lote       = dominios.slice( i , i + 4 ) ;
        const procesados = await Promise.all( lote.map( ( d ) => verificarDominio( d ) ) ) ;
        acumulados.push( ...procesados ) ;
      }
      return( acumulados ) ;
    } ;

    candidatos.push( ...( await procesarLotes( lista ) ) ) ;

    // Segunda pasada si ningún candidato inicial coincide
    const tieneCoincidencia = candidatos.some( ( c ) => c.coincide === true ) ;
    if( !tieneCoincidencia ) {
      const palabras = consultaNormalizada.split( " " ).filter( Boolean ) ;
      const slug     = palabras.join( "" ) ;
      if( slug ) {
        const yaEvaluados  = new Set( candidatos.map( ( c ) => c.dominio ) ) ;
        const listaSegunda = TLDS_PRODUCTO
          .map( ( tld ) => `${slug}${tld}` )
          .filter( ( d ) => !yaEvaluados.has( d ) ) ;

        if( listaSegunda.length > 0 ) {
          const procesadosSegunda = await procesarLotes( listaSegunda ) ;
          candidatos.push( ...procesadosSegunda ) ;
        }
      }
    }

    // Orden de salida: coincide primero, luego resuelve, luego orden original de la lista
    const ordenados = [...candidatos].sort( ( a , b ) => {
      const cA = a.coincide ? 1 : 0 ;
      const cB = b.coincide ? 1 : 0 ;
      if( cB !== cA ) return( cB - cA ) ;

      const rA = a.resuelve ? 1 : 0 ;
      const rB = b.resuelve ? 1 : 0 ;
      if( rB !== rA ) return( rB - rA ) ;

      return( 0 ) ;
    } ) ;

    return( {
      estrategia: "verificados" ,
      ok:         true ,
      ms:         Math.round( performance.now() - inicio ) ,
      estado:     "200" ,
      candidatos: ordenados.slice( 0 , 10 )
    } ) ;
  } catch( error: unknown ) {
    const errorObj = error as { message?: string } | undefined ;
    return( {
      estrategia: "verificados" ,
      ok:         false ,
      ms:         Math.round( performance.now() - inicio ) ,
      estado:     errorObj?.message || "error" ,
      candidatos: []
    } ) ;
  }
}
