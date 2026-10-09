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
 * Si es un ICO analiza el PNG interno; de lo contrario utiliza metadata de sharp.
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
      const pngBuf = extraerPngDeIco( buf ) ;
      if( !pngBuf ) {
        return( null ) ;
      }
      const meta = await sharp( pngBuf ).metadata() ;
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
 * @param buf - Buffer de la imagen en formato soportado (PNG, SVG, ICO con PNG, etc.).
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
      const pngBuf = extraerPngDeIco( buf ) ;
      if( !pngBuf ) {
        return( null ) ;
      }
      entrada = pngBuf ;
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
