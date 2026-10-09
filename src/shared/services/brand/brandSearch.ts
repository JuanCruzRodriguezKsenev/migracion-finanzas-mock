/**
 * @file brandSearch.ts
 * Búsqueda de marcas compartida contra la API de Brandfetch con resolución
 * de consultas por sufijos, ordenación por país prioritario y bandera por TLD.
 */

/** Resultado de marca devuelto por la búsqueda compartida. */
export interface MarcaEncontrada {
  name:    string ;
  domain:  string ;
  icon?:   string ;
}

/** Opciones de configuración para la búsqueda de marcas. */
export interface OpcionesBusquedaMarcas {
  /** Sufijos que se agregan al texto cuando éste no tiene punto: [ ".com" , ".com.ar" , ".ar" ]. */
  sufijos?:         string[] ;
  /** ccTLD en minúscula ("ar"): sus dominios van primero. Vacío o ausente: no ordena. */
  paisPrioritario?: string ;
  /** Tope de resultados. Ausente: sin tope. */
  limite?:          number ;
}

/**
 * Construye la lista de variantes de consulta a buscar en Brandfetch.
 * Si el texto ya contiene un punto, no se expanden sufijos adicionales.
 */
export function construirConsultas( texto: string , sufijos: string[] = [] ): string[] {
  const limpio = texto.trim() ;

  if( limpio.includes( "." ) ) {
    return( [ limpio ] ) ;
  }

  return( [ limpio , ...sufijos.map( ( s ) => limpio + s ) ] ) ;
}

/**
 * Consulta la API de Brandfetch en paralelo para todas las variantes construidas,
 * unifica los resultados eliminando duplicados de dominio (case-insensitive),
 * prioriza dominios asociados al país configurado y aplica el límite solicitado.
 */
export async function buscarMarcas( texto: string , opciones: OpcionesBusquedaMarcas = {} ): Promise< MarcaEncontrada[] > {
  const limpio    = texto.trim() ;
  const clientId  = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID || "brandfetch" ;
  const consultas = construirConsultas( limpio , opciones.sufijos || [] ) ;

  const respuestas = await Promise.all(
    consultas.map( async ( q ) => {
      try {
        const res = await fetch( `https://api.brandfetch.io/v2/search/${encodeURIComponent( q )}?c=${clientId}` ) ;
        if( !res.ok ) {
          return( [] ) ;
        }
        const datos = await res.json() ;
        return( Array.isArray( datos ) ? datos : [] ) ;
      } catch {
        return( [] ) ;
      }
    } )
  ) ;

  const resultado      : MarcaEncontrada[] = [] ;
  const dominiosVistos : Set< string >     = new Set() ;

  for( const res of respuestas ) {
    if( Array.isArray( res ) ) {
      for( const item of res ) {
        if( item && ( typeof item === "object" ) && ( typeof item.domain === "string" ) && ( item.domain.length > 0 ) ) {
          const clave = item.domain.toLowerCase() ;
          if( !dominiosVistos.has( clave ) ) {
            dominiosVistos.add( clave ) ;
            resultado.push( {
              name:   ( item.name && ( typeof item.name === "string" ) && ( item.name.length > 0 ) ) ? item.name : item.domain ,
              domain: item.domain ,
              ...( ( item.icon && ( typeof item.icon === "string" ) ) ? { icon: item.icon } : {} )
            } ) ;
          }
        }
      }
    }
  }

  const pais = opciones.paisPrioritario?.trim().toLowerCase() ;
  if( pais ) {
    resultado.sort( ( a , b ) => {
      const aDom   = a.domain.toLowerCase() ;
      const bDom   = b.domain.toLowerCase() ;
      const aLocal = aDom.endsWith( `.${pais}` ) || aDom.includes( `.${pais}.` ) ;
      const bLocal = bDom.endsWith( `.${pais}` ) || bDom.includes( `.${pais}.` ) ;
      if( aLocal && !bLocal ) { return( -1 ) ; }
      if( !aLocal && bLocal ) { return( 1 ) ; }
      return( 0 ) ;
    } ) ;
  }

  if( ( typeof opciones.limite === "number" ) && ( opciones.limite >= 0 ) ) {
    return( resultado.slice( 0 , opciones.limite ) ) ;
  }

  return( resultado ) ;
}

/**
 * Resuelve la bandera del país asociada al TLD de 2 letras de un dominio.
 * Si el dominio no posee TLD de 2 letras o falla la conversión Unicode, devuelve 🌐.
 */
export function banderaDeDominio( domain: string ): string {
  const parts = domain.toLowerCase().split( "." ) ;
  const tld   = parts[parts.length - 1] ;

  if( tld && ( tld.length === 2 ) ) {
    try {
      const codePoints = tld
        .toUpperCase()
        .split( "" )
        .map( ( char ) => 127397 + char.charCodeAt( 0 ) ) ;
      return( String.fromCodePoint( ...codePoints ) ) ;
    } catch {
      return( "🌐" ) ;
    }
  }

  return( "🌐" ) ;
}
