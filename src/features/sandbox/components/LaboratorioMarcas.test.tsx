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

vi.mock( "./consultas" , () => ( {
  CONSULTAS: [
    { consulta: "galicia" , esperados: [ "galicia.ar" , "bancogalicia.com" ] } ,
    { consulta: "bbva" ,    esperados: [ "bbva.com" , "bbva.com.ar" ] } ,
    { consulta: "gali" ,    esperados: [ "galicia.ar" ] , parcial: true }
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
            estrategia: "candidatos" ,
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

    expect( await screen.findByText( "candidatos" ) ).toBeInTheDocument() ;
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
                estrategia: "candidatos" ,
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

  it( "la fila muestra dimensiones originales, fuenteUrl y redireccion en el title" , async() => {
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
            dominio:   "galicia.ar" ,
            icono:     {
              origen:      "sitio" ,
              url:         "https://galicia.ar/favicon.png" ,
              origenAncho: 180 ,
              origenAlto:  180 ,
              fuenteUrl:   "https://x.test/i.png"
            } ,
            color:     "#ff5500" ,
            intentos:  [ { fuente: "sitio" , ok: true } ] ,
            redirigeA: "personal.com.ar"
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

    const colorHexEl = screen.getAllByText( "#ff5500" )[0] ;
    const cellEl     = colorHexEl.closest( `.${styles.resolverCellContent}` ) ;
    const titleText  = cellEl?.getAttribute( "title" ) || "" ;

    expect( titleText ).toContain( "180×180" ) ;
    expect( titleText ).toContain( "https://x.test/i.png" ) ;
    expect( titleText ).toContain( "→ personal.com.ar" ) ;

    vi.useRealTimers() ;
  } ) ;

  it( "7. la batería por nombre llama a fase=dominios&q=<consulta> por cada consulta, no llama a fase=iconos, y pide /api/brand/identidad una sola vez por dominio repetido" , async() => {
    vi.useFakeTimers() ;

    const fetchSpy = vi.fn().mockImplementation( async( url: string ) => {
      const u = String( url ) ;
      if( u.includes( "fase=dominios" ) ) {
        // galicia y gali retornan el mismo primer dominio galicia.ar
        const dominio = u.includes( "bbva" ) ? "bbva.com" : "galicia.ar" ;
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            resultados: [
              {
                estrategia: "wikidata" ,
                ok:         true ,
                ms:         30 ,
                estado:     "200" ,
                candidatos: [ { dominio } ]
              } ,
              {
                estrategia: "candidatos" ,
                ok:         true ,
                ms:         40 ,
                estado:     "200" ,
                candidatos: [ { dominio , resuelve: true } ]
              } ,
              {
                estrategia: "verificados" ,
                ok:         true ,
                ms:         50 ,
                estado:     "200" ,
                candidatos: [ { dominio , coincide: true } ]
              }
            ]
          } )
        } ) ;
      }
      if( u.includes( "/api/brand/identidad" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            dominio:  "galicia.ar" ,
            icono:    { origen: "sitio" , url: "https://galicia.ar/logo.png" } ,
            color:    "#ff5500" ,
            intentos: [ { fuente: "sitio" , ok: true } ]
          } )
        } ) ;
      }
      return( { ok: false , status: 404 } ) ;
    } ) ;
    global.fetch = fetchSpy ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;
    fireEvent.click( screen.getByText( dict.sandboxPage.brandsBatteryName ) ) ;

    await act( async() => {
      await vi.runAllTimersAsync() ;
    } ) ;

    // No debe haber llamado a fase=iconos
    const llamadasIconos = fetchSpy.mock.calls.filter( ( [ u ] ) => String( u ).includes( "fase=iconos" ) ) ;
    expect( llamadasIconos ).toHaveLength( 0 ) ;

    // Debe haber llamado a fase=dominios para las 3 consultas
    const llamadasDominios = fetchSpy.mock.calls.filter( ( [ u ] ) => String( u ).includes( "fase=dominios" ) ) ;
    expect( llamadasDominios ).toHaveLength( 3 ) ;

    // Identidad para galicia.ar debe haberse llamado UNA sola vez (galicia y gali comparten dominio)
    const llamadasIdGalicia = fetchSpy.mock.calls.filter( ( [ u ] ) => String( u ).includes( "domain=galicia.ar" ) ) ;
    expect( llamadasIdGalicia ).toHaveLength( 1 ) ;

    vi.useRealTimers() ;
  } ) ;

  it( "8. una casilla cuyo primer candidato es esperado lleva celdaUsada, muestra ícono y #rrggbb; con esperado tercero lleva celdaFallo y esperado en #3" , async() => {
    vi.useFakeTimers() ;

    global.fetch = vi.fn().mockImplementation( async( url: string ) => {
      const u = String( url ) ;
      if( u.includes( "fase=dominios" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            resultados: [
              {
                estrategia: "wikidata" ,
                ok:         true ,
                ms:         20 ,
                estado:     "200" ,
                candidatos: [ { dominio: "galicia.ar" } ]
              } ,
              {
                estrategia: "candidatos" ,
                ok:         true ,
                ms:         25 ,
                estado:     "200" ,
                candidatos: [
                  { dominio: "otro1.com" , resuelve: true } ,
                  { dominio: "otro2.com" , resuelve: true } ,
                  { dominio: "galicia.ar" , resuelve: true }
                ]
              }
            ]
          } )
        } ) ;
      }
      if( u.includes( "/api/brand/identidad" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            dominio:  "galicia.ar" ,
            icono:    { origen: "sitio" , url: "https://galicia.ar/logo.png" } ,
            color:    "#ff5500" ,
            intentos: [ { fuente: "sitio" , ok: true } ]
          } )
        } ) ;
      }
      return( { ok: false , status: 404 } ) ;
    } ) ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;
    fireEvent.click( screen.getByText( dict.sandboxPage.brandsBatteryName ) ) ;

    await act( async() => {
      await vi.runAllTimersAsync() ;
    } ) ;

    // Celda de wikidata: acertó en primero -> celdaUsada, #ff5500
    const celdaUsada = screen.getAllByText( "#ff5500" )[0].closest( "td" ) ;
    expect( celdaUsada ).toHaveClass( styles.celdaUsada ) ;

    // Celda de candidatos: esperado en posición 2 (3.º candidato) -> celdaFallo, esperado en #3
    const celdaFallo = screen.getAllByText( /esperado en #3/ )[0].closest( "td" ) ;
    expect( celdaFallo ).toHaveClass( styles.celdaFallo ) ;

    vi.useRealTimers() ;
  } ) ;

  it( "9. una estrategia con candidatos vacíos lleva celdaVacia; una con ok: false muestra su estado" , async() => {
    vi.useFakeTimers() ;

    global.fetch = vi.fn().mockImplementation( async( url: string ) => {
      const u = String( url ) ;
      if( u.includes( "fase=dominios" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            resultados: [
              {
                estrategia: "wikidata" ,
                ok:         true ,
                ms:         15 ,
                estado:     "200" ,
                candidatos: []
              } ,
              {
                estrategia: "verificados" ,
                ok:         false ,
                ms:         50 ,
                estado:     "timeout-504" ,
                candidatos: []
              }
            ]
          } )
        } ) ;
      }
      return( { ok: false , status: 404 } ) ;
    } ) ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;
    fireEvent.click( screen.getByText( dict.sandboxPage.brandsBatteryName ) ) ;

    await act( async() => {
      await vi.runAllTimersAsync() ;
    } ) ;

    // Wikidata: candidatos vacíos -> celdaVacia en tabla
    const celdaVacia = screen.getAllByText( dict.sandboxPage.brandsNoResults )
      .map( ( el ) => el.closest( "td" ) )
      .find( Boolean ) ;
    expect( celdaVacia ).toHaveClass( styles.celdaVacia ) ;

    // Verificados: ok: false -> muestra su estado
    expect( screen.getAllByText( /timeout-504/ ).length ).toBeGreaterThan( 0 ) ;

    vi.useRealTimers() ;
  } ) ;

  it( "10. parcial muestra brandsPartial" , async() => {
    vi.useFakeTimers() ;

    global.fetch = vi.fn().mockImplementation( async( url: string ) => {
      if( url.includes( "fase=dominios" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( { resultados: [] } )
        } ) ;
      }
      return( { ok: false , status: 404 } ) ;
    } ) ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;
    fireEvent.click( screen.getByText( dict.sandboxPage.brandsBatteryName ) ) ;

    await act( async() => {
      await vi.runAllTimersAsync() ;
    } ) ;

    // La tercera consulta 'gali' es parcial: true
    expect( screen.getByText( new RegExp( dict.sandboxPage.brandsPartial ) ) ).toBeInTheDocument() ;

    vi.useRealTimers() ;
  } ) ;

  it( "11. el resumen cuenta 1.º y top3 correctamente para un caso de 3 consultas (dos aciertan, una no) y ninguna: 1" , async() => {
    vi.useFakeTimers() ;

    global.fetch = vi.fn().mockImplementation( async( url: string ) => {
      const u = String( url ) ;
      if( u.includes( "fase=dominios" ) ) {
        if( u.includes( "q=galicia" ) ) {
          return( {
            ok:     true ,
            status: 200 ,
            json:   async() => ( {
              resultados: [
                { estrategia: "wikidata" , ok: true , ms: 20 , estado: "200" , candidatos: [ { dominio: "galicia.ar" } ] }
              ]
            } )
          } ) ;
        }
        if( u.includes( "q=bbva" ) ) {
          return( {
            ok:     true ,
            status: 200 ,
            json:   async() => ( {
              resultados: [
                { estrategia: "wikidata" , ok: true , ms: 20 , estado: "200" , candidatos: [ { dominio: "erroneo.com" } , { dominio: "bbva.com" } ] }
              ]
            } )
          } ) ;
        }
        // q=gali -> no acierta
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            resultados: [
              { estrategia: "wikidata" , ok: true , ms: 20 , estado: "200" , candidatos: [ { dominio: "noesperado.com" } ] }
            ]
          } )
        } ) ;
      }
      return( { ok: false , status: 404 } ) ;
    } ) ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;
    fireEvent.click( screen.getByText( dict.sandboxPage.brandsBatteryName ) ) ;

    await act( async() => {
      await vi.runAllTimersAsync() ;
    } ) ;

    expect( screen.getByText( /alguna acierta 2\/3 · ninguna: 1/ ) ).toBeInTheDocument() ;

    vi.useRealTimers() ;
  } ) ;

  it( "12. una respuesta 401/500 de identidad deja la casilla con el dominio y sin ícono, y la batería termina todas las consultas" , async() => {
    vi.useFakeTimers() ;

    global.fetch = vi.fn().mockImplementation( async( url: string ) => {
      const u = String( url ) ;
      if( u.includes( "fase=dominios" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            resultados: [
              { estrategia: "wikidata" , ok: true , ms: 10 , estado: "200" , candidatos: [ { dominio: "galicia.ar" } ] }
            ]
          } )
        } ) ;
      }
      if( u.includes( "/api/brand/identidad" ) ) {
        return( { ok: false , status: 500 } ) ;
      }
      return( { ok: false , status: 404 } ) ;
    } ) ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;
    const btn = screen.getByText( dict.sandboxPage.brandsBatteryName ) ;
    fireEvent.click( btn ) ;

    await act( async() => {
      await vi.runAllTimersAsync() ;
    } ) ;

    // Muestra el dominio pero sin img de logo
    expect( screen.getAllByText( "galicia.ar" ).length ).toBeGreaterThan( 0 ) ;
    expect( screen.queryByAltText( "galicia.ar" ) ).not.toBeInTheDocument() ;
    // Terminó la batería
    expect( screen.getByText( dict.sandboxPage.brandsBatteryName ) ).toBeInTheDocument() ;

    vi.useRealTimers() ;
  } ) ;

  it( "13. batería por dominio: no hay columnas Wikidata ni Brandfetch; 1 · y 2 · en la cascada; brandsInformative en DDG e Icon Horse" , async() => {
    vi.useFakeTimers() ;

    global.fetch = vi.fn().mockResolvedValue( {
      ok:     true ,
      status: 200 ,
      json:   async() => ( { resultados: [] } )
    } ) ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;
    fireEvent.click( screen.getByText( dict.sandboxPage.brandsBattery ) ) ;

    await act( async() => {
      await vi.runAllTimersAsync() ;
    } ) ;

    // No debe haber columnas Wikidata ni Brandfetch en la tabla de dominios
    const tablaDominios = screen.getByText( "1 · Sitio" ).closest( "table" ) ;
    expect( tablaDominios ).not.toBeNull() ;
    expect( tablaDominios?.textContent ).not.toContain( "Brandfetch" ) ;
    expect( tablaDominios?.textContent ).not.toContain( "Wikidata" ) ;

    // 1 · Sitio y 2 · Google S2 presentes
    expect( screen.getByText( "1 · Sitio" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "2 · Google S2" ) ).toBeInTheDocument() ;

    // DDG e Icon Horse con brandsInformative
    const infoHeaders = screen.getAllByText( dict.sandboxPage.brandsInformative ) ;
    expect( infoHeaders.length ).toBeGreaterThanOrEqual( 2 ) ;

    vi.useRealTimers() ;
  } ) ;

  it( "14. pintado: identidad con origen: 'google-s2' e intentos [sitio falló 'http 404', google-s2 ok] -> Google S2 con celdaUsada, brandsUsedIcon y brandsUsedColor; Sitio con celdaFallo y http 404" , async() => {
    vi.useFakeTimers() ;

    global.fetch = vi.fn().mockImplementation( async( url: string ) => {
      const u = String( url ) ;
      if( u.includes( "fase=iconos" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            resultados: [
              { estrategia: "sitio" , ok: false , ms: 20 , estado: "404" } ,
              { estrategia: "google-s2" , ok: true , ms: 30 , estado: "200" , url: "https://s2.test/icon.png" }
            ]
          } )
        } ) ;
      }
      if( u.includes( "/api/brand/identidad" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            dominio:  "galicia.ar" ,
            icono:    { origen: "google-s2" , url: "https://s2.test/icon.png" } ,
            color:    "#002244" ,
            intentos: [
              { fuente: "sitio" , ok: false , motivo: "http 404" } ,
              { fuente: "google-s2" , ok: true }
            ]
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

    // Google S2 celdaUsada, brandsUsedIcon, brandsUsedColor
    const usedLabel = screen.getAllByText( dict.sandboxPage.brandsUsedIcon )[0] ;
    const tdGoogle = usedLabel.closest( "td" ) ;
    expect( tdGoogle ).toHaveClass( styles.celdaUsada ) ;
    expect( tdGoogle?.textContent ).toContain( dict.sandboxPage.brandsUsedColor ) ;

    // Sitio celdaFallo con http 404
    const falloLabel = screen.getAllByText( /http 404/ )[0] ;
    const tdSitio = falloLabel.closest( "td" ) ;
    expect( tdSitio ).toHaveClass( styles.celdaFallo ) ;

    vi.useRealTimers() ;
  } ) ;

  it( "15. respaldo chico: origen: 'sitio' + intento ok:false 'menor a 64 px' -> Sitio celdaUsada con 'respaldo chico'" , async() => {
    vi.useFakeTimers() ;

    global.fetch = vi.fn().mockImplementation( async( url: string ) => {
      const u = String( url ) ;
      if( u.includes( "fase=iconos" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            resultados: [
              { estrategia: "sitio" , ok: true , ms: 20 , estado: "200" , url: "https://sitio.test/favicon.png" }
            ]
          } )
        } ) ;
      }
      if( u.includes( "/api/brand/identidad" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            dominio:  "galicia.ar" ,
            icono:    { origen: "sitio" , url: "https://sitio.test/favicon.png" , origenAncho: 32 , origenAlto: 32 } ,
            color:    "#ff5500" ,
            intentos: [
              { fuente: "sitio" , ok: false , motivo: "menor a 64 px" }
            ]
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

    const labelRespaldo = screen.getAllByText( "respaldo chico" )[0] ;
    const tdSitio = labelRespaldo.closest( "td" ) ;
    expect( tdSitio ).toHaveClass( styles.celdaUsada ) ;

    vi.useRealTimers() ;
  } ) ;

  it( "16. los dos botones se bloquean entre sí" , async() => {
    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;

    const btnNombres = screen.getByText( dict.sandboxPage.brandsBatteryName ) ;
    const btnDominios = screen.getByText( dict.sandboxPage.brandsBattery ) ;

    expect( btnNombres ).toBeEnabled() ;
    expect( btnDominios ).toBeEnabled() ;

    // Iniciar batería por dominio -> botón de nombres se deshabilita
    await act( async() => {
      fireEvent.click( btnDominios ) ;
    } ) ;
    expect( screen.getByText( dict.sandboxPage.brandsBatteryName ) ).toBeDisabled() ;

    // Cancelar batería por dominio
    await act( async() => {
      fireEvent.click( screen.getByText( new RegExp( dict.sandboxPage.brandsCancel ) ) ) ;
    } ) ;

    // Ambos botones habilitados de nuevo
    expect( screen.getByText( dict.sandboxPage.brandsBatteryName ) ).toBeEnabled() ;
    expect( screen.getByText( dict.sandboxPage.brandsBattery ) ).toBeEnabled() ;

    // Iniciar batería por nombre -> botón de dominio se deshabilita
    await act( async() => {
      fireEvent.click( screen.getByText( dict.sandboxPage.brandsBatteryName ) ) ;
    } ) ;
    expect( screen.getByText( dict.sandboxPage.brandsBattery ) ).toBeDisabled() ;
  } ) ;

  it( "17. el JSON copiado trae bateriaNombres con esperados y posicionEsperado, y NO contiene dataUri" , async() => {
    vi.useFakeTimers() ;
    let clipboardText = "" ;
    Object.assign( navigator , {
      clipboard: {
        writeText: vi.fn().mockImplementation( async( text: string ) => {
          clipboardText = text ;
        } )
      }
    } ) ;
    vi.spyOn( window , "alert" ).mockImplementation( () => {} ) ;

    global.fetch = vi.fn().mockImplementation( async( url: string ) => {
      const u = String( url ) ;
      if( u.includes( "fase=dominios" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            resultados: [
              {
                estrategia: "wikidata" ,
                ok:         true ,
                ms:         20 ,
                estado:     "200" ,
                candidatos: [ { dominio: "galicia.ar" } ]
              }
            ]
          } )
        } ) ;
      }
      if( u.includes( "/api/brand/identidad" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            dominio:  "galicia.ar" ,
            icono:    { origen: "sitio" , dataUri: "data:image/png;base64,SECRET" } ,
            color:    "#ff5500" ,
            intentos: [ { fuente: "sitio" , ok: true } ]
          } )
        } ) ;
      }
      return( { ok: false , status: 404 } ) ;
    } ) ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;
    fireEvent.click( screen.getByText( dict.sandboxPage.brandsBatteryName ) ) ;

    await act( async() => {
      await vi.runAllTimersAsync() ;
    } ) ;

    fireEvent.click( screen.getByText( dict.sandboxPage.brandsCopy ) ) ;

    expect( navigator.clipboard.writeText ).toHaveBeenCalled() ;
    const parsed = JSON.parse( clipboardText ) ;
    expect( parsed.bateriaNombres ).toBeDefined() ;
    expect( parsed.bateriaNombres[0].esperados ).toBeDefined() ;
    expect( parsed.bateriaNombres[0].estrategias[0].primero.posicionEsperado ).toBe( 0 ) ;
    expect( clipboardText ).not.toContain( "dataUri" ) ;

    vi.useRealTimers() ;
  } ) ;

  it( "18. fase 2 individual: la tarjeta de la estrategia usada lleva celdaUsada" , async() => {
    global.fetch = vi.fn().mockImplementation( async( url: string ) => {
      const u = String( url ) ;
      if( u.includes( "fase=iconos" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            resultados: [
              { estrategia: "sitio" , ok: true , ms: 20 , estado: "200" , url: "https://sitio.test/favicon.png" } ,
              { estrategia: "google-s2" , ok: true , ms: 30 , estado: "200" , url: "https://s2.test/favicon.png" }
            ]
          } )
        } ) ;
      }
      if( u.includes( "/api/brand/identidad" ) ) {
        return( {
          ok:     true ,
          status: 200 ,
          json:   async() => ( {
            dominio:  "galicia.ar" ,
            icono:    { origen: "google-s2" , url: "https://s2.test/favicon.png" } ,
            color:    "#002244" ,
            intentos: [ { fuente: "google-s2" , ok: true } ]
          } )
        } ) ;
      }
      return( { ok: false , status: 404 } ) ;
    } ) ;

    render( <LaboratorioMarcas dict={dict} lang="es" /> ) ;

    const inputManual = screen.getByPlaceholderText( "ej: bbva.com" ) ;
    fireEvent.change( inputManual , { target: { value: "galicia.ar" } } ) ;

    // Probar íconos
    const btnsProbar = screen.getAllByText( dict.sandboxPage.brandsTryIcons ) ;
    fireEvent.click( btnsProbar[0] ) ;

    // Resolver identidad
    fireEvent.click( screen.getByText( dict.sandboxPage.brandsResolverRun ) ) ;

    await waitFor( () => {
      const tarjetas = screen.getAllByText( "google-s2" ) ;
      const tarjetaS2 = tarjetas
        .map( ( t ) => t.closest( `.${styles.iconTile}` ) )
        .find( Boolean ) ;
      expect( tarjetaS2 ).toHaveClass( styles.celdaUsada ) ;
    } ) ;
  } ) ;
} ) ;
