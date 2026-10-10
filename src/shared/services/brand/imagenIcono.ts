/**
 * @file imagenIcono.ts
 * Utilidades puras de decodificación, medición y normalización de imágenes de íconos de marcas.
 */

// Librerías externas
import sharp from "sharp" ;

/**
 * Representa un ícono normalizado en formato PNG en memoria.
 */
export interface IconoNormalizado {
  dataUri: string ;
  ancho:   number ;
  alto:    number ;
  bytes:   number ;
}

/**
 * Firma mágica del formato PNG (8 bytes).
 */
const FIRMA_PNG = Buffer.from( [ 0x89 , 0x50 , 0x4e , 0x47 , 0x0d , 0x0a , 0x1a , 0x0a ] ) ;

/**
 * Comprueba si un buffer tiene la cabecera estándar de un archivo ICO (00 00 01 00).
 */
function esCabeceraIco( buf: Buffer ): boolean {
  if( !Buffer.isBuffer( buf ) || (buf.length < 4) ) {
    return( false ) ;
  }
  return( (buf[0] === 0) && (buf[1] === 0) && (buf[2] === 1) && (buf[3] === 0) ) ;
}

/**
 * Decodifica una entrada DIB / BITMAPINFOHEADER contenida en un ICO y la convierte a buffer PNG.
 * Soporta profundidades de color de 32bpp (BGRA / máscara AND), 24bpp (BGR con máscara AND)
 * y 8bpp (paleta con máscara AND).
 */
async function decodificarBmpEnIco(
  buf:        Buffer ,
  offsetDato: number ,
  bytesDato:  number
): Promise< Buffer | null > {
  try {
    if( bytesDato < 40 ) {
      return( null ) ;
    }

    const biSize = buf.readUInt32LE( offsetDato ) ;
    if( biSize !== 40 ) {
      return( null ) ;
    }

    const width       = buf.readInt32LE( offsetDato + 4 ) ;
    const rawHeight   = buf.readInt32LE( offsetDato + 8 ) ;
    const height      = Math.floor( Math.abs( rawHeight ) / 2 ) ;
    const planes      = buf.readUInt16LE( offsetDato + 12 ) ;
    const bpp         = buf.readUInt16LE( offsetDato + 14 ) ;
    const compression = buf.readUInt32LE( offsetDato + 16 ) ;
    const clrUsed     = buf.readUInt32LE( offsetDato + 32 ) ;

    if( (width <= 0) || (height <= 0) || (planes !== 1) || (compression !== 0) ) {
      return( null ) ;
    }

    const andMaskRowStride = Math.floor( ( width + 31 ) / 32 ) * 4 ;

    if( bpp === 32 ) {
      const pixelOffset = offsetDato + biSize ;
      const rowStride   = width * 4 ;
      if( pixelOffset + (rowStride * height) > offsetDato + bytesDato ) {
        return( null ) ;
      }

      let hayAlfa = false ;
      for( let i = 0 ; i < width * height ; i++ ) {
        if( buf[pixelOffset + (i * 4) + 3] > 0 ) {
          hayAlfa = true ;
          break ;
        }
      }

      const andMaskOffset = pixelOffset + (rowStride * height) ;
      const tieneAndMask  = (andMaskOffset + (andMaskRowStride * height) <= offsetDato + bytesDato) ;

      const rgba = Buffer.alloc( width * height * 4 ) ;
      for( let y = 0 ; y < height ; y++ ) {
        const srcY = ( height - 1 ) - y ;
        for( let x = 0 ; x < width ; x++ ) {
          const srcIdx = pixelOffset + ( ( ( srcY * width ) + x ) * 4 ) ;
          const dstIdx = ( ( y * width ) + x ) * 4 ;
          rgba[dstIdx]     = buf[srcIdx + 2] ;
          rgba[dstIdx + 1] = buf[srcIdx + 1] ;
          rgba[dstIdx + 2] = buf[srcIdx] ;

          if( hayAlfa ) {
            rgba[dstIdx + 3] = buf[srcIdx + 3] ;
          } else if( tieneAndMask ) {
            const maskByte   = buf[andMaskOffset + (srcY * andMaskRowStride) + Math.floor( x / 8 )] ;
            const bit        = ( maskByte >> ( 7 - ( x % 8 ) ) ) & 1 ;
            rgba[dstIdx + 3] = ( bit === 1 ) ? 0 : 255 ;
          } else {
            rgba[dstIdx + 3] = 255 ;
          }
        }
      }

      return( await sharp( rgba , { raw: { width , height , channels: 4 } } ).png().toBuffer() ) ;
    }

    if( bpp === 24 ) {
      const pixelOffset = offsetDato + biSize ;
      const rowStride   = Math.floor( ( ( width * 24 ) + 31 ) / 32 ) * 4 ;
      if( pixelOffset + (rowStride * height) > offsetDato + bytesDato ) {
        return( null ) ;
      }

      const andMaskOffset = pixelOffset + (rowStride * height) ;
      const tieneAndMask  = (andMaskOffset + (andMaskRowStride * height) <= offsetDato + bytesDato) ;

      const rgba = Buffer.alloc( width * height * 4 ) ;
      for( let y = 0 ; y < height ; y++ ) {
        const srcY = ( height - 1 ) - y ;
        for( let x = 0 ; x < width ; x++ ) {
          const srcIdx = pixelOffset + ( srcY * rowStride ) + ( x * 3 ) ;
          const dstIdx = ( ( y * width ) + x ) * 4 ;
          rgba[dstIdx]     = buf[srcIdx + 2] ;
          rgba[dstIdx + 1] = buf[srcIdx + 1] ;
          rgba[dstIdx + 2] = buf[srcIdx] ;

          if( tieneAndMask ) {
            const maskByte   = buf[andMaskOffset + (srcY * andMaskRowStride) + Math.floor( x / 8 )] ;
            const bit        = ( maskByte >> ( 7 - ( x % 8 ) ) ) & 1 ;
            rgba[dstIdx + 3] = ( bit === 1 ) ? 0 : 255 ;
          } else {
            rgba[dstIdx + 3] = 255 ;
          }
        }
      }

      return( await sharp( rgba , { raw: { width , height , channels: 4 } } ).png().toBuffer() ) ;
    }

    if( bpp === 8 ) {
      const numColors     = ( clrUsed > 0 ) ? clrUsed : 256 ;
      const paletteOffset = offsetDato + biSize ;
      const pixelOffset   = paletteOffset + ( numColors * 4 ) ;
      const rowStride     = Math.floor( ( ( width * 8 ) + 31 ) / 32 ) * 4 ;

      if( pixelOffset + (rowStride * height) > offsetDato + bytesDato ) {
        return( null ) ;
      }

      const andMaskOffset = pixelOffset + (rowStride * height) ;
      const tieneAndMask  = (andMaskOffset + (andMaskRowStride * height) <= offsetDato + bytesDato) ;

      const rgba = Buffer.alloc( width * height * 4 ) ;
      for( let y = 0 ; y < height ; y++ ) {
        const srcY = ( height - 1 ) - y ;
        for( let x = 0 ; x < width ; x++ ) {
          const colorIdx = buf[pixelOffset + ( srcY * rowStride ) + x] ;
          const palEntry = paletteOffset + ( colorIdx * 4 ) ;
          const dstIdx   = ( ( y * width ) + x ) * 4 ;
          rgba[dstIdx]     = buf[palEntry + 2] ;
          rgba[dstIdx + 1] = buf[palEntry + 1] ;
          rgba[dstIdx + 2] = buf[palEntry] ;

          if( tieneAndMask ) {
            const maskByte   = buf[andMaskOffset + (srcY * andMaskRowStride) + Math.floor( x / 8 )] ;
            const bit        = ( maskByte >> ( 7 - ( x % 8 ) ) ) & 1 ;
            rgba[dstIdx + 3] = ( bit === 1 ) ? 0 : 255 ;
          } else {
            rgba[dstIdx + 3] = 255 ;
          }
        }
      }

      return( await sharp( rgba , { raw: { width , height , channels: 4 } } ).png().toBuffer() ) ;
    }

    return( null ) ;
  } catch {
    return( null ) ;
  }
}

/**
 * Extrae la imagen de mayor resolución de un archivo ICO y la convierte a buffer PNG.
 * Admite tanto flujos PNG nativos embebidos como entradas DIB / BMP (32bpp, 24bpp u 8bpp).
 *
 * @param buf - Buffer binario con los datos del archivo ICO.
 * @returns Buffer PNG decodificado o null si el archivo está dañado o no es soportado.
 */
export async function extraerImagenDeIco( buf: Buffer ): Promise< Buffer | null > {
  try {
    if( !Buffer.isBuffer( buf ) || (buf.length < 6) ) {
      return( null ) ;
    }

    const reservado = buf.readUInt16LE( 0 ) ;
    const tipo      = buf.readUInt16LE( 2 ) ;
    const cantidad  = buf.readUInt16LE( 4 ) ;

    if( (reservado !== 0) || (tipo !== 1) || (cantidad === 0) ) {
      return( null ) ;
    }

    const tamanoDirectorio = 6 + (cantidad * 16) ;
    if( buf.length < tamanoDirectorio ) {
      return( null ) ;
    }

    let indiceMayor = -1 ;
    let areaMayor   = -1 ;

    for( let i = 0 ; i < cantidad ; i++ ) {
      const offsetEntrada = 6 + (i * 16) ;
      const bAncho        = buf[offsetEntrada] ;
      const bAlto         = buf[offsetEntrada + 1] ;
      const ancho         = (bAncho === 0) ? 256 : bAncho ;
      const alto          = (bAlto === 0) ? 256 : bAlto ;
      const area          = ancho * alto ;

      if( area > areaMayor ) {
        areaMayor   = area ;
        indiceMayor = i ;
      }
    }

    if( indiceMayor === -1 ) {
      return( null ) ;
    }

    const offsetElegido = 6 + (indiceMayor * 16) ;
    const bytesDato     = buf.readUInt32LE( offsetElegido + 8 ) ;
    const offsetDato    = buf.readUInt32LE( offsetElegido + 12 ) ;

    if( (offsetDato < 0) || (bytesDato < 8) || (offsetDato + bytesDato > buf.length) ) {
      return( null ) ;
    }

    const datosEntrada = buf.subarray( offsetDato , offsetDato + bytesDato ) ;
    if( datosEntrada.subarray( 0 , 8 ).equals( FIRMA_PNG ) ) {
      return( Buffer.from( datosEntrada ) ) ;
    }

    return( await decodificarBmpEnIco( buf , offsetDato , bytesDato ) ) ;
  } catch {
    return( null ) ;
  }
}

/**
 * Extrae el flujo PNG embebido de mayor resolución contenido dentro de un archivo ICO.
 * Si la entrada de mayor tamaño es BMP u otro formato, o si la estructura está dañada,
 * retorna null sin lanzar excepciones.
 *
 * @param buf - Buffer binario con los datos del archivo ICO.
 * @returns Buffer con los datos crudos del PNG o null.
 */
export function extraerPngDeIco( buf: Buffer ): Buffer | null {
  try {
    if( !Buffer.isBuffer( buf ) || (buf.length < 6) ) {
      return( null ) ;
    }

    const reservado = buf.readUInt16LE( 0 ) ;
    const tipo      = buf.readUInt16LE( 2 ) ;
    const cantidad  = buf.readUInt16LE( 4 ) ;

    if( (reservado !== 0) || (tipo !== 1) || (cantidad === 0) ) {
      return( null ) ;
    }

    const tamanoDirectorio = 6 + (cantidad * 16) ;
    if( buf.length < tamanoDirectorio ) {
      return( null ) ;
    }

    let indiceMayor = -1 ;
    let areaMayor   = -1 ;

    for( let i = 0 ; i < cantidad ; i++ ) {
      const offsetEntrada = 6 + (i * 16) ;
      const bAncho        = buf[offsetEntrada] ;
      const bAlto         = buf[offsetEntrada + 1] ;
      const ancho         = (bAncho === 0) ? 256 : bAncho ;
      const alto          = (bAlto === 0) ? 256 : bAlto ;
      const area          = ancho * alto ;

      if( area > areaMayor ) {
        areaMayor   = area ;
        indiceMayor = i ;
      }
    }

    if( indiceMayor === -1 ) {
      return( null ) ;
    }

    const offsetElegido = 6 + (indiceMayor * 16) ;
    const bytesDato     = buf.readUInt32LE( offsetElegido + 8 ) ;
    const offsetDato    = buf.readUInt32LE( offsetElegido + 12 ) ;

    if( (offsetDato < 0) || (bytesDato < 8) || (offsetDato + bytesDato > buf.length) ) {
      return( null ) ;
    }

    const datosEntrada = buf.subarray( offsetDato , offsetDato + bytesDato ) ;
    if( !datosEntrada.subarray( 0 , 8 ).equals( FIRMA_PNG ) ) {
      return( null ) ;
    }

    return( Buffer.from( datosEntrada ) ) ;
  } catch {
    return( null ) ;
  }
}

/**
 * Mide las dimensiones en píxeles de una imagen en formato binario.
 * Si es un ICO analiza la imagen interna (PNG o BMP); de lo contrario utiliza metadata de sharp.
 *
 * @param buf - Buffer de la imagen.
 * @returns Objeto con ancho y alto o null si no se puede leer.
 */
export async function medirImagen( buf: Buffer ): Promise< { ancho: number ; alto: number } | null > {
  try {
    if( !Buffer.isBuffer( buf ) || (buf.length === 0) ) {
      return( null ) ;
    }

    if( esCabeceraIco( buf ) ) {
      const imgBuf = await extraerImagenDeIco( buf ) ;
      if( !imgBuf ) {
        return( null ) ;
      }
      const meta = await sharp( imgBuf ).metadata() ;
      if( meta.width && meta.height ) {
        return( { ancho: meta.width , alto: meta.height } ) ;
      }
      return( null ) ;
    }

    const meta = await sharp( buf ).metadata() ;
    if( meta.width && meta.height ) {
      return( { ancho: meta.width , alto: meta.height } ) ;
    }

    const infoSvg = await sharp( buf , { density: 72 } )
      .resize( 128 , 128 , { fit: "inside" } )
      .toBuffer( { resolveWithObject: true } ) ;

    if( infoSvg.info.width && infoSvg.info.height ) {
      return( { ancho: infoSvg.info.width , alto: infoSvg.info.height } ) ;
    }

    return( null ) ;
  } catch {
    return( null ) ;
  }
}

/**
 * Normaliza un ícono binario a formato PNG de 128x128 píxeles con contención y fondo transparente.
 * Retorna además el ancho original detectado antes del escalado.
 *
 * @param buf - Buffer de la imagen en formato soportado (PNG, SVG, ICO con PNG/BMP, etc.).
 * @returns Objeto con dataUri base64, dimensiones y ancho original o null si no se puede procesar.
 */
export async function normalizarIcono( buf: Buffer ): Promise< ( IconoNormalizado & { origenAncho: number } ) | null > {
  try {
    const dimensiones = await medirImagen( buf ) ;
    if( !dimensiones ) {
      return( null ) ;
    }

    const origenAncho = dimensiones.ancho ;
    let entrada: Buffer ;

    if( esCabeceraIco( buf ) ) {
      const imgBuf = await extraerImagenDeIco( buf ) ;
      if( !imgBuf ) {
        return( null ) ;
      }
      entrada = imgBuf ;
    } else {
      entrada = buf ;
    }

    const salidaBuffer = await sharp( entrada )
      .resize( 128 , 128 , {
        fit:        "contain" ,
        background: { r: 0 , g: 0 , b: 0 , alpha: 0 }
      } )
      .png()
      .toBuffer() ;

    return( {
      dataUri:     `data:image/png;base64,${salidaBuffer.toString( "base64" )}` ,
      ancho:       128 ,
      alto:        128 ,
      bytes:       salidaBuffer.length ,
      origenAncho
    } ) ;
  } catch {
    return( null ) ;
  }
}
