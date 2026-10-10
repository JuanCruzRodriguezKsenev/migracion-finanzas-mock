/**
 * @file brandSearch.ts
 * Búsqueda de marcas compartida contra la API de Brandfetch con resolución
 * de consultas por sufijos, ordenación por país prioritario y bandera por TLD.
 */

/** Resultado de marca devuelto por la búsqueda compartida. */
export interface MarcaEncontrada {
  name:           string ;
  domain:         string ;
  icon?:          string ;
  coincide?:      boolean ;
  confianzaAlta?: boolean ;
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
 * Construye la lista de variantes de consulta a buscar.
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
 * Consulta el endpoint interno /api/brand con la consulta y el país configurado,
 * prioriza dominios asociados al país prioritario y aplica el límite solicitado.
 */
export async function buscarMarcas( texto: string , opciones: OpcionesBusquedaMarcas = {} ): Promise< MarcaEncontrada[] > {
  const limpio = texto.trim() ;
  if( !limpio ) {
    return( [] ) ;
  }

  const params = new URLSearchParams() ;
  params.set( "q" , limpio ) ;
  if( opciones.paisPrioritario ) {
    params.set( "pais" , opciones.paisPrioritario ) ;
  }

  let marcas: MarcaEncontrada[] = [] ;
  try {
    const res = await fetch( `/api/brand?${params.toString()}` ) ;
    if( res.ok ) {
      const datos = await res.json() ;
      if( Array.isArray( datos ) ) {
        marcas = datos ;
      }
    }
  } catch {
    return( [] ) ;
  }

  const pais = opciones.paisPrioritario?.trim().toLowerCase() ;
  const ordenadas = [ ...marcas ] ;
  if( pais ) {
    ordenadas.sort( ( a , b ) => {
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
    return( ordenadas.slice( 0 , opciones.limite ) ) ;
  }

  return( ordenadas ) ;
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
