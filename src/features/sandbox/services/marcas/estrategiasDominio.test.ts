/**
 * @file estrategiasDominio.test.ts
 * Pruebas unitarias para las estrategias de descubrimiento de dominios.
 */

// Librerías externas
import { describe , it , expect , vi , beforeEach } from "vitest" ;
import dns                                          from "dns" ;

// Feature: Sandbox
import {
  generarCandidatosVerificables ,
  estrategiaVerificados ,
  estrategiaDuckDuckGo ,
  estrategiaCandidatos ,
  titulaDominioEnVenta ,
  estrategiaWikidata ,
  generarCandidatos ,
  TLDS_PRODUCTO
} from "./estrategiasDominio" ;

interface DnsSpyMock {
  mockResolvedValue: ( val: dns.LookupAddress[] ) => void ;
  mockRejectedValue: ( err: Error ) => void ;
  mockImplementation: ( fn: ( host: string ) => Promise< dns.LookupAddress[] > ) => void ;
}

const spyDns = () => vi.spyOn( dns.promises , "lookup" ) as unknown as DnsSpyMock ;

describe( "estrategiasDominio" , () => {
  beforeEach( () => {
    vi.restoreAllMocks() ;
  } ) ;

  describe( "duckduckgo" , () => {
    it( "detecta respuesta 202 con anomaly y retorna ok:false con estado 'bloqueado' en una sola llamada" , async() => {
      spyDns().mockResolvedValue( [
        { address: "52.142.124.215" , family: 4 }
      ] ) ;

      const fetchSpy = vi.fn().mockResolvedValue( {
        status: 202 ,
        ok:     false ,
        headers: new Headers( { "content-type": "text/html" } ) ,
        body: new ReadableStream( {
          start( controller ) {
            controller.enqueue( new TextEncoder().encode( "<html><script src='/anomaly.js'></script></html>" ) ) ;
            controller.close() ;
          }
        } )
      } as unknown as Response ) ;
      global.fetch = fetchSpy ;

      const res = await estrategiaDuckDuckGo( "galicia" , {
        pais: { sufijo: ".com.ar" , nombre: "argentina" }
      } ) ;

      expect( fetchSpy ).toHaveBeenCalledTimes( 1 ) ;
      expect( res.ok ).toBe( false ) ;
      expect( res.estado ).toContain( "bloqueado" ) ;
      expect( res.candidatos ).toEqual( [] ) ;
    } ) ;
  } ) ;

  describe( "wikidata" , () => {
    it( "desenvuelve P856 de Wayback Machine y extrae el dominio de Galicia Más" , async() => {
      spyDns().mockResolvedValue( [
        { address: "208.80.154.224" , family: 4 }
      ] ) ;

      global.fetch = vi.fn().mockImplementation( async( url: string ) => {
        if( url.includes( "wbsearchentities" ) ) {
          return( {
            ok:     true ,
            status: 200 ,
            headers: new Headers( { "content-type": "application/json" } ) ,
            body: new ReadableStream( {
              start( controller ) {
                const data = JSON.stringify( {
                  search: [
                    {
                      id:          "Q130642790" ,
                      label:       "Galicia Más" ,
                      description: "Entidad financiera argentina"
                    }
                  ]
                } ) ;
                controller.enqueue( new TextEncoder().encode( data ) ) ;
                controller.close() ;
              }
            } )
          } as unknown as Response ) ;
        }

        if( url.includes( "Q130642790" ) ) {
          return( {
            ok:     true ,
            status: 200 ,
            headers: new Headers( { "content-type": "application/json" } ) ,
            body: new ReadableStream( {
              start( controller ) {
                const data = JSON.stringify( {
                  entities: {
                    Q130642790: {
                      claims: {
                        P856: [
                          {
                            mainsnak: {
                              datavalue: {
                                value: "https://web.archive.org/web/https://www.galiciamas.com.ar/"
                              }
                            }
                          }
                        ] ,
                        P154: [
                          {
                            mainsnak: {
                              datavalue: {
                                value: "Galicia-Mas-Logo.png"
                              }
                            }
                          }
                        ]
                      }
                    }
                  }
                } ) ;
                controller.enqueue( new TextEncoder().encode( data ) ) ;
                controller.close() ;
              }
            } )
          } as unknown as Response ) ;
        }

        return( { ok: false , status: 404 } as unknown as Response ) ;
      } ) ;

      const res = await estrategiaWikidata( "galicia mas" , {
        pais: { sufijo: ".com.ar" , nombre: "argentina" }
      } ) ;

      expect( res.ok ).toBe( true ) ;
      expect( res.candidatos ).toHaveLength( 1 ) ;
      expect( res.candidatos[0].dominio ).toBe( "galiciamas.com.ar" ) ;
      expect( res.candidatos[0].archivoLogo ).toBe( "Galicia-Mas-Logo.png" ) ;
    } ) ;
  } ) ;

  describe( "candidatos" , () => {
    it( "genera candidatos con las 5 reglas heurísticas para 'banco nacion'" , () => {
      const ar = { sufijo: ".com.ar" , nombre: "argentina" } ;
      const lista = generarCandidatos( "banco nacion" , ar ) ;

      expect( lista ).toContain( "banconacion.com" ) ;
      expect( lista ).toContain( "banconacion.com.ar" ) ;
      expect( lista ).toContain( "banco-nacion.com" ) ;
      expect( lista ).toContain( "banco-nacion.com.ar" ) ;
      expect( lista ).toContain( "bn.com" ) ;
      expect( lista ).toContain( "bn.com.ar" ) ;
      expect( lista ).toContain( "banconacionargentina.com" ) ;
      expect( lista ).toContain( "banconacionargentina.com.ar" ) ;
      expect( lista ).toContain( "bna.com" ) ;
      expect( lista ).toContain( "bna.com.ar" ) ;
    } ) ;

    it( "resuelve candidatos mediante hostEsPublico" , async() => {
      spyDns().mockImplementation( async( host ) => {
        if( host === "banconacion.com.ar" ) {
          return( [{ address: "200.5.120.10" , family: 4 }] ) ;
        }
        return( [] ) ;
      } ) ;

      const res = await estrategiaCandidatos( "banco nacion" , {
        pais: { sufijo: ".com.ar" , nombre: "argentina" }
      } ) ;

      expect( res.ok ).toBe( true ) ;
      const bna = res.candidatos.find( ( c ) => c.dominio === "banconacion.com.ar" ) ;
      expect( bna?.resuelve ).toBe( true ) ;
    } ) ;
  } ) ;

  describe( "verificados" , () => {
    const paisAr = { sufijo: ".com.ar" , nombre: "argentina" } ;

    it( "genera lista de candidatos para 'galicia' y 'mercado pago'" , () => {
      const candGalicia = generarCandidatosVerificables( "galicia" , paisAr ) ;
      expect( candGalicia ).toEqual( [
        "galicia.com.ar" ,
        "galicia.ar" ,
        "galicia.com"
      ] ) ;

      const candMp = generarCandidatosVerificables( "mercado pago" , paisAr ) ;
      expect( candMp ).toEqual( [
        "mercadopago.com.ar" ,
        "mercadopago.ar" ,
        "mercadopago.com" ,
        "mercado-pago.com.ar" ,
        "mercado-pago.com" ,
        "mp.com.ar" ,
        "mp.com" ,
        "mpa.com.ar" ,
        "mpa.com"
      ] ) ;
    } ) ;

    it( "sin pais genera sólo candidatos con .com" , () => {
      const candGalicia = generarCandidatosVerificables( "galicia" , null ) ;
      expect( candGalicia ).toEqual( [ "galicia.com" ] ) ;

      const candMp = generarCandidatosVerificables( "mercado pago" , null ) ;
      expect( candMp ).toEqual( [ "mercadopago.com" , "mercado-pago.com" , "mp.com" ] ) ;
    } ) ;

    it( "galicia.ar con <title>Banco Galicia</title> -> coincide: true y primero frente a host con otro título" , async() => {
      spyDns().mockImplementation( async( host ) => {
        if( (host === "galicia.com.ar") || (host === "galicia.ar") ) {
          return( [{ address: "200.5.120.10" , family: 4 }] ) ;
        }
        return( [] ) ;
      } ) ;

      global.fetch = vi.fn().mockImplementation( async( url: string ) => {
        if( url.includes( "galicia.ar" ) ) {
          return( {
            ok:     true ,
            status: 200 ,
            headers: new Headers( { "content-type": "text/html" } ) ,
            body: new ReadableStream( {
              start( controller ) {
                controller.enqueue( new TextEncoder().encode( "<html><head><title>Banco Galicia</title></head></html>" ) ) ;
                controller.close() ;
              }
            } )
          } as unknown as Response ) ;
        }
        if( url.includes( "galicia.com.ar" ) ) {
          return( {
            ok:     true ,
            status: 200 ,
            headers: new Headers( { "content-type": "text/html" } ) ,
            body: new ReadableStream( {
              start( controller ) {
                controller.enqueue( new TextEncoder().encode( "<html><head><title>Otra cosa totalmente distinta</title></head></html>" ) ) ;
                controller.close() ;
              }
            } )
          } as unknown as Response ) ;
        }
        return( { ok: false , status: 404 } as unknown as Response ) ;
      } ) ;

      const res = await estrategiaVerificados( "galicia" , { pais: paisAr } ) ;

      expect( res.ok ).toBe( true ) ;
      expect( res.candidatos[0].dominio ).toBe( "galicia.ar" ) ;
      expect( res.candidatos[0].coincide ).toBe( true ) ;
      expect( res.candidatos[1].dominio ).toBe( "galicia.com.ar" ) ;
      expect( res.candidatos[1].coincide ).toBe( false ) ;
    } ) ;

    it( "host sin DNS -> resuelve: false y cero pedidos HTTP a él" , async() => {
      spyDns().mockImplementation( async() => [] ) ;

      const fetchSpy = vi.fn() ;
      global.fetch = fetchSpy ;

      const res = await estrategiaVerificados( "galicia" , { pais: paisAr } ) ;

      expect( res.ok ).toBe( true ) ;
      expect( res.candidatos.every( ( c ) => c.resuelve === false ) ).toBe( true ) ;
      expect( fetchSpy ).not.toHaveBeenCalled() ;
    } ) ;

    it( "timeout del pedido -> resuelve: true, sin título" , async() => {
      spyDns().mockImplementation( async( host ) => {
        if( host === "galicia.ar" ) {
          return( [{ address: "200.5.120.10" , family: 4 }] ) ;
        }
        return( [] ) ;
      } ) ;

      global.fetch = vi.fn().mockImplementation( async( url: string ) => {
        if( url.includes( "galicia.ar" ) ) {
          throw new Error( "The operation was aborted" ) ;
        }
        return( { ok: false , status: 404 } as unknown as Response ) ;
      } ) ;

      const res = await estrategiaVerificados( "galicia" , { pais: paisAr } ) ;

      expect( res.ok ).toBe( true ) ;
      const cand = res.candidatos.find( ( c ) => c.dominio === "galicia.ar" ) ;
      expect( cand?.resuelve ).toBe( true ) ;
      expect( cand?.titulo ).toBeUndefined() ;
      expect( cand?.coincide ).toBe( false ) ;
    } ) ;

    it( "generarCandidatosVerificables con 'banco nacion' (AR) incluye siglas y respeta tope 10" , () => {
      const cand = generarCandidatosVerificables( "banco nacion" , paisAr ) ;
      expect( cand ).toContain( "bn.com.ar" ) ;
      expect( cand ).toContain( "bna.com.ar" ) ;
      expect( cand ).toHaveLength( 9 ) ;
      expect( cand.length ).toBeLessThanOrEqual( 10 ) ;
    } ) ;

    it( "belo sin coincidencia en primera pasada prueba belo.app y queda primero" , async() => {
      spyDns().mockImplementation( async( host ) => {
        if( (host === "belo.com") || (host === "belo.app") ) {
          return( [{ address: "200.5.120.10" , family: 4 }] ) ;
        }
        return( [] ) ;
      } ) ;

      global.fetch = vi.fn().mockImplementation( async( url: string ) => {
        if( url.includes( "belo.com" ) ) {
          return( {
            ok:     true ,
            status: 200 ,
            headers: new Headers( { "content-type": "text/html" } ) ,
            body: new ReadableStream( {
              start( controller ) {
                controller.enqueue( new TextEncoder().encode( "<html><head><title>Otra Empresa Diferente</title></head></html>" ) ) ;
                controller.close() ;
              }
            } )
          } as unknown as Response ) ;
        }
        if( url.includes( "belo.app" ) ) {
          return( {
            ok:     true ,
            status: 200 ,
            headers: new Headers( { "content-type": "text/html" } ) ,
            body: new ReadableStream( {
              start( controller ) {
                controller.enqueue( new TextEncoder().encode( "<html><head><title>Belo - cuenta</title></head></html>" ) ) ;
                controller.close() ;
              }
            } )
          } as unknown as Response ) ;
        }
        return( { ok: false , status: 404 } as unknown as Response ) ;
      } ) ;

      const res = await estrategiaVerificados( "belo" , { pais: paisAr } ) ;

      expect( res.ok ).toBe( true ) ;
      expect( res.candidatos[0].dominio ).toBe( "belo.app" ) ;
      expect( res.candidatos[0].coincide ).toBe( true ) ;
    } ) ;

    it( "si hay coincidencia en primera pasada no se prueba TLDS_PRODUCTO (cero pedidos a .app)" , async() => {
      expect( TLDS_PRODUCTO ).toEqual( [ ".app" , ".io" , ".so" , ".co" , ".ai" ] ) ;

      spyDns().mockImplementation( async( host ) => {
        if( (host === "galicia.ar") || (host === "galicia.app") ) {
          return( [{ address: "200.5.120.10" , family: 4 }] ) ;
        }
        return( [] ) ;
      } ) ;

      const fetchSpy = vi.fn().mockImplementation( async( url: string ) => {
        if( url.includes( "galicia.ar" ) ) {
          return( {
            ok:     true ,
            status: 200 ,
            headers: new Headers( { "content-type": "text/html" } ) ,
            body: new ReadableStream( {
              start( controller ) {
                controller.enqueue( new TextEncoder().encode( "<html><head><title>Banco Galicia Oficial</title></head></html>" ) ) ;
                controller.close() ;
              }
            } )
          } as unknown as Response ) ;
        }
        return( { ok: false , status: 404 } as unknown as Response ) ;
      } ) ;
      global.fetch = fetchSpy ;

      const res = await estrategiaVerificados( "galicia" , { pais: paisAr } ) ;

      expect( res.ok ).toBe( true ) ;
      expect( res.candidatos[0].coincide ).toBe( true ) ;
      const llamadasApp = fetchSpy.mock.calls.filter( ( [ u ] ) => String( u ).includes( ".app" ) ) ;
      expect( llamadasApp ).toHaveLength( 0 ) ;
    } ) ;

    it( "titulaDominioEnVenta detecta los cuatro casos reales y marca coincide: false con resuelve: true" , async() => {
      expect( titulaDominioEnVenta( "Edesur.com is for sale | HugeDomains" ) ).toBe( true ) ;
      expect( titulaDominioEnVenta( "telecentro.com&nbsp;-&nbsp;¡Este sitio web está a la venta!&nbsp;-&nbsp;telecentro Recursos e información." ) ).toBe( true ) ;
      expect( titulaDominioEnVenta( "Banco Provincia de Buenos Aires" ) ).toBe( false ) ;
      expect( titulaDominioEnVenta( "Mercado Pago | De ahora en adelante, hacés más con tu dinero" ) ).toBe( false ) ;

      spyDns().mockImplementation( async( host ) => {
        if( host === "edesur.com" ) {
          return( [{ address: "200.5.120.10" , family: 4 }] ) ;
        }
        return( [] ) ;
      } ) ;

      global.fetch = vi.fn().mockImplementation( async( url: string ) => {
        if( url.includes( "edesur.com" ) ) {
          return( {
            ok:     true ,
            status: 200 ,
            headers: new Headers( { "content-type": "text/html" } ) ,
            body: new ReadableStream( {
              start( controller ) {
                controller.enqueue( new TextEncoder().encode( "<html><head><title>Edesur.com is for sale | HugeDomains</title></head></html>" ) ) ;
                controller.close() ;
              }
            } )
          } as unknown as Response ) ;
        }
        return( { ok: false , status: 404 } as unknown as Response ) ;
      } ) ;

      const res = await estrategiaVerificados( "edesur" , { pais: paisAr } ) ;
      expect( res.ok ).toBe( true ) ;
      const cand = res.candidatos.find( ( c ) => c.dominio === "edesur.com" ) ;
      expect( cand?.resuelve ).toBe( true ) ;
      expect( cand?.coincide ).toBe( false ) ;
      expect( cand?.titulo ).toBe( "Edesur.com is for sale | HugeDomains" ) ;
    } ) ;

    it( "apex sin DNS y www con DNS -> resuelve: true, pedido a www y dominio sin www" , async() => {
      spyDns().mockImplementation( async( host ) => {
        if( host === "www.edesur.com.ar" ) {
          return( [{ address: "45.60.113.88" , family: 4 }] ) ;
        }
        return( [] ) ;
      } ) ;

      const fetchSpy = vi.fn().mockImplementation( async( url: string ) => {
        if( url.includes( "www.edesur.com.ar" ) ) {
          return( {
            ok:     true ,
            status: 200 ,
            headers: new Headers( { "content-type": "text/html" } ) ,
            body: new ReadableStream( {
              start( controller ) {
                controller.enqueue( new TextEncoder().encode( "<html><head><title>Edesur - Inicio</title></head></html>" ) ) ;
                controller.close() ;
              }
            } )
          } as unknown as Response ) ;
        }
        return( { ok: false , status: 404 } as unknown as Response ) ;
      } ) ;
      global.fetch = fetchSpy ;

      const res = await estrategiaVerificados( "edesur" , { pais: paisAr } ) ;
      expect( res.ok ).toBe( true ) ;
      const cand = res.candidatos.find( ( c ) => c.dominio === "edesur.com.ar" ) ;
      expect( cand?.resuelve ).toBe( true ) ;
      expect( cand?.dominio ).toBe( "edesur.com.ar" ) ;
      expect( fetchSpy ).toHaveBeenCalledWith(
        "https://www.edesur.com.ar/" ,
        expect.anything()
      ) ;
    } ) ;

    it( "ni apex ni www con DNS -> resuelve: false y cero pedidos" , async() => {
      spyDns().mockImplementation( async() => [] ) ;

      const fetchSpy = vi.fn() ;
      global.fetch   = fetchSpy ;

      const res = await estrategiaVerificados( "inexistente total" , { pais: paisAr } ) ;
      expect( res.ok ).toBe( true ) ;
      expect( res.candidatos.every( ( c ) => c.resuelve === false ) ).toBe( true ) ;
      expect( fetchSpy ).not.toHaveBeenCalled() ;
    } ) ;
  } ) ;
} ) ;
