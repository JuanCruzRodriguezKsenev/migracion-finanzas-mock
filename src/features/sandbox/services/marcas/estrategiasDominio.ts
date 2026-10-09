/**
 * @file estrategiasDominio.ts
 * Estrategias de descubrimiento y resolución de dominios de marcas.
 */

// Shared: Brand
import {
  desenvolverArchive ,
  parseResultadosDdg ,
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
  clientIdBrandfetch: string ;
  pais: {
    sufijo: string ;
    nombre: string ;
  } ;
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

interface ItemBrandfetchRaw {
  domain?: string ;
  name?:   string ;
  icon?:   string ;
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
 * Consulta la Search API de Brandfetch para descubrir dominios asociados.
 */
export async function estrategiaBrandfetchSearch(
  texto: string ,
  contexto: ContextoEstrategiaDominio
): Promise< ResultadoDominios > {
  const inicio = performance.now() ;
  const clientId = contexto.clientIdBrandfetch || process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID || "brandfetch" ;
  const url = `https://api.brandfetch.io/v2/search/${encodeURIComponent( texto )}?c=${encodeURIComponent( clientId )}` ;

  try {
    const res = await fetchSeguro( url , { timeoutMs: 6000 } ) ;
    const duracion = Math.round( performance.now() - inicio ) ;

    if( !res.ok ) {
      return( {
        estrategia: "brandfetch-search" ,
        ok:         false ,
        ms:         duracion ,
        estado:     String( res.status ) ,
        candidatos: []
      } ) ;
    }

    const json = JSON.parse( res.cuerpo?.toString( "utf-8" ) || "[]" ) ;
    const candidatos: CandidatoDominio[] = ( Array.isArray( json ) ? (json as ItemBrandfetchRaw[]) : [] )
      .slice( 0 , 5 )
      .map( ( item ) => ( {
        dominio:          item.domain || "" ,
        nombre:           item.name ,
        iconoBrandfetch:  item.icon
      } ) ) ;

    return( {
      estrategia: "brandfetch-search" ,
      ok:         true ,
      ms:         duracion ,
      estado:     "200" ,
      candidatos
    } ) ;
  } catch( error: unknown ) {
    const errorObj = error as { message?: string } | undefined ;
    return( {
      estrategia: "brandfetch-search" ,
      ok:         false ,
      ms:         Math.round( performance.now() - inicio ) ,
      estado:     errorObj?.message || "error" ,
      candidatos: []
    } ) ;
  }
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
