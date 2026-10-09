/**
 * @file colorMarca.ts
 * Cálculo determinista del color dominante de un ícono de marca a partir de su imagen.
 */

// Librerías externas
import sharp from "sharp" ;

interface CuboColor {
  cuenta:       number ;
  sumaR:        number ;
  sumaG:        number ;
  sumaB:        number ;
  saturacion?:  number ;
  esCromatico?: boolean ;
}

function formatearHex( canal: number ): string {
  return( canal.toString( 16 ).padStart( 2 , "0" ) ) ;
}

/**
 * Calcula el color dominante de un ícono a partir de su buffer PNG o binario compatible.
 * Prioriza los cubos cromáticos con suficiente saturación y brillo (s >= 0.25 y v >= 0.15);
 * si el isotipo es acromático, excluye los cubos casi blancos (s < 0.25 y v > 0.9) salvo que
 * sean los únicos cubos opacos de la imagen.
 *
 * @param png - Buffer binario de la imagen.
 * @returns Cadena hexadecimal #rrggbb en minúsculas o null si no hay píxeles legibles.
 */
export async function colorDominante( png: Buffer ): Promise< string | null > {
  try {
    if( !Buffer.isBuffer( png ) || (png.length === 0) ) {
      return( null ) ;
    }

    const { data , info } = await sharp( png )
      .resize( 32 , 32 , { fit: "fill" } )
      .ensureAlpha()
      .raw()
      .toBuffer( { resolveWithObject: true } ) ;

    if( !data || (info.channels !== 4) ) {
      return( null ) ;
    }

    const cubos      = new Map< number , CuboColor >() ;
    const totalBytes = data.length ;

    for( let i = 0 ; i < totalBytes ; i += 4 ) {
      const r = data[i] ;
      const g = data[i + 1] ;
      const b = data[i + 2] ;
      const a = data[i + 3] ;

      if( a < 128 ) {
        continue ;
      }

      const qr  = r >> 4 ;
      const qg  = g >> 4 ;
      const qb  = b >> 4 ;
      const key = (qr << 8) | (qg << 4) | qb ;

      const existente = cubos.get( key ) ;
      if( existente ) {
        existente.cuenta++ ;
        existente.sumaR += r ;
        existente.sumaG += g ;
        existente.sumaB += b ;
      } else {
        cubos.set( key , {
          cuenta: 1 ,
          sumaR:  r ,
          sumaG:  g ,
          sumaB:  b
        } ) ;
      }
    }

    if( cubos.size === 0 ) {
      return( null ) ;
    }

    const cromaticos: { cubo: CuboColor ; s: number }[] = [] ;
    let mejorAcromatico: CuboColor | null = null ;
    let mejorCasiBlanco: CuboColor | null = null ;

    for( const cubo of cubos.values() ) {
      const mediaR = Math.round( cubo.sumaR / cubo.cuenta ) ;
      const mediaG = Math.round( cubo.sumaG / cubo.cuenta ) ;
      const mediaB = Math.round( cubo.sumaB / cubo.cuenta ) ;

      const rn  = mediaR / 255 ;
      const gn  = mediaG / 255 ;
      const bn  = mediaB / 255 ;
      const max = Math.max( rn , gn , bn ) ;
      const min = Math.min( rn , gn , bn ) ;
      const d   = max - min ;

      const v = max ;
      const s = (max === 0) ? 0 : (d / max) ;

      cubo.saturacion = s ;

      const esCromatico = (s >= 0.25) && (v >= 0.15) ;
      cubo.esCromatico = esCromatico ;

      if( esCromatico ) {
        cromaticos.push( { cubo , s } ) ;
      } else {
        const esCasiBlanco = (s < 0.25) && (v > 0.9) ;
        if( esCasiBlanco ) {
          if( !mejorCasiBlanco || (cubo.cuenta > mejorCasiBlanco.cuenta) ) {
            mejorCasiBlanco = cubo ;
          }
        } else {
          if( !mejorAcromatico || (cubo.cuenta > mejorAcromatico.cuenta) ) {
            mejorAcromatico = cubo ;
          }
        }
      }
    }

    if( !mejorAcromatico ) {
      mejorAcromatico = mejorCasiBlanco ;
    }

    let cuboElegido: CuboColor | null = null ;

    if( cromaticos.length > 0 ) {
      cromaticos.sort( ( a , b ) => {
        const difCuenta = b.cubo.cuenta - a.cubo.cuenta ;
        if( difCuenta !== 0 ) {
          return( difCuenta ) ;
        }
        return( b.s - a.s ) ;
      } ) ;
      cuboElegido = cromaticos[0].cubo ;
    } else {
      cuboElegido = mejorAcromatico ;
    }

    if( !cuboElegido ) {
      return( null ) ;
    }

    const finalR = Math.round( cuboElegido.sumaR / cuboElegido.cuenta ) ;
    const finalG = Math.round( cuboElegido.sumaG / cuboElegido.cuenta ) ;
    const finalB = Math.round( cuboElegido.sumaB / cuboElegido.cuenta ) ;

    const hex = `#${formatearHex( finalR )}${formatearHex( finalG )}${formatearHex( finalB )}`.toLowerCase() ;
    return( hex ) ;
  } catch {
    return( null ) ;
  }
}

/**
 * true si el color es casi blanco (Y >= 240) o casi negro (Y <= 12); sin gamma, canales 0–255.
 *
 * @param hex - Cadena hexadecimal #rrggbb.
 * @returns true si el color es extremo; false si es intermedio o inválido.
 */
export function esColorExtremo( hex: string ): boolean {
  if( !hex || !/^#[0-9a-f]{6}$/i.test( hex ) ) {
    return( false ) ;
  }
  const r = parseInt( hex.slice( 1 , 3 ) , 16 ) ;
  const g = parseInt( hex.slice( 3 , 5 ) , 16 ) ;
  const b = parseInt( hex.slice( 5 , 7 ) , 16 ) ;
  const y = (0.2126 * r) + (0.7152 * g) + (0.0722 * b) ;
  return( (y <= 12) || (y >= 240) ) ;
}
