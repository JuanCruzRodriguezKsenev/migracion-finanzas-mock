// @vitest-environment jsdom
/**
 * @file AddSubscriptionModal.test.tsx
 * Plan 32 (§3.2): Blindaje con pruebas unitarias del modal de suscripciones y su buscador de marcas
 * contra el código vigente, sin modificar código de producción.
 */

// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach , afterEach } from "vitest" ;
import { render , screen , fireEvent , act , waitFor , within }           from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Accounting
import { getCategoryTreeAction } from "@/features/accounting/actions/categoryActions" ;

// Feature: Subscriptions
import { AddSubscriptionModal }  from "./AddSubscriptionModal" ;
import { SubscriptionWithStats } from "../types" ;


vi.mock( "@/features/accounting/actions/categoryActions" , () => ( {
  getCategoryTreeAction: vi.fn().mockResolvedValue( { success: true , value: [] } ) ,
} ) ) ;

describe( "AddSubscriptionModal — buscador de marcas y modal de suscripción" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > >["subscriptionsPage"] ;
  let fetchMock: ReturnType< typeof vi.fn > ;
  const storageMap = new Map< string , string >() ;

  const localStorageMock = {
    getItem:    vi.fn( ( key: string ) => storageMap.get( key ) ?? null ) ,
    setItem:    vi.fn( ( key: string , val: string ) => { storageMap.set( key , String( val ) ) ; } ) ,
    removeItem: vi.fn( ( key: string ) => { storageMap.delete( key ) ; } ) ,
    clear:      vi.fn( () => { storageMap.clear() ; } ) ,
  } ;

  beforeAll( async () => {
    dict = ( await getDictionary( "es" ) ).subscriptionsPage ;
  } ) ;

  beforeEach( () => {
    storageMap.clear() ;
    vi.stubGlobal( "localStorage" , localStorageMock ) ;

    fetchMock = vi.fn().mockImplementation( async () => {
      return( {
        ok:     false ,
        status: 404 ,
        json:   async () => null ,
      } ) ;
    } ) ;
    vi.stubGlobal( "fetch" , fetchMock ) ;
  } ) ;

  afterEach( () => {
    vi.unstubAllGlobals() ;
    vi.clearAllMocks() ;
  } ) ;

  const renderModal = async ( props: Partial< React.ComponentProps< typeof AddSubscriptionModal > > = {} ) => {
    const result = render(
      <AddSubscriptionModal
        open={true}
        onClose={vi.fn()}
        onAdd={vi.fn()}
        dict={dict}
        {...props}
      />
    ) ;
    await waitFor( () => expect( getCategoryTreeAction ).toHaveBeenCalled() ) ;
    return( result ) ;
  } ;

  it( "1. escribir en el buscador filtra localmente y no consulta la red" , async () => {
    await renderModal() ;

    const searchInput = screen.getByPlaceholderText( dict.searchPlaceholder ) ;
    fireEvent.change( searchInput , { target: { value: "net" } } ) ;

    const opciones = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" ) ;
    expect( opciones ).toHaveLength( 3 ) ;
    expect( opciones[0] ).toHaveTextContent( "Netflix" ) ;
    expect( opciones[1] ).toHaveTextContent( `${dict.searchOnlinePrefix} "net"` ) ;
    expect( opciones[2] ).toHaveTextContent( `${dict.customOptionPrefix} "net"` ) ;
    expect( fetchMock ).not.toHaveBeenCalled() ;
  } ) ;

  it( "2. texto sin coincidencias locales muestra únicamente las dos acciones" , async () => {
    await renderModal() ;

    const searchInput = screen.getByPlaceholderText( dict.searchPlaceholder ) ;
    fireEvent.change( searchInput , { target: { value: "zzzz" } } ) ;

    const opciones = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" ) ;
    expect( opciones ).toHaveLength( 2 ) ;
    expect( opciones[0] ).toHaveTextContent( `${dict.searchOnlinePrefix} "zzzz"` ) ;
    expect( opciones[1] ).toHaveTextContent( `${dict.customOptionPrefix} "zzzz"` ) ;
    expect( fetchMock ).not.toHaveBeenCalled() ;
  } ) ;

  it( "3. filtra por dominio y por nombre en marcas populares" , async () => {
    await renderModal() ;
    const searchInput = screen.getByPlaceholderText( dict.searchPlaceholder ) ;

    fireEvent.change( searchInput , { target: { value: "spot" } } ) ;
    let opciones = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" ) ;
    expect( opciones.some( ( opt ) => opt.textContent?.includes( "Spotify" ) ) ).toBe( true ) ;

    fireEvent.change( searchInput , { target: { value: "spotify.com" } } ) ;
    opciones = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" ) ;
    expect( opciones.some( ( opt ) => opt.textContent?.includes( "Spotify" ) ) ).toBe( true ) ;
    expect( fetchMock ).not.toHaveBeenCalled() ;
  } ) ;

  it( "4. elegir una marca con respuesta ok actualiza la vista previa y envía datos enriquecidos" , async () => {
    const onAdd = vi.fn() ;
    fetchMock.mockImplementation( async ( input ) => {
      const url = String( input ) ;
      if( url.includes( "/api/brand/identidad?domain=netflix.com" ) ) {
        return( {
          ok:   true ,
          json: async () => ( {
            nombre:  "Netflix" ,
            dominio: "netflix.com" ,
            color:   "#E50914" ,
            icono:   {
              dataUri: "data:image/png;base64,mockLogoBase64" ,
              ancho:   32 ,
              alto:    32 ,
            } ,
          } ) ,
        } ) ;
      }
      return( { ok: false , json: async () => ( {} ) } ) ;
    } ) ;

    await renderModal( { onAdd } ) ;

    const searchInput = screen.getByPlaceholderText( dict.searchPlaceholder ) ;
    fireEvent.change( searchInput , { target: { value: "net" } } ) ;

    const netflixOption = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )[0] ;
    await act( async () => {
      fireEvent.click( netflixOption ) ;
    } ) ;

    expect( fetchMock ).toHaveBeenCalledWith( "/api/brand/identidad?domain=netflix.com" ) ;
    expect( screen.getByText( dict.previewLabel ) ).toBeInTheDocument() ;

    fireEvent.change( screen.getByLabelText( dict.priceLabel , { exact: false } ) , { target: { value: "15.99" } } ) ;

    const form = document.querySelector( "#add-subscription-form" ) as HTMLFormElement ;
    await act( async () => {
      fireEvent.submit( form ) ;
    } ) ;

    expect( onAdd ).toHaveBeenCalledWith( expect.objectContaining( {
      name:    "Netflix" ,
      logoKey: "data:image/png;base64,mockLogoBase64" ,
      color:   "#E50914" ,
      amount:  1599 ,
    } ) ) ;
  } ) ;

  it( "5. respuesta de identidad sin icono preserva el logo predefinido de la marca y actualiza el color" , async () => {
    const onAdd = vi.fn() ;
    fetchMock.mockImplementation( async ( input ) => {
      const url = String( input ) ;
      if( url.includes( "/api/brand/identidad?domain=netflix.com" ) ) {
        return( {
          ok:   true ,
          json: async () => ( {
            nombre:  "Netflix" ,
            dominio: "netflix.com" ,
            color:   "#FF2222" ,
            icono:   null ,
          } ) ,
        } ) ;
      }
      return( { ok: false , json: async () => ( {} ) } ) ;
    } ) ;

    await renderModal( { onAdd } ) ;

    const searchInput = screen.getByPlaceholderText( dict.searchPlaceholder ) ;
    fireEvent.change( searchInput , { target: { value: "net" } } ) ;

    await act( async () => {
      fireEvent.click( within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )[0] ) ;
    } ) ;

    fireEvent.change( screen.getByLabelText( dict.priceLabel , { exact: false } ) , { target: { value: "10" } } ) ;

    const form = document.querySelector( "#add-subscription-form" ) as HTMLFormElement ;
    await act( async () => {
      fireEvent.submit( form ) ;
    } ) ;

    expect( onAdd ).toHaveBeenCalledWith( expect.objectContaining( {
      logoKey: "https://logo.clearbit.com/netflix.com" ,
      color:   "#FF2222" ,
    } ) ) ;
  } ) ;

  it( "6. elegir una marca sin respuesta exitosa recurre a los valores predefinidos de la lista" , async () => {
    const onAdd = vi.fn() ;
    fetchMock.mockImplementation( async () => ( { ok: false , json: async () => ( {} ) } ) ) ;

    await renderModal( { onAdd } ) ;

    fireEvent.change( screen.getByPlaceholderText( dict.searchPlaceholder ) , { target: { value: "net" } } ) ;

    await act( async () => {
      fireEvent.click( within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )[0] ) ;
    } ) ;

    fireEvent.change( screen.getByLabelText( dict.priceLabel , { exact: false } ) , { target: { value: "10" } } ) ;

    const form = document.querySelector( "#add-subscription-form" ) as HTMLFormElement ;
    await act( async () => {
      fireEvent.submit( form ) ;
    } ) ;

    expect( onAdd ).toHaveBeenCalledWith( expect.objectContaining( {
      name:    "Netflix" ,
      logoKey: "https://logo.clearbit.com/netflix.com" ,
      color:   "#E50914" ,
    } ) ) ;
  } ) ;

  it( "7. buscar en la web consulta marcas mediante /api/brand y muestra sugerencias online" , async () => {
    fetchMock.mockImplementation( async ( input ) => {
      const url = String( input ) ;
      if( url.includes( "/api/brand?q=bbva" ) ) {
        return( {
          ok:   true ,
          json: async () => [
            { name: "BBVA Francés" , domain: "bbva.com.ar" , icon: "https://cdn.bbva.com/frances.png" } ,
            { name: "BBVA Global"  , domain: "bbva.com"    , icon: "https://cdn.bbva.com/global.png" } ,
          ] ,
        } ) ;
      }
      return( { ok: false , json: async () => ( {} ) } ) ;
    } ) ;

    await renderModal() ;

    fireEvent.change( screen.getByPlaceholderText( dict.searchPlaceholder ) , { target: { value: "bbva" } } ) ;

    const searchOnlineBtn = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )[0] ;
    await act( async () => {
      fireEvent.click( searchOnlineBtn ) ;
    } ) ;

    const urls = fetchMock.mock.calls.map( ( [ url ] ) => String( url ) ) ;
    expect( urls.some( ( u ) => u.includes( "/api/brand?q=bbva" ) ) ).toBe( true ) ;
    expect( urls.some( ( u ) => u.includes( "brandfetch" ) ) ).toBe( false ) ;

    const opciones = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" ) ;
    expect( opciones[0] ).toHaveTextContent( "BBVA Francés" ) ;
    expect( opciones[1] ).toHaveTextContent( "BBVA Global" ) ;
    expect( opciones[2] ).toHaveTextContent( `${dict.customOptionPrefix} "bbva"` ) ;
    expect( opciones ).toHaveLength( 3 ) ;
  } ) ;

  it( "8. texto con espacios consulta /api/brand con query codificada sin consultar Brandfetch" , async () => {
    fetchMock.mockImplementation( async ( input ) => {
      const url = String( input ) ;
      if( url.includes( "/api/brand?q=" ) ) {
        return( {
          ok:   true ,
          json: async () => [ { name: "Mercado Pago" , domain: "mercadopago.com" } ] ,
        } ) ;
      }
      return( { ok: false , json: async () => ( {} ) } ) ;
    } ) ;

    await renderModal() ;

    fireEvent.change( screen.getByPlaceholderText( dict.searchPlaceholder ) , { target: { value: "mercado pago" } } ) ;

    const searchOnlineBtn = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )[0] ;
    await act( async () => {
      fireEvent.click( searchOnlineBtn ) ;
    } ) ;

    const urls = fetchMock.mock.calls.map( ( [ url ] ) => String( url ) ) ;
    expect( urls.some( ( u ) => u.includes( "/api/brand?q=mercado" ) ) ).toBe( true ) ;
    expect( urls.some( ( u ) => u.includes( "brandfetch" ) ) ).toBe( false ) ;
  } ) ;

  it( "9. texto con dominio consulta /api/brand con el dominio exacto" , async () => {
    fetchMock.mockImplementation( async ( input ) => {
      const url = String( input ) ;
      if( url.includes( "/api/brand?q=" ) ) {
        return( {
          ok:   true ,
          json: async () => [ { name: "BBVA" , domain: "bbva.com" } ] ,
        } ) ;
      }
      return( { ok: false , json: async () => ( {} ) } ) ;
    } ) ;

    await renderModal() ;

    fireEvent.change( screen.getByPlaceholderText( dict.searchPlaceholder ) , { target: { value: "bbva.com" } } ) ;

    const searchOnlineBtn = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )[0] ;
    await act( async () => {
      fireEvent.click( searchOnlineBtn ) ;
    } ) ;

    const calls = fetchMock.mock.calls
      .map( ( [ url ] ) => String( url ) )
      .filter( ( u ) => u.includes( "/api/brand?q=" ) ) ;

    expect( calls ).toHaveLength( 1 ) ;
    expect( calls[0] ).toContain( "q=bbva.com" ) ;
  } ) ;

  it( "10. sin resultados en la web cae directo a opción personalizada con el nombre buscado" , async () => {
    fetchMock.mockImplementation( async () => ( { ok: false , json: async () => [] } ) ) ;

    await renderModal() ;

    fireEvent.change( screen.getByPlaceholderText( dict.searchPlaceholder ) , { target: { value: "desconocido" } } ) ;

    const searchOnlineBtn = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )[0] ;
    await act( async () => {
      fireEvent.click( searchOnlineBtn ) ;
    } ) ;

    expect( screen.getByLabelText( dict.nameLabel , { exact: false } ) ).toHaveValue( "desconocido" ) ;
  } ) ;

  it( "11. seleccionar opción personalizada asigna logo gym y color predeterminado" , async () => {
    const onAdd = vi.fn() ;
    await renderModal( { onAdd } ) ;

    fireEvent.change( screen.getByPlaceholderText( dict.searchPlaceholder ) , { target: { value: "mi gimnasio" } } ) ;

    const customBtn = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )[1] ;
    await act( async () => {
      fireEvent.click( customBtn ) ;
    } ) ;

    fireEvent.change( screen.getByLabelText( dict.priceLabel , { exact: false } ) , { target: { value: "50" } } ) ;

    const form = document.querySelector( "#add-subscription-form" ) as HTMLFormElement ;
    await act( async () => {
      fireEvent.submit( form ) ;
    } ) ;

    expect( onAdd ).toHaveBeenCalledWith( expect.objectContaining( {
      name:    "mi gimnasio" ,
      logoKey: "gym" ,
      color:   "#DBEAFE" ,
      amount:  5000 ,
    } ) ) ;
  } ) ;

  it( "12. cambiar de país persiste en almacenamiento y altera la búsqueda con parámetro de país" , async () => {
    fetchMock.mockImplementation( async ( input ) => {
      const url = String( input ) ;
      if( url.includes( "/api/brand" ) ) {
        return( {
          ok:   true ,
          json: async () => [ { name: "Renfe" , domain: "renfe.es" } ] ,
        } ) ;
      }
      return( { ok: false , json: async () => null } ) ;
    } ) ;

    const { unmount } = await renderModal() ;

    const selectorPais = screen.getByLabelText( dict.countryLabel ) ;
    fireEvent.change( selectorPais , { target: { value: "ES" } } ) ;

    expect( localStorageMock.setItem ).toHaveBeenCalledWith( "finanzia-subscriptions-country" , "ES" ) ;

    fireEvent.change( screen.getByPlaceholderText( dict.searchPlaceholder ) , { target: { value: "renfe" } } ) ;

    const searchOnlineBtn = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )[0] ;
    await act( async () => {
      fireEvent.click( searchOnlineBtn ) ;
    } ) ;

    const urls = fetchMock.mock.calls.map( ( [ url ] ) => String( url ) ) ;
    expect( urls.some( ( u ) => u.includes( "/api/brand" ) && ( u.includes( "pais=es" ) || u.includes( "pais=ES" ) ) ) ).toBe( true ) ;

    unmount() ;

    // Segundo caso: con almacenamiento previo MX arranca en México
    localStorageMock.getItem.mockReturnValueOnce( "MX" ) ;
    await renderModal() ;
    expect( screen.getByLabelText( dict.countryLabel ) ).toHaveValue( "MX" ) ;
  } ) ;

  it( "13. validación: nombre requerido y precio mayor a 0 bloquean el envío" , async () => {
    const onAdd = vi.fn() ;
    await renderModal( { onAdd } ) ;

    const form = document.querySelector( "#add-subscription-form" ) as HTMLFormElement ;

    // 1. Envío sin nombre
    await act( async () => {
      fireEvent.submit( form ) ;
    } ) ;
    expect( screen.getByText( dict.errorNameRequired ) ).toBeInTheDocument() ;
    expect( onAdd ).not.toHaveBeenCalled() ;

    // 2. Con nombre pero sin precio (o precio 0)
    fireEvent.change( screen.getByLabelText( dict.nameLabel , { exact: false } ) , { target: { value: "Gym" } } ) ;
    fireEvent.change( screen.getByLabelText( dict.priceLabel , { exact: false } ) , { target: { value: "0" } } ) ;

    await act( async () => {
      fireEvent.submit( form ) ;
    } ) ;
    expect( screen.getByText( dict.errorPriceRequired ) ).toBeInTheDocument() ;
    expect( onAdd ).not.toHaveBeenCalled() ;
  } ) ;

  it( "14. montar en edición no dispara consultas de red innecesarias" , async () => {
    const editingRemoto = {
      id:          "sub-1" ,
      name:        "Netflix" ,
      amount:      1599 ,
      frequency:   "monthly" ,
      logoKey:     "https://logo.clearbit.com/netflix.com" ,
      color:       "#E50914" ,
      categoryId:  null ,
      createdAt:   new Date().toISOString() ,
      monthlyCost: 1599 ,
      yearlyCost:  19188 ,
    } as unknown as SubscriptionWithStats ;

    await renderModal( { editingData: editingRemoto } ) ;
    expect( fetchMock ).not.toHaveBeenCalled() ;
  } ) ;

  it( "15. seleccionar marca encontrada en búsqueda online consulta /api/brand/identidad" , async () => {
    fetchMock.mockImplementation( async ( input ) => {
      const url = String( input ) ;
      if( url.includes( "/api/brand?q=bbva" ) ) {
        return( {
          ok:   true ,
          json: async () => [
            { name: "BBVA" , domain: "bbva.com" , icon: "https://cdn.bbva.com/logo.png" } ,
          ] ,
        } ) ;
      }
      if( url.includes( "/api/brand/identidad?domain=bbva.com" ) ) {
        return( {
          ok:   true ,
          json: async () => ( {
            nombre:  "BBVA" ,
            dominio: "bbva.com" ,
            color:   "#004481" ,
            icono:   { dataUri: "data:image/png;base64,bbvaIcon" } ,
          } ) ,
        } ) ;
      }
      return( { ok: false , json: async () => ( {} ) } ) ;
    } ) ;

    await renderModal() ;

    fireEvent.change( screen.getByPlaceholderText( dict.searchPlaceholder ) , { target: { value: "bbva" } } ) ;

    const searchOnlineBtn = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )[0] ;
    await act( async () => {
      fireEvent.click( searchOnlineBtn ) ;
    } ) ;

    const bbvaOption = within( screen.getByRole( "listbox" ) ).getAllByRole( "option" )[0] ;
    await act( async () => {
      fireEvent.click( bbvaOption ) ;
    } ) ;

    expect( fetchMock ).toHaveBeenCalledWith( "/api/brand/identidad?domain=bbva.com" ) ;
    expect( screen.getByLabelText( dict.nameLabel , { exact: false } ) ).toHaveValue( "BBVA" ) ;
  } ) ;
} ) ;
