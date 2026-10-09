// @vitest-environment jsdom
/**
 * @file LaboratorioMarcas.test.tsx
 * Pruebas de integración del componente cliente LaboratorioMarcas.
 */

// Librerías externas
import { describe , it , expect , vi , beforeEach , beforeAll } from "vitest" ;
import { render , screen , fireEvent , waitFor }                from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Sandbox
import { LaboratorioMarcas } from "./LaboratorioMarcas" ;

describe( "LaboratorioMarcas" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async() => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.restoreAllMocks() ;
  } ) ;

  it( "al buscar llama /api/sandbox/marcas?fase=dominios&q=galicia y muestra el estado de cada estrategia" , async() => {
    const fetchSpy = vi.fn().mockResolvedValue( {
      ok:     true ,
      status: 200 ,
      json:   async() => ( {
        fase:       "dominios" ,
        q:          "galicia" ,
        resultados: [
          {
            estrategia: "brandfetch-search" ,
            ok:         true ,
            ms:         45 ,
            estado:     "200" ,
            candidatos: [
              { dominio: "galicia.ar" , nombre: "Banco Galicia" }
            ]
          } ,
          {
            estrategia: "wikidata" ,
            ok:         true ,
            ms:         120 ,
            estado:     "200" ,
            candidatos: []
          }
        ]
      } )
    } ) ;
    global.fetch = fetchSpy ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;

    const input = screen.getByPlaceholderText( dict.sandboxPage.brandsQueryPlaceholder ) ;
    fireEvent.change( input , { target: { value: "galicia" } } ) ;

    const btnBuscar = screen.getByText( dict.sandboxPage.brandsSearch ) ;
    fireEvent.click( btnBuscar ) ;

    await waitFor( () => {
      expect( fetchSpy ).toHaveBeenCalledWith( "/api/sandbox/marcas?fase=dominios&q=galicia" ) ;
    } ) ;

    expect( await screen.findByText( "brandfetch-search" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "200 · 45 ms" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "galicia.ar" ) ).toBeInTheDocument() ;
  } ) ;

  it( "una respuesta 404 disabled muestra el mensaje brandsDisabled" , async() => {
    global.fetch = vi.fn().mockResolvedValue( {
      ok:     false ,
      status: 404 ,
      json:   async() => ( { error: "disabled" } )
    } ) ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;

    const input = screen.getByPlaceholderText( dict.sandboxPage.brandsQueryPlaceholder ) ;
    fireEvent.change( input , { target: { value: "galicia" } } ) ;

    const btnBuscar = screen.getByText( dict.sandboxPage.brandsSearch ) ;
    fireEvent.click( btnBuscar ) ;

    expect( await screen.findByText( dict.sandboxPage.brandsDisabled ) ).toBeInTheDocument() ;
  } ) ;

  it( "el botón 'Probar íconos' llama la fase 2 con el dominio" , async() => {
    const fetchSpy = vi.fn().mockImplementation( async( url: string ) => {
      if( url.includes( "fase=dominios" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            fase:       "dominios" ,
            q:          "galicia" ,
            resultados: [
              {
                estrategia: "brandfetch-search" ,
                ok:         true ,
                ms:         40 ,
                estado:     "200" ,
                candidatos: [
                  { dominio: "galicia.ar" , nombre: "Galicia" }
                ]
              }
            ]
          } )
        } ) ;
      }

      if( url.includes( "fase=iconos" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            fase:       "iconos" ,
            dominio:    "galicia.ar" ,
            resultados: [
              {
                estrategia: "sitio" ,
                modo:       "servidor" ,
                ok:         true ,
                ms:         150 ,
                estado:     "200" ,
                url:        "https://galicia.ar/favicon.png"
              }
            ]
          } )
        } ) ;
      }

      return( { ok: false , status: 500 } ) ;
    } ) ;
    global.fetch = fetchSpy ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;

    const input = screen.getByPlaceholderText( dict.sandboxPage.brandsQueryPlaceholder ) ;
    fireEvent.change( input , { target: { value: "galicia" } } ) ;
    fireEvent.click( screen.getByText( dict.sandboxPage.brandsSearch ) ) ;

    // Esperar a que el candidato aparezca en el DOM
    expect( await screen.findByText( "galicia.ar" ) ).toBeInTheDocument() ;

    const btnsProbar = screen.getAllByText( dict.sandboxPage.brandsTryIcons ) ;
    const btnCandidato = btnsProbar[btnsProbar.length - 1] ;
    fireEvent.click( btnCandidato ) ;

    await waitFor( () => {
      expect( fetchSpy ).toHaveBeenCalledWith(
        expect.stringContaining( "/api/sandbox/marcas?fase=iconos&dominio=galicia.ar" )
      ) ;
    } ) ;

    const imgSitio = await screen.findByAltText( "sitio" ) ;
    expect( imgSitio ).toHaveAttribute( "src" , "https://galicia.ar/favicon.png" ) ;
  } ) ;

  it( "la insignia 'chico' aparece con naturalWidth 48 y no con 192" , async() => {
    global.fetch = vi.fn().mockResolvedValue( {
      ok:     true ,
      status: 200 ,
      json:   async() => ( {
        fase:       "iconos" ,
        dominio:    "galicia.ar" ,
        resultados: [
          {
            estrategia: "google-s2" ,
            modo:       "servidor" ,
            ok:         true ,
            ms:         80 ,
            estado:     "200" ,
            url:        "https://google.com/favicon.png"
          }
        ]
      } )
    } ) ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;

    const inputManual = screen.getByPlaceholderText( "ej: bbva.com" ) ;
    fireEvent.change( inputManual , { target: { value: "galicia.ar" } } ) ;

    const btnsProbar = screen.getAllByText( dict.sandboxPage.brandsTryIcons ) ;
    fireEvent.click( btnsProbar[0] ) ;

    const img = ( await screen.findByAltText( "google-s2" ) ) as HTMLImageElement ;

    // Simular carga con 48x48 (menor a 64 -> debe aparecer insignia chico)
    Object.defineProperty( img , "naturalWidth" , { value: 48 , configurable: true } ) ;
    Object.defineProperty( img , "naturalHeight" , { value: 48 , configurable: true } ) ;
    fireEvent.load( img ) ;

    expect( await screen.findByText( dict.sandboxPage.brandsSmall ) ).toBeInTheDocument() ;

    // Simular carga con 192x192 (mayor a 64 -> no debe aparecer insignia chico)
    Object.defineProperty( img , "naturalWidth" , { value: 192 , configurable: true } ) ;
    Object.defineProperty( img , "naturalHeight" , { value: 192 , configurable: true } ) ;
    fireEvent.load( img ) ;

    expect( screen.queryByText( dict.sandboxPage.brandsSmall ) ).not.toBeInTheDocument() ;
  } ) ;
} ) ;
