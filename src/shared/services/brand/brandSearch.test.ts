/**
 * @file brandSearch.test.ts
 * Pruebas unitarias de las funciones puras de búsqueda y utilidades de marcas (Plan 33).
 */

// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach } from "vitest" ;

// Shared
import { buscarMarcas , banderaDeDominio } from "./brandSearch" ;


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

  it( "2. buscarMarcas consulta /api/brand?q=... y propaga pais cuando paisPrioritario está presente" , async () => {
    await buscarMarcas( "banco galicia" ) ;
    expect( fetchMock ).toHaveBeenCalledWith( "/api/brand?q=banco+galicia" ) ;

    fetchMock.mockClear() ;

    await buscarMarcas( "santander" , { paisPrioritario: "ar" } ) ;
    expect( fetchMock ).toHaveBeenCalledWith( "/api/brand?q=santander&pais=ar" ) ;
  } ) ;

  it( "3. buscarMarcas procesa y devuelve los resultados de /api/brand" , async () => {
    fetchMock.mockImplementation( async () => {
      return( {
        ok:   true ,
        json: async () => [
          { name: "Banco Galicia" , domain: "galicia.com.ar" , icon: "https://google.com/s2/favicons?domain=galicia.com.ar" , coincide: true , confianzaAlta: true }
        ]
      } ) ;
    } ) ;

    const res = await buscarMarcas( "galicia" ) ;

    expect( res ).toHaveLength( 1 ) ;
    expect( res[0] ).toEqual( {
      name:          "Banco Galicia" ,
      domain:        "galicia.com.ar" ,
      icon:          "https://google.com/s2/favicons?domain=galicia.com.ar" ,
      coincide:      true ,
      confianzaAlta: true
    } ) ;
  } ) ;

  it( "4. ignora respuesta si json no es arreglo o si el texto es vacío" , async () => {
    fetchMock.mockImplementation( async () => {
      return( {
        ok:   true ,
        json: async () => ( { error: "not an array" } )
      } ) ;
    } ) ;

    const resInvalido = await buscarMarcas( "test" ) ;
    expect( resInvalido ).toEqual( [] ) ;

    const resVacio = await buscarMarcas( "   " ) ;
    expect( resVacio ).toEqual( [] ) ;
  } ) ;

  it( "5. !ok y rechazo de fetch retornan arreglo vacío sin lanzar error" , async () => {
    fetchMock.mockImplementation( async () => {
      return( {
        ok:   false ,
        json: async () => ( { error: "bad request" } )
      } ) ;
    } ) ;

    const resFallo = await buscarMarcas( "errorHttp" ) ;
    expect( resFallo ).toEqual( [] ) ;

    fetchMock.mockImplementation( async () => {
      throw new Error( "network failure" ) ;
    } ) ;

    const resRed = await buscarMarcas( "caidaRed" ) ;
    expect( resRed ).toEqual( [] ) ;
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
