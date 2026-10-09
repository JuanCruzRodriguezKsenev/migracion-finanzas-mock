/**
 * @file estrategiasIcono.test.ts
 * Pruebas unitarias para las estrategias de resolución de logotipos e íconos.
 */

// Librerías externas
import { describe , it , expect , vi , beforeEach } from "vitest" ;
import dns                                          from "dns" ;

// Feature: Sandbox
import {
  estrategiaIconoGoogleS2 ,
  estrategiaIconoSitio
} from "./estrategiasIcono" ;

interface DnsSpyMock {
  mockResolvedValue: ( val: dns.LookupAddress[] ) => void ;
  mockRejectedValue: ( err: Error ) => void ;
  mockImplementation: ( fn: ( host: string ) => Promise< dns.LookupAddress[] > ) => void ;
}

const spyDns = () => vi.spyOn( dns.promises , "lookup" ) as unknown as DnsSpyMock ;

describe( "estrategiasIcono" , () => {
  beforeEach( () => {
    vi.restoreAllMocks() ;
  } ) ;

  describe( "sitio" , () => {
    it( "elige el apple-touch-icon y devuelve hallados completos" , async() => {
      spyDns().mockResolvedValue( [
        { address: "93.184.216.34" , family: 4 }
      ] ) ;

      const html = `
        <html>
        <head>
          <link rel="icon" href="/favicon.ico">
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon.png">
        </head>
        </html>
      ` ;

      global.fetch = vi.fn().mockImplementation( async( url: string ) => {
        if( url.includes( "apple-icon.png" ) ) {
          return( {
            ok:     true ,
            status: 200 ,
            headers: new Headers( { "content-type": "image/png" } ) ,
            body: new ReadableStream( {
              start( controller ) {
                controller.enqueue( new Uint8Array( [137 , 80 , 78 , 71] ) ) ;
                controller.close() ;
              }
            } )
          } as unknown as Response ) ;
        }

        return( {
          ok:     true ,
          status: 200 ,
          headers: new Headers( { "content-type": "text/html" } ) ,
          body: new ReadableStream( {
            start( controller ) {
              controller.enqueue( new TextEncoder().encode( html ) ) ;
              controller.close() ;
            }
          } )
        } as unknown as Response ) ;
      } ) ;

      const res = await estrategiaIconoSitio( "ejemplo.com" , {} ) ;

      expect( res.ok ).toBe( true ) ;
      expect( res.origen ).toBe( "apple-touch-icon" ) ;
      expect( res.hallados ).toHaveLength( 2 ) ;
      expect( res.dataUri ).toContain( "data:image/png;base64," ) ;
    } ) ;

    it( "maneja respuesta 403 con estado 'http 403'" , async() => {
      spyDns().mockResolvedValue( [
        { address: "93.184.216.34" , family: 4 }
      ] ) ;

      global.fetch = vi.fn().mockResolvedValue( {
        ok:     false ,
        status: 403 ,
        headers: new Headers( { "content-type": "text/html" } ) ,
        body: new ReadableStream( {
          start( controller ) {
            controller.enqueue( new TextEncoder().encode( "Forbidden" ) ) ;
            controller.close() ;
          }
        } )
      } as unknown as Response ) ;

      const res = await estrategiaIconoSitio( "bbva.com.ar" , {} ) ;

      expect( res.ok ).toBe( false ) ;
      expect( res.estado ).toBe( "http 403" ) ;
    } ) ;
  } ) ;

  describe( "google-s2" , () => {
    it( "procesa imagen de 261 B con ok:true y bytes:261" , async() => {
      spyDns().mockResolvedValue( [
        { address: "142.250.190.46" , family: 4 }
      ] ) ;

      const payload = new Uint8Array( 261 ) ;
      global.fetch = vi.fn().mockResolvedValue( {
        ok:     true ,
        status: 200 ,
        headers: new Headers( { "content-type": "image/png" } ) ,
        body: new ReadableStream( {
          start( controller ) {
            controller.enqueue( payload ) ;
            controller.close() ;
          }
        } )
      } as unknown as Response ) ;

      const res = await estrategiaIconoGoogleS2( "galicia.ar" , {} ) ;

      expect( res.ok ).toBe( true ) ;
      expect( res.bytes ).toBe( 261 ) ;
      expect( res.estado ).toBe( "200" ) ;
    } ) ;
  } ) ;
} ) ;
