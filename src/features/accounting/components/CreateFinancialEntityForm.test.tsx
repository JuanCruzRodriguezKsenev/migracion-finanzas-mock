// @vitest-environment jsdom
/**
 * @file CreateFinancialEntityForm.test.tsx
 * Plan 32 (§3.1): Blindaje con pruebas unitarias del buscador de marcas de entidades financieras
 * contra el código vigente, sin modificar código de producción.
 */

// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach , afterEach } from "vitest" ;
import { render , screen , fireEvent , act , within }                     from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Accounting
import { createFinancialEntityAction } from "../actions/accountingActions" ;
import { CreateFinancialEntityForm }   from "./CreateFinancialEntityForm" ;


vi.mock( "../actions/accountingActions" , () => ( {
  createFinancialEntityAction: vi.fn() ,
} ) ) ;

describe( "CreateFinancialEntityForm — buscador de marcas y alta de entidad" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;
  let fetchMock: ReturnType< typeof vi.fn > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.useFakeTimers() ;
    fetchMock = vi.fn().mockImplementation( async ( input: RequestInfo | URL ) => {
      const url = String( input ) ;

      if( url.includes( "/api/brand/identidad" ) ) {
        return( {
          ok:   true ,
          json: async () => ( { color: "#123456" } ) ,
        } ) ;
      }

      if( url.startsWith( "/api/brand" ) ) {
        return( {
          ok:   true ,
          json: async () => [] ,
        } ) ;
      }

      return( { ok: false , json: async () => ( {} ) } ) ;
    } ) ;

    vi.stubGlobal( "fetch" , fetchMock ) ;
    vi.mocked( createFinancialEntityAction ).mockResolvedValue( {
      success: true ,
      value:   { id: "ent-1" , name: "Test" } as never ,
    } ) ;
  } ) ;

  afterEach( () => {
    vi.unstubAllGlobals() ;
    vi.useRealTimers() ;
    vi.clearAllMocks() ;
  } ) ;

  const inputNombre  = () => screen.getByLabelText( "Nombre o Dominio de la Entidad" , { exact: false } ) as HTMLInputElement ;
  const selectorPais = () => screen.getByLabelText( "País de Búsqueda" , { exact: false } ) as HTMLSelectElement ;
  const botonEnviar  = () => screen.getByRole( "button" , { name: "Crear Entidad" } ) ;

  it( "1. menos de 3 letras no busca" , async () => {
    render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;

    fireEvent.change( inputNombre() , { target: { value: "ga" } } ) ;
    await vi.advanceTimersByTimeAsync( 1000 ) ;

    expect( fetchMock ).not.toHaveBeenCalled() ;
  } ) ;

  it( "2. espera 500 ms antes de consultar la red" , async () => {
    render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;

    fireEvent.change( inputNombre() , { target: { value: "galicia" } } ) ;
    await vi.advanceTimersByTimeAsync( 499 ) ;
    expect( fetchMock ).not.toHaveBeenCalled() ;

    await vi.advanceTimersByTimeAsync( 1 ) ;
    expect( fetchMock ).toHaveBeenCalled() ;
  } ) ;

  it( "3. rebote: escribir interrumpe la espera anterior y solo consulta el texto final" , async () => {
    render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;

    fireEvent.change( inputNombre() , { target: { value: "gal" } } ) ;
    await vi.advanceTimersByTimeAsync( 300 ) ;

    fireEvent.change( inputNombre() , { target: { value: "galicia" } } ) ;
    await vi.advanceTimersByTimeAsync( 500 ) ;

    const llamadas = fetchMock.mock.calls.map( ( [ url ] ) => String( url ) ) ;
    expect( llamadas.length ).toBeGreaterThan( 0 ) ;
    expect( llamadas.every( ( url ) => url.includes( "galicia" ) ) ).toBe( true ) ;
  } ) ;

  it( "4. con país ar y texto consulta /api/brand con parámetro q y pais" , async () => {
    render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    fireEvent.change( selectorPais() , { target: { value: "ar" } } ) ;

    fireEvent.change( inputNombre() , { target: { value: "galicia" } } ) ;
    await act( async () => {
      await vi.advanceTimersByTimeAsync( 500 ) ;
    } ) ;

    expect( fetchMock ).toHaveBeenCalledWith( "/api/brand?q=galicia&pais=ar" ) ;
  } ) ;

  it( "5. consulta directa con dominio que contiene punto" , async () => {
    render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    fireEvent.change( selectorPais() , { target: { value: "ar" } } ) ;

    fireEvent.change( inputNombre() , { target: { value: "galicia.com.ar" } } ) ;
    await act( async () => {
      await vi.advanceTimersByTimeAsync( 500 ) ;
    } ) ;

    expect( fetchMock ).toHaveBeenCalledWith( "/api/brand?q=galicia.com.ar&pais=ar" ) ;
  } ) ;

  it( "6. sin país (Global / Todos) consulta /api/brand sin parámetro pais" , async () => {
    render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    fireEvent.change( selectorPais() , { target: { value: "" } } ) ;

    fireEvent.change( inputNombre() , { target: { value: "galicia" } } ) ;
    await act( async () => {
      await vi.advanceTimersByTimeAsync( 500 ) ;
    } ) ;

    expect( fetchMock ).toHaveBeenCalledWith( "/api/brand?q=galicia" ) ;
  } ) ;

  it( "7. prioridad del país y tope de 5 opciones" , async () => {
    fetchMock.mockImplementation( async ( input ) => {
      const url = String( input ) ;
      if( url.startsWith( "/api/brand" ) ) {
        return( {
          ok:   true ,
          json: async () => [
            { name: "Global Uno" , domain: "global1.com" } ,
            { name: "España Uno" , domain: "espana1.es" } ,
            { name: "Arg Uno"    , domain: "banco1.ar" } ,
            { name: "Global Dos" , domain: "global2.com" } ,
            { name: "Arg Dos"    , domain: "banco2.com.ar" } ,
            { name: "Global Tres", domain: "global3.com" } ,
            { name: "Arg Tres"   , domain: "banco3.ar" } ,
          ] ,
        } ) ;
      }
      return( { ok: false , json: async () => [] } ) ;
    } ) ;

    render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    fireEvent.change( selectorPais() , { target: { value: "ar" } } ) ;

    fireEvent.change( inputNombre() , { target: { value: "banco" } } ) ;
    await act( async () => {
      await vi.advanceTimersByTimeAsync( 500 ) ;
    } ) ;

    const opciones = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" ) ;
    expect( opciones ).toHaveLength( 5 ) ;

    // Los 3 con dominio argentino van al principio
    expect( opciones[0] ).toHaveTextContent( "banco1.ar" ) ;
    expect( opciones[1] ).toHaveTextContent( "banco2.com.ar" ) ;
    expect( opciones[2] ).toHaveTextContent( "banco3.ar" ) ;
  } ) ;

  it( "8. sin duplicados: el mismo dominio retornado por distintas consultas aparece una sola vez" , async () => {
    fetchMock.mockImplementation( async ( input ) => {
      const url = String( input ) ;
      if( url.startsWith( "/api/brand" ) ) {
        return( {
          ok:   true ,
          json: async () => [
            { name: "Galicia" , domain: "galicia.com.ar" } ,
          ] ,
        } ) ;
      }
      return( { ok: false , json: async () => [] } ) ;
    } ) ;

    render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    fireEvent.change( selectorPais() , { target: { value: "ar" } } ) ;

    fireEvent.change( inputNombre() , { target: { value: "galicia" } } ) ;
    await act( async () => {
      await vi.advanceTimersByTimeAsync( 500 ) ;
    } ) ;

    const opciones = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" ) ;
    expect( opciones ).toHaveLength( 1 ) ;
    expect( opciones[0] ).toHaveTextContent( "galicia.com.ar" ) ;
  } ) ;

  it( "9. muestra nombre, dominio como subtexto, icono o 🌐 y bandera de país o 🌐" , async () => {
    fetchMock.mockImplementation( async ( input ) => {
      const url = String( input ) ;
      if( url.startsWith( "/api/brand" ) ) {
        return( {
          ok:   true ,
          json: async () => [
            { name: "Banco Galicia" , domain: "galicia.com.ar" , icon: "https://cdn.example.com/galicia.png" } ,
            { name: "Banco Global"  , domain: "bancoglobal.com" } ,
          ] ,
        } ) ;
      }
      return( { ok: false , json: async () => [] } ) ;
    } ) ;

    render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    fireEvent.change( selectorPais() , { target: { value: "ar" } } ) ;

    fireEvent.change( inputNombre() , { target: { value: "banco" } } ) ;
    await act( async () => {
      await vi.advanceTimersByTimeAsync( 500 ) ;
    } ) ;

    const opciones = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" ) ;
    expect( opciones ).toHaveLength( 2 ) ;

    // Opción con icono y TLD .ar (bandera 🇦🇷)
    const optAr = opciones[0] ;
    expect( optAr ).toHaveTextContent( "Banco Galicia" ) ;
    expect( optAr ).toHaveTextContent( "galicia.com.ar" ) ;
    expect( optAr ).toHaveTextContent( "🇦🇷" ) ;
    const imgAr = optAr.querySelector( "img" ) ;
    expect( imgAr ).toHaveAttribute( "src" , "https://cdn.example.com/galicia.png" ) ;
    expect( imgAr ).toHaveAttribute( "alt" , "Banco Galicia" ) ;

    // Opción sin icono (🌐) y TLD .com (🌐)
    const optCom = opciones[1] ;
    expect( optCom ).toHaveTextContent( "Banco Global" ) ;
    expect( optCom ).toHaveTextContent( "bancoglobal.com" ) ;
    expect( optCom.querySelector( "img" ) ).toBeNull() ;
    expect( optCom ).toHaveTextContent( "🌐" ) ;
  } ) ;

  it( "10. falla de red: todas las consultas rechazan sin romper la UI ni mostrar error" , async () => {
    fetchMock.mockRejectedValue( new Error( "Falla de red Brandfetch" ) ) ;

    render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    fireEvent.change( selectorPais() , { target: { value: "ar" } } ) ;

    fireEvent.change( inputNombre() , { target: { value: "galicia" } } ) ;
    await act( async () => {
      await vi.advanceTimersByTimeAsync( 500 ) ;
    } ) ;

    expect( screen.queryByRole( "listbox" ) ).not.toBeInTheDocument() ;
    expect( screen.queryByRole( "alert" ) ).not.toBeInTheDocument() ;
  } ) ;

  it( "11. país inicial detectado desde el navegador" , async () => {
    const baseOptions = new Intl.DateTimeFormat().resolvedOptions() ;

    // Caso 1: timeZone America/Argentina/Buenos_Aires + languages [ "en-US" ] -> "ar"
    const spyTzAr   = vi.spyOn( Intl , "DateTimeFormat" ).mockImplementation( () => ( {
      resolvedOptions: () => ( {
        ...baseOptions ,
        timeZone: "America/Argentina/Buenos_Aires"
      } )
    } as unknown as Intl.DateTimeFormat ) ) ;
    const spyLangAr = vi.spyOn( navigator , "languages" , "get" ).mockReturnValue( [ "en-US" ] ) ;
    const vistaAr   = render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    expect( selectorPais().value ).toBe( "ar" ) ;
    vistaAr.unmount() ;
    spyTzAr.mockRestore() ;
    spyLangAr.mockRestore() ;

    // Caso 2: timeZone America/Mexico_City + languages [ "en-US" ] -> "mx"
    const spyTzMx   = vi.spyOn( Intl , "DateTimeFormat" ).mockImplementation( () => ( {
      resolvedOptions: () => ( {
        ...baseOptions ,
        timeZone: "America/Mexico_City"
      } )
    } as unknown as Intl.DateTimeFormat ) ) ;
    const spyLangMx = vi.spyOn( navigator , "languages" , "get" ).mockReturnValue( [ "en-US" ] ) ;
    const vistaMx   = render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    expect( selectorPais().value ).toBe( "mx" ) ;
    vistaMx.unmount() ;
    spyTzMx.mockRestore() ;
    spyLangMx.mockRestore() ;

    // Caso 3: timeZone UTC + languages [ "en-US" ] -> "us"; timeZone UTC + languages [ "de-DE" ] -> "ar"
    const spyTzUtc  = vi.spyOn( Intl , "DateTimeFormat" ).mockImplementation( () => ( {
      resolvedOptions: () => ( {
        ...baseOptions ,
        timeZone: "UTC"
      } )
    } as unknown as Intl.DateTimeFormat ) ) ;
    const spyLangUs = vi.spyOn( navigator , "languages" , "get" ).mockReturnValue( [ "en-US" ] ) ;
    const vistaUs   = render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    expect( selectorPais().value ).toBe( "us" ) ;
    vistaUs.unmount() ;
    spyLangUs.mockRestore() ;

    const spyLangDe = vi.spyOn( navigator , "languages" , "get" ).mockReturnValue( [ "de-DE" ] ) ;
    const vistaDe   = render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    expect( selectorPais().value ).toBe( "ar" ) ;
    fireEvent.change( inputNombre() , { target: { value: "galicia" } } ) ;
    await act( async () => {
      await vi.advanceTimersByTimeAsync( 500 ) ;
    } ) ;
    expect( fetchMock ).toHaveBeenCalledWith( expect.stringContaining( "pais=ar" ) ) ;
    vistaDe.unmount() ;
    spyLangDe.mockRestore() ;
    spyTzUtc.mockRestore() ;
  } ) ;

  it( "12. elegir una marca consulta /api/brand, muestra banner y oculta el buscador" , async () => {
    fetchMock.mockImplementation( async ( input ) => {
      const url = String( input ) ;
      if( url.includes( "/api/brand/identidad" ) ) {
        return( {
          ok:   true ,
          json: async () => ( { color: "#FF5500" } ) ,
        } ) ;
      }
      if( url.startsWith( "/api/brand" ) ) {
        return( {
          ok:   true ,
          json: async () => [ { name: "Galicia" , domain: "galicia.com.ar" } ] ,
        } ) ;
      }
      return( { ok: false , json: async () => ( {} ) } ) ;
    } ) ;

    render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    fireEvent.change( selectorPais() , { target: { value: "ar" } } ) ;

    fireEvent.change( inputNombre() , { target: { value: "galicia" } } ) ;
    await act( async () => {
      await vi.advanceTimersByTimeAsync( 500 ) ;
    } ) ;

    const opcion = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )[0] ;
    await act( async () => {
      fireEvent.click( opcion ) ;
      await vi.runAllTimersAsync() ;
    } ) ;

    expect( fetchMock ).toHaveBeenCalledWith( "/api/brand/identidad?domain=galicia.com.ar" ) ;
    expect( screen.getByText( /✨ Marca vinculada:/ ) ).toBeInTheDocument() ;
    expect( screen.getByText( "Galicia" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "(galicia.com.ar)" ) ).toBeInTheDocument() ;
    expect( screen.queryByLabelText( "Nombre o Dominio de la Entidad" , { exact: false } ) ).not.toBeInTheDocument() ;
  } ) ;

  it( "13. enviar con marca vinculada llama a createFinancialEntityAction con logo bank, brandDomain y color oficial" , async () => {
    fetchMock.mockImplementation( async ( input ) => {
      const url = String( input ) ;
      if( url.includes( "/api/brand/identidad" ) ) {
        return( {
          ok:   true ,
          json: async () => ( { color: "#FF5500" } ) ,
        } ) ;
      }
      if( url.startsWith( "/api/brand" ) ) {
        return( {
          ok:   true ,
          json: async () => [ { name: "Galicia" , domain: "galicia.com.ar" } ] ,
        } ) ;
      }
      return( { ok: false , json: async () => ( {} ) } ) ;
    } ) ;

    render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    fireEvent.change( selectorPais() , { target: { value: "ar" } } ) ;

    fireEvent.change( inputNombre() , { target: { value: "galicia" } } ) ;
    await act( async () => {
      await vi.advanceTimersByTimeAsync( 500 ) ;
    } ) ;

    await act( async () => {
      fireEvent.click( within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )[0] ) ;
      await vi.runAllTimersAsync() ;
    } ) ;

    await act( async () => {
      fireEvent.click( botonEnviar() ) ;
      await vi.runAllTimersAsync() ;
    } ) ;

    expect( createFinancialEntityAction ).toHaveBeenCalledWith( {
      name:        "Galicia" ,
      logo:        "bank" ,
      brandDomain: "galicia.com.ar" ,
      color:       "#FF5500" ,
    } ) ;
  } ) ;

  it( "14. sin color oficial: /api/brand !ok o sin primaryColor muestra aviso y envía color por defecto #6366f1" , async () => {
    fetchMock.mockImplementation( async ( input ) => {
      const url = String( input ) ;
      if( url.includes( "/api/brand/identidad" ) ) {
        return( {
          ok:   false ,
          json: async () => ( {} ) ,
        } ) ;
      }
      if( url.startsWith( "/api/brand" ) ) {
        return( {
          ok:   true ,
          json: async () => [ { name: "Galicia" , domain: "galicia.com.ar" } ] ,
        } ) ;
      }
      return( { ok: false , json: async () => ( {} ) } ) ;
    } ) ;

    render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    fireEvent.change( selectorPais() , { target: { value: "ar" } } ) ;

    fireEvent.change( inputNombre() , { target: { value: "galicia" } } ) ;
    await act( async () => {
      await vi.advanceTimersByTimeAsync( 500 ) ;
    } ) ;

    await act( async () => {
      fireEvent.click( within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )[0] ) ;
      await vi.runAllTimersAsync() ;
    } ) ;

    expect( screen.getByText( new RegExp( dict.accountsPage.brandColorFetchError ) ) ).toBeInTheDocument() ;

    await act( async () => {
      fireEvent.click( botonEnviar() ) ;
      await vi.runAllTimersAsync() ;
    } ) ;

    expect( createFinancialEntityAction ).toHaveBeenCalledWith( {
      name:        "Galicia" ,
      logo:        "bank" ,
      brandDomain: "galicia.com.ar" ,
      color:       "#6366f1" ,
    } ) ;
  } ) ;

  it( "15. botón Cambiar desvincula la marca y reabre el buscador vacío" , async () => {
    fetchMock.mockImplementation( async ( input ) => {
      const url = String( input ) ;
      if( url.includes( "/api/brand/identidad" ) ) {
        return( {
          ok:   true ,
          json: async () => ( { color: "#FF5500" } ) ,
        } ) ;
      }
      if( url.startsWith( "/api/brand" ) ) {
        return( {
          ok:   true ,
          json: async () => [ { name: "Galicia" , domain: "galicia.com.ar" } ] ,
        } ) ;
      }
      return( { ok: false , json: async () => ( {} ) } ) ;
    } ) ;

    render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    fireEvent.change( selectorPais() , { target: { value: "ar" } } ) ;

    fireEvent.change( inputNombre() , { target: { value: "galicia" } } ) ;
    await act( async () => {
      await vi.advanceTimersByTimeAsync( 500 ) ;
    } ) ;

    await act( async () => {
      fireEvent.click( within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )[0] ) ;
      await vi.runAllTimersAsync() ;
    } ) ;
    expect( screen.queryByLabelText( "Nombre o Dominio de la Entidad" , { exact: false } ) ).not.toBeInTheDocument() ;

    await act( async () => {
      fireEvent.click( screen.getByRole( "button" , { name: "Cambiar" } ) ) ;
    } ) ;

    expect( screen.queryByText( /✨ Marca vinculada:/ ) ).not.toBeInTheDocument() ;
    expect( inputNombre() ).toBeInTheDocument() ;
    expect( inputNombre().value ).toBe( "" ) ;
  } ) ;

  it( "16. sin marca (manual): nombre escrito sin elegir de la lista envía brandDomain null y logo/color elegidos" , async () => {
    render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;

    fireEvent.change( inputNombre() , { target: { value: "Caja Fuerte Casa" } } ) ;
    fireEvent.change( screen.getByLabelText( "Icono / Logo de Respaldo" , { exact: false } ) , { target: { value: "cash" } } ) ;
    fireEvent.change( screen.getByLabelText( "Color de la Entidad" , { exact: false } ) , { target: { value: "#22c55e" } } ) ;

    await act( async () => {
      fireEvent.click( botonEnviar() ) ;
      await vi.runAllTimersAsync() ;
    } ) ;

    expect( createFinancialEntityAction ).toHaveBeenCalledWith( {
      name:        "Caja Fuerte Casa" ,
      logo:        "cash" ,
      brandDomain: null ,
      color:       "#22c55e" ,
    } ) ;
  } ) ;

  it( "17. nombre vacío: muestra error requerido y no llama a la acción del servidor" , async () => {
    const { container } = render( <CreateFinancialEntityForm dict={dict.accountsPage} /> ) ;
    const form = container.querySelector( "form" ) as HTMLFormElement ;

    fireEvent.submit( form ) ;

    expect( screen.getByRole( "alert" ) ).toHaveTextContent( dict.accountsPage.entityRequiredError ) ;
    expect( createFinancialEntityAction ).not.toHaveBeenCalled() ;
  } ) ;

  it( "18. éxito: llama a onSuccess con { id , name } y restablece el formulario" , async () => {
    const onSuccess = vi.fn() ;
    vi.mocked( createFinancialEntityAction ).mockResolvedValue( {
      success: true ,
      value:   { id: "ent-42" , name: "Banco Galicia" } as never ,
    } ) ;

    render( <CreateFinancialEntityForm dict={dict.accountsPage} onSuccess={onSuccess} /> ) ;

    fireEvent.change( inputNombre() , { target: { value: "Banco Galicia" } } ) ;
    await act( async () => {
      fireEvent.click( botonEnviar() ) ;
      await vi.runAllTimersAsync() ;
    } ) ;

    expect( onSuccess ).toHaveBeenCalledWith( { id: "ent-42" , name: "Banco Galicia" } ) ;
    expect( inputNombre().value ).toBe( "" ) ;
  } ) ;

  it( "19. fallo del servidor: muestra mensaje de error y no llama a onSuccess" , async () => {
    const onSuccess = vi.fn() ;
    vi.mocked( createFinancialEntityAction ).mockResolvedValue( {
      success: false ,
      error:   "Error de base de datos" ,
    } ) ;

    render( <CreateFinancialEntityForm dict={dict.accountsPage} onSuccess={onSuccess} /> ) ;

    fireEvent.change( inputNombre() , { target: { value: "Banco Galicia" } } ) ;
    await act( async () => {
      fireEvent.click( botonEnviar() ) ;
      await vi.runAllTimersAsync() ;
    } ) ;

    expect( screen.getByRole( "alert" ) ).toHaveTextContent( "Error de base de datos" ) ;
    expect( onSuccess ).not.toHaveBeenCalled() ;
  } ) ;
} ) ;
