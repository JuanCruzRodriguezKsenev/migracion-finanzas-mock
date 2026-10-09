/**
 * @file bateriaVista.test.ts
 * Pruebas unitarias para las funciones auxiliares de vista de las baterías del laboratorio.
 */

// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Sandbox
import {
  columnaDeOrigen ,
  posicionEsperado ,
  primerCandidato ,
  veredictoFuente ,
  resumenNombres ,
  dominioBase
} from "./bateriaVista" ;
import type {
  FilaBateriaNombres ,
  IdentidadMarcaLab
} from "./bateriaVista" ;

describe( "bateriaVista" , () => {
  it( "1. dominioBase normaliza protocolo, www, mayúsculas y rutas" , () => {
    expect( dominioBase( "https://www.Galicia.ar/" ) ).toBe( "galicia.ar" ) ;
    expect( dominioBase( "http://WWW.MercadoPago.com.ar/personas" ) ).toBe( "mercadopago.com.ar" ) ;
    expect( dominioBase( "bbva.com" ) ).toBe( "bbva.com" ) ;
    expect( dominioBase( "" ) ).toBe( "" ) ;
  } ) ;

  it( "2. posicionEsperado encuentra índice, tolera www y mayúsculas, y retorna -1 si ninguno coincide" , () => {
    const esperados = [ "galicia.ar" , "bancogalicia.com" ] ;

    const candidatos1 = [
      { dominio: "otra-cosa.com" } ,
      { dominio: "https://www.Galicia.ar/" } ,
      { dominio: "galicia.com" }
    ] ;
    expect( posicionEsperado( candidatos1 , esperados ) ).toBe( 1 ) ;

    const candidatos2 = [
      { dominio: "xunta.gal" } ,
      { dominio: "otra.com" }
    ] ;
    expect( posicionEsperado( candidatos2 , esperados ) ).toBe( -1 ) ;
  } ) ;

  it( "3. primerCandidato retorna el primero para wikidata/verificados y el primero con resuelve:true para candidatos" , () => {
    const listaCandidatos = [
      { dominio: "cand1.com" , resuelve: false } ,
      { dominio: "cand2.com" , resuelve: true } ,
      { dominio: "cand3.com" , resuelve: true }
    ] ;

    expect( primerCandidato( "candidatos" , listaCandidatos ) ).toBe( "cand2.com" ) ;
    expect( primerCandidato( "wikidata" , listaCandidatos ) ).toBe( "cand1.com" ) ;
    expect( primerCandidato( "verificados" , listaCandidatos ) ).toBe( "cand1.com" ) ;

    const todosSinResolver = [
      { dominio: "cand1.com" , resuelve: false }
    ] ;
    expect( primerCandidato( "candidatos" , todosSinResolver ) ).toBeNull() ;
    expect( primerCandidato( "candidatos" , [] ) ).toBeNull() ;
  } ) ;

  it( "4. columnaDeOrigen mapea sitio y google-s2 y retorna null para cualquier otro" , () => {
    expect( columnaDeOrigen( "sitio" ) ).toBe( "sitio" ) ;
    expect( columnaDeOrigen( "google-s2" ) ).toBe( "google-s2" ) ;
    expect( columnaDeOrigen( "otro" ) ).toBeNull() ;
    expect( columnaDeOrigen( null ) ).toBeNull() ;
    expect( columnaDeOrigen( undefined ) ).toBeNull() ;
  } ) ;

  it( "5. veredictoFuente maneja cascada, fallo, respaldo chico y sin-resolutor" , () => {
    // Caso A: Google S2 usado tras fallo de sitio 404
    const idGoogleS2: IdentidadMarcaLab = {
      dominio:  "ejemplo.com" ,
      icono:    { origen: "google-s2" , url: "https://s2.test/icon.png" } ,
      color:    "#112233" ,
      intentos: [
        { fuente: "sitio" , ok: false , motivo: "http 404" } ,
        { fuente: "google-s2" , ok: true }
      ]
    } ;

    expect( veredictoFuente( "sitio" , idGoogleS2 ) ).toEqual( {
      tipo:   "fallo" ,
      motivo: "http 404"
    } ) ;
    expect( veredictoFuente( "google-s2" , idGoogleS2 ) ).toEqual( {
      tipo:     "usada" ,
      respaldo: false
    } ) ;

    // Caso B: Sitio usado como respaldo chico
    const idSitioRespaldo: IdentidadMarcaLab = {
      dominio:  "ejemplo.com" ,
      icono:    { origen: "sitio" , dataUri: "data:..." } ,
      color:    "#ff5500" ,
      intentos: [
        { fuente: "sitio" , ok: false , motivo: "menor a 64 px" } ,
        { fuente: "google-s2" , ok: false , motivo: "http 500" }
      ]
    } ;

    expect( veredictoFuente( "sitio" , idSitioRespaldo ) ).toEqual( {
      tipo:     "usada" ,
      respaldo: true
    } ) ;

    // Caso C: sin identidad
    expect( veredictoFuente( "sitio" , null ) ).toEqual( {
      tipo: "sin-resolutor"
    } ) ;
  } ) ;

  it( "6. resumenNombres cuenta enPrimero, enTop3 y ningunaAcierta correctamente" , () => {
    const filasMock: FilaBateriaNombres[] = [
      {
        consulta:    "bbva" ,
        esperados:   [ "bbva.com" ] ,
        estrategias: [
          {
            estrategia: "wikidata" ,
            ok:         true ,
            estado:     "200" ,
            ms:         50 ,
            candidatos: [{ dominio: "bbva.com" }] ,
            primero:    {
              dominio:          "bbva.com" ,
              esperado:         true ,
              posicionEsperado: 0 ,
              identidad:        { dominio: "bbva.com" , icono: { origen: "sitio" } , color: "#004488" , intentos: [] }
            }
          } ,
          {
            estrategia: "candidatos" ,
            ok:         true ,
            estado:     "200" ,
            ms:         20 ,
            candidatos: [{ dominio: "bbva.com" , resuelve: true }] ,
            primero:    {
              dominio:          "bbva.com" ,
              esperado:         true ,
              posicionEsperado: 0 ,
              identidad:        { dominio: "bbva.com" , icono: { origen: "sitio" } , color: "#004488" , intentos: [] }
            }
          }
        ]
      } ,
      {
        consulta:    "galicia" ,
        esperados:   [ "galicia.ar" ] ,
        estrategias: [
          {
            estrategia: "wikidata" ,
            ok:         true ,
            estado:     "200" ,
            ms:         100 ,
            candidatos: [{ dominio: "xunta.gal" }] ,
            primero:    {
              dominio:          "xunta.gal" ,
              esperado:         false ,
              posicionEsperado: -1 ,
              identidad:        null
            }
          } ,
          {
            estrategia: "candidatos" ,
            ok:         true ,
            estado:     "200" ,
            ms:         30 ,
            candidatos: [
              { dominio: "otra.com" , resuelve: true } ,
              { dominio: "galicia.ar" , resuelve: true }
            ] ,
            primero:    {
              dominio:          "otra.com" ,
              esperado:         false ,
              posicionEsperado: 1 ,
              identidad:        null
            }
          }
        ]
      } ,
      {
        consulta:    "consulta-fallida" ,
        esperados:   [ "esperado.com" ] ,
        estrategias: [
          {
            estrategia: "wikidata" ,
            ok:         true ,
            estado:     "200" ,
            ms:         40 ,
            candidatos: [] ,
            primero:    {
              dominio:          null ,
              esperado:         false ,
              posicionEsperado: -1 ,
              identidad:        null
            }
          } ,
          {
            estrategia: "candidatos" ,
            ok:         true ,
            estado:     "200" ,
            ms:         20 ,
            candidatos: [] ,
            primero:    {
              dominio:          null ,
              esperado:         false ,
              posicionEsperado: -1 ,
              identidad:        null
            }
          }
        ]
      }
    ] ;

    const res = resumenNombres( filasMock ) ;
    expect( res.total ).toBe( 3 ) ;

    // wikidata: consulta 1 enPrimero (1), top3 (1), icono (1), color (1)
    expect( res.estrategias["wikidata"].enPrimero ).toBe( 1 ) ;
    expect( res.estrategias["wikidata"].enTop3 ).toBe( 1 ) ;
    expect( res.estrategias["wikidata"].conIcono ).toBe( 1 ) ;
    expect( res.estrategias["wikidata"].conColor ).toBe( 1 ) ;

    // candidatos: consulta 1 enPrimero (pos 0), consulta 2 enTop3 (pos 1) -> enPrimero: 1, enTop3: 2
    expect( res.estrategias["candidatos"].enPrimero ).toBe( 1 ) ;
    expect( res.estrategias["candidatos"].enTop3 ).toBe( 2 ) ;

    // consulta-fallida no acierta en ninguna -> ningunaAcierta: 1, alMenosUna: 2
    expect( res.ningunaAcierta ).toBe( 1 ) ;
    expect( res.alMenosUna ).toBe( 2 ) ;
  } ) ;

  it( "7. posicionEsperado ignora los candidatos con resuelve === false, y los sin resuelve (wikidata) siguen contando" , () => {
    const esperados = [ "edesur.com.ar" ] ;

    // Caso A: candidato esperado tiene resuelve: false -> retorna -1 (sin esperado)
    const listaConFallo = [
      { dominio: "edesur.com" ,    resuelve: true } ,
      { dominio: "edesur.com.ar" , resuelve: false }
    ] ;
    expect( posicionEsperado( listaConFallo , esperados ) ).toBe( -1 ) ;

    // Caso B: candidato esperado tiene resuelve: undefined (como wikidata/duckduckgo) -> cuenta normalmente
    const listaWikidata = [
      { dominio: "otra.com" } ,
      { dominio: "edesur.com.ar" }
    ] ;
    expect( posicionEsperado( listaWikidata , esperados ) ).toBe( 1 ) ;

    // Caso C: candidato no resuelto previo no penaliza el índice del siguiente válido que coincide
    const listaConPrevioInvalido = [
      { dominio: "invalido.com" ,  resuelve: false } ,
      { dominio: "edesur.com.ar" , resuelve: true }
    ] ;
    expect( posicionEsperado( listaConPrevioInvalido , esperados ) ).toBe( 0 ) ;
  } ) ;
} ) ;
