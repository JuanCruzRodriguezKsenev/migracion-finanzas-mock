/**
 * @file estrategiasDominio.ts
 * Estrategias de descubrimiento y resolución de dominios de marcas.
 */

// Shared: Brand
import {
  desenvolverArchive ,
  parseResultadosDdg ,
  extraerNombreSitio ,
  dominioDeUrl
} from "@/shared/services/brand/analisisHtml" ;
import {
  fetchSeguro ,
  hostEsPublico
} from "@/shared/services/brand/fetchSeguro" ;

// Feature: Sandbox
import type {
  CandidatoDominio ,
  ResultadoDominios
} from "./tipos" ;

export interface ContextoEstrategiaDominio {
  pais: {
    sufijo: string ;
    nombre: string ;
  } ;
}

interface EntidadWikidataRaw {
  id?:          string ;
  label?:       string ;
  description?: string ;
}

interface ClaimItemRaw {
  mainsnak?: {
    datavalue?: {
      value?: string ;
    } ;
  } ;
}

interface DetalleWikidataRaw {
  entities?: Record< string , {
    claims?: {
      P856?: ClaimItemRaw[] ;
      P154?: ClaimItemRaw[] ;
    } ;
  } > ;
}

/**
 * Genera candidatos especulativos de dominios aplicando 5 reglas heurísticas basadas en la consulta y el país.
 * Función pura sin acceso a red.
 *
 * @param query - Término de búsqueda de la marca.
 * @param pais - Configuración del país para sufijos y nombres locales.
 * @returns Lista de nombres de dominio candidatos.
 */
export function generarCandidatos(
  query: string ,
  pais: { sufijo: string ; nombre: string } | null
): string[] {
  const consultaLimpia = query.toLowerCase().replace( /\s+/g , " " ).trim() ;
  if( !consultaLimpia ) return( [] ) ;

  const palabras   = consultaLimpia.split( " " ) ;
  const candidatos = new Set< string >() ;

  // Si ya contiene punto o barra, tratar como dominio directo
  if( consultaLimpia.includes( "." ) || consultaLimpia.includes( "/" ) ) {
    let d = consultaLimpia.replace( /^(https?:\/\/)?(www\.)?/ , "" ).split( "/" )[0] ;
    if( !d.includes( "." ) ) d = `${d}.com` ;
    candidatos.add( d ) ;
    return( Array.from( candidatos ) ) ;
  }

  // 1. Dominio exacto concatenado directo
  const exactSlug = palabras.join( "" ) ;
  candidatos.add( `${exactSlug}.com` ) ;
  if( pais ) {
    candidatos.add( `${exactSlug}${pais.sufijo}` ) ;
  }

  // 2. Dominio con guiones medios
  const hyphenSlug = palabras.join( "-" ) ;
  candidatos.add( `${hyphenSlug}.com` ) ;
  if( pais ) {
    candidatos.add( `${hyphenSlug}${pais.sufijo}` ) ;
  }

  // 3. Siglas o acrónimo si hay múltiples palabras
  if( palabras.length > 1 ) {
    const acronym = palabras.map( ( p ) => p[0] ).join( "" ) ;
    candidatos.add( `${acronym}.com` ) ;
    if( pais ) {
      candidatos.add( `${acronym}${pais.sufijo}` ) ;
    }
  }

  // 4. Sufijos explícitos del nombre del país
  if( pais ) {
    const countryClean = pais.nombre.toLowerCase().replace( /\s+/g , "" ) ;
    const exactSlugCountry = exactSlug.includes( countryClean ) ? exactSlug : `${exactSlug}${countryClean}` ;
    const hyphenSlugCountry = hyphenSlug.includes( countryClean ) ? hyphenSlug : `${hyphenSlug}-${countryClean}` ;

    candidatos.add( `${exactSlugCountry}.com` ) ;
    candidatos.add( `${exactSlugCountry}${pais.sufijo}` ) ;
    candidatos.add( `${hyphenSlugCountry}.com` ) ;
    candidatos.add( `${hyphenSlugCountry}${pais.sufijo}` ) ;
  }

  // 5. Acrónimo con inicial del país
  if( pais && (palabras.length > 1) ) {
    const acronym = palabras.map( ( p ) => p[0] ).join( "" ) ;
    const countryInitial = pais.nombre[0].toLowerCase() ;
    const acronymCountry = `${acronym}${countryInitial}` ;
    candidatos.add( `${acronymCountry}.com` ) ;
    candidatos.add( `${acronymCountry}${pais.sufijo}` ) ;
  }

  return( Array.from( candidatos ) ) ;
}


/**
 * Consulta la API de entidades de Wikidata (P856 para dominios y P154 para logotipos).
 */
export async function estrategiaWikidata(
  texto: string ,
  contexto: ContextoEstrategiaDominio
): Promise< ResultadoDominios > {
  void contexto ;
  const inicio = performance.now() ;
  const urlSearch = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent( texto )}&language=es&format=json&limit=5` ;

  try {
    const resSearch = await fetchSeguro( urlSearch , { timeoutMs: 6000 } ) ;
    if( !resSearch.ok ) {
      return( {
        estrategia: "wikidata" ,
        ok:         false ,
        ms:         Math.round( performance.now() - inicio ) ,
        estado:     String( resSearch.status ) ,
        candidatos: []
      } ) ;
    }

    const dataSearch = JSON.parse( resSearch.cuerpo?.toString( "utf-8" ) || "{}" ) ;
    const entidades = ( Array.isArray( dataSearch.search ) ? (dataSearch.search as EntidadWikidataRaw[]) : [] ).slice( 0 , 3 ) ;

    const detalles = await Promise.all(
      entidades.map( async( ent ) => {
        const id = ent.id ;
        if( !id ) return( null ) ;
        const urlDetalle = `https://www.wikidata.org/wiki/Special:EntityData/${id}.json` ;
        const resDetalle = await fetchSeguro( urlDetalle , { timeoutMs: 6000 } ) ;
        if( !resDetalle.ok ) return( null ) ;

        try {
          const dataDetalle: DetalleWikidataRaw = JSON.parse( resDetalle.cuerpo?.toString( "utf-8" ) || "{}" ) ;
          const claims = dataDetalle.entities?.[id]?.claims ;
          if( !claims ) return( null ) ;

          const websiteClaim = claims.P856 ;
          const rawWebsite = websiteClaim?.[0]?.mainsnak?.datavalue?.value ;
          if( !rawWebsite ) return( null ) ;

          const websiteDesenvuelta = desenvolverArchive( rawWebsite ) ;
          const dominio = dominioDeUrl( websiteDesenvuelta ) ;
          if( !dominio ) return( null ) ;

          const logoClaim = claims.P154 ;
          const archivoLogo = logoClaim?.[0]?.mainsnak?.datavalue?.value ;

          return( {
            dominio ,
            nombre:      ent.label ,
            detalle:     ent.description ,
            archivoLogo
          } as CandidatoDominio ) ;
        } catch {
          return( null ) ;
        }
      } )
    ) ;

    const candidatosValidos = detalles.filter( ( c ): c is CandidatoDominio => c !== null ) ;

    return( {
      estrategia: "wikidata" ,
      ok:         true ,
      ms:         Math.round( performance.now() - inicio ) ,
      estado:     "200" ,
      candidatos: candidatosValidos
    } ) ;
  } catch( error: unknown ) {
    const errorObj = error as { message?: string } | undefined ;
    return( {
      estrategia: "wikidata" ,
      ok:         false ,
      ms:         Math.round( performance.now() - inicio ) ,
      estado:     errorObj?.message || "error" ,
      candidatos: []
    } ) ;
  }
}

/**
 * Consulta la versión HTML de DuckDuckGo para encontrar sitios oficiales.
 */
export async function estrategiaDuckDuckGo(
  texto: string ,
  contexto: ContextoEstrategiaDominio
): Promise< ResultadoDominios > {
  void contexto ;
  const inicio = performance.now() ;
  const urlDdg = "https://html.duckduckgo.com/html/" ;
  const cuerpo = new URLSearchParams( { q: `${texto} sitio oficial` } ).toString() ;

  try {
    const res = await fetchSeguro( urlDdg , {
      metodo:    "POST" ,
      cuerpo ,
      cabeceras: {
        "Content-Type": "application/x-www-form-urlencoded"
      } ,
      timeoutMs: 6000
    } ) ;

    const duracion = Math.round( performance.now() - inicio ) ;
    const html = res.cuerpo?.toString( "utf-8" ) || "" ;

    if( (res.status === 202) || html.includes( "anomaly" ) ) {
      return( {
        estrategia: "duckduckgo" ,
        ok:         false ,
        ms:         duracion ,
        estado:     "bloqueado (desafío anti-bot, http 202)" ,
        candidatos: []
      } ) ;
    }

    if( !res.ok ) {
      return( {
        estrategia: "duckduckgo" ,
        ok:         false ,
        ms:         duracion ,
        estado:     String( res.status ) ,
        candidatos: []
      } ) ;
    }

    const dominios = parseResultadosDdg( html ).slice( 0 , 5 ) ;
    const candidatos: CandidatoDominio[] = dominios.map( ( dominio ) => ( { dominio } ) ) ;

    return( {
      estrategia: "duckduckgo" ,
      ok:         true ,
      ms:         duracion ,
      estado:     String( res.status ) ,
      candidatos
    } ) ;
  } catch( error: unknown ) {
    const errorObj = error as { message?: string } | undefined ;
    return( {
      estrategia: "duckduckgo" ,
      ok:         false ,
      ms:         Math.round( performance.now() - inicio ) ,
      estado:     errorObj?.message || "error" ,
      candidatos: []
    } ) ;
  }
}

/**
 * Genera candidatos heurísticos y valida su resolución DNS pública con concurrencia 4.
 */
export async function estrategiaCandidatos(
  texto: string ,
  contexto: ContextoEstrategiaDominio
): Promise< ResultadoDominios > {
  const inicio = performance.now() ;

  try {
    const lista = generarCandidatos( texto , contexto.pais ).slice( 0 , 12 ) ;
    const candidatos: CandidatoDominio[] = [] ;

    // Resolución con concurrencia 4
    for( let i = 0 ; i < lista.length ; i += 4 ) {
      const lote = lista.slice( i , i + 4 ) ;
      const resueltos = await Promise.all(
        lote.map( async( dominio ) => {
          const resuelve = await hostEsPublico( dominio ) ;
          return( { dominio , resuelve } ) ;
        } )
      ) ;
      candidatos.push( ...resueltos ) ;
    }

    return( {
      estrategia: "candidatos" ,
      ok:         true ,
      ms:         Math.round( performance.now() - inicio ) ,
      estado:     "200" ,
      candidatos
    } ) ;
  } catch( error: unknown ) {
    const errorObj = error as { message?: string } | undefined ;
    return( {
      estrategia: "candidatos" ,
      ok:         false ,
      ms:         Math.round( performance.now() - inicio ) ,
      estado:     errorObj?.message || "error" ,
      candidatos: []
    } ) ;
  }
}

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

/** TLDs alternativos de producto para la segunda pasada si ningún candidato inicial coincide. */
export const TLDS_PRODUCTO: readonly string[] = [ ".app" , ".io" , ".so" , ".co" , ".ai" ] ;

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
  pais: { sufijo: string ; nombre: string } | null
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
 *
 * @param texto - Consulta de la marca.
 * @param contexto - Contexto con información de país.
 * @returns Lista de candidatos ordenados por coincidencia, resolución y orden inicial.
 */
export async function estrategiaVerificados(
  texto: string ,
  contexto: ContextoEstrategiaDominio
): Promise< ResultadoDominios > {
  const inicio = performance.now() ;

  try {
    const lista = generarCandidatosVerificables( texto , contexto.pais ) ;
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
          resuelve: false ,
          coincide: false
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

      return( {
        dominio ,
        resuelve: true ,
        ...( titulo ? { titulo } : {} ) ,
        ...( nombreSitio ? { nombre: nombreSitio } : {} ) ,
        coincide
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
