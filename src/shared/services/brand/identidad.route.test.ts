/**
 * @file identidad.route.test.ts
 * Pruebas unitarias para el endpoint GET /api/brand/identidad (Route Handler).
 */

// Librerías externas
import { describe , it , expect , vi , beforeEach } from "vitest" ;
import { NextRequest }                             from "next/server" ;
import * as nextAuth                               from "next-auth" ;

// App & Shared
import * as resolutorModulo from "./resolutorIdentidad" ;
import { GET }              from "@/app/api/brand/identidad/route" ;

vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn()
} ) ) ;

describe( "GET /api/brand/identidad" , () => {
  beforeEach( () => {
    vi.restoreAllMocks() ;
  } ) ;

  it( "15. sin sesión -> 401 y resolverIdentidad no se llamó" , async () => {
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( null ) ;
    const resolverSpy = vi.spyOn( resolutorModulo , "resolverIdentidad" ) ;

    const reqSinParam = new NextRequest( "http://localhost:3000/api/brand/identidad" ) ;
    const resSinParam = await GET( reqSinParam ) ;
    expect( resSinParam.status ).toBe( 401 ) ;
    expect( await resSinParam.json() ).toEqual( { error: "Unauthorized" } ) ;

    const req = new NextRequest( "http://localhost:3000/api/brand/identidad?domain=ejemplo.com" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 401 ) ;
    const body = await res.json() ;
    expect( body ).toEqual( { error: "Unauthorized" } ) ;
    expect( resolverSpy ).not.toHaveBeenCalled() ;
  } ) ;

  it( "16. sin domain -> 400; dominio inválido -> 400" , async () => {
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( {
      user: { id: "usuario_1" }
    } as unknown as nextAuth.Session ) ;

    // Sin parámetro domain
    const reqSinDomain = new NextRequest( "http://localhost:3000/api/brand/identidad" ) ;
    const resSinDomain = await GET( reqSinDomain ) ;
    expect( resSinDomain.status ).toBe( 400 ) ;
    expect( await resSinDomain.json() ).toEqual( { error: "Missing domain query parameter" } ) ;

    // Dominio inválido (sintácticamente erróneo)
    const reqInvalido = new NextRequest( "http://localhost:3000/api/brand/identidad?domain=a..b" ) ;
    const resInvalido = await GET( reqInvalido ) ;
    expect( resInvalido.status ).toBe( 400 ) ;
    expect( await resInvalido.json() ).toEqual( { error: "Invalid domain" } ) ;
  } ) ;

  it( "17. con sesión y resultado -> 200 con el cuerpo y Cache-Control: private, max-age=86400" , async () => {
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( {
      user: { id: "usuario_1" }
    } as unknown as nextAuth.Session ) ;

    const identidadMock: resolutorModulo.IdentidadMarca = {
      dominio:  "galicia.ar" ,
      icono:    { origen: "sitio" , dataUri: "data:image/png;base64,abc" , ancho: 128 , alto: 128 } ,
      color:    "#ff6600" ,
      intentos: [ { fuente: "sitio" , ok: true } ]
    } ;

    vi.spyOn( resolutorModulo , "resolverIdentidad" ).mockResolvedValue( identidadMock ) ;

    const req = new NextRequest( "http://localhost:3000/api/brand/identidad?domain=galicia.ar" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 200 ) ;
    expect( await res.json() ).toEqual( identidadMock ) ;
    expect( res.headers.get( "cache-control" ) ).toBe( "private, max-age=86400" ) ;
  } ) ;

  it( "18. resolverIdentidad lanza -> 500 sin filtrar el mensaje del error" , async () => {
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( {
      user: { id: "usuario_1" }
    } as unknown as nextAuth.Session ) ;

    vi.spyOn( resolutorModulo , "resolverIdentidad" ).mockRejectedValue(
      new Error( "Detalle técnico interno altamente confidencial" )
    ) ;

    const req = new NextRequest( "http://localhost:3000/api/brand/identidad?domain=galicia.ar" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 500 ) ;
    const body = await res.json() ;
    expect( body ).toEqual( { error: "Internal error" } ) ;
    expect( JSON.stringify( body ) ).not.toContain( "altamente confidencial" ) ;
  } ) ;
} ) ;
