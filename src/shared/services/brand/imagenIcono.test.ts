/**
 * @file imagenIcono.test.ts
 * Pruebas unitarias para extracción de PNG desde ICO, medición y normalización de íconos.
 */

// Librerías externas
import { describe , it , expect } from "vitest" ;
import sharp                       from "sharp" ;

// Shared
import {
  extraerImagenDeIco ,
  normalizarIcono ,
  extraerPngDeIco ,
  medirImagen
} from "./imagenIcono" ;

async function crearPng( ancho: number , alto: number , r = 255 , g = 0 , b = 0 ): Promise< Buffer > {
  return(
    await sharp( {
      create: {
        width:      ancho ,
        height:     alto ,
        channels:   4 ,
        background: { r , g , b , alpha: 1 }
      }
    } )
      .png()
      .toBuffer()
  ) ;
}

function armarIco( entradas: { ancho: number ; alto: number ; buf: Buffer }[] ): Buffer {
  const cantidad = entradas.length ;
  const header   = Buffer.alloc( 6 ) ;
  header.writeUInt16LE( 0 , 0 ) ;
  header.writeUInt16LE( 1 , 2 ) ;
  header.writeUInt16LE( cantidad , 4 ) ;

  const directorio = Buffer.alloc( cantidad * 16 ) ;
  let desplazamiento = 6 + (cantidad * 16) ;
  const bufsDatos: Buffer[] = [] ;

  for( let i = 0 ; i < cantidad ; i++ ) {
    const e      = entradas[i] ;
    const offset = i * 16 ;
    directorio[offset]     = (e.ancho >= 256) ? 0 : e.ancho ;
    directorio[offset + 1] = (e.alto >= 256) ? 0 : e.alto ;
    directorio[offset + 2] = 0 ;
    directorio[offset + 3] = 0 ;
    directorio.writeUInt16LE( 1 , offset + 4 ) ;
    directorio.writeUInt16LE( 32 , offset + 6 ) ;
    directorio.writeUInt32LE( e.buf.length , offset + 8 ) ;
    directorio.writeUInt32LE( desplazamiento , offset + 12 ) ;
    desplazamiento += e.buf.length ;
    bufsDatos.push( e.buf ) ;
  }

  return( Buffer.concat( [ header , directorio , ...bufsDatos ] ) ) ;
}

describe( "imagenIcono" , () => {
  it( "1. extraerPngDeIco devuelve el PNG de la entrada mayor; null si es BMP; null con buffer truncado o aleatorio" , async () => {
    const png16 = await crearPng( 16 , 16 , 255 , 0 , 0 ) ;
    const png48 = await crearPng( 48 , 48 , 0 , 255 , 0 ) ;

    const icoDosPngs = armarIco( [
      { ancho: 16 , alto: 16 , buf: png16 } ,
      { ancho: 48 , alto: 48 , buf: png48 }
    ] ) ;

    const extraido = extraerPngDeIco( icoDosPngs ) ;
    expect( extraido ).not.toBeNull() ;
    expect( extraido!.equals( png48 ) ).toBe( true ) ;

    // Entrada mayor con datos BMP o falsos (sin firma PNG)
    const bmpFalsoMayor = armarIco( [
      { ancho: 16 , alto: 16 , buf: png16 } ,
      { ancho: 64 , alto: 64 , buf: Buffer.from( "BM_datos_bmp_no_png_padding_1234567890" ) }
    ] ) ;
    expect( extraerPngDeIco( bmpFalsoMayor ) ).toBeNull() ;

    // Buffer truncado o aleatorio
    expect( extraerPngDeIco( Buffer.from( [ 0 , 0 , 1 , 0 ] ) ) ).toBeNull() ;
    expect( extraerPngDeIco( Buffer.alloc( 100 , 0xaa ) ) ).toBeNull() ;
    expect( extraerPngDeIco( Buffer.from( "" ) ) ).toBeNull() ;
  } ) ;

  it( "2. medirImagen: PNG 200x100 -> {200, 100}; ICO con PNG de 48 -> {48, 48}; basura -> null" , async () => {
    const png200x100 = await crearPng( 200 , 100 ) ;
    const dimPng     = await medirImagen( png200x100 ) ;
    expect( dimPng ).toEqual( { ancho: 200 , alto: 100 } ) ;

    const png48  = await crearPng( 48 , 48 ) ;
    const ico48  = armarIco( [ { ancho: 48 , alto: 48 , buf: png48 } ] ) ;
    const dimIco = await medirImagen( ico48 ) ;
    expect( dimIco ).toEqual( { ancho: 48 , alto: 48 } ) ;

    const dimBasura = await medirImagen( Buffer.from( "texto que no es imagen" ) ) ;
    expect( dimBasura ).toBeNull() ;
  } ) ;

  it( "3. normalizarIcono: salida de 128x128, PNG, origenAncho igual al original; no rechaza PNG de 32px" , async () => {
    const png32       = await crearPng( 32 , 32 ) ;
    const normalizado = await normalizarIcono( png32 ) ;

    expect( normalizado ).not.toBeNull() ;
    expect( normalizado!.ancho ).toBe( 128 ) ;
    expect( normalizado!.alto ).toBe( 128 ) ;
    expect( normalizado!.origenAncho ).toBe( 32 ) ;
    expect( normalizado!.dataUri.startsWith( "data:image/png;base64," ) ).toBe( true ) ;

    const b64  = normalizado!.dataUri.replace( "data:image/png;base64," , "" ) ;
    const meta = await sharp( Buffer.from( b64 , "base64" ) ).metadata() ;

    expect( meta.width ).toBe( 128 ) ;
    expect( meta.height ).toBe( 128 ) ;
    expect( meta.format ).toBe( "png" ) ;
  } ) ;

  it( "4. extraerImagenDeIco decodifica entrada BMP 32bpp y la convierte a PNG" , async () => {
    const ancho  = 32 ;
    const alto   = 32 ;
    const biSize = 40 ;
    const pixelBytes = ancho * alto * 4 ;
    const andMaskRowStride = Math.floor( ( ancho + 31 ) / 32 ) * 4 ;
    const andMaskBytes = andMaskRowStride * alto ;
    const bmpBuf = Buffer.alloc( biSize + pixelBytes + andMaskBytes ) ;

    bmpBuf.writeUInt32LE( biSize , 0 ) ;
    bmpBuf.writeInt32LE( ancho , 4 ) ;
    bmpBuf.writeInt32LE( alto * 2 , 8 ) ;
    bmpBuf.writeUInt16LE( 1 , 12 ) ;
    bmpBuf.writeUInt16LE( 32 , 14 ) ;
    bmpBuf.writeUInt32LE( 0 , 16 ) ;

    for( let i = 0 ; i < ancho * alto ; i++ ) {
      const offset = biSize + ( i * 4 ) ;
      bmpBuf[offset]     = 200 ; // B
      bmpBuf[offset + 1] = 100 ; // G
      bmpBuf[offset + 2] = 50 ;  // R
      bmpBuf[offset + 3] = 255 ; // A
    }

    const icoConBmp = armarIco( [ { ancho: 32 , alto: 32 , buf: bmpBuf } ] ) ;

    // extraerPngDeIco síncrono retorna null para BMP
    expect( extraerPngDeIco( icoConBmp ) ).toBeNull() ;

    // extraerImagenDeIco asíncrono lo decodifica a PNG
    const extraido = await extraerImagenDeIco( icoConBmp ) ;
    expect( extraido ).not.toBeNull() ;

    const meta = await sharp( extraido! ).metadata() ;
    expect( meta.width ).toBe( 32 ) ;
    expect( meta.height ).toBe( 32 ) ;
    expect( meta.format ).toBe( "png" ) ;
  } ) ;

  it( "5. extraerImagenDeIco y medirImagen manejan cabeceras BMP corruptas sin lanzar errores" , async () => {
    // Cabecera menor a 40 bytes
    const bmpTruncado = armarIco( [ { ancho: 16 , alto: 16 , buf: Buffer.alloc( 20 , 0 ) } ] ) ;
    expect( await extraerImagenDeIco( bmpTruncado ) ).toBeNull() ;
    expect( await medirImagen( bmpTruncado ) ).toBeNull() ;

    // biSize !== 40
    const bmpCabeceraInvalida = Buffer.alloc( 60 , 0 ) ;
    bmpCabeceraInvalida.writeUInt32LE( 20 , 0 ) ; // biSize incorrecto
    const icoInvalido = armarIco( [ { ancho: 16 , alto: 16 , buf: bmpCabeceraInvalida } ] ) ;
    expect( await extraerImagenDeIco( icoInvalido ) ).toBeNull() ;
    expect( await medirImagen( icoInvalido ) ).toBeNull() ;
  } ) ;

  it( "6. normalizarIcono produce data URI de 128x128 a partir de un ICO con BMP de 32bpp" , async () => {
    const ancho  = 32 ;
    const alto   = 32 ;
    const biSize = 40 ;
    const pixelBytes = ancho * alto * 4 ;
    const andMaskRowStride = Math.floor( ( ancho + 31 ) / 32 ) * 4 ;
    const andMaskBytes = andMaskRowStride * alto ;
    const bmpBuf = Buffer.alloc( biSize + pixelBytes + andMaskBytes ) ;

    bmpBuf.writeUInt32LE( biSize , 0 ) ;
    bmpBuf.writeInt32LE( ancho , 4 ) ;
    bmpBuf.writeInt32LE( alto * 2 , 8 ) ;
    bmpBuf.writeUInt16LE( 1 , 12 ) ;
    bmpBuf.writeUInt16LE( 32 , 14 ) ;
    bmpBuf.writeUInt32LE( 0 , 16 ) ;

    for( let i = 0 ; i < ancho * alto ; i++ ) {
      const offset = biSize + ( i * 4 ) ;
      bmpBuf[offset]     = 10 ;
      bmpBuf[offset + 1] = 20 ;
      bmpBuf[offset + 2] = 200 ;
      bmpBuf[offset + 3] = 255 ;
    }

    const icoConBmp   = armarIco( [ { ancho: 32 , alto: 32 , buf: bmpBuf } ] ) ;
    const normalizado = await normalizarIcono( icoConBmp ) ;

    expect( normalizado ).not.toBeNull() ;
    expect( normalizado!.ancho ).toBe( 128 ) ;
    expect( normalizado!.alto ).toBe( 128 ) ;
    expect( normalizado!.origenAncho ).toBe( 32 ) ;
    expect( normalizado!.dataUri.startsWith( "data:image/png;base64," ) ).toBe( true ) ;

    const b64  = normalizado!.dataUri.replace( "data:image/png;base64," , "" ) ;
    const meta = await sharp( Buffer.from( b64 , "base64" ) ).metadata() ;
    expect( meta.width ).toBe( 128 ) ;
    expect( meta.height ).toBe( 128 ) ;
  } ) ;
} ) ;
