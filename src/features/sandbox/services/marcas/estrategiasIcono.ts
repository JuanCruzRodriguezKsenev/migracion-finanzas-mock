/**
 * @file estrategiasIcono.ts
 * Estrategias de extracción y resolución de logotipos e íconos de marcas.
 */

// Shared: Brand
import {
  extraerManifestUrl ,
  iconosDeManifest ,
  extraerThemeColor ,
  elegirMejorIcono ,
  extraerIconos
} from "@/shared/services/brand/analisisHtml" ;
import { fetchSeguro } from "@/shared/services/brand/fetchSeguro" ;

// Feature: Sandbox
import type {
  ResultadoIcono ,
  CandidatoIcono
} from "./tipos" ;

export interface ContextoEstrategiaIcono {
  nombre?:             string ;
  archivoLogo?:        string ;
  iconoBrandfetch?:    string ;
  clientIdBrandfetch: string ;
}

/**
 * Convierte un Buffer en una Data URI en base64 con su tipo MIME correspondiente.
 */
function bufferADataUri( buffer: Buffer , tipoMime: string ): string {
  const mimeLimpio = tipoMime.split( ";" )[0].trim() || "image/png" ;
  return( `data:${mimeLimpio};base64,${buffer.toString( "base64" )}` ) ;
}

/**
 * Extrae íconos directamente desde la página HTML oficial del dominio y su web manifest.
 */
export async function estrategiaIconoSitio(
  dominio: string ,
  contexto: ContextoEstrategiaIcono
): Promise< ResultadoIcono > {
  void contexto ;
  const inicio = performance.now() ;

  try {
    let urlIntento = `https://${dominio}` ;
    let res = await fetchSeguro( urlIntento , {
      maxBytes:  1500 * 1024 ,
      timeoutMs: 6000
    } ) ;

    // Si falló el dominio directo, probar con www.
    if( !res.ok && !dominio.startsWith( "www." ) ) {
      const urlWww = `https://www.${dominio}` ;
      const resWww = await fetchSeguro( urlWww , {
        maxBytes:  1500 * 1024 ,
        timeoutMs: 6000
      } ) ;
      if( resWww.ok ) {
        res = resWww ;
        urlIntento = urlWww ;
      }
    }

    const duracionBase = Math.round( performance.now() - inicio ) ;

    if( !res.ok ) {
      return( {
        estrategia: "sitio" ,
        modo:       "servidor" ,
        ok:         false ,
        ms:         duracionBase ,
        estado:     res.status ? `http ${res.status}` : res.estado
      } ) ;
    }

    const html = res.cuerpo?.toString( "utf-8" ) || "" ;
    const urlFinal = res.urlFinal || urlIntento ;

    let candidatos: CandidatoIcono[] = extraerIconos( html , urlFinal ) ;
    let themeColor = extraerThemeColor( html ) ;

    // Inspeccionar web manifest si está declarado
    const manifestUrl = extraerManifestUrl( html , urlFinal ) ;
    if( manifestUrl ) {
      const resManifest = await fetchSeguro( manifestUrl , {
        maxBytes:  200 * 1024 ,
        timeoutMs: 4000
      } ) ;

      if( resManifest.ok && resManifest.cuerpo ) {
        const datosManifest = iconosDeManifest( resManifest.cuerpo.toString( "utf-8" ) , manifestUrl ) ;
        candidatos = candidatos.concat( datosManifest.iconos ) ;
        if( !themeColor && datosManifest.themeColor ) {
          themeColor = datosManifest.themeColor ;
        }
      }
    }

    const hallados = [...candidatos] ;
    const mejor = elegirMejorIcono( candidatos ) ;

    if( !mejor ) {
      return( {
        estrategia: "sitio" ,
        modo:       "servidor" ,
        ok:         false ,
        ms:         Math.round( performance.now() - inicio ) ,
        estado:     "sin iconos declarados" ,
        color:      themeColor ,
        hallados
      } ) ;
    }

    // Descargar el ícono elegido
    const resIcono = await fetchSeguro( mejor.url , {
      maxBytes:  300 * 1024 ,
      timeoutMs: 5000
    } ) ;

    const duracionTotal = Math.round( performance.now() - inicio ) ;

    if( !resIcono.ok || !resIcono.cuerpo ) {
      return( {
        estrategia: "sitio" ,
        modo:       "servidor" ,
        ok:         false ,
        ms:         duracionTotal ,
        estado:     resIcono.status ? `http ${resIcono.status}` : resIcono.estado ,
        url:        mejor.url ,
        origen:     mejor.origen ,
        color:      themeColor ,
        hallados
      } ) ;
    }

    const mime = resIcono.tipo.split( ";" )[0].trim() || "image/png" ;
    const dataUri = bufferADataUri( resIcono.cuerpo , mime ) ;

    return( {
      estrategia: "sitio" ,
      modo:       "servidor" ,
      ok:         true ,
      ms:         duracionTotal ,
      estado:     "200" ,
      url:        mejor.url ,
      dataUri ,
      mime ,
      bytes:      resIcono.cuerpo.length ,
      origen:     mejor.origen ,
      color:      themeColor ,
      hallados
    } ) ;
  } catch( error: unknown ) {
    const errorObj = error as { message?: string } | undefined ;
    return( {
      estrategia: "sitio" ,
      modo:       "servidor" ,
      ok:         false ,
      ms:         Math.round( performance.now() - inicio ) ,
      estado:     errorObj?.message || "error inesperado"
    } ) ;
  }
}

/**
 * Descarga el archivo de logotipo declarado en Wikimedia Commons (propiedad P154).
 */
export async function estrategiaIconoWikidata(
  _dominio: string ,
  contexto: ContextoEstrategiaIcono
): Promise< ResultadoIcono > {
  void _dominio ;
  const inicio = performance.now() ;

  if( !contexto.archivoLogo ) {
    return( {
      estrategia: "wikidata-logo" ,
      modo:       "servidor" ,
      ok:         false ,
      ms:         0 ,
      estado:     "sin P154"
    } ) ;
  }

  const nombreLimpio = contexto.archivoLogo.replace( /\s+/g , "_" ) ;
  const urlArchivo = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent( nombreLimpio )}?width=256` ;

  try {
    const hostsPermitidos = ["commons.wikimedia.org" , "upload.wikimedia.org" , "thumb.wikimedia.org"] ;
    const res = await fetchSeguro( urlArchivo , {
      maxBytes:    300 * 1024 ,
      timeoutMs:   6000 ,
      validarHost: ( h ) => hostsPermitidos.includes( h )
    } ) ;

    const duracion = Math.round( performance.now() - inicio ) ;

    if( !res.ok || !res.cuerpo ) {
      return( {
        estrategia: "wikidata-logo" ,
        modo:       "servidor" ,
        ok:         false ,
        ms:         duracion ,
        estado:     res.status ? String( res.status ) : res.estado
      } ) ;
    }

    const mime = res.tipo.split( ";" )[0].trim() || "image/png" ;
    const dataUri = bufferADataUri( res.cuerpo , mime ) ;

    return( {
      estrategia: "wikidata-logo" ,
      modo:       "servidor" ,
      ok:         true ,
      ms:         duracion ,
      estado:     String( res.status ) ,
      url:        res.urlFinal ,
      dataUri ,
      mime ,
      bytes:      res.cuerpo.length ,
      origen:     "wikidata-p154"
    } ) ;
  } catch( error: unknown ) {
    const errorObj = error as { message?: string } | undefined ;
    return( {
      estrategia: "wikidata-logo" ,
      modo:       "servidor" ,
      ok:         false ,
      ms:         Math.round( performance.now() - inicio ) ,
      estado:     errorObj?.message || "error inesperado"
    } ) ;
  }
}

/**
 * Consulta el servicio de favicons Google S2 en tamaño 128 px.
 */
export async function estrategiaIconoGoogleS2(
  dominio: string ,
  contexto: ContextoEstrategiaIcono
): Promise< ResultadoIcono > {
  void contexto ;
  const inicio = performance.now() ;
  const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent( dominio )}&sz=128` ;

  try {
    const res = await fetchSeguro( url , {
      maxBytes:  300 * 1024 ,
      timeoutMs: 5000
    } ) ;

    const duracion = Math.round( performance.now() - inicio ) ;

    if( !res.ok || !res.cuerpo ) {
      return( {
        estrategia: "google-s2" ,
        modo:       "servidor" ,
        ok:         false ,
        ms:         duracion ,
        estado:     res.status ? String( res.status ) : res.estado
      } ) ;
    }

    const mime = res.tipo.split( ";" )[0].trim() || "image/png" ;
    const dataUri = bufferADataUri( res.cuerpo , mime ) ;

    return( {
      estrategia: "google-s2" ,
      modo:       "servidor" ,
      ok:         true ,
      ms:         duracion ,
      estado:     String( res.status ) ,
      url:        res.urlFinal ,
      dataUri ,
      mime ,
      bytes:      res.cuerpo.length ,
      origen:     "google-s2"
    } ) ;
  } catch( error: unknown ) {
    const errorObj = error as { message?: string } | undefined ;
    return( {
      estrategia: "google-s2" ,
      modo:       "servidor" ,
      ok:         false ,
      ms:         Math.round( performance.now() - inicio ) ,
      estado:     errorObj?.message || "error inesperado"
    } ) ;
  }
}

/**
 * Consulta el servicio de favicons de DuckDuckGo en formato .ico.
 */
export async function estrategiaIconoDdg(
  dominio: string ,
  contexto: ContextoEstrategiaIcono
): Promise< ResultadoIcono > {
  void contexto ;
  const inicio = performance.now() ;
  const url = `https://icons.duckduckgo.com/ip3/${encodeURIComponent( dominio )}.ico` ;

  try {
    const res = await fetchSeguro( url , {
      maxBytes:  300 * 1024 ,
      timeoutMs: 5000
    } ) ;

    const duracion = Math.round( performance.now() - inicio ) ;

    if( !res.ok || !res.cuerpo ) {
      return( {
        estrategia: "ddg-icons" ,
        modo:       "servidor" ,
        ok:         false ,
        ms:         duracion ,
        estado:     res.status ? String( res.status ) : res.estado
      } ) ;
    }

    const mime = res.tipo.split( ";" )[0].trim() || "image/x-icon" ;
    const dataUri = bufferADataUri( res.cuerpo , mime ) ;

    return( {
      estrategia: "ddg-icons" ,
      modo:       "servidor" ,
      ok:         true ,
      ms:         duracion ,
      estado:     String( res.status ) ,
      url:        res.urlFinal ,
      dataUri ,
      mime ,
      bytes:      res.cuerpo.length ,
      origen:     "ddg-icons"
    } ) ;
  } catch( error: unknown ) {
    const errorObj = error as { message?: string } | undefined ;
    return( {
      estrategia: "ddg-icons" ,
      modo:       "servidor" ,
      ok:         false ,
      ms:         Math.round( performance.now() - inicio ) ,
      estado:     errorObj?.message || "error inesperado"
    } ) ;
  }
}

/**
 * Consulta el servicio icon.horse para obtener el ícono del dominio.
 */
export async function estrategiaIconoHorse(
  dominio: string ,
  contexto: ContextoEstrategiaIcono
): Promise< ResultadoIcono > {
  void contexto ;
  const inicio = performance.now() ;
  const url = `https://icon.horse/icon/${encodeURIComponent( dominio )}` ;

  try {
    const res = await fetchSeguro( url , {
      maxBytes:  300 * 1024 ,
      timeoutMs: 5000
    } ) ;

    const duracion = Math.round( performance.now() - inicio ) ;

    if( !res.ok || !res.cuerpo ) {
      return( {
        estrategia: "icon-horse" ,
        modo:       "servidor" ,
        ok:         false ,
        ms:         duracion ,
        estado:     res.status ? String( res.status ) : res.estado
      } ) ;
    }

    const mime = res.tipo.split( ";" )[0].trim() || "image/png" ;
    const dataUri = bufferADataUri( res.cuerpo , mime ) ;

    return( {
      estrategia: "icon-horse" ,
      modo:       "servidor" ,
      ok:         true ,
      ms:         duracion ,
      estado:     String( res.status ) ,
      url:        res.urlFinal ,
      dataUri ,
      mime ,
      bytes:      res.cuerpo.length ,
      origen:     "icon-horse"
    } ) ;
  } catch( error: unknown ) {
    const errorObj = error as { message?: string } | undefined ;
    return( {
      estrategia: "icon-horse" ,
      modo:       "servidor" ,
      ok:         false ,
      ms:         Math.round( performance.now() - inicio ) ,
      estado:     errorObj?.message || "error inesperado"
    } ) ;
  }
}

/**
 * Estrategia de cliente para probar la CDN directa de Brandfetch en el navegador.
 */
export function estrategiaIconoBrandfetchCdn(
  dominio: string ,
  contexto: ContextoEstrategiaIcono
): ResultadoIcono {
  const clientId = contexto.clientIdBrandfetch || process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID || "brandfetch" ;
  const url = `https://cdn.brandfetch.io/${dominio}?c=${clientId}` ;

  return( {
    estrategia: "brandfetch-cdn" ,
    modo:       "navegador" ,
    ok:         true ,
    ms:         0 ,
    estado:     "esperando carga en navegador" ,
    url
  } ) ;
}

/**
 * Estrategia de cliente para validar el token temporal firmado de Brandfetch Search.
 */
export function estrategiaIconoBrandfetchSearch(
  _dominio: string ,
  contexto: ContextoEstrategiaIcono
): ResultadoIcono {
  void _dominio ;
  if( contexto.iconoBrandfetch && contexto.iconoBrandfetch.startsWith( "https://cdn.brandfetch.io/" ) ) {
    return( {
      estrategia: "brandfetch-search-icon" ,
      modo:       "navegador" ,
      ok:         true ,
      ms:         0 ,
      estado:     "token firmado (vence en 24 h)" ,
      url:        contexto.iconoBrandfetch
    } ) ;
  }

  return( {
    estrategia: "brandfetch-search-icon" ,
    modo:       "navegador" ,
    ok:         false ,
    ms:         0 ,
    estado:     "sin icono de busqueda"
  } ) ;
}

/**
 * Ejecuta todas las estrategias de ícono (servidor en paralelo y navegador instantáneas).
 */
export async function ejecutarEstrategiasIcono(
  dominio: string ,
  contexto: ContextoEstrategiaIcono
): Promise< ResultadoIcono[] > {
  const promesasServidor = Promise.all( [
    estrategiaIconoSitio( dominio , contexto ) ,
    estrategiaIconoWikidata( dominio , contexto ) ,
    estrategiaIconoGoogleS2( dominio , contexto ) ,
    estrategiaIconoDdg( dominio , contexto ) ,
    estrategiaIconoHorse( dominio , contexto )
  ] ) ;

  const [ sitio , wikidata , google , ddg , horse ] = await promesasServidor ;
  const cdn    = estrategiaIconoBrandfetchCdn( dominio , contexto ) ;
  const search = estrategiaIconoBrandfetchSearch( dominio , contexto ) ;

  return( [ sitio , wikidata , google , ddg , horse , cdn , search ] ) ;
}
