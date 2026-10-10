/**
 * @file paisBusqueda.test.ts
 * Pruebas unitarias para la resolución de contexto de país y sufijos de dominio comercial (Plan 41b).
 */

// Librerías externas
import { describe , it , expect } from "vitest" ;

// Shared: Brand
import { contextoPaisDeBusqueda } from "./paisBusqueda" ;

describe( "paisBusqueda — contexto de país para búsqueda de marcas" , () => {
  it( "1. \"ar\" y \"AR\" retornan sufijo .com.ar y nombre argentina" , () => {
    expect( contextoPaisDeBusqueda( "ar" ) ).toEqual( {
      sufijo: ".com.ar" ,
      nombre: "argentina"
    } ) ;

    expect( contextoPaisDeBusqueda( "AR" ) ).toEqual( {
      sufijo: ".com.ar" ,
      nombre: "argentina"
    } ) ;
  } ) ;

  it( "2. resuelve correctamente códigos comerciales de br, uy, cl y us" , () => {
    expect( contextoPaisDeBusqueda( "br" ) ).toEqual( {
      sufijo: ".com.br" ,
      nombre: "brasil"
    } ) ;

    expect( contextoPaisDeBusqueda( "uy" ) ).toEqual( {
      sufijo: ".com.uy" ,
      nombre: "uruguay"
    } ) ;

    expect( contextoPaisDeBusqueda( "cl" ) ).toEqual( {
      sufijo: ".cl" ,
      nombre: "chile"
    } ) ;

    expect( contextoPaisDeBusqueda( "us" ) ).toEqual( {
      sufijo: ".com" ,
      nombre: "estados unidos"
    } ) ;
  } ) ;

  it( "3. entradas vacías, nulas, indefinidas o con sólo espacios retornan null" , () => {
    expect( contextoPaisDeBusqueda( "" ) ).toBeNull() ;
    expect( contextoPaisDeBusqueda( null ) ).toBeNull() ;
    expect( contextoPaisDeBusqueda( undefined ) ).toBeNull() ;
    expect( contextoPaisDeBusqueda( "  " ) ).toBeNull() ;
  } ) ;

  it( "4. código inexistente \"zz\" retorna null" , () => {
    expect( contextoPaisDeBusqueda( "zz" ) ).toBeNull() ;
  } ) ;
} ) ;
