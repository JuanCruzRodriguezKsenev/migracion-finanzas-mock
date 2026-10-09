/**
 * @file colorMarca.test.ts
 * Pruebas unitarias para el cálculo determinista del color dominante de marcas.
 */

// Librerías externas
import { describe , it , expect } from "vitest" ;
import sharp                       from "sharp" ;

// Shared
import {
  colorDominante ,
  esColorExtremo
} from "./colorMarca" ;

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

  it( "7. celeste saturado muy claro #08b8f8 (v ≈ 0.97) con contorno marino menor -> devuelve el celeste, no el marino" , async () => {
    const totalPixeles   = 32 * 32 ;
    const pixelesCeleste = Math.round( totalPixeles * 0.75 ) ;
    const bufferRgba     = Buffer.alloc( totalPixeles * 4 ) ;

    for( let i = 0 ; i < totalPixeles ; i++ ) {
      const offset = i * 4 ;
      if( i < pixelesCeleste ) {
        // Celeste saturado Mercado Pago (#08b8f8)
        bufferRgba[offset]     = 8 ;
        bufferRgba[offset + 1] = 184 ;
        bufferRgba[offset + 2] = 248 ;
        bufferRgba[offset + 3] = 255 ;
      } else {
        // Contorno marino (#080888)
        bufferRgba[offset]     = 8 ;
        bufferRgba[offset + 1] = 8 ;
        bufferRgba[offset + 2] = 136 ;
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
    expect( canales.r ).toBeLessThanOrEqual( 16 ) ;
    expect( canales.g ).toBeGreaterThan( 170 ) ;
    expect( canales.b ).toBeGreaterThan( 230 ) ;
  } ) ;

  it( "8. naranja #ff6a13 (v = 1) junto a porción menor de violeta #480078 -> devuelve el naranja" , async () => {
    const totalPixeles   = 32 * 32 ;
    const pixelesNaranja = Math.round( totalPixeles * 0.75 ) ;
    const bufferRgba     = Buffer.alloc( totalPixeles * 4 ) ;

    for( let i = 0 ; i < totalPixeles ; i++ ) {
      const offset = i * 4 ;
      if( i < pixelesNaranja ) {
        // Naranja X (#ff6a13)
        bufferRgba[offset]     = 255 ;
        bufferRgba[offset + 1] = 106 ;
        bufferRgba[offset + 2] = 19 ;
        bufferRgba[offset + 3] = 255 ;
      } else {
        // Violeta (#480078)
        bufferRgba[offset]     = 72 ;
        bufferRgba[offset + 1] = 0 ;
        bufferRgba[offset + 2] = 120 ;
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
    expect( canales.r ).toBeGreaterThan( 240 ) ;
    expect( canales.g ).toBeGreaterThan( 90 ) ;
    expect( canales.b ).toBeLessThan( 30 ) ;
  } ) ;

  it( "9. baldosa blanca con glifo negro de 25% -> devuelve negro (#000000), no #fefefe" , async () => {
    const totalPixeles  = 32 * 32 ;
    const pixelesNegros = Math.round( totalPixeles * 0.25 ) ;
    const bufferRgba    = Buffer.alloc( totalPixeles * 4 ) ;

    for( let i = 0 ; i < totalPixeles ; i++ ) {
      const offset = i * 4 ;
      if( i < pixelesNegros ) {
        // Glifo negro
        bufferRgba[offset]     = 0 ;
        bufferRgba[offset + 1] = 0 ;
        bufferRgba[offset + 2] = 0 ;
        bufferRgba[offset + 3] = 255 ;
      } else {
        // Baldosa blanca
        bufferRgba[offset]     = 255 ;
        bufferRgba[offset + 1] = 255 ;
        bufferRgba[offset + 2] = 255 ;
        bufferRgba[offset + 3] = 255 ;
      }
    }

    const compuesto = await sharp( bufferRgba , {
      raw: { width: 32 , height: 32 , channels: 4 }
    } )
      .png()
      .toBuffer() ;

    const color = await colorDominante( compuesto ) ;
    expect( color ).toBe( "#000000" ) ;
  } ) ;

  it( "10. imagen toda blanca -> #ffffff; imagen blanca con un único píxel gris oscuro -> ese gris, no el blanco" , async () => {
    const pngTodaBlanca = await sharp( {
      create: {
        width:      32 ,
        height:     32 ,
        channels:   4 ,
        background: { r: 255 , g: 255 , b: 255 , alpha: 1 }
      }
    } )
      .png()
      .toBuffer() ;

    const colorBlanco = await colorDominante( pngTodaBlanca ) ;
    expect( colorBlanco ).toBe( "#ffffff" ) ;

    const totalPixeles = 32 * 32 ;
    const bufferRgba   = Buffer.alloc( totalPixeles * 4 ) ;

    for( let i = 0 ; i < totalPixeles ; i++ ) {
      const offset = i * 4 ;
      if( i === 0 ) {
        // Único píxel gris oscuro (#323232)
        bufferRgba[offset]     = 50 ;
        bufferRgba[offset + 1] = 50 ;
        bufferRgba[offset + 2] = 50 ;
        bufferRgba[offset + 3] = 255 ;
      } else {
        // Fondo blanco
        bufferRgba[offset]     = 255 ;
        bufferRgba[offset + 1] = 255 ;
        bufferRgba[offset + 2] = 255 ;
        bufferRgba[offset + 3] = 255 ;
      }
    }

    const compuesto = await sharp( bufferRgba , {
      raw: { width: 32 , height: 32 , channels: 4 }
    } )
      .png()
      .toBuffer() ;

    const colorGris = await colorDominante( compuesto ) ;
    expect( colorGris ).not.toBeNull() ;
    expect( colorGris ).not.toBe( "#ffffff" ) ;

    const canales = extraerCanalesHex( colorGris! ) ;
    expect( canales.r ).toBeLessThan( 80 ) ;
    expect( canales.g ).toBeLessThan( 80 ) ;
    expect( canales.b ).toBeLessThan( 80 ) ;
  } ) ;

  it( "11. esColorExtremo identifica casi blanco o casi negro y conserva colores cromáticos" , () => {
    // Casi blanco (Y >= 240) o casi negro (Y <= 12) -> true
    expect( esColorExtremo( "#fefefe" ) ).toBe( true ) ;
    expect( esColorExtremo( "#070809" ) ).toBe( true ) ;
    expect( esColorExtremo( "#000000" ) ).toBe( true ) ;
    expect( esColorExtremo( "#ffffff" ) ).toBe( true ) ;
    expect( esColorExtremo( "#f0f0f0" ) ).toBe( true ) ;

    // Colores cromáticos e intermedios -> false
    expect( esColorExtremo( "#480078" ) ).toBe( false ) ;
    expect( esColorExtremo( "#00278f" ) ).toBe( false ) ;
    expect( esColorExtremo( "#1ed961" ) ).toBe( false ) ;
    expect( esColorExtremo( "#ececec" ) ).toBe( false ) ;

    // Cadenas inválidas -> false sin explotar
    expect( esColorExtremo( "rojo" ) ).toBe( false ) ;
    expect( esColorExtremo( "" ) ).toBe( false ) ;
  } ) ;
} ) ;
