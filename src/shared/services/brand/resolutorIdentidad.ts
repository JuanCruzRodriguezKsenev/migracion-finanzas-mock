/**
 * @file resolutorIdentidad.ts
 * Resolutor centralizado en el servidor para determinar ícono y color de un dominio de marca.
 */

// Librerías externas
import dns from "dns" ;

// Shared: Brand
import {
  extraerManifestUrl ,
  iconosDeManifest ,
  extraerIconos
} from "./analisisHtml" ;
import {
  validarDominio ,
  fetchSeguro
} from "./fetchSeguro" ;
import {
  normalizarIcono ,
  medirImagen
} from "./imagenIcono" ;
import {
  colorDominante ,
  esColorExtremo
} from "./colorMarca" ;
import type { CandidatoIcono } from "./tiposMarca" ;

/** Umbral de resolución nítida para íconos directos de sitio (64 px). */
export const UMBRAL_NITIDO = 64 ;

/** Umbral de resolución mínima estándar para íconos de cualquier fuente (32 px). */
export const UMBRAL_MINIMO = 32 ;

/** Umbral de resolución de piso absoluto aceptable como baja resolución (16 px). */
export const UMBRAL_PISO = 16 ;

export type OrigenIcono = "sitio" | "google-s2" ;

export interface IdentidadMarca {
  dominio:    string ;
  icono:      {
    origen:          OrigenIcono ;
    dataUri?:        string ;
    url?:            string ;
    ancho?:          number ;
    alto?:           number ;
    origenAncho?:    number ;
    origenAlto?:     number ;
    fuenteUrl?:      string ;
    bajaResolucion?: boolean ;
  } | null ;
  color:      string | null ;
  intentos:   { fuente: OrigenIcono ; ok: boolean ; motivo?: string }[] ;
  redirigeA?: string ;
}

/**
 * Evalúa si un host no resuelve en DNS (no existe o devuelve arreglo vacío).
 *
 * fetchSeguro no distingue «sin DNS» de «IP privada» (ambos emiten «host privado o no resoluble»).
 * Esta consulta sólo se realiza tras un fallo inicial para decidir si reintentar con www.
 *
 * @param host - Host a consultar en DNS.
 * @returns true si dns.promises.lookup lanza error o devuelve un arreglo vacío.
 */
async function dominioNoResuelve( host: string ): Promise< boolean > {
  try {
    const direcciones = await dns.promises.lookup( host , { all: true } ) ;
    return( !direcciones || (direcciones.length === 0) ) ;
  } catch {
    return( true ) ;
  }
}

/**
 * Asigna una puntuación heurística a un candidato para ordenar pruebas.
 */
function puntajeCandidato( c: CandidatoIcono ): number {
  if( c.origen === "apple-touch-icon" ) return( 5 ) ;
  const urlBaja = c.url.toLowerCase() ;
  const tipo    = (c.tipo || "").toLowerCase() ;
  if( tipo.includes( "svg" ) || urlBaja.endsWith( ".svg" ) ) return( 4 ) ;
  if( tipo.includes( "png" ) || urlBaja.endsWith( ".png" ) ) return( 3 ) ;
  if( c.origen === "manifest" ) return( 2 ) ;
  return( 1 ) ;
}

/**
 * Ordena y filtra la lista de URLs candidatas de íconos para un sitio descartando og:image.
 */
function ordenarUrlsCandidatas( candidatos: CandidatoIcono[] , urlBase: string ): string[] {
  const sinOg = candidatos.filter( ( c ) => c.origen !== "og:image" ) ;

  const conTamano = sinOg.filter( ( c ) => typeof c.tamano === "number" ) ;
  conTamano.sort( ( a , b ) => {
    const dif = (b.tamano || 0) - (a.tamano || 0) ;
    if( dif !== 0 ) return( dif ) ;
    return( puntajeCandidato( b ) - puntajeCandidato( a ) ) ;
  } ) ;

  const sinTamano = sinOg.filter( ( c ) => typeof c.tamano !== "number" ) ;
  sinTamano.sort( ( a , b ) => puntajeCandidato( b ) - puntajeCandidato( a ) ) ;

  let urlFavicon: string | null = null ;
  try {
    urlFavicon = new URL( "/favicon.ico" , urlBase ).href ;
  } catch {
    urlFavicon = null ;
  }

  const todasLasUrls = [
    ...conTamano.map( ( c ) => c.url ) ,
    ...sinTamano.map( ( c ) => c.url ) ,
    ...( urlFavicon ? [ urlFavicon ] : [] )
  ] ;

  const unicas: string[] = [] ;
  for( const u of todasLasUrls ) {
    if( !unicas.includes( u ) ) {
      unicas.push( u ) ;
    }
  }

  return( unicas ) ;
}

/**
 * Remueve el prefijo www. de un nombre de host para comparaciones canónicas.
 */
function normalizarHostSinWww( host: string ): string {
  return( host.toLowerCase().replace( /^www\./ , "" ) ) ;
}

/**
 * Resuelve la identidad de una marca (ícono normalizado a 128x128 y color corporativo)
 * ejecutando la cascada: sitio (>= 64px) -> Google S2 -> respaldo chico del sitio.
 *
 * @param dominio - Dominio o URL a consultar.
 * @returns Estructura IdentidadMarca con el ícono, color, registro de intentos y redirección opcional.
 * @throws Error("dominio inválido") únicamente si el dominio es sintácticamente inválido.
 */
export async function resolverIdentidad(
  dominio: string
): Promise< IdentidadMarca > {
  const domLimpio = validarDominio( dominio ) ;
  if( !domLimpio ) {
    throw new Error( "dominio inválido" ) ;
  }

  const intentos: { fuente: OrigenIcono ; ok: boolean ; motivo?: string }[] = [] ;
  let iconoElegido: {
    origen:          OrigenIcono ;
    dataUri?:        string ;
    url?:            string ;
    ancho?:          number ;
    alto?:           number ;
    origenAncho?:    number ;
    origenAlto?:     number ;
    fuenteUrl?:      string ;
    bajaResolucion?: boolean ;
  } | null = null ;
  let bufferPngParaColor: Buffer | null = null ;
  let redirigeA: string | undefined = undefined ;

  let respaldoChico: {
    icono:  {
      origen:       OrigenIcono ;
      dataUri:      string ;
      ancho:        number ;
      alto:         number ;
      origenAncho?: number ;
      origenAlto?:  number ;
      fuenteUrl?:   string ;
    } ;
    pngBuf: Buffer ;
  } | null = null ;

  let candidatoS2: {
    icono:  {
      origen:       OrigenIcono ;
      dataUri:      string ;
      ancho:        number ;
      alto:         number ;
      origenAncho?: number ;
      origenAlto?:  number ;
      fuenteUrl?:   string ;
    } ;
    pngBuf: Buffer ;
  } | null = null ;

  // 1. Fuente: sitio
  const urlSitio        = `https://${domLimpio}/` ;
  let resHtml           = await fetchSeguro( urlSitio , { timeoutMs: 5000 , maxBytes: 256 * 1024 } ) ;
  let fueReintentoWww   = false ;
  let consultaSitioExitosa = false ;

  if( !resHtml.ok ) {
    const motivo = (resHtml.status > 0) ? `http ${resHtml.status}` : (resHtml.estado || "error de red") ;
    intentos.push( { fuente: "sitio" , ok: false , motivo } ) ;

    if( resHtml.estado === "host privado o no resoluble" ) {
      if( !domLimpio.startsWith( "www." ) && (await dominioNoResuelve( domLimpio )) ) {
        const urlWww = `https://www.${domLimpio}/` ;
        const resWww = await fetchSeguro( urlWww , { timeoutMs: 5000 , maxBytes: 256 * 1024 } ) ;

        if( resWww.ok && resWww.cuerpo ) {
          resHtml              = resWww ;
          fueReintentoWww      = true ;
          consultaSitioExitosa = true ;
        } else {
          const motivoWww = (resWww.status > 0) ? `http ${resWww.status}` : (resWww.estado || "error de red") ;
          intentos.push( { fuente: "sitio" , ok: false , motivo: motivoWww } ) ;
        }
      } else {
        return( {
          dominio: domLimpio ,
          icono:   null ,
          color:   null ,
          intentos
        } ) ;
      }
    }
  } else {
    consultaSitioExitosa = true ;
  }

  if( consultaSitioExitosa && resHtml.cuerpo ) {
    const html        = resHtml.cuerpo.toString( "utf-8" ) ;
    const urlFinal    = resHtml.urlFinal || (fueReintentoWww ? `https://www.${domLimpio}/` : urlSitio) ;

    try {
      const hostPedido = normalizarHostSinWww( domLimpio ) ;
      const hostFinal  = normalizarHostSinWww( new URL( urlFinal ).hostname ) ;
      if( hostFinal !== hostPedido ) {
        redirigeA = hostFinal ;
      }
    } catch {
      // Ignorar error al parsear urlFinal
    }

    const iconosHtml     = extraerIconos( html , urlFinal ) ;
    const manifestUrl    = extraerManifestUrl( html , urlFinal ) ;
    let iconosManifest: CandidatoIcono[] = [] ;

    if( manifestUrl ) {
      const resManifest = await fetchSeguro( manifestUrl , { timeoutMs: 3000 , maxBytes: 128 * 1024 } ) ;
      if( resManifest.ok && resManifest.cuerpo ) {
        iconosManifest = iconosDeManifest( resManifest.cuerpo.toString( "utf-8" ) , resManifest.urlFinal || manifestUrl ).iconos ;
      }
    }

    const todosCandidatos = [ ...iconosHtml , ...iconosManifest ] ;
    const urlsCandidatas  = ordenarUrlsCandidatas( todosCandidatos , urlFinal ) ;
    const topeCandidatos  = urlsCandidatas.slice( 0 , 4 ) ;

    let encontroApto    = false ;
    let habiaMenorAPiso = false ;

    for( const urlIcono of topeCandidatos ) {
      const resIcono = await fetchSeguro( urlIcono , { timeoutMs: 4000 , maxBytes: 300 * 1024 } ) ;
      if( !resIcono.ok || !resIcono.cuerpo ) {
        continue ;
      }

      const dimensiones = await medirImagen( resIcono.cuerpo ) ;
      const normalizado = await normalizarIcono( resIcono.cuerpo ) ;
      if( !normalizado ) {
        continue ;
      }

      const anchoEfectivo = dimensiones?.ancho ?? normalizado.origenAncho ;

      if( anchoEfectivo >= UMBRAL_NITIDO ) {
        iconoElegido = {
          origen:      "sitio" ,
          dataUri:     normalizado.dataUri ,
          ancho:       normalizado.ancho ,
          alto:        normalizado.alto ,
          origenAncho: anchoEfectivo ,
          origenAlto:  dimensiones?.alto ,
          fuenteUrl:   urlIcono
        } ;
        bufferPngParaColor = Buffer.from( normalizado.dataUri.slice( "data:image/png;base64,".length ) , "base64" ) ;
        intentos.push( {
          fuente: "sitio" ,
          ok:     true ,
          ...( fueReintentoWww ? { motivo: "reintento con www" } : {} )
        } ) ;
        encontroApto = true ;
        break ;
      } else if( anchoEfectivo >= UMBRAL_PISO ) {
        if( !respaldoChico || (anchoEfectivo > (respaldoChico.icono.origenAncho ?? 0)) ) {
          respaldoChico = {
            icono: {
              origen:      "sitio" ,
              dataUri:     normalizado.dataUri ,
              ancho:       normalizado.ancho ,
              alto:        normalizado.alto ,
              origenAncho: anchoEfectivo ,
              origenAlto:  dimensiones?.alto ,
              fuenteUrl:   urlIcono
            } ,
            pngBuf: Buffer.from( normalizado.dataUri.slice( "data:image/png;base64,".length ) , "base64" )
          } ;
        }
      } else {
        habiaMenorAPiso = true ;
      }
    }

    if( !encontroApto ) {
      const motivo = respaldoChico ? "menor a 64 px" : (habiaMenorAPiso ? "menor a 16 px" : "ilegible") ;
      intentos.push( { fuente: "sitio" , ok: false , motivo } ) ;
    }
  } else if( !fueReintentoWww && resHtml.ok ) {
    intentos.push( { fuente: "sitio" , ok: false , motivo: "ilegible" } ) ;
  }

  // 2. Fuente: google-s2
  if( !iconoElegido ) {
    const urlS2_256 = `https://www.google.com/s2/favicons?domain=${encodeURIComponent( domLimpio )}&sz=256` ;
    let resS2       = await fetchSeguro( urlS2_256 , { timeoutMs: 4000 , maxBytes: 300 * 1024 } ) ;
    let urlS2Usada  = urlS2_256 ;

    if( !resS2.ok || !resS2.cuerpo ) {
      const urlS2_128 = `https://www.google.com/s2/favicons?domain=${encodeURIComponent( domLimpio )}&sz=128` ;
      resS2           = await fetchSeguro( urlS2_128 , { timeoutMs: 4000 , maxBytes: 300 * 1024 } ) ;
      urlS2Usada      = urlS2_128 ;
    }

    if( resS2.ok && resS2.cuerpo ) {
      const dimsS2 = await medirImagen( resS2.cuerpo ) ;
      const normS2 = await normalizarIcono( resS2.cuerpo ) ;
      if( normS2 ) {
        const anchoS2 = dimsS2?.ancho ?? normS2.origenAncho ;
        if( anchoS2 >= UMBRAL_PISO ) {
          candidatoS2 = {
            icono: {
              origen:      "google-s2" ,
              dataUri:     normS2.dataUri ,
              ancho:       normS2.ancho ,
              alto:        normS2.alto ,
              origenAncho: anchoS2 ,
              origenAlto:  dimsS2?.alto ,
              fuenteUrl:   urlS2Usada
            } ,
            pngBuf: Buffer.from( normS2.dataUri.slice( "data:image/png;base64,".length ) , "base64" )
          } ;
          intentos.push( { fuente: "google-s2" , ok: true } ) ;
        } else {
          intentos.push( { fuente: "google-s2" , ok: false , motivo: "menor a 16 px" } ) ;
        }
      } else {
        intentos.push( { fuente: "google-s2" , ok: false , motivo: "ilegible" } ) ;
      }
    } else {
      const motivoS2 = (resS2.status > 0) ? `http ${resS2.status}` : (resS2.estado || "error de red") ;
      intentos.push( { fuente: "google-s2" , ok: false , motivo: motivoS2 } ) ;
    }
  }

  // 3. Selección entre Google S2 y respaldo chico de sitio
  if( !iconoElegido ) {
    const anchoS2       = candidatoS2?.icono.origenAncho ?? 0 ;
    const anchoRespaldo = respaldoChico?.icono.origenAncho ?? 0 ;

    const s2LlegaMinimo       = anchoS2 >= UMBRAL_MINIMO ;
    const respaldoLlegaMinimo = anchoRespaldo >= UMBRAL_MINIMO ;

    if( s2LlegaMinimo || respaldoLlegaMinimo ) {
      // Regla 2: los que tengan >= 32. Mayor gana; empate -> Google S2
      if( s2LlegaMinimo && respaldoLlegaMinimo ) {
        if( anchoRespaldo > anchoS2 ) {
          iconoElegido       = respaldoChico!.icono ;
          bufferPngParaColor = respaldoChico!.pngBuf ;
        } else {
          iconoElegido       = candidatoS2!.icono ;
          bufferPngParaColor = candidatoS2!.pngBuf ;
        }
      } else if( s2LlegaMinimo ) {
        iconoElegido       = candidatoS2!.icono ;
        bufferPngParaColor = candidatoS2!.pngBuf ;
      } else {
        iconoElegido       = respaldoChico!.icono ;
        bufferPngParaColor = respaldoChico!.pngBuf ;
      }
    } else if( (anchoS2 >= UMBRAL_PISO) || (anchoRespaldo >= UMBRAL_PISO) ) {
      // Regla 3: Si ninguno llega a 32, el de mayor ancho con >= 16; bajaResolucion: true; empate -> Google S2
      let elegido: typeof respaldoChico ;
      if( (anchoS2 >= UMBRAL_PISO) && (anchoRespaldo >= UMBRAL_PISO) ) {
        elegido = (anchoRespaldo > anchoS2) ? respaldoChico : candidatoS2 ;
      } else if( anchoS2 >= UMBRAL_PISO ) {
        elegido = candidatoS2 ;
      } else {
        elegido = respaldoChico ;
      }

      if( elegido ) {
        iconoElegido = {
          ...elegido.icono ,
          bajaResolucion: true
        } ;
        bufferPngParaColor = elegido.pngBuf ;
      }
    }
  }

  // Color dominante
  let color: string | null = null ;
  if( iconoElegido?.dataUri && bufferPngParaColor ) {
    color = await colorDominante( bufferPngParaColor ) ;
    if( color && esColorExtremo( color ) ) {
      color = null ;
    }
  }

  return( {
    dominio: domLimpio ,
    icono:   iconoElegido ,
    color ,
    intentos ,
    ...( redirigeA ? { redirigeA } : {} )
  } ) ;
}
