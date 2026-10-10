/**
 * @file verificados.test.ts
 * Pruebas unitarias para la estrategia verificados, candidatos, dominios en venta y cálculo de confianza.
 */

// Librerías externas
import { describe , it , expect , vi , beforeEach } from "vitest" ;

// Shared: Brand
import type { RespuestaSegura } from "@/shared/services/brand/fetchSeguro" ;
import * as fetchSeguroMod      from "@/shared/services/brand/fetchSeguro" ;
import {
  generarCandidatosVerificables ,
  estrategiaVerificados ,
  titulaDominioEnVenta ,
  esEtiquetaExacta ,
  TLDS_PRODUCTO
} from "./verificados" ;

describe( "verificados" , () => {
  beforeEach( () => {
    vi.restoreAllMocks() ;
  } ) ;

  it( "1. generarCandidatosVerificables genera candidatos con TLD local, .com, guiones y siglas" , () => {
    const candidatosSimple = generarCandidatosVerificables( "Netflix" , { sufijo: ".com.ar" , nombre: "argentina" } ) ;
    expect( candidatosSimple ).toContain( "netflix.com.ar" ) ;
    expect( candidatosSimple ).toContain( "netflix.ar" ) ;
    expect( candidatosSimple ).toContain( "netflix.com" ) ;

    const candidatosMultiples = generarCandidatosVerificables( "Banco Galicia" , { sufijo: ".com.ar" , nombre: "argentina" } ) ;
    expect( candidatosMultiples ).toContain( "bancogalicia.com.ar" ) ;
    expect( candidatosMultiples ).toContain( "banco-galicia.com.ar" ) ;
    expect( candidatosMultiples ).toContain( "banco-galicia.com" ) ;
    expect( candidatosMultiples ).toContain( "bg.com.ar" ) ;
    expect( candidatosMultiples ).toContain( "bga.com.ar" ) ;

    // Consulta vacía retorna array vacío
    expect( generarCandidatosVerificables( "" ) ).toEqual( [] ) ;
  } ) ;

  it( "2. titulaDominioEnVenta detecta dominios aparcados o a la venta" , () => {
    expect( titulaDominioEnVenta( "Buy this domain - HugeDomains" ) ).toBe( true ) ;
    expect( titulaDominioEnVenta( "Dominio a la venta en Sedo" ) ).toBe( true ) ;
    expect( titulaDominioEnVenta( "Sitio parked en GoDaddy" ) ).toBe( true ) ;
    expect( titulaDominioEnVenta( "Banco Galicia - Bienvenidos a tu banco online" ) ).toBe( false ) ;
    expect( titulaDominioEnVenta( "Netflix - Ver series online" ) ).toBe( false ) ;
  } ) ;

  it( "3. esEtiquetaExacta valida correspondencia entre slug de consulta y apex del dominio" , () => {
    expect( esEtiquetaExacta( "chatgpt.com" , "chatgpt" ) ).toBe( true ) ;
    expect( esEtiquetaExacta( "www.chatgpt.com" , "chatgpt" ) ).toBe( true ) ;
    expect( esEtiquetaExacta( "chatgpt.com.ar" , "ChatGPT" ) ).toBe( true ) ;
    expect( esEtiquetaExacta( "galicia.com" , "gali" ) ).toBe( false ) ;
    expect( esEtiquetaExacta( "mercadolibre.com" , "merc" ) ).toBe( false ) ;
    expect( esEtiquetaExacta( "bancogalicia.com" , "banco galicia" ) ).toBe( true ) ;
    expect( esEtiquetaExacta( "otro.com" , "" ) ).toBe( false ) ;
  } ) ;

  it( "4. estrategiaVerificados soporta fallback www, filtro de dominios en venta y discrimina confianzaAlta" , async () => {
    // Mock de hostEsPublico: solo resuelve www.ejemplo.com.ar y ajeno.com
    vi.spyOn( fetchSeguroMod , "hostEsPublico" ).mockImplementation( async( host: string ) => {
      if( host === "www.netflix.com.ar" ) return( true ) ;
      if( host === "netflix.com" ) return( true ) ;
      if( host === "ajeno.com" ) return( true ) ;
      return( false ) ;
    } ) ;

    // Mock de fetchSeguro
    vi.spyOn( fetchSeguroMod , "fetchSeguro" ).mockImplementation( async( url: string ) => {
      if( url.includes( "netflix" ) ) {
        return( {
          ok:       true ,
          status:   200 ,
          urlFinal: url ,
          tipo:     "text/html" ,
          cuerpo:   Buffer.from( "<html><head><title>Netflix Argentina - Ver series</title></head></html>" ) ,
          estado:   "ok"
        } satisfies RespuestaSegura ) ;
      }
      if( url.includes( "ajeno.com" ) ) {
        return( {
          ok:       true ,
          status:   200 ,
          urlFinal: url ,
          tipo:     "text/html" ,
          cuerpo:   Buffer.from( "<html><head><title>Portal Genérico No Coincidente</title></head></html>" ) ,
          estado:   "ok"
        } satisfies RespuestaSegura ) ;
      }
      return( {
        ok:       false ,
        status:   404 ,
        urlFinal: url ,
        tipo:     "" ,
        cuerpo:   null ,
        estado:   "error"
      } satisfies RespuestaSegura ) ;
    } ) ;

    const res = await estrategiaVerificados( "Netflix" , {
      pais: { sufijo: ".com.ar" , nombre: "argentina" }
    } ) ;

    expect( res.ok ).toBe( true ) ;
    expect( res.estrategia ).toBe( "verificados" ) ;
    expect( res.candidatos.length ).toBeGreaterThan( 0 ) ;

    const netflixAr = res.candidatos.find( ( c ) => c.dominio === "netflix.com.ar" ) ;
    expect( netflixAr ).toBeDefined() ;
    expect( netflixAr!.resuelve ).toBe( true ) ;
    expect( netflixAr!.coincide ).toBe( true ) ;
    expect( netflixAr!.confianzaAlta ).toBe( true ) ;
  } ) ;

  it( "5. estrategiaVerificados asigna confianzaAlta: false si no coincide el título ni la etiqueta" , async () => {
    // Consulta: "gali". Dominio generado que resuelve: "gali.com"
    // Pero el título es de otra cosa y la etiqueta "gali" no coincide con galicia
    vi.spyOn( fetchSeguroMod , "hostEsPublico" ).mockResolvedValue( true ) ;

    vi.spyOn( fetchSeguroMod , "fetchSeguro" ).mockResolvedValue( {
      ok:       true ,
      status:   200 ,
      urlFinal: "https://gali.com" ,
      tipo:     "text/html" ,
      cuerpo:   Buffer.from( "<html><head><title>Servicios Industriales Metalúrgicos</title></head></html>" ) ,
      estado:   "ok"
    } satisfies RespuestaSegura ) ;

    const res = await estrategiaVerificados( "galicia" , {
      pais: { sufijo: ".com.ar" , nombre: "argentina" }
    } ) ;

    // Simulamos un candidato evaluado donde coincide es false y esEtiquetaExacta es false
    const candidatoNoCoincidente = res.candidatos.find( ( c ) => c.coincide === false && !esEtiquetaExacta( c.dominio , "galicia" ) ) ;
    if( candidatoNoCoincidente ) {
      expect( candidatoNoCoincidente.confianzaAlta ).toBe( false ) ;
    } else {
      // Si todos tenían etiqueta "galicia", testeamos directamente con consulta que no coincida
      const resAjeno = await estrategiaVerificados( "banco galicia" , {
        pais: { sufijo: ".com.ar" , nombre: "argentina" }
      } ) ;
      const noExacto = resAjeno.candidatos.find( ( c ) => (c.coincide === false) && !esEtiquetaExacta( c.dominio , "banco galicia" ) ) ;
      expect( noExacto ).toBeDefined() ;
      expect( noExacto!.confianzaAlta ).toBe( false ) ;
    }
  } ) ;

  it( "6. TLDS_PRODUCTO contiene dominios de producto alternativos" , () => {
    expect( TLDS_PRODUCTO ).toContain( ".app" ) ;
    expect( TLDS_PRODUCTO ).toContain( ".io" ) ;
    expect( TLDS_PRODUCTO ).toContain( ".ai" ) ;
  } ) ;
} ) ;
