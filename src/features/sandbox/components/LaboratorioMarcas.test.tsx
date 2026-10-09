// @vitest-environment jsdom
/**
 * @file LaboratorioMarcas.test.tsx
 * Pruebas de integración del componente cliente LaboratorioMarcas.
 */

// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach , beforeAll } from "vitest" ;
import { render , screen , fireEvent , waitFor , act }                      from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Sandbox
import { LaboratorioMarcas } from "./LaboratorioMarcas" ;
import styles                from "./LaboratorioMarcas.module.css" ;

vi.mock( "./bateria" , () => ( {
  BATERIA: [
    { nombre: "Banco Galicia" , dominio: "galicia.ar" } ,
    { nombre: "BBVA" ,          dominio: "bbva.com" } ,
    { nombre: "Santander" ,     dominio: "santander.com" }
  ]
} ) ) ;

describe( "LaboratorioMarcas" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async() => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.restoreAllMocks() ;
  } ) ;

  afterEach( () => {
    vi.useRealTimers() ;
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

  it( "la batería llama a fase=iconos con dominio fijo y a /api/brand/identidad por cada marca sin llamar a fase=dominios" , async() => {
    vi.useFakeTimers() ;

    const fetchSpy = vi.fn().mockImplementation( async( url: string ) => {
      if( url.includes( "fase=iconos" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            resultados: [
              { estrategia: "sitio" , ok: true , ms: 20 , estado: "200" , url: "https://ejemplo.com/icon.png" }
            ]
          } )
        } ) ;
      }
      if( url.includes( "/api/brand/identidad" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            dominio:  "galicia.ar" ,
            icono:    { origen: "sitio" , url: "https://ejemplo.com/icon.png" } ,
            color:    "#ff5500" ,
            intentos: [ { fuente: "sitio" , ok: true } ]
          } )
        } ) ;
      }
      return( { ok: false , status: 404 } ) ;
    } ) ;
    global.fetch = fetchSpy ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;

    const btnBateria = screen.getByText( dict.sandboxPage.brandsBattery ) ;
    fireEvent.click( btnBateria ) ;

    await act( async() => {
      await vi.runAllTimersAsync() ;
    } ) ;

    expect( fetchSpy ).not.toHaveBeenCalledWith( expect.stringContaining( "fase=dominios" ) ) ;
    expect( fetchSpy ).toHaveBeenCalledWith( expect.stringContaining( "/api/sandbox/marcas?fase=iconos&dominio=galicia.ar" ) ) ;
    expect( fetchSpy ).toHaveBeenCalledWith( "/api/brand/identidad?domain=galicia.ar" ) ;
    expect( fetchSpy ).toHaveBeenCalledWith( expect.stringContaining( "/api/sandbox/marcas?fase=iconos&dominio=bbva.com" ) ) ;
    expect( fetchSpy ).toHaveBeenCalledWith( "/api/brand/identidad?domain=bbva.com" ) ;
    expect( fetchSpy ).toHaveBeenCalledWith( expect.stringContaining( "/api/sandbox/marcas?fase=iconos&dominio=santander.com" ) ) ;
    expect( fetchSpy ).toHaveBeenCalledWith( "/api/brand/identidad?domain=santander.com" ) ;

    vi.useRealTimers() ;
  } ) ;

  it( "la fila muestra la fuente, el #rrggbb y la muestra de color del resolutor" , async() => {
    vi.useFakeTimers() ;

    global.fetch = vi.fn().mockImplementation( async( url: string ) => {
      if( url.includes( "fase=iconos" ) ) {
        return( { ok: true , status: 200 , json: async() => ( { resultados: [] } ) } ) ;
      }
      if( url.includes( "/api/brand/identidad" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            dominio:  "galicia.ar" ,
            icono:    { origen: "sitio" , url: "https://galicia.ar/favicon.png" } ,
            color:    "#ff5500" ,
            intentos: [ { fuente: "sitio" , ok: true } ]
          } )
        } ) ;
      }
      return( { ok: false , status: 404 } ) ;
    } ) ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;
    fireEvent.click( screen.getByText( dict.sandboxPage.brandsBattery ) ) ;

    await act( async() => {
      await vi.runAllTimersAsync() ;
    } ) ;

    expect( screen.getAllByText( "#ff5500" ).length ).toBeGreaterThan( 0 ) ;
    expect( screen.getAllByText( "sitio" ).length ).toBeGreaterThan( 0 ) ;

    const colorHexEl = screen.getAllByText( "#ff5500" )[0] ;
    const swatchEl = colorHexEl.parentElement?.querySelector( `.${styles.colorSwatch}` ) ;
    expect( swatchEl ).toHaveStyle( { backgroundColor: "#ff5500" } ) ;

    vi.useRealTimers() ;
  } ) ;

  it( "una respuesta 401/500 de identidad deja la fila con ✗ y la batería termina todas las marcas" , async() => {
    vi.useFakeTimers() ;

    global.fetch = vi.fn().mockImplementation( async( url: string ) => {
      if( url.includes( "fase=iconos" ) ) {
        return( { ok: true , status: 200 , json: async() => ( { resultados: [] } ) } ) ;
      }
      if( url.includes( "/api/brand/identidad" ) ) {
        if( url.includes( "galicia.ar" ) ) {
          return( { ok: false , status: 500 , json: async() => ( { error: "fallo" } ) } ) ;
        }
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            dominio:  "bbva.com" ,
            icono:    { origen: "google-s2" , url: "https://bbva.com/icon.png" } ,
            color:    "#004488" ,
            intentos: [ { fuente: "google-s2" , ok: true } ]
          } )
        } ) ;
      }
      return( { ok: false , status: 404 } ) ;
    } ) ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;
    fireEvent.click( screen.getByText( dict.sandboxPage.brandsBattery ) ) ;

    await act( async() => {
      await vi.runAllTimersAsync() ;
    } ) ;

    // Galicia tuvo error 500 -> celda con ✗
    expect( screen.getAllByText( "✗" ).length ).toBeGreaterThan( 0 ) ;

    // Y la batería completó las 3 marcas
    expect( screen.getByText( "Banco Galicia" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "BBVA" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "Santander" ) ).toBeInTheDocument() ;
    expect( screen.queryByText( new RegExp( dict.sandboxPage.brandsCancel ) ) ).not.toBeInTheDocument() ;

    vi.useRealTimers() ;
  } ) ;

  it( "el resumen cuenta bien: 3 marcas (una sitio, una google-s2, una sin ícono; dos con color)" , async() => {
    vi.useFakeTimers() ;

    global.fetch = vi.fn().mockImplementation( async( url: string ) => {
      if( url.includes( "fase=iconos" ) ) {
        return( { ok: true , status: 200 , json: async() => ( { resultados: [] } ) } ) ;
      }
      if( url.includes( "/api/brand/identidad" ) ) {
        if( url.includes( "galicia.ar" ) ) {
          return( {
            ok:     true ,
            status: 200 ,
            json:   async() => ( {
              dominio:  "galicia.ar" ,
              icono:    { origen: "sitio" , url: "https://galicia.ar/logo.png" } ,
              color:    "#111111" ,
              intentos: []
            } )
          } ) ;
        }
        if( url.includes( "bbva.com" ) ) {
          return( {
            ok:     true ,
            status: 200 ,
            json:   async() => ( {
              dominio:  "bbva.com" ,
              icono:    { origen: "google-s2" , url: "https://bbva.com/logo.png" } ,
              color:    "#222222" ,
              intentos: []
            } )
          } ) ;
        }
        // Santander: sin ícono, sin color
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            dominio:  "santander.com" ,
            icono:    null ,
            color:    null ,
            intentos: []
          } )
        } ) ;
      }
      return( { ok: false , status: 404 } ) ;
    } ) ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;
    fireEvent.click( screen.getByText( dict.sandboxPage.brandsBattery ) ) ;

    await act( async() => {
      await vi.runAllTimersAsync() ;
    } ) ;

    const resumenEl = screen.getByText( new RegExp( dict.sandboxPage.brandsResolverSummary ) ).parentElement ;
    expect( resumenEl ).toHaveTextContent( "sitio 1" ) ;
    expect( resumenEl ).toHaveTextContent( "google-s2 1" ) ;
    expect( resumenEl ).toHaveTextContent( "brandfetch-cdn 0" ) ;
    expect( resumenEl ).toHaveTextContent( "sin ícono 1" ) ;
    expect( resumenEl ).toHaveTextContent( "con color 2/3" ) ;

    vi.useRealTimers() ;
  } ) ;

  it( "copiarResultados incluye identidad y msIdentidad y NO contiene dataUri en ninguna parte del JSON" , async() => {
    vi.useFakeTimers() ;

    const writeTextSpy = vi.fn().mockResolvedValue( undefined ) ;
    Object.assign( navigator , {
      clipboard: { writeText: writeTextSpy }
    } ) ;
    vi.spyOn( window , "alert" ).mockImplementation( () => {} ) ;

    global.fetch = vi.fn().mockImplementation( async( url: string ) => {
      if( url.includes( "fase=iconos" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            resultados: [
              {
                estrategia: "sitio" ,
                ok:         true ,
                ms:         10 ,
                estado:     "200" ,
                dataUri:    "data:image/png;base64,ICON_DATA_URI"
              }
            ]
          } )
        } ) ;
      }
      if( url.includes( "/api/brand/identidad" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            dominio:     "galicia.ar" ,
            icono:       {
              origen:  "sitio" ,
              dataUri: "data:image/png;base64,ID_DATA_URI"
            } ,
            color:       "#ff5500" ,
            intentos:    []
          } )
        } ) ;
      }
      return( { ok: false , status: 404 } ) ;
    } ) ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;
    fireEvent.click( screen.getByText( dict.sandboxPage.brandsBattery ) ) ;

    await act( async() => {
      await vi.runAllTimersAsync() ;
    } ) ;

    const btnCopiar = screen.getByText( dict.sandboxPage.brandsCopy ) ;
    fireEvent.click( btnCopiar ) ;

    expect( writeTextSpy ).toHaveBeenCalledTimes( 1 ) ;
    const jsonStr = writeTextSpy.mock.calls[0][0] ;

    // NO debe contener la subcadena "dataUri" en ninguna parte
    expect( jsonStr ).not.toContain( "dataUri" ) ;
    expect( jsonStr ).not.toContain( "ICON_DATA_URI" ) ;
    expect( jsonStr ).not.toContain( "ID_DATA_URI" ) ;

    const parsed = JSON.parse( jsonStr ) ;
    expect( parsed.bateria ).toHaveLength( 3 ) ;
    expect( parsed.bateria[0].identidad ).toBeDefined() ;
    expect( parsed.bateria[0].identidad.icono.origen ).toBe( "sitio" ) ;
    expect( parsed.bateria[0].identidad.icono.dataUri ).toBeUndefined() ;
    expect( typeof parsed.bateria[0].msIdentidad ).toBe( "number" ) ;

    vi.useRealTimers() ;
  } ) ;

  it( "el botón Resolver identidad llama al endpoint con el dominio actual y muestra el resultado" , async() => {
    const fetchSpy = vi.fn().mockImplementation( async( url: string ) => {
      if( url.includes( "/api/brand/identidad?domain=bbva.com" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            dominio:  "bbva.com" ,
            icono:    { origen: "google-s2" , url: "https://bbva.com/icon.png" } ,
            color:    "#004488" ,
            intentos: [ { fuente: "google-s2" , ok: true } ]
          } )
        } ) ;
      }
      return( { ok: false , status: 404 } ) ;
    } ) ;
    global.fetch = fetchSpy ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;

    const inputManual = screen.getByPlaceholderText( "ej: bbva.com" ) ;
    fireEvent.change( inputManual , { target: { value: "bbva.com" } } ) ;

    const btnResolver = screen.getByText( dict.sandboxPage.brandsResolverRun ) ;
    fireEvent.click( btnResolver ) ;

    await waitFor( () => {
      expect( fetchSpy ).toHaveBeenCalledWith( "/api/brand/identidad?domain=bbva.com" ) ;
    } ) ;

    expect( await screen.findByText( "#004488" ) ).toBeInTheDocument() ;
    expect( screen.getAllByText( "google-s2" ).length ).toBeGreaterThan( 0 ) ;
  } ) ;

  it( "bateria.ts define 18 marcas y Banco Nación usa bna.com.ar" , async() => {
    const mod = await vi.importActual< typeof import( "./bateria" ) >( "./bateria" ) ;
    expect( mod.BATERIA ).toHaveLength( 18 ) ;
    const bn = mod.BATERIA.find( ( m ) => m.nombre === "Banco Nación" ) ;
    expect( bn?.dominio ).toBe( "bna.com.ar" ) ;
  } ) ;
} ) ;
