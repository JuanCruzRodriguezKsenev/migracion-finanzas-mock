/**
 * @file resolutorIdentidad.test.ts
 * Pruebas unitarias para el resolutor centralizado de identidad de marca (cascada de íconos y color).
 */

// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach } from "vitest" ;
import sharp                                                    from "sharp" ;
import dns                                                      from "dns" ;

// Shared
import { resolverIdentidad } from "./resolutorIdentidad" ;

async function crearPng( ancho: number , alto: number , r = 229 , g = 9 , b = 20 ): Promise< Buffer > {
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

function respuestaImagen( buf: Buffer ): Response {
  return(
    new Response( new Uint8Array( buf ) as unknown as BodyInit , {
      status:  200 ,
      headers: { "content-type": "image/png" }
    } )
  ) ;
}

describe( "resolutorIdentidad" , () => {
  let fetchMock: ReturnType< typeof vi.fn > ;

  beforeEach( () => {
    vi.restoreAllMocks() ;

    // DNS por defecto: siempre resuelve a IP pública
    ( vi.spyOn( dns.promises , "lookup" ) as unknown as { mockImplementation: ( fn: ( host: string ) => Promise< unknown > ) => void } ).mockImplementation(
      async ( host ) => {
        if( host === "privado.test" ) {
          return( [ { address: "169.254.169.254" , family: 4 } ] ) ;
        }
        if( host === "interno.test" ) {
          return( [ { address: "10.0.0.1" , family: 4 } ] ) ;
        }
        return( [ { address: "93.184.216.34" , family: 4 } ] ) ;
      }
    ) ;

    fetchMock = vi.fn() ;
    vi.stubGlobal( "fetch" , fetchMock ) ;
  } ) ;

  afterEach( () => {
    vi.unstubAllGlobals() ;
    vi.restoreAllMocks() ;
  } ) ;

  it( "7. sitio con apple-touch-icon de 180px -> origen sitio, dataUri presente, color no nulo" , async () => {
    const png180 = await crearPng( 180 , 180 , 229 , 9 , 20 ) ;

    fetchMock.mockImplementation( async ( url: string | Request ) => {
      const u = String( url ) ;
      if( u === "https://ejemplo.com/" ) {
        const html = `<html><head><link rel="apple-touch-icon" sizes="180x180" href="/icon-180.png"></head></html>` ;
        return( new Response( html , { status: 200 , headers: { "content-type": "text/html" } } ) ) ;
      }
      if( u === "https://ejemplo.com/icon-180.png" ) {
        return( respuestaImagen( png180 ) ) ;
      }
      return( new Response( "" , { status: 404 } ) ) ;
    } ) ;

    const res = await resolverIdentidad( "ejemplo.com" ) ;
    expect( res.icono ).not.toBeNull() ;
    expect( res.icono?.origen ).toBe( "sitio" ) ;
    expect( res.icono?.dataUri?.startsWith( "data:image/png;base64," ) ).toBe( true ) ;
    expect( res.color ).not.toBeNull() ;
    expect( res.intentos ).toEqual( [ { fuente: "sitio" , ok: true } ] ) ;
  } ) ;

  it( "8. sitio con sólo favicon de 32px y S2 respondiendo PNG -> origen google-s2 (el chico queda como respaldo)" , async () => {
    const png32 = await crearPng( 32 , 32 , 0 , 100 , 200 ) ;
    const pngS2 = await crearPng( 128 , 128 , 229 , 9 , 20 ) ;

    fetchMock.mockImplementation( async ( url: string | Request ) => {
      const u = String( url ) ;
      if( u === "https://ejemplo.com/" ) {
        const html = `<html><head><link rel="icon" sizes="32x32" href="/icon-32.png"></head></html>` ;
        return( new Response( html , { status: 200 , headers: { "content-type": "text/html" } } ) ) ;
      }
      if( u === "https://ejemplo.com/icon-32.png" ) {
        return( respuestaImagen( png32 ) ) ;
      }
      if( u.includes( "google.com/s2/favicons" ) ) {
        return( respuestaImagen( pngS2 ) ) ;
      }
      return( new Response( "" , { status: 404 } ) ) ;
    } ) ;

    const res = await resolverIdentidad( "ejemplo.com" ) ;
    expect( res.icono?.origen ).toBe( "google-s2" ) ;
    expect( res.intentos[0] ).toEqual( { fuente: "sitio" , ok: false , motivo: "menor a 64 px" } ) ;
    expect( res.intentos[1] ).toEqual( { fuente: "google-s2" , ok: true } ) ;
  } ) ;

  it( "9. sitio falla con 403 y S2 responde -> origen google-s2; intentos registra 'http 403'" , async () => {
    const pngS2 = await crearPng( 128 , 128 , 229 , 9 , 20 ) ;

    fetchMock.mockImplementation( async ( url: string | Request ) => {
      const u = String( url ) ;
      if( u === "https://ejemplo.com/" ) {
        return( new Response( "Forbidden" , { status: 403 } ) ) ;
      }
      if( u.includes( "google.com/s2/favicons" ) ) {
        return( respuestaImagen( pngS2 ) ) ;
      }
      return( new Response( "" , { status: 404 } ) ) ;
    } ) ;

    const res = await resolverIdentidad( "ejemplo.com" ) ;
    expect( res.icono?.origen ).toBe( "google-s2" ) ;
    expect( res.intentos[0] ).toEqual( { fuente: "sitio" , ok: false , motivo: "http 403" } ) ;
    expect( res.intentos[1] ).toEqual( { fuente: "google-s2" , ok: true } ) ;
  } ) ;

  it( "10. sitio y S2 fallan, hay c= real -> brandfetch-cdn con url correcta, sin dataUri y color: null" , async () => {
    fetchMock.mockImplementation( async () => {
      return( new Response( "" , { status: 500 } ) ) ;
    } ) ;

    const res = await resolverIdentidad( "ejemplo.com" , { clientIdBrandfetch: "client_real_123" } ) ;
    expect( res.icono ).toEqual( {
      origen: "brandfetch-cdn" ,
      url:    "https://cdn.brandfetch.io/ejemplo.com?c=client_real_123"
    } ) ;
    expect( res.color ).toBeNull() ;
    expect( res.intentos ).toEqual( [
      { fuente: "sitio" , ok: false , motivo: "http 500" } ,
      { fuente: "google-s2" , ok: false , motivo: "http 500" } ,
      { fuente: "brandfetch-cdn" , ok: true }
    ] ) ;
  } ) ;

  it( "11. todo falla, sin c= real (vacío o 'brandfetch') -> icono: null, color: null, y no lanza" , async () => {
    fetchMock.mockImplementation( async () => {
      return( new Response( "" , { status: 500 } ) ) ;
    } ) ;

    const res = await resolverIdentidad( "ejemplo.com" , { clientIdBrandfetch: "brandfetch" } ) ;
    expect( res.icono ).toBeNull() ;
    expect( res.color ).toBeNull() ;
    expect( res.intentos ).toEqual( [
      { fuente: "sitio" , ok: false , motivo: "http 500" } ,
      { fuente: "google-s2" , ok: false , motivo: "http 500" } ,
      { fuente: "brandfetch-cdn" , ok: false , motivo: "sin cliente" }
    ] ) ;
  } ) ;

  it( "12. sólo hay favicon chico y nada más -> se devuelve el respaldo chico" , async () => {
    const png32 = await crearPng( 32 , 32 , 229 , 9 , 20 ) ;

    fetchMock.mockImplementation( async ( url: string | Request ) => {
      const u = String( url ) ;
      if( u === "https://ejemplo.com/" ) {
        const html = `<html><head><link rel="icon" sizes="32x32" href="/icon-32.png"></head></html>` ;
        return( new Response( html , { status: 200 , headers: { "content-type": "text/html" } } ) ) ;
      }
      if( u === "https://ejemplo.com/icon-32.png" ) {
        return( respuestaImagen( png32 ) ) ;
      }
      return( new Response( "" , { status: 500 } ) ) ;
    } ) ;

    const res = await resolverIdentidad( "ejemplo.com" , { clientIdBrandfetch: "brandfetch" } ) ;
    expect( res.icono ).not.toBeNull() ;
    expect( res.icono?.origen ).toBe( "sitio" ) ;
    expect( res.icono?.dataUri?.startsWith( "data:image/png;base64," ) ).toBe( true ) ;
    expect( res.color ).not.toBeNull() ;
    expect( res.intentos[0] ).toEqual( { fuente: "sitio" , ok: false , motivo: "menor a 64 px" } ) ;
    expect( res.intentos[1] ).toEqual( { fuente: "google-s2" , ok: false , motivo: "http 500" } ) ;
  } ) ;

  it( "13. dominio que resuelve a IP privada -> no se hace fetch de contenido; dominio inválido -> lanza 'dominio inválido'" , async () => {
    const resPrivado = await resolverIdentidad( "privado.test" ) ;
    expect( resPrivado.icono ).toBeNull() ;
    expect( resPrivado.color ).toBeNull() ;
    expect( fetchMock ).not.toHaveBeenCalled() ;
    expect( resPrivado.intentos[0].ok ).toBe( false ) ;
    expect( resPrivado.intentos[0].motivo ).toBe( "host privado o no resoluble" ) ;

    await expect( resolverIdentidad( "a b" ) ).rejects.toThrow( "dominio inválido" ) ;
  } ) ;

  it( "14. sólo se prueban 4 candidatos de sitio aunque haya 10 declarados" , async () => {
    const links = Array.from( { length: 10 } , ( _ , i ) => `<link rel="icon" href="/icon-${i + 1}.png">` ).join( "\n" ) ;
    const html  = `<html><head>${links}</head></html>` ;

    fetchMock.mockImplementation( async ( url: string | Request ) => {
      const u = String( url ) ;
      if( u === "https://ejemplo.com/" ) {
        return( new Response( html , { status: 200 , headers: { "content-type": "text/html" } } ) ) ;
      }
      return( new Response( "" , { status: 404 } ) ) ;
    } ) ;

    await resolverIdentidad( "ejemplo.com" , { clientIdBrandfetch: "brandfetch" } ) ;

    const llamadasIconos = fetchMock.mock.calls
      .map( ( [ url ] ) => String( url ) )
      .filter( ( u ) => u.includes( "/icon-" ) ) ;

    expect( llamadasIconos.length ).toBe( 4 ) ;
  } ) ;
} ) ;
