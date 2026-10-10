/**
 * @file brand.route.test.ts
 * Pruebas unitarias para el endpoint GET /api/brand (Route Handler).
 */

// Librerías externas
import { describe , it , expect , vi , beforeEach } from "vitest" ;
import { NextRequest }                             from "next/server" ;
import * as nextAuth                               from "next-auth" ;

// App & Shared
import * as verificadosModulo from "@/shared/services/brand/verificados" ;
import * as resolutorModulo   from "@/shared/services/brand/resolutorIdentidad" ;
import { GET }                from "./route" ;

vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn()
} ) ) ;

describe( "GET /api/brand" , () => {
  beforeEach( () => {
    vi.restoreAllMocks() ;
  } ) ;

  it( "1. sin sesión retorna 401 Unauthorized" , async () => {
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( null ) ;

    const req = new NextRequest( "http://localhost:3000/api/brand?q=netflix" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 401 ) ;
    expect( await res.json() ).toEqual( { error: "Unauthorized" } ) ;
  } ) ;

  it( "2. sin parámetro q ni domain retorna 400" , async () => {
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( {
      user: { id: "usuario_1" }
    } as unknown as nextAuth.Session ) ;

    const req = new NextRequest( "http://localhost:3000/api/brand" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 400 ) ;
    expect( await res.json() ).toEqual( { error: "Missing q or domain query parameter" } ) ;
  } ) ;

  it( "3. con parámetro q ejecuta estrategiaVerificados y retorna lista de marcas con 200 y Cache-Control" , async () => {
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( {
      user: { id: "usuario_1" }
    } as unknown as nextAuth.Session ) ;

    vi.spyOn( verificadosModulo , "estrategiaVerificados" ).mockResolvedValue( {
      estrategia: "verificados" ,
      ok:         true ,
      ms:         120 ,
      estado:     "200" ,
      candidatos: [
        {
          dominio:       "netflix.com" ,
          nombre:        "Netflix" ,
          resuelve:      true ,
          coincide:      true ,
          confianzaAlta: true
        } ,
        {
          dominio:       "invalido.com" ,
          resuelve:      false ,
          coincide:      false ,
          confianzaAlta: false
        }
      ]
    } ) ;

    const req = new NextRequest( "http://localhost:3000/api/brand?q=netflix" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 200 ) ;
    expect( res.headers.get( "cache-control" ) ).toBe( "private, max-age=3600" ) ;

    const body = await res.json() ;
    expect( body ).toEqual( [
      {
        name:          "Netflix" ,
        domain:        "netflix.com" ,
        icon:          "https://www.google.com/s2/favicons?domain=netflix.com&sz=128" ,
        coincide:      true ,
        confianzaAlta: true
      }
    ] ) ;
  } ) ;

  it( "4. con parámetro domain ejecuta resolverIdentidad y retorna objeto compatible con 200" , async () => {
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( {
      user: { id: "usuario_1" }
    } as unknown as nextAuth.Session ) ;

    vi.spyOn( resolutorModulo , "resolverIdentidad" ).mockResolvedValue( {
      dominio:  "netflix.com" ,
      color:    "#e50914" ,
      icono:    {
        origen:  "sitio" ,
        dataUri: "data:image/png;base64,mock" ,
        ancho:   128 ,
        alto:    128
      } ,
      intentos: []
    } ) ;

    const req = new NextRequest( "http://localhost:3000/api/brand?domain=netflix.com" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 200 ) ;
    expect( res.headers.get( "cache-control" ) ).toBe( "private, max-age=3600" ) ;

    const body = await res.json() ;
    expect( body ).toEqual( {
      domain:       "netflix.com" ,
      name:         "netflix.com" ,
      primaryColor: "#e50914" ,
      logoUrl:      "data:image/png;base64,mock"
    } ) ;
  } ) ;

  it( "5. con ?q=nubank&pais=br llama a estrategiaVerificados con el contexto de brasil" , async () => {
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( {
      user: { id: "usuario_1" }
    } as unknown as nextAuth.Session ) ;

    const spy = vi.spyOn( verificadosModulo , "estrategiaVerificados" ).mockResolvedValue( {
      estrategia: "verificados" ,
      ok:         true ,
      ms:         50 ,
      estado:     "200" ,
      candidatos: []
    } ) ;

    const req = new NextRequest( "http://localhost:3000/api/brand?q=nubank&pais=br" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 200 ) ;
    expect( spy ).toHaveBeenCalledWith( "nubank" , {
      pais: { sufijo: ".com.br" , nombre: "brasil" }
    } ) ;
  } ) ;

  it( "6. con ?q=netflix sin país llama a estrategiaVerificados con { pais: null }" , async () => {
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( {
      user: { id: "usuario_1" }
    } as unknown as nextAuth.Session ) ;

    const spy = vi.spyOn( verificadosModulo , "estrategiaVerificados" ).mockResolvedValue( {
      estrategia: "verificados" ,
      ok:         true ,
      ms:         50 ,
      estado:     "200" ,
      candidatos: []
    } ) ;

    const req = new NextRequest( "http://localhost:3000/api/brand?q=netflix" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 200 ) ;
    expect( spy ).toHaveBeenCalledWith( "netflix" , {
      pais: null
    } ) ;
  } ) ;

  it( "7. con ?q=netflix&pais=a.b retorna 400 y no llama a estrategiaVerificados" , async () => {
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( {
      user: { id: "usuario_1" }
    } as unknown as nextAuth.Session ) ;

    const spy = vi.spyOn( verificadosModulo , "estrategiaVerificados" ) ;

    const req = new NextRequest( "http://localhost:3000/api/brand?q=netflix&pais=a.b" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 400 ) ;
    expect( await res.json() ).toEqual( { error: "Invalid pais" } ) ;
    expect( spy ).not.toHaveBeenCalled() ;
  } ) ;
} ) ;

