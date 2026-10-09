/**
 * @file imagenIcono.test.ts
 * Pruebas unitarias para extracción de PNG desde ICO, medición y normalización de íconos.
 */

// Librerías externas
import { describe , it , expect } from "vitest" ;
import sharp                       from "sharp" ;

// Shared
import {
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
} ) ;
