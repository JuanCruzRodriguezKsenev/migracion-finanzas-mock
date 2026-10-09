/**
 * @file route.test.ts
 * Pruebas unitarias para el endpoint de API /api/sandbox/marcas.
 */

// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach } from "vitest" ;
import { NextRequest }                                          from "next/server" ;
import * as nextAuth                                            from "next-auth" ;

// App API
import { GET } from "@/app/api/sandbox/marcas/route" ;

// Feature: Sandbox
import * as estrategiasDominio from "@/features/sandbox/services/marcas/estrategiasDominio" ;
import * as estrategiasIcono   from "@/features/sandbox/services/marcas/estrategiasIcono" ;

vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn()
} ) ) ;

describe( "GET /api/sandbox/marcas" , () => {
  const envOriginal = process.env ;

  const setNodeEnv = ( valor: string ) => {
    ( process.env as Record< string , string | undefined > ).NODE_ENV = valor ;
  } ;

  beforeEach( () => {
    vi.clearAllMocks() ;
    process.env = { ...envOriginal } ;
  } ) ;

  afterEach( () => {
    process.env = envOriginal ;
  } ) ;

  it( "en producción sin SANDBOX_MARCAS=1 responde 404 sin consultar la sesión" , async() => {
    setNodeEnv( "production" ) ;
    delete process.env.SANDBOX_MARCAS ;

    const getServerSessionSpy = vi.spyOn( nextAuth , "getServerSession" ) ;
    const req = new NextRequest( "http://localhost:3000/api/sandbox/marcas?fase=dominios&q=galicia" ) ;

    const res = await GET( req ) ;
    expect( res.status ).toBe( 404 ) ;

    const body = await res.json() ;
    expect( body ).toEqual( { error: "disabled" } ) ;
    expect( getServerSessionSpy ).not.toHaveBeenCalled() ;
  } ) ;

  it( "sin sesión activa responde 401 Unauthorized" , async() => {
    setNodeEnv( "test" ) ;
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( null ) ;

    const req = new NextRequest( "http://localhost:3000/api/sandbox/marcas?fase=dominios&q=galicia" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 401 ) ;
    const body = await res.json() ;
    expect( body ).toEqual( { error: "Unauthorized" } ) ;
  } ) ;

  it( "con fase=dominios y q de 1 carácter responde 400 { error: 'q' }" , async() => {
    setNodeEnv( "test" ) ;
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( {
      user: { id: "user-123" }
    } as unknown as nextAuth.Session ) ;

    const req = new NextRequest( "http://localhost:3000/api/sandbox/marcas?fase=dominios&q=g" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 400 ) ;
    const body = await res.json() ;
    expect( body ).toEqual( { error: "q" } ) ;
  } ) ;

  it( "con fase=iconos y dominio=localhost responde 400 { error: 'dominio' }" , async() => {
    setNodeEnv( "test" ) ;
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( {
      user: { id: "user-123" }
    } as unknown as nextAuth.Session ) ;

    const req = new NextRequest( "http://localhost:3000/api/sandbox/marcas?fase=iconos&dominio=localhost" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 400 ) ;
    const body = await res.json() ;
    expect( body ).toEqual( { error: "dominio" } ) ;
  } ) ;

  it( "con fase desconocida responde 400 { error: 'fase' }" , async() => {
    setNodeEnv( "test" ) ;
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( {
      user: { id: "user-123" }
    } as unknown as nextAuth.Session ) ;

    const req = new NextRequest( "http://localhost:3000/api/sandbox/marcas?fase=zzz" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 400 ) ;
    const body = await res.json() ;
    expect( body ).toEqual( { error: "fase" } ) ;
  } ) ;

  it( "camino feliz de dominios con estrategias mockeadas retorna estructura esperada" , async() => {
    setNodeEnv( "test" ) ;
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( {
      user: { id: "user-123" }
    } as unknown as nextAuth.Session ) ;

    vi.spyOn( estrategiasDominio , "estrategiaBrandfetchSearch" ).mockResolvedValue( {
      estrategia: "brandfetch-search" ,
      ok:         true ,
      ms:         120 ,
      estado:     "200" ,
      candidatos: [{ dominio: "galicia.ar" }]
    } ) ;
    vi.spyOn( estrategiasDominio , "estrategiaWikidata" ).mockResolvedValue( {
      estrategia: "wikidata" ,
      ok:         true ,
      ms:         150 ,
      estado:     "200" ,
      candidatos: [{ dominio: "galicia.ar" }]
    } ) ;
    vi.spyOn( estrategiasDominio , "estrategiaDuckDuckGo" ).mockResolvedValue( {
      estrategia: "duckduckgo" ,
      ok:         true ,
      ms:         200 ,
      estado:     "200" ,
      candidatos: [{ dominio: "galicia.ar" }]
    } ) ;
    vi.spyOn( estrategiasDominio , "estrategiaCandidatos" ).mockResolvedValue( {
      estrategia: "candidatos" ,
      ok:         true ,
      ms:         10 ,
      estado:     "200" ,
      candidatos: [{ dominio: "galicia.ar" , resuelve: true }]
    } ) ;

    const req = new NextRequest( "http://localhost:3000/api/sandbox/marcas?fase=dominios&q=galicia" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 200 ) ;
    const body = await res.json() ;
    expect( body.fase ).toBe( "dominios" ) ;
    expect( body.q ).toBe( "galicia" ) ;
    expect( body.resultados ).toHaveLength( 4 ) ;
  } ) ;

  it( "camino feliz de iconos con estrategias mockeadas retorna estructura esperada" , async() => {
    setNodeEnv( "test" ) ;
    vi.spyOn( nextAuth , "getServerSession" ).mockResolvedValue( {
      user: { id: "user-123" }
    } as unknown as nextAuth.Session ) ;

    vi.spyOn( estrategiasIcono , "ejecutarEstrategiasIcono" ).mockResolvedValue( [
      {
        estrategia: "sitio" ,
        modo:       "servidor" ,
        ok:         true ,
        ms:         300 ,
        estado:     "200" ,
        url:        "https://galicia.ar/logo.png"
      }
    ] ) ;

    const req = new NextRequest( "http://localhost:3000/api/sandbox/marcas?fase=iconos&dominio=galicia.ar" ) ;
    const res = await GET( req ) ;

    expect( res.status ).toBe( 200 ) ;
    const body = await res.json() ;
    expect( body.fase ).toBe( "iconos" ) ;
    expect( body.dominio ).toBe( "galicia.ar" ) ;
    expect( body.resultados ).toHaveLength( 1 ) ;
    expect( body.resultados[0].estrategia ).toBe( "sitio" ) ;
  } ) ;
} ) ;
