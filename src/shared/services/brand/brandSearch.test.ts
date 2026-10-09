/**
 * @file brandSearch.test.ts
 * Pruebas unitarias de las funciones puras de búsqueda y utilidades de marcas (Plan 33).
 */

// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach } from "vitest" ;

// Shared
import { construirConsultas , buscarMarcas , banderaDeDominio } from "./brandSearch" ;


describe( "brandSearch — búsqueda y utilidades de marcas" , () => {
  let fetchMock: ReturnType< typeof vi.fn > ;

  beforeEach( () => {
    fetchMock = vi.fn().mockImplementation( async () => {
      return( {
        ok:   true ,
        json: async () => []
      } ) ;
    } ) ;
    vi.stubGlobal( "fetch" , fetchMock ) ;
  } ) ;

  afterEach( () => {
    vi.unstubAllGlobals() ;
    vi.unstubAllEnvs() ;
    vi.clearAllMocks() ;
  } ) ;

  it( "1. construirConsultas: con punto retorna una sola; sin punto genera variantes ordenadas; recorta texto" , () => {
    expect( construirConsultas( "  galicia.com.ar  " , [ ".com" , ".com.ar" , ".ar" ] ) ).toEqual( [
      "galicia.com.ar"
    ] ) ;

    expect( construirConsultas( "  galicia  " , [ ".com" , ".com.ar" , ".ar" ] ) ).toEqual( [
      "galicia" ,
      "galicia.com" ,
      "galicia.com.ar" ,
      "galicia.ar"
    ] ) ;

    expect( construirConsultas( "galicia" ) ).toEqual( [ "galicia" ] ) ;
  } ) ;

  it( "2. buscarMarcas consulta con URL esperada y lee NEXT_PUBLIC_BRANDFETCH_CLIENT_ID al consultar" , async () => {
    await buscarMarcas( "banco galicia" ) ;
    expect( fetchMock ).toHaveBeenCalledWith( "https://api.brandfetch.io/v2/search/banco%20galicia?c=brandfetch" ) ;

    fetchMock.mockClear() ;
    vi.stubEnv( "NEXT_PUBLIC_BRANDFETCH_CLIENT_ID" , "abc" ) ;

    await buscarMarcas( "santander" ) ;
    expect( fetchMock ).toHaveBeenCalledWith( "https://api.brandfetch.io/v2/search/santander?c=abc" ) ;
  } ) ;

  it( "3. une sin repetir dominio ignorando mayúsculas conservando la primera grafía" , async () => {
    fetchMock.mockImplementation( async ( input: RequestInfo | URL ) => {
      const url = String( input ) ;
      if( url.includes( "search/galicia%3F" ) || url.includes( "search/galicia?" ) ) {
        return( {
          ok:   true ,
          json: async () => [
            { name: "Banco Galicia" , domain: "Galicia.com.ar" , icon: "https://cdn.example.com/g1.png" }
          ]
        } ) ;
      }
      return( {
        ok:   true ,
        json: async () => [
          { name: "galicia ar" , domain: "galicia.com.ar" , icon: "https://cdn.example.com/g2.png" }
        ]
      } ) ;
    } ) ;

    const res = await buscarMarcas( "galicia" , { sufijos: [ ".com.ar" ] } ) ;

    expect( res ).toHaveLength( 1 ) ;
    expect( res[0] ).toEqual( {
      name:   "Banco Galicia" ,
      domain: "Galicia.com.ar" ,
      icon:   "https://cdn.example.com/g1.png"
    } ) ;
  } ) ;

  it( "4. name cae al dominio si falta; descarta ítems sin domain; ignora respuesta que no es arreglo" , async () => {
    fetchMock.mockImplementation( async ( input: RequestInfo | URL ) => {
      const url = String( input ) ;
      if( url.includes( "search/test?" ) ) {
        return( {
          ok:   true ,
          json: async () => [
            { domain: "solo-dominio.com" } ,
            { name: "Sin Dominio" } ,
            null ,
            "invalido"
          ]
        } ) ;
      }
      return( {
        ok:   true ,
        json: async () => ( { error: "not an array" } )
      } ) ;
    } ) ;

    const res = await buscarMarcas( "test" , { sufijos: [ ".com" ] } ) ;

    expect( res ).toEqual( [
      {
        name:   "solo-dominio.com" ,
        domain: "solo-dominio.com"
      }
    ] ) ;
  } ) ;

  it( "5. !ok y rechazo de fetch retornan arreglo vacío sin lanzar y las otras variantes siguen aportando" , async () => {
    fetchMock.mockImplementation( async ( input: RequestInfo | URL ) => {
      const url = String( input ) ;
      if( url.includes( "search/variante1?" ) ) {
        return( {
          ok:   false ,
          json: async () => ( { error: "bad request" } )
        } ) ;
      }
      if( url.includes( "search/variante2?" ) ) {
        throw new Error( "network failure" ) ;
      }
      return( {
        ok:   true ,
        json: async () => [
          { name: "Variante 3" , domain: "v3.com" }
        ]
      } ) ;
    } ) ;

    const res = await buscarMarcas( "variante1" , { sufijos: [ "variante2" , "variante3" ] } ) ;

    expect( res ).toEqual( [
      {
        name:   "Variante 3" ,
        domain: "v3.com"
      }
    ] ) ;
  } ) ;

  it( "6. paisPrioritario: ar prioriza dominios .ar y .ar. manteniendo orden estable; sin país preserva orden de llegada" , async () => {
    const lista = [
      { name: "Global"   , domain: "banco.com" } ,
      { name: "España"   , domain: "banco.es" } ,
      { name: "Arg TLD"  , domain: "banco.ar" } ,
      { name: "Arg Sub"  , domain: "banco.com.ar" } ,
      { name: "Arg Rama" , domain: "banco.ar.corp" } ,
      { name: "Chile"    , domain: "banco.cl" }
    ] ;

    fetchMock.mockImplementation( async () => ( {
      ok:   true ,
      json: async () => lista
    } ) ) ;

    const ordenPriorizado = await buscarMarcas( "banco.com" , { paisPrioritario: "ar" } ) ;
    expect( ordenPriorizado.map( ( m ) => m.domain ) ).toEqual( [
      "banco.ar" ,
      "banco.com.ar" ,
      "banco.ar.corp" ,
      "banco.com" ,
      "banco.es" ,
      "banco.cl"
    ] ) ;

    const ordenSinPais = await buscarMarcas( "banco.com" , { paisPrioritario: "" } ) ;
    expect( ordenSinPais.map( ( m ) => m.domain ) ).toEqual( [
      "banco.com" ,
      "banco.es" ,
      "banco.ar" ,
      "banco.com.ar" ,
      "banco.ar.corp" ,
      "banco.cl"
    ] ) ;

    const ordenPorDefecto = await buscarMarcas( "banco.com" ) ;
    expect( ordenPorDefecto.map( ( m ) => m.domain ) ).toEqual( [
      "banco.com" ,
      "banco.es" ,
      "banco.ar" ,
      "banco.com.ar" ,
      "banco.ar.corp" ,
      "banco.cl"
    ] ) ;
  } ) ;

  it( "7. limite: 5 corta en 5 y sin limite no corta" , async () => {
    const listaOcho = Array.from( { length: 8 } , ( _ , i ) => ( {
      name:   `Marca ${i}` ,
      domain: `marca${i}.com`
    } ) ) ;

    fetchMock.mockImplementation( async () => ( {
      ok:   true ,
      json: async () => listaOcho
    } ) ) ;

    const conLimite = await buscarMarcas( "marca.com" , { limite: 5 } ) ;
    expect( conLimite ).toHaveLength( 5 ) ;

    const sinLimite = await buscarMarcas( "marca.com" ) ;
    expect( sinLimite ).toHaveLength( 8 ) ;
  } ) ;

  it( "8. banderaDeDominio resuelve banderas emoji por ccTLD de 2 letras y 🌐 para el resto" , () => {
    expect( banderaDeDominio( "galicia.com.ar" ) ).toBe( "🇦🇷" ) ;
    expect( banderaDeDominio( "netflix.com" ) ).toBe( "🌐" ) ;
    expect( banderaDeDominio( "x.io" ) ).toBe( "🇮🇴" ) ;
    expect( banderaDeDominio( "ar" ) ).toBe( "🇦🇷" ) ;
  } ) ;
} ) ;
