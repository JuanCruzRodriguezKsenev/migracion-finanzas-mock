/**
 * @file colorMarca.test.ts
 * Pruebas unitarias para el cálculo determinista del color dominante de marcas.
 */

// Librerías externas
import { describe , it , expect } from "vitest" ;
import sharp                       from "sharp" ;

// Shared
import { colorDominante } from "./colorMarca" ;

function extraerCanalesHex( hex: string ): { r: number ; g: number ; b: number } {
  const limpio = hex.replace( "#" , "" ) ;
  return( {
    r: parseInt( limpio.slice( 0 , 2 ) , 16 ) ,
    g: parseInt( limpio.slice( 2 , 4 ) , 16 ) ,
    b: parseInt( limpio.slice( 4 , 6 ) , 16 )
  } ) ;
}

describe( "colorMarca" , () => {
  it( "4. PNG sólido #e50914 -> un rojo dentro de +-8 por canal de #e50914" , async () => {
    const pngRojo = await sharp( {
      create: {
        width:      32 ,
        height:     32 ,
        channels:   4 ,
        background: { r: 0xe5 , g: 0x09 , b: 0x14 , alpha: 1 }
      }
    } )
      .png()
      .toBuffer() ;

    const color = await colorDominante( pngRojo ) ;
    expect( color ).not.toBeNull() ;

    const canales = extraerCanalesHex( color! ) ;
    expect( Math.abs( canales.r - 0xe5 ) ).toBeLessThanOrEqual( 8 ) ;
    expect( Math.abs( canales.g - 0x09 ) ).toBeLessThanOrEqual( 8 ) ;
    expect( Math.abs( canales.b - 0x14 ) ).toBeLessThanOrEqual( 8 ) ;
  } ) ;

  it( "5. PNG negro con cuadrado naranja de 30% -> gana el naranja por ser cromático" , async () => {
    const totalPixeles    = 32 * 32 ;
    const pixelesNaranja  = Math.round( totalPixeles * 0.30 ) ;
    const bufferRgba      = Buffer.alloc( totalPixeles * 4 ) ;

    for( let i = 0 ; i < totalPixeles ; i++ ) {
      const offset = i * 4 ;
      if( i < pixelesNaranja ) {
        bufferRgba[offset]     = 240 ;
        bufferRgba[offset + 1] = 120 ;
        bufferRgba[offset + 2] = 0 ;
        bufferRgba[offset + 3] = 255 ;
      } else {
        bufferRgba[offset]     = 0 ;
        bufferRgba[offset + 1] = 0 ;
        bufferRgba[offset + 2] = 0 ;
        bufferRgba[offset + 3] = 255 ;
      }
    }

    const compuesto = await sharp( bufferRgba , {
      raw: { width: 32 , height: 32 , channels: 4 }
    } )
      .png()
      .toBuffer() ;

    const color = await colorDominante( compuesto ) ;
    expect( color ).not.toBeNull() ;

    const canales = extraerCanalesHex( color! ) ;
    // Debe haber ganado el naranja (R alto > 200, G moderado > 100, B bajo < 50), no el negro
    expect( canales.r ).toBeGreaterThan( 200 ) ;
    expect( canales.g ).toBeGreaterThan( 100 ) ;
    expect( canales.b ).toBeLessThan( 50 ) ;
  } ) ;

  it( "6. totalmente negro -> #000000; totalmente blanco -> #ffffff; totalmente transparente -> null" , async () => {
    const pngNegro = await sharp( {
      create: {
        width:      32 ,
        height:     32 ,
        channels:   4 ,
        background: { r: 0 , g: 0 , b: 0 , alpha: 1 }
      }
    } )
      .png()
      .toBuffer() ;

    const colorNegro = await colorDominante( pngNegro ) ;
    expect( colorNegro ).toBe( "#000000" ) ;

    const pngBlanco = await sharp( {
      create: {
        width:      32 ,
        height:     32 ,
        channels:   4 ,
        background: { r: 255 , g: 255 , b: 255 , alpha: 1 }
      }
    } )
      .png()
      .toBuffer() ;

    const colorBlanco = await colorDominante( pngBlanco ) ;
    expect( colorBlanco ).toBe( "#ffffff" ) ;

    const pngTransparente = await sharp( {
      create: {
        width:      32 ,
        height:     32 ,
        channels:   4 ,
        background: { r: 0 , g: 0 , b: 0 , alpha: 0 }
      }
    } )
      .png()
      .toBuffer() ;

    const colorTransparente = await colorDominante( pngTransparente ) ;
    expect( colorTransparente ).toBeNull() ;
  } ) ;
} ) ;
