/**
 * @file analisisHtml.test.ts
 * Pruebas unitarias para las utilidades de análisis HTML y manifiestos web.
 */

// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Sandbox
import {
  desenvolverArchive ,
  extraerManifestUrl ,
  parseResultadosDdg ,
  iconosDeManifest ,
  extraerThemeColor ,
  elegirMejorIcono ,
  extraerIconos ,
  dominioDeUrl
} from "./analisisHtml" ;
import type { CandidatoIcono } from "./tiposMarca" ;

describe( "analisisHtml" , () => {
  describe( "extraerIconos con fixtures reales" , () => {
    it( "extrae apple-touch-icon relativo resuelto contra la URL final (galicia.ar)" , () => {
      const htmlGalicia = `
        <!DOCTYPE html>
        <html>
        <head>
          <link rel="apple-touch-icon" href="/etc.clientlibs/galicia/clientlibs/clientlib-site/resources/images/logoGalicia.png">
          <meta name="theme-color" content="#000000">
          <meta property="og:image" content="https://www.galicia.ar/content/dam/galicia/og-image.jpg">
        </head>
        </html>
      ` ;
      const iconos = extraerIconos( htmlGalicia , "https://www.galicia.ar/personas" ) ;

      expect( iconos ).toHaveLength( 2 ) ;
      expect( iconos[0] ).toEqual( {
        url:    "https://www.galicia.ar/etc.clientlibs/galicia/clientlibs/clientlib-site/resources/images/logoGalicia.png" ,
        origen: "apple-touch-icon" ,
        tamano: undefined ,
        tipo:   undefined
      } ) ;
      expect( iconos[1] ).toEqual( {
        url:    "https://www.galicia.ar/content/dam/galicia/og-image.jpg" ,
        origen: "og:image"
      } ) ;
    } ) ;

    it( "extrae apple-touch-icon 180x180 absoluto e icon svg (mercadopago.com.ar)" , () => {
      const htmlMp = `
        <html>
        <head>
          <link rel="apple-touch-icon" sizes="180x180" href="https://http2.mlstatic.com/frontend-assets/ui-navigation/5.21.22/mercadopago/180x180.png">
          <link rel="icon" type="image/svg+xml" href="https://http2.mlstatic.com/frontend-assets/ui-navigation/5.21.22/mercadopago/favicon.svg">
        </head>
        </html>
      ` ;
      const iconos = extraerIconos( htmlMp , "https://www.mercadopago.com.ar" ) ;

      expect( iconos ).toHaveLength( 2 ) ;
      expect( iconos[0] ).toEqual( {
        url:    "https://http2.mlstatic.com/frontend-assets/ui-navigation/5.21.22/mercadopago/180x180.png" ,
        origen: "apple-touch-icon" ,
        tamano: 180 ,
        tipo:   undefined
      } ) ;
      expect( iconos[1] ).toEqual( {
        url:    "https://http2.mlstatic.com/frontend-assets/ui-navigation/5.21.22/mercadopago/favicon.svg" ,
        origen: "icon" ,
        tamano: undefined ,
        tipo:   "image/svg+xml"
      } ) ;
    } ) ;

    it( "extrae shortcut icon y apple-touch-icon absolutos (brubank.com)" , () => {
      const htmlBrubank = `
        <html>
        <head>
          <link rel="shortcut icon" href="https://assets.brubank.com/favicon.png">
          <link rel="apple-touch-icon" href="https://assets.brubank.com/apple-icon.png">
        </head>
        </html>
      ` ;
      const iconos = extraerIconos( htmlBrubank , "https://www.brubank.com" ) ;

      expect( iconos ).toHaveLength( 2 ) ;
      expect( iconos[0].origen ).toBe( "icon" ) ;
      expect( iconos[1].origen ).toBe( "apple-touch-icon" ) ;
    } ) ;

    it( "resuelve favicon.ico relativo y og:image protocolo-relativo a https: (naranjax.com)" , () => {
      const htmlNx = `
        <html>
        <head>
          <link rel="icon" href="favicon.ico">
          <meta property="og:image" content="//images.ctfassets.net/nx/nx-og-image.png">
        </head>
        </html>
      ` ;
      const iconos = extraerIconos( htmlNx , "https://naranjax.com/home" ) ;

      expect( iconos ).toHaveLength( 2 ) ;
      expect( iconos[0].url ).toBe( "https://naranjax.com/favicon.ico" ) ;
      expect( iconos[1].url ).toBe( "https://images.ctfassets.net/nx/nx-og-image.png" ) ;
      expect( iconos[1].origen ).toBe( "og:image" ) ;
    } ) ;

    it( "tolera atributos en orden invertido y comillas simples" , () => {
      const html = `<link href='https://ejemplo.com/icon.png' rel='icon' sizes='180x180'>` ;
      const iconos = extraerIconos( html , "https://ejemplo.com" ) ;

      expect( iconos ).toHaveLength( 1 ) ;
      expect( iconos[0].url ).toBe( "https://ejemplo.com/icon.png" ) ;
      expect( iconos[0].tamano ).toBe( 180 ) ;
    } ) ;

    it( "extrae el mayor tamaño en atributo compuesto como sizes='16x16 32x32'" , () => {
      const html = `<link rel="icon" sizes="16x16 32x32" href="/fav.ico">` ;
      const iconos = extraerIconos( html , "https://ejemplo.com" ) ;

      expect( iconos[0].tamano ).toBe( 32 ) ;
    } ) ;

    it( "descarta esquemas data: para íconos" , () => {
      const html = `<link rel="icon" href="data:image/png;base64,iVBORw0KGgo...">` ;
      const iconos = extraerIconos( html , "https://ejemplo.com" ) ;

      expect( iconos ).toHaveLength( 0 ) ;
    } ) ;
  } ) ;

  describe( "elegirMejorIcono" , () => {
    it( "prioriza mayor tamaño conocido" , () => {
      const lista: CandidatoIcono[] = [
        { url: "https://ejemplo.com/32.png" , origen: "icon" , tamano: 32 } ,
        { url: "https://ejemplo.com/180.png" , origen: "apple-touch-icon" , tamano: 180 } ,
        { url: "https://ejemplo.com/64.png" , origen: "icon" , tamano: 64 }
      ] ;
      const mejor = elegirMejorIcono( lista ) ;
      expect( mejor?.url ).toBe( "https://ejemplo.com/180.png" ) ;
    } ) ;

    it( "deja og:image estrictamente como último recurso" , () => {
      const lista: CandidatoIcono[] = [
        { url: "https://ejemplo.com/banner.jpg" , origen: "og:image" } ,
        { url: "https://ejemplo.com/favicon.ico" , origen: "icon" }
      ] ;
      const mejor = elegirMejorIcono( lista ) ;
      expect( mejor?.url ).toBe( "https://ejemplo.com/favicon.ico" ) ;

      const soloOg: CandidatoIcono[] = [
        { url: "https://ejemplo.com/banner.jpg" , origen: "og:image" }
      ] ;
      expect( elegirMejorIcono( soloOg )?.url ).toBe( "https://ejemplo.com/banner.jpg" ) ;
    } ) ;

    it( "desempata por tipo si no hay tamaños (apple-touch-icon > svg > png > manifest > ico)" , () => {
      const lista: CandidatoIcono[] = [
        { url: "https://ejemplo.com/fav.ico" , origen: "icon" } ,
        { url: "https://ejemplo.com/logo.svg" , origen: "icon" , tipo: "image/svg+xml" } ,
        { url: "https://ejemplo.com/touch.png" , origen: "apple-touch-icon" }
      ] ;
      const mejor = elegirMejorIcono( lista ) ;
      expect( mejor?.url ).toBe( "https://ejemplo.com/touch.png" ) ;
    } ) ;
  } ) ;

  describe( "extraerThemeColor" , () => {
    it( "extrae color hexadecimal válido #rrggbb" , () => {
      const html = `<meta name="theme-color" content="#1a56f0">` ;
      expect( extraerThemeColor( html ) ).toBe( "#1a56f0" ) ;
    } ) ;

    it( "rechaza color no hexadecimal o mal formateado" , () => {
      const html = `<meta name="theme-color" content="red">` ;
      expect( extraerThemeColor( html ) ).toBeUndefined() ;
    } ) ;
  } ) ;

  describe( "extraerManifestUrl e iconosDeManifest" , () => {
    it( "extrae URL del manifest y procesa íconos y theme_color" , () => {
      const html = `<link rel="manifest" href="/site.webmanifest">` ;
      const manifestUrl = extraerManifestUrl( html , "https://ejemplo.com" ) ;
      expect( manifestUrl ).toBe( "https://ejemplo.com/site.webmanifest" ) ;

      const jsonManifest = {
        theme_color: "#ff5500" ,
        icons: [
          { src: "/icon-192.png" , sizes: "192x192" , type: "image/png" } ,
          { src: "/icon-512.png" , sizes: "512x512" , type: "image/png" }
        ]
      } ;

      const datos = iconosDeManifest( jsonManifest , "https://ejemplo.com/site.webmanifest" ) ;
      expect( datos.themeColor ).toBe( "#ff5500" ) ;
      expect( datos.iconos ).toHaveLength( 2 ) ;
      expect( datos.iconos[0].url ).toBe( "https://ejemplo.com/icon-192.png" ) ;
      expect( datos.iconos[0].tamano ).toBe( 192 ) ;
      expect( datos.iconos[1].tamano ).toBe( 512 ) ;
    } ) ;

    it( "tolera JSON roto en el manifest retornando lista vacía" , () => {
      const datos = iconosDeManifest( "{ invalido: true " , "https://ejemplo.com" ) ;
      expect( datos.iconos ).toEqual( [] ) ;
      expect( datos.themeColor ).toBeUndefined() ;
    } ) ;
  } ) ;

  describe( "desenvolverArchive" , () => {
    it( "desenvuelve URL con timestamp" , () => {
      const url = "https://web.archive.org/web/20230501120000/https://www.galiciamas.com.ar/" ;
      expect( desenvolverArchive( url ) ).toBe( "https://www.galiciamas.com.ar/" ) ;
    } ) ;

    it( "desenvuelve URL sin timestamp" , () => {
      const url = "https://web.archive.org/web/https://www.galiciamas.com.ar/" ;
      expect( desenvolverArchive( url ) ).toBe( "https://www.galiciamas.com.ar/" ) ;
    } ) ;

    it( "deja intacta una URL que no pertenece a Wayback Machine" , () => {
      const url = "https://www.netflix.com/" ;
      expect( desenvolverArchive( url ) ).toBe( "https://www.netflix.com/" ) ;
    } ) ;
  } ) ;

  describe( "parseResultadosDdg" , () => {
    it( "decodifica enlaces uddg de DuckDuckGo" , () => {
      const html = `
        <a class="result__url" href="#">ignorar</a>
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.galicia.ar%2Fpersonas&rut=...">Galicia</a>
        <a class="result__a" href="https://onlinebanking.bancogalicia.com.ar/">Online Banking</a>
      ` ;
      const dominios = parseResultadosDdg( html ) ;
      expect( dominios ).toEqual( ["galicia.ar" , "onlinebanking.bancogalicia.com.ar"] ) ;
    } ) ;

    it( "devuelve lista vacía en página de desafío anti-bot sin enlaces result__a" , () => {
      const htmlDesafio = `
        <html>
        <head><script src="/anomaly.js"></script></head>
        <body><div id="anomaly-modal">Please verify</div></body>
        </html>
      ` ;
      expect( parseResultadosDdg( htmlDesafio ) ).toEqual( [] ) ;
    } ) ;
  } ) ;

  describe( "dominioDeUrl" , () => {
    it( "quita www. y normaliza a minúsculas" , () => {
      expect( dominioDeUrl( "https://www.BancoGalicia.com.ar/personas" ) ).toBe( "bancogalicia.com.ar" ) ;
      expect( dominioDeUrl( "http://Netflix.COM" ) ).toBe( "netflix.com" ) ;
    } ) ;
  } ) ;
} ) ;
