/**
 * @file analisisHtml.ts
 * Utilidades puras (sin red) para parsear HTML, manifiestos web y respuestas de motores de búsqueda.
 */

// Shared: Brand
import type { CandidatoIcono } from "./tiposMarca" ;

/**
 * Normaliza y resuelve una URL frente a una URL base.
 * Descarta URIs de datos (data:) y resuelve URLs protocolo-relativas (//host/...).
 *
 * @param href - Enlace extraído del atributo HTML.
 * @param urlBase - URL base para resolver rutas relativas.
 * @returns URL absoluta normalizada o null si es inválida o rechazada.
 */
function resolverUrl( href: string , urlBase: string ): string | null {
  if( !href ) return( null ) ;
  const enlace = href.trim() ;

  if( enlace.startsWith( "data:" ) ) {
    return( null ) ;
  }

  if( enlace.startsWith( "//" ) ) {
    return( `https:${enlace}` ) ;
  }

  try {
    return( new URL( enlace , urlBase ).toString() ) ;
  } catch {
    return( null ) ;
  }
}

/**
 * Extrae la dimensión entera máxima a partir del atributo HTML sizes.
 *
 * @param sizes - Valor del atributo sizes (ej. "180x180", "16x16 32x32", "any").
 * @returns El mayor valor numérico encontrado o undefined si no contiene números.
 */
function parseTamano( sizes: string ): number | undefined {
  if( !sizes ) return( undefined ) ;
  const numeros = sizes.match( /\d+/g )?.map( Number ) ;
  if( !numeros || (numeros.length === 0) ) {
    return( undefined ) ;
  }
  return( Math.max( ...numeros ) ) ;
}

/**
 * Extrae candidatos a ícono de las etiquetas link y meta og:image de un documento HTML.
 *
 * @param html - Cadena de texto con el contenido HTML de la página.
 * @param urlBase - URL base de la página para resolver rutas relativas.
 * @returns Lista de candidatos a ícono detectados.
 */
export function extraerIconos( html: string , urlBase: string ): CandidatoIcono[] {
  if( !html ) return( [] ) ;
  const candidatos: CandidatoIcono[] = [] ;
  const urlsVistas: Set< string >   = new Set() ;

  // Coincidencias de etiquetas <link ...>
  const linkRegex = /<link\b([^>]*)\/?>/gi ;
  let linkMatch: RegExpExecArray | null ;

  while( (linkMatch = linkRegex.exec( html )) !== null ) {
    const atributos = linkMatch[1] ;

    // Extraer rel
    const relMatch = atributos.match( /\brel=["']([^"']*)["']/i ) ;
    if( !relMatch ) continue ;
    const rel = relMatch[1].toLowerCase() ;

    let origen: string | null = null ;
    if( rel.includes( "apple-touch-icon" ) ) {
      origen = "apple-touch-icon" ;
    } else if( rel.includes( "shortcut icon" ) || rel.includes( "icon" ) ) {
      origen = "icon" ;
    }

    if( !origen ) continue ;

    // Extraer href
    const hrefMatch = atributos.match( /\bhref=["']([^"']*)["']/i ) ;
    if( !hrefMatch ) continue ;

    const urlResuelta = resolverUrl( hrefMatch[1] , urlBase ) ;
    if( !urlResuelta || urlsVistas.has( urlResuelta ) ) continue ;

    // Extraer sizes
    const sizesMatch = atributos.match( /\bsizes=["']([^"']*)["']/i ) ;
    const tamano     = sizesMatch ? parseTamano( sizesMatch[1] ) : undefined ;

    // Extraer type
    const typeMatch = atributos.match( /\btype=["']([^"']*)["']/i ) ;
    const tipo      = typeMatch ? typeMatch[1].toLowerCase() : undefined ;

    urlsVistas.add( urlResuelta ) ;
    candidatos.push( {
      url: urlResuelta ,
      origen ,
      tamano ,
      tipo
    } ) ;
  }

  // Coincidencias de etiquetas <meta ...> para og:image
  const metaRegex = /<meta\b([^>]*)\/?>/gi ;
  let metaMatch: RegExpExecArray | null ;

  while( (metaMatch = metaRegex.exec( html )) !== null ) {
    const atributos = metaMatch[1] ;
    const propMatch =
      atributos.match( /\bproperty=["']([^"']*)["']/i ) ||
      atributos.match( /\bname=["']([^"']*)["']/i ) ;

    if( !propMatch || (propMatch[1].toLowerCase() !== "og:image") ) {
      continue ;
    }

    const contentMatch = atributos.match( /\bcontent=["']([^"']*)["']/i ) ;
    if( !contentMatch ) continue ;

    const urlResuelta = resolverUrl( contentMatch[1] , urlBase ) ;
    if( !urlResuelta || urlsVistas.has( urlResuelta ) ) continue ;

    urlsVistas.add( urlResuelta ) ;
    candidatos.push( {
      url:    urlResuelta ,
      origen: "og:image"
    } ) ;
  }

  return( candidatos ) ;
}

/**
 * Extrae la URL del archivo manifest indicado en el HTML.
 *
 * @param html - Contenido HTML.
 * @param urlBase - URL base para resolver el enlace.
 * @returns URL absoluta del manifest o null si no se declara.
 */
export function extraerManifestUrl( html: string , urlBase: string ): string | null {
  if( !html ) return( null ) ;
  const regex = /<link\b[^>]*\brel=["']manifest["'][^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i ;
  const regexInvertido = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']manifest["'][^>]*\/?>/i ;

  const match = html.match( regex ) || html.match( regexInvertido ) ;
  if( match && match[1] ) {
    return( resolverUrl( match[1] , urlBase ) ) ;
  }
  return( null ) ;
}

interface ManifestIconoItem {
  src?:   string ;
  sizes?: string ;
  type?:  string ;
}

interface ManifestEstructura {
  icons?:       ManifestIconoItem[] ;
  theme_color?: string ;
}

/**
 * Parsea el JSON del manifest web de forma tolerante y extrae íconos y theme_color.
 *
 * @param json - Objeto parseado o cadena cruda del manifest.
 * @param urlManifest - URL del manifest para resolver rutas de íconos.
 * @returns Objeto con lista de íconos y themeColor si está presente.
 */
export function iconosDeManifest(
  json: unknown ,
  urlManifest: string
): { iconos: CandidatoIcono[] ; themeColor?: string } {
  let objeto: unknown = json ;
  if( typeof json === "string" ) {
    try {
      objeto = JSON.parse( json ) ;
    } catch {
      return( { iconos: [] } ) ;
    }
  }

  if( !objeto || (typeof objeto !== "object") ) {
    return( { iconos: [] } ) ;
  }

  const manifest = objeto as ManifestEstructura ;
  const iconos: CandidatoIcono[] = [] ;
  if( Array.isArray( manifest.icons ) ) {
    for( const item of manifest.icons ) {
      if( !item?.src ) continue ;
      const urlResuelta = resolverUrl( item.src , urlManifest ) ;
      if( !urlResuelta ) continue ;

      const tamano = item.sizes ? parseTamano( item.sizes ) : undefined ;
      iconos.push( {
        url:    urlResuelta ,
        origen: "manifest" ,
        tamano ,
        tipo:   item.type
      } ) ;
    }
  }

  let themeColor: string | undefined ;
  if( typeof manifest.theme_color === "string" ) {
    const colorLimpio = manifest.theme_color.trim() ;
    if( /^#[0-9a-fA-F]{6}$/.test( colorLimpio ) ) {
      themeColor = colorLimpio ;
    }
  }

  return( { iconos , themeColor } ) ;
}

/**
 * Extrae y valida el color de tema definido en <meta name="theme-color">.
 *
 * @param html - Contenido HTML.
 * @returns Color hexadecimal en formato #rrggbb o undefined.
 */
export function extraerThemeColor( html: string ): string | undefined {
  if( !html ) return( undefined ) ;
  const regex = /<meta\b[^>]*\bname=["']theme-color["'][^>]*\bcontent=["']([^"']+)["'][^>]*\/?>/i ;
  const regexInvertido = /<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bname=["']theme-color["'][^>]*\/?>/i ;

  const match = html.match( regex ) || html.match( regexInvertido ) ;
  if( match && match[1] ) {
    const color = match[1].trim() ;
    if( /^#[0-9a-fA-F]{6}$/.test( color ) ) {
      return( color ) ;
    }
  }
  return( undefined ) ;
}

/**
 * Asigna una puntuación de prioridad a un ícono en ausencia de tamaños explícitos.
 *
 * @param icono - Candidato a ícono.
 * @returns Puntaje numérico mayor para mejor candidato.
 */
function puntajeTipoIcono( icono: CandidatoIcono ): number {
  if( icono.origen === "apple-touch-icon" ) return( 5 ) ;
  const urlBaja  = icono.url.toLowerCase() ;
  const tipoBajo = (icono.tipo || "").toLowerCase() ;

  if( tipoBajo.includes( "svg" ) || urlBaja.endsWith( ".svg" ) ) return( 4 ) ;
  if( tipoBajo.includes( "png" ) || urlBaja.endsWith( ".png" ) ) return( 3 ) ;
  if( icono.origen === "manifest" ) return( 2 ) ;
  if( tipoBajo.includes( "icon" ) || urlBaja.endsWith( ".ico" ) ) return( 1 ) ;
  return( 1 ) ;
}

/**
 * Selecciona el mejor ícono disponible de una lista de candidatos según tamaño y formato.
 *
 * @param candidatos - Lista de candidatos a íconos.
 * @returns El mejor candidato seleccionado o null si no hay candidatos.
 */
export function elegirMejorIcono( candidatos: CandidatoIcono[] ): CandidatoIcono | null {
  if( !candidatos || (candidatos.length === 0) ) {
    return( null ) ;
  }

  // Separar og:image para dejarlo estrictamente al final
  const sinOg = candidatos.filter( ( c ) => c.origen !== "og:image" ) ;
  if( sinOg.length === 0 ) {
    return( candidatos[0] ) ;
  }

  // Candidatos con tamaño explícito conocido
  const conTamano = sinOg.filter( ( c ) => typeof c.tamano === "number" ) ;
  if( conTamano.length > 0 ) {
    conTamano.sort( ( a , b ) => {
      const difTamano = (b.tamano || 0) - (a.tamano || 0) ;
      if( difTamano !== 0 ) return( difTamano ) ;
      return( puntajeTipoIcono( b ) - puntajeTipoIcono( a ) ) ;
    } ) ;
    return( conTamano[0] ) ;
  }

  // Sin tamaños: ordenar por tipo y origen
  const ordenados = [...sinOg].sort( ( a , b ) => puntajeTipoIcono( b ) - puntajeTipoIcono( a ) ) ;
  return( ordenados[0] ) ;
}

/**
 * Parsea los resultados de DuckDuckGo HTML extrayendo los dominios limpios únicos.
 *
 * @param html - HTML devuelto por la búsqueda de DuckDuckGo.
 * @returns Lista de dominios limpios sin www.
 */
export function parseResultadosDdg( html: string ): string[] {
  if( !html ) return( [] ) ;
  const dominiosUnicos: Set< string > = new Set() ;

  const regex1 = /<a\b[^>]*\bclass=["'][^"']*\bresult__a\b[^"']*["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi ;
  const regex2 = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*\bclass=["'][^"']*\bresult__a\b[^"']*["'][^>]*>/gi ;

  function agregarDestino( href: string ) {
    let urlFinal = href ;
    if( href.includes( "uddg=" ) ) {
      try {
        const u = new URL( href.startsWith( "//" ) ? `https:${href}` : href , "https://duckduckgo.com" ) ;
        const param = u.searchParams.get( "uddg" ) ;
        if( param ) {
          urlFinal = decodeURIComponent( param ) ;
        }
      } catch {
        const m = href.match( /[?&]uddg=([^&]+)/ ) ;
        if( m && m[1] ) {
          urlFinal = decodeURIComponent( m[1] ) ;
        }
      }
    }

    const dominio = dominioDeUrl( urlFinal ) ;
    if( dominio && !dominio.includes( "duckduckgo.com" ) ) {
      dominiosUnicos.add( dominio ) ;
    }
  }

  let m: RegExpExecArray | null ;
  while( (m = regex1.exec( html )) !== null ) {
    agregarDestino( m[1] ) ;
  }
  while( (m = regex2.exec( html )) !== null ) {
    agregarDestino( m[1] ) ;
  }

  return( Array.from( dominiosUnicos ) ) ;
}

/**
 * Desenvuelve URLs archivadas en Wayback Machine devolviendo la URL original.
 *
 * @param url - URL a evaluar.
 * @returns URL original desenvuelta o la misma URL si no pertenece al archivo.
 */
export function desenvolverArchive( url: string ): string {
  if( !url ) return( "" ) ;
  const regex = /^https?:\/\/web\.archive\.org\/web\/(?:[^/]+\/)*(https?:\/\/.+)$/i ;
  const match = url.match( regex ) ;
  if( match && match[1] ) {
    return( match[1] ) ;
  }
  return( url ) ;
}

/**
 * Extrae el nombre de dominio en minúsculas y sin subdominio www.
 *
 * @param url - URL o dominio textual.
 * @returns Dominio normalizado o null si la URL es inválida.
 */
export function dominioDeUrl( url: string ): string | null {
  if( !url ) return( null ) ;
  try {
    let u = url.trim() ;
    if( !u.startsWith( "http://" ) && !u.startsWith( "https://" ) ) {
      u = `https://${u}` ;
    }
    const parsed = new URL( u ) ;
    let host = parsed.hostname.toLowerCase() ;
    if( host.startsWith( "www." ) ) {
      host = host.slice( 4 ) ;
    }
    return( host || null ) ;
  } catch {
    return( null ) ;
  }
}
