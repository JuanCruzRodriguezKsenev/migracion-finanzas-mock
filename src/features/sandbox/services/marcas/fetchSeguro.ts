/**
 * @file fetchSeguro.ts
 * Capa de transporte HTTP y validación de red para prevenir Server-Side Request Forgery (SSRF).
 *
 * Riesgo residual aceptado: El host se resuelve por DNS durante la validación previa y nuevamente
 * al establecer la conexión con fetch (DNS rebinding). Este riesgo es tolerable en el laboratorio
 * dado que el endpoint requiere sesión activa de usuario y se encuentra desactivado en producción.
 */

// Librerías externas
import dns from "dns" ;
import net from "net" ;

export const USER_AGENT_LABORATORIO =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36" ;

export interface OpcionesFetchSeguro {
  metodo?:           string ;
  cuerpo?:           BodyInit | null ;
  cabeceras?:        Record< string , string > ;
  timeoutMs?:        number ;
  maxBytes?:         number ;
  maxRedirecciones?: number ;
  validarHost?:      ( host: string ) => boolean ;
}

export interface RespuestaSegura {
  ok:       boolean ;
  status:   number ;
  urlFinal: string ;
  tipo:     string ;
  cuerpo:   Buffer | null ;
  estado:   string ;
}

/**
 * Evalúa si una dirección IPv4 pertenece a rangos reservados o privados.
 *
 * @param ip - Dirección IPv4 en formato a.b.c.d.
 * @returns true si la IP es privada o reservada.
 */
function esIpv4Privada( ip: string ): boolean {
  const partes = ip.split( "." ).map( ( n ) => Number( n ) ) ;
  if( (partes.length !== 4) || partes.some( ( n ) => isNaN( n ) || (n < 0) || (n > 255) ) ) {
    return( true ) ;
  }
  const [ a , b ] = partes ;
  if( a === 0 ) return( true ) ;
  if( a === 10 ) return( true ) ;
  if( (a === 100) && (b >= 64) && (b <= 127) ) return( true ) ;
  if( a === 127 ) return( true ) ;
  if( (a === 169) && (b === 254) ) return( true ) ;
  if( (a === 172) && (b >= 16) && (b <= 31) ) return( true ) ;
  if( (a === 192) && (b === 168) ) return( true ) ;
  if( a >= 224 ) return( true ) ;
  return( false ) ;
}

/**
 * Evalúa si una dirección IP (IPv4 o IPv6) es privada, local o reservada.
 *
 * @param ip - Dirección IP en formato textual.
 * @returns true si la dirección es privada.
 */
export function esIpPrivada( ip: string ): boolean {
  const ipLimpia = ip.trim().toLowerCase() ;

  // Direcciones IPv4 mapeadas en IPv6 (ej. ::ffff:127.0.0.1)
  if( ipLimpia.startsWith( "::ffff:" ) ) {
    const parteV4 = ipLimpia.replace( "::ffff:" , "" ) ;
    if( parteV4.includes( "." ) ) {
      return( esIpv4Privada( parteV4 ) ) ;
    }
  }

  // IPv6 loopback o sin especificar
  if( (ipLimpia === "::") || (ipLimpia === "::0") || (ipLimpia === "::1") ) {
    return( true ) ;
  }

  // IPv6 ULA (fc00::/7 -> fc.. o fd..)
  if( /^f[cd][0-9a-f]{2}:/i.test( ipLimpia ) || ipLimpia.startsWith( "fc" ) || ipLimpia.startsWith( "fd" ) ) {
    return( true ) ;
  }

  // IPv6 Link-Local (fe80::/10 -> fe8.., fe9.., fea.., feb..)
  if( /^fe[89ab][0-9a-f]:/i.test( ipLimpia ) ) {
    return( true ) ;
  }

  // Si es IPv4 estándar
  if( net.isIPv4( ipLimpia ) ) {
    return( esIpv4Privada( ipLimpia ) ) ;
  }

  // Si no es un formato IPv6 reconocido como público global
  if( net.isIPv6( ipLimpia ) ) {
    return( false ) ;
  }

  return( true ) ;
}

/**
 * Limpia y valida sintácticamente un dominio, asegurando que no sea localhost ni una IP literal.
 *
 * @param texto - Texto del dominio o URL a validar.
 * @returns El dominio normalizado en minúsculas o null si es inválido.
 */
export function validarDominio( texto: string ): string | null {
  if( !texto ) return( null ) ;

  let limpio = texto.trim().toLowerCase() ;
  limpio = limpio.replace( /^[a-z]+:\/\// , "" ) ;
  limpio = limpio.split( "/" )[0] ;
  limpio = limpio.split( "?" )[0] ;
  limpio = limpio.split( "#" )[0] ;
  limpio = limpio.split( ":" )[0] ;

  if( !limpio ) return( null ) ;

  // Rechazar literales IP
  if( net.isIP( limpio ) !== 0 || /^(\d+\.){3}\d+$/.test( limpio ) ) {
    return( null ) ;
  }

  // Rechazar localhost y dominios internos
  if( (limpio === "localhost") || limpio.endsWith( ".localhost" ) || limpio.endsWith( ".local" ) || limpio.endsWith( ".internal" ) || limpio.endsWith( ".lan" ) ) {
    return( null ) ;
  }

  // Validar formato de dominio estándar RFC
  const regexDominio = /^(?=.{1,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/ ;
  if( !regexDominio.test( limpio ) ) {
    return( null ) ;
  }

  // Etiquetas no pueden empezar ni terminar con guión
  const etiquetas = limpio.split( "." ) ;
  for( const etiqueta of etiquetas ) {
    if( etiqueta.startsWith( "-" ) || etiqueta.endsWith( "-" ) ) {
      return( null ) ;
    }
  }

  return( limpio ) ;
}

/**
 * Resuelve el host mediante DNS y verifica que todas sus direcciones IP sean públicas.
 *
 * @param host - Nombre de host a resolver.
 * @returns true si resuelve y ninguna IP es privada.
 */
export function hostEsPublico( host: string ): Promise< boolean > {
  return(
    dns.promises
      .lookup( host , { all: true } )
      .then( ( direcciones ) => {
        if( !direcciones || (direcciones.length === 0) ) {
          return( false ) ;
        }
        for( const item of direcciones ) {
          if( esIpPrivada( item.address ) ) {
            return( false ) ;
          }
        }
        return( true ) ;
      } )
      .catch( () => false )
  ) ;
}

/**
 * Realiza una petición HTTP/HTTPS segura protegiendo contra SSRF, redirecciones inseguras
 * y excesos de tamaño de respuesta.
 *
 * @param urlInicial - URL objetivo a consultar.
 * @param opciones - Parámetros de configuración de la petición.
 * @returns Objeto RespuestaSegura con el resultado obtenido. Nunca lanza excepciones.
 */
export async function fetchSeguro(
  urlInicial: string ,
  opciones: OpcionesFetchSeguro = {}
): Promise< RespuestaSegura > {
  const {
    metodo = "GET" ,
    cuerpo = null ,
    cabeceras = {} ,
    timeoutMs = 6000 ,
    maxBytes ,
    maxRedirecciones = 4
  } = opciones ;

  let urlActual = urlInicial ;
  let redireccionesRestantes = maxRedirecciones ;
  let cuerpoActual = cuerpo ;
  let metodoActual = metodo ;

  while( true ) {
    let urlObj: URL ;
    try {
      urlObj = new URL( urlActual ) ;
    } catch {
      return( {
        ok:       false ,
        status:   0 ,
        urlFinal: urlActual ,
        tipo:     "" ,
        cuerpo:   null ,
        estado:   "url invalida"
      } ) ;
    }

    if( (urlObj.protocol !== "http:") && (urlObj.protocol !== "https:") ) {
      return( {
        ok:       false ,
        status:   0 ,
        urlFinal: urlActual ,
        tipo:     "" ,
        cuerpo:   null ,
        estado:   "protocolo no permitido"
      } ) ;
    }

    const puerto = urlObj.port ;
    if( puerto && (puerto !== "80") && (puerto !== "443") ) {
      return( {
        ok:       false ,
        status:   0 ,
        urlFinal: urlActual ,
        tipo:     "" ,
        cuerpo:   null ,
        estado:   "puerto no permitido"
      } ) ;
    }

    const esPublico = await hostEsPublico( urlObj.hostname ) ;
    if( !esPublico ) {
      return( {
        ok:       false ,
        status:   0 ,
        urlFinal: urlActual ,
        tipo:     "" ,
        cuerpo:   null ,
        estado:   "host privado o no resoluble"
      } ) ;
    }

    if( opciones.validarHost && !opciones.validarHost( urlObj.hostname ) ) {
      return( {
        ok:       false ,
        status:   0 ,
        urlFinal: urlActual ,
        tipo:     "" ,
        cuerpo:   null ,
        estado:   "host no permitido"
      } ) ;
    }

    const controller = new AbortController() ;
    const timer = setTimeout( () => {
      controller.abort( new Error( "timeout" ) ) ;
    } , timeoutMs ) ;

    try {
      const cabecerasFinales: Record< string , string > = {
        "User-Agent": USER_AGENT_LABORATORIO ,
        ...cabeceras
      } ;

      const res = await fetch( urlActual , {
        method:   metodoActual ,
        headers:  cabecerasFinales ,
        body:     cuerpoActual ,
        redirect: "manual" ,
        signal:   controller.signal
      } ) ;

      clearTimeout( timer ) ;

      // Manejo manual de redirecciones
      if( (res.status === 301) || (res.status === 302) || (res.status === 303) || (res.status === 307) || (res.status === 308) ) {
        if( redireccionesRestantes <= 0 ) {
          return( {
            ok:       false ,
            status:   res.status ,
            urlFinal: urlActual ,
            tipo:     "" ,
            cuerpo:   null ,
            estado:   "demasiadas redirecciones"
          } ) ;
        }

        const ubicacion = res.headers.get( "location" ) ;
        if( !ubicacion ) {
          return( {
            ok:       false ,
            status:   res.status ,
            urlFinal: urlActual ,
            tipo:     "" ,
            cuerpo:   null ,
            estado:   "redireccion sin cabecera location"
          } ) ;
        }

        redireccionesRestantes-- ;
        urlActual = new URL( ubicacion , urlActual ).toString() ;
        if( (res.status === 303) || (res.status === 301) || (res.status === 302) ) {
          metodoActual = "GET" ;
          cuerpoActual = null ;
        }
        continue ;
      }

      const tipo = res.headers.get( "content-type" ) || "" ;

      // Lectura en streaming cortando en maxBytes si corresponde
      let bufferFinal: Buffer | null = null ;
      if( res.body ) {
        const reader = res.body.getReader() ;
        const chunks: Uint8Array[] = [] ;
        let bytesLeidos = 0 ;

        while( true ) {
          const { done , value } = await reader.read() ;
          if( done ) break ;
          if( value ) {
            bytesLeidos += value.length ;
            if( maxBytes && (bytesLeidos > maxBytes) ) {
              const exceso = bytesLeidos - maxBytes ;
              chunks.push( value.subarray( 0 , value.length - exceso ) ) ;
              try {
                await reader.cancel() ;
              } catch {
                // Silenciar cancelacion
              }
              break ;
            }
            chunks.push( value ) ;
          }
        }
        bufferFinal = Buffer.concat( chunks ) ;
      } else {
        bufferFinal = Buffer.from( [] ) ;
      }

      return( {
        ok:       res.ok ,
        status:   res.status ,
        urlFinal: urlActual ,
        tipo ,
        cuerpo:   bufferFinal ,
        estado:   String( res.status )
      } ) ;
    } catch( error: unknown ) {
      clearTimeout( timer ) ;
      const errorObj = error as { name?: string ; message?: string } | undefined ;
      const esTimeout = (errorObj?.name === "AbortError") || String( error ).toLowerCase().includes( "timeout" ) ;
      return( {
        ok:       false ,
        status:   0 ,
        urlFinal: urlActual ,
        tipo:     "" ,
        cuerpo:   null ,
        estado:   esTimeout ? "timeout" : (errorObj?.message || "error de red")
      } ) ;
    }
  }
}
