/**
 * @file fetchSeguro.test.ts
 * Pruebas unitarias para fetchSeguro y validaciones de protección contra SSRF.
 */

// Librerías externas
import { describe , it , expect , vi , beforeEach } from "vitest" ;
import dns                                          from "dns" ;

// Feature: Sandbox
import {
  validarDominio ,
  hostEsPublico ,
  fetchSeguro ,
  esIpPrivada
} from "./fetchSeguro" ;

describe( "fetchSeguro" , () => {
  describe( "validarDominio" , () => {
    it( "acepta dominios válidos y limpia esquema, ruta y puerto" , () => {
      expect( validarDominio( "galicia.ar" ) ).toBe( "galicia.ar" ) ;
      expect( validarDominio( "https://bbva.com/personas?tab=1" ) ).toBe( "bbva.com" ) ;
      expect( validarDominio( "http://sub.dominio.com.ar:8080/test" ) ).toBe( "sub.dominio.com.ar" ) ;
    } ) ;

    it( "rechaza localhost y sufijos internos" , () => {
      expect( validarDominio( "localhost" ) ).toBeNull() ;
      expect( validarDominio( "api.localhost" ) ).toBeNull() ;
      expect( validarDominio( "server.local" ) ).toBeNull() ;
      expect( validarDominio( "node.internal" ) ).toBeNull() ;
      expect( validarDominio( "router.lan" ) ).toBeNull() ;
    } ) ;

    it( "rechaza literales IP y formatos inválidos" , () => {
      expect( validarDominio( "10.0.0.1" ) ).toBeNull() ;
      expect( validarDominio( "127.0.0.1" ) ).toBeNull() ;
      expect( validarDominio( "169.254.169.254" ) ).toBeNull() ;
      expect( validarDominio( "a..b" ) ).toBeNull() ;
      expect( validarDominio( "" ) ).toBeNull() ;
      expect( validarDominio( "-invalido.com" ) ).toBeNull() ;
    } ) ;
  } ) ;

  describe( "esIpPrivada" , () => {
    const casos = [
      { ip: "169.254.169.254" , esperadaPrivada: true , descripcion: "metadatos de nube (169.254/16)" } ,
      { ip: "100.64.0.1"      , esperadaPrivada: true , descripcion: "CGNAT (100.64/10)" } ,
      { ip: "127.0.0.1"       , esperadaPrivada: true , descripcion: "loopback IPv4" } ,
      { ip: "10.1.2.3"        , esperadaPrivada: true , descripcion: "red privada 10/8" } ,
      { ip: "172.16.5.4"      , esperadaPrivada: true , descripcion: "red privada 172.16/12" } ,
      { ip: "192.168.1.1"     , esperadaPrivada: true , descripcion: "red privada 192.168/16" } ,
      { ip: "0.0.0.0"         , esperadaPrivada: true , descripcion: "origen 0/8" } ,
      { ip: "224.0.0.1"       , esperadaPrivada: true , descripcion: "multicast 224/4" } ,
      { ip: "::1"             , esperadaPrivada: true , descripcion: "loopback IPv6" } ,
      { ip: "::"              , esperadaPrivada: true , descripcion: "no especificada IPv6" } ,
      { ip: "::ffff:127.0.0.1" , esperadaPrivada: true , descripcion: "IPv4-mapped privada" } ,
      { ip: "fc00::1"         , esperadaPrivada: true , descripcion: "ULA IPv6 fc00::/7" } ,
      { ip: "fe80::1"         , esperadaPrivada: true , descripcion: "Link-Local IPv6 fe80::/10" } ,
      { ip: "8.8.8.8"         , esperadaPrivada: false , descripcion: "DNS público de Google" } ,
      { ip: "1.1.1.1"         , esperadaPrivada: false , descripcion: "DNS público de Cloudflare" } ,
      { ip: "200.5.120.10"    , esperadaPrivada: false , descripcion: "IP pública general" }
    ] ;

    it.each( casos )( "evalúa $ip como $esperadaPrivada ($descripcion)" , ( { ip , esperadaPrivada } ) => {
      expect( esIpPrivada( ip ) ).toBe( esperadaPrivada ) ;
    } ) ;
  } ) ;

  interface DnsSpyMock {
    mockResolvedValue: ( val: dns.LookupAddress[] ) => void ;
    mockRejectedValue: ( err: Error ) => void ;
    mockImplementation: ( fn: ( host: string ) => Promise< dns.LookupAddress[] > ) => void ;
  }

  const spyDns = () => vi.spyOn( dns.promises , "lookup" ) as unknown as DnsSpyMock ;

  describe( "hostEsPublico" , () => {
    beforeEach( () => {
      vi.restoreAllMocks() ;
    } ) ;

    it( "retorna false si alguna IP del host es privada" , async() => {
      spyDns().mockResolvedValue( [
        { address: "8.8.8.8" , family: 4 } ,
        { address: "192.168.1.1" , family: 4 }
      ] ) ;

      const publico = await hostEsPublico( "ejemplo-mixto.com" ) ;
      expect( publico ).toBe( false ) ;
    } ) ;

    it( "retorna true si todas las IPs del host son públicas" , async() => {
      spyDns().mockResolvedValue( [
        { address: "8.8.8.8" , family: 4 } ,
        { address: "1.1.1.1" , family: 4 }
      ] ) ;

      const publico = await hostEsPublico( "ejemplo-publico.com" ) ;
      expect( publico ).toBe( true ) ;
    } ) ;

    it( "retorna false si DNS lookup falla o no devuelve direcciones" , async() => {
      spyDns().mockRejectedValue( new Error( "ENOTFOUND" ) ) ;
      const publico = await hostEsPublico( "no-existe.invalido" ) ;
      expect( publico ).toBe( false ) ;
    } ) ;
  } ) ;

  describe( "fetchSeguro" , () => {
    beforeEach( () => {
      vi.restoreAllMocks() ;
    } ) ;

    it( "no sigue una redirección a un host privado" , async() => {
      // Mock inicial de DNS para permitir host origen
      spyDns().mockImplementation( async( host ) => {
        if( host === "origen.com" ) {
          return( [{ address: "93.184.216.34" , family: 4 }] ) ;
        }
        if( host === "interno.local" ) {
          return( [{ address: "127.0.0.1" , family: 4 }] ) ;
        }
        return( [] ) ;
      } ) ;

      // Mock de fetch global
      global.fetch = vi.fn().mockResolvedValue( {
        status: 302 ,
        headers: new Headers( { location: "http://interno.local/secreto" } )
      } as unknown as Response ) ;

      const respuesta = await fetchSeguro( "http://origen.com" ) ;
      expect( respuesta.ok ).toBe( false ) ;
      expect( respuesta.estado ).toBe( "host privado o no resoluble" ) ;
    } ) ;

    it( "corta el cuerpo en maxBytes" , async() => {
      spyDns().mockResolvedValue( [
        { address: "93.184.216.34" , family: 4 }
      ] ) ;

      const chunk = new Uint8Array( [65 , 65 , 65 , 65 , 65] ) ; // 5 bytes "AAAAA"
      const stream = new ReadableStream( {
        start( controller ) {
          controller.enqueue( chunk ) ;
          controller.enqueue( chunk ) ;
          controller.close() ;
        }
      } ) ;

      global.fetch = vi.fn().mockResolvedValue( {
        ok: true ,
        status: 200 ,
        headers: new Headers( { "content-type": "text/plain" } ) ,
        body: stream
      } as unknown as Response ) ;

      const respuesta = await fetchSeguro( "http://origen.com" , { maxBytes: 7 } ) ;
      expect( respuesta.ok ).toBe( true ) ;
      expect( respuesta.cuerpo?.length ).toBe( 7 ) ;
    } ) ;

    it( "nunca lanza excepción ante un fetch que rechaza la promesa" , async() => {
      spyDns().mockResolvedValue( [
        { address: "93.184.216.34" , family: 4 }
      ] ) ;

      global.fetch = vi.fn().mockRejectedValue( new Error( "ECONNREFUSED" ) ) ;

      const respuesta = await fetchSeguro( "http://origen.com" ) ;
      expect( respuesta.ok ).toBe( false ) ;
      expect( respuesta.status ).toBe( 0 ) ;
      expect( respuesta.estado ).toBe( "ECONNREFUSED" ) ;
    } ) ;
  } ) ;
} ) ;
