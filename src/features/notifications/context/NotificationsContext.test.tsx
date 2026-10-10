// @vitest-environment jsdom
/**
 * @file NotificationsContext.test.tsx
 * La campana real (PageHeader + NotificationsProvider + NotificationsDropdown) con diccionario real
 * y las acciones de servidor inyectadas por props.
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor }               from "@testing-library/react" ;
import React                                                   from "react" ;

// Shared
import { PageHeader }    from "@/shared/ui/layout/PageHeader/PageHeader" ;
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Profile
import { ProfileProvider } from "@/features/profile/context/ProfileContext" ;
import type { ProfileData } from "@/features/profile/types" ;

// Feature: Notifications
import type { AvisoVista , OrganizacionDeAvisos } from "../types" ;
import { NotificationsProvider }                 from "./NotificationsContext" ;


vi.mock( "next/navigation" , () => ( {
  useRouter:       () => ( { push: vi.fn() , replace: vi.fn() , refresh: vi.fn() } ) ,
  usePathname:     () => "/es" ,
  useSearchParams: () => new URLSearchParams()
} ) ) ;

const mockProfile: ProfileData = {
  userId: "11111111-1111-4111-8111-111111111111" , phone: null , currency: "ARS" , timezone: "America/Argentina/Buenos_Aires" ,
  bio: null , theme: "light" , defaultView: "dashboard" , fastLogin: true , weeklyStart: "monday" , dateFormat: "DD/MM/YYYY" ,
  numberFormat: "es-AR" , roundAmounts: false , includeTransfers: true , defaultAccount: null ,
  planName: "Básico" , planBilling: "Mensual" , planNextCharge: ""
} ;

let dict: Awaited< ReturnType< typeof getDictionary > > ;

const storageMock = (() => {
  let store: Record< string , string > = {} ;
  return( {
    getItem:    vi.fn( ( key: string ) => store[key] ?? null ) ,
    setItem:    vi.fn( ( key: string , val: string ) => { store[key] = val ; } ) ,
    removeItem: vi.fn( ( key: string ) => { delete store[key] ; } ) ,
    clear:      vi.fn( () => { store = {} ; } ) ,
  } ) ;
})() ;

beforeAll( async () => {
  dict = await getDictionary( "es" ) ;
  vi.stubGlobal( "localStorage" , storageMock ) ;
} ) ;

beforeEach( () => {
  vi.clearAllMocks() ;
  storageMock.clear() ;
} ) ;

const avisos: AvisoVista[] = [
  { id: "1" , tipo: "charged_to_holder"    , actor: "Beto"  , titular: "Ana" , descripcion: "Súper"    , montoEnCentavos: 120000 , divisa: "ARS" , leida: false , creadaEn: "2026-10-01T12:00:00.000Z" , organizacionId: "org-1" , organizacionNombre: "Casa" , organizacionEsPersonal: false } ,
  { id: "2" , tipo: "transaction_reversed" , actor: "Carla" , titular: "Ana" , descripcion: "Farmacia" , montoEnCentavos: 50000  , divisa: "ARS" , leida: false , creadaEn: "2026-10-02T12:00:00.000Z" , organizacionId: "org-1" , organizacionNombre: "Casa" , organizacionEsPersonal: false } ,
] ;

const orgsDemo: OrganizacionDeAvisos[] = [
  { id: "org-p" , nombre: "Personal" , esPersonal: true  } ,
  { id: "org-1" , nombre: "Casa"     , esPersonal: false } ,
] ;

function renderCampana( props: Omit< React.ComponentProps< typeof NotificationsProvider > , "children" > ) {
  return( render(
    <ProfileProvider initialProfile={mockProfile}>
      <NotificationsProvider {...props}>
        <PageHeader title="Inicio" dict={dict} lang="es" />
      </NotificationsProvider>
    </ProfileProvider>
  ) ) ;
}

describe( "campana de avisos" , () => {
  it( "con listar inyectado muestra el contador 2 y, al abrir, los textos y marca como leídos" , async () => {
    const listar       = vi.fn().mockResolvedValue( { success: true , value: { items: avisos , noLeidas: 2 , organizaciones: [ { id: "org-1" , nombre: "Casa" , esPersonal: false } ] } } ) ;
    const marcarLeidas = vi.fn().mockResolvedValue( { success: true , value: true } ) ;
    renderCampana( { listar , marcarLeidas } ) ;

    const boton = await screen.findByRole( "button" , { name: dict.notifications.title } ) ;
    await waitFor( () => expect( boton.textContent ).toContain( "2" ) ) ;
    expect( marcarLeidas ).not.toHaveBeenCalled() ;

    fireEvent.click( boton ) ;

    expect( await screen.findByText( "Beto" ) ).toBeDefined() ;
    expect( screen.getByText( "Carla" ) ).toBeDefined() ;
    expect( screen.getByText( "Súper" ) ).toBeDefined() ;
    expect( screen.getByText( /1\.200,00/ ) ).toBeDefined() ;
    expect( screen.getByText( /500,00/ ) ).toBeDefined() ;
    expect( screen.getAllByRole( "img" , { name: dict.notifications.unreadAria } ) ).toHaveLength( 2 ) ;

    await waitFor( () => expect( marcarLeidas ).toHaveBeenCalledTimes( 1 ) ) ;
    await waitFor( () => expect( boton.textContent ).not.toContain( "2" ) ) ;
  } ) ;

  it( "los avisos de deuda y de cambio de acuerdo se muestran con sus plantillas" , async () => {
    const nuevos: AvisoVista[] = [
      { id: "3" , tipo: "debt_created"      , actor: "Ana" , titular: "Ana" , descripcion: "Súper" , montoEnCentavos: 5000 , divisa: "ARS" , leida: false , creadaEn: "2026-10-03T12:00:00.000Z" , organizacionId: "org-1" , organizacionNombre: "Casa" , organizacionEsPersonal: false } ,
      { id: "4" , tipo: "agreement_changed" , actor: "Ana" , titular: null  , descripcion: ""      , montoEnCentavos: null , divisa: null  , leida: false , creadaEn: "2026-10-04T12:00:00.000Z" , organizacionId: "org-1" , organizacionNombre: "Casa" , organizacionEsPersonal: false } ,
    ] ;
    const listar = vi.fn().mockResolvedValue( { success: true , value: { items: nuevos , noLeidas: 2 , organizaciones: [ { id: "org-1" , nombre: "Casa" , esPersonal: false } ] } } ) ;
    renderCampana( { listar , marcarLeidas: vi.fn().mockResolvedValue( { success: true , value: true } ) } ) ;

    fireEvent.click( await screen.findByRole( "button" , { name: dict.notifications.title } ) ) ;

    expect( await screen.findByText( /te toca/ ) ).toBeDefined() ;
    expect( screen.getByText( /50,00/ ) ).toBeDefined() ;
    expect( screen.getByText( /cambió el acuerdo de la organización/ ) ).toBeDefined() ;
  } ) ;

  it( "los avisos de solicitud y de pago registrado muestran actor y monto; un tipo desconocido no se muestra" , async () => {
    const nuevos: AvisoVista[] = [
      { id: "5" , tipo: "payment_requested" , actor: "Ana"   , titular: null , descripcion: "" , montoEnCentavos: 480000 , divisa: "ARS" , leida: false , creadaEn: "2026-10-05T12:00:00.000Z" , organizacionId: "org-1" , organizacionNombre: "Casa" , organizacionEsPersonal: false } ,
      { id: "6" , tipo: "payment_received"  , actor: "Carla" , titular: null , descripcion: "" , montoEnCentavos: 20000  , divisa: "ARS" , leida: false , creadaEn: "2026-10-06T12:00:00.000Z" , organizacionId: "org-1" , organizacionNombre: "Casa" , organizacionEsPersonal: false } ,
      { id: "7" , tipo: "tipo_inventado"    , actor: "Zeta"  , titular: null , descripcion: "" , montoEnCentavos: null   , divisa: null  , leida: false , creadaEn: "2026-10-07T12:00:00.000Z" , organizacionId: "org-1" , organizacionNombre: "Casa" , organizacionEsPersonal: false } ,
    ] ;
    const listar = vi.fn().mockResolvedValue( { success: true , value: { items: nuevos , noLeidas: 3 , organizaciones: [ { id: "org-1" , nombre: "Casa" , esPersonal: false } ] } } ) ;
    renderCampana( { listar , marcarLeidas: vi.fn().mockResolvedValue( { success: true , value: true } ) } ) ;

    fireEvent.click( await screen.findByRole( "button" , { name: dict.notifications.title } ) ) ;

    expect( await screen.findByText( /te solicitó un pago de/ ) ).toBeDefined() ;
    expect( screen.getByText( "Ana" ) ).toBeDefined() ;
    expect( screen.getByText( /4\.800,00/ ) ).toBeDefined() ;
    expect( screen.getByText( /registró un pago de/ ) ).toBeDefined() ;
    expect( screen.getByText( "Carla" ) ).toBeDefined() ;
    expect( screen.getByText( /200,00/ ) ).toBeDefined() ;
    expect( screen.queryByText( "Zeta" ) ).toBeNull() ;
  } ) ;

  it( "sin listar inyectado no consulta nada: contador 0 y lista vacía" , async () => {
    renderCampana( {} ) ;

    const boton = screen.getByRole( "button" , { name: dict.notifications.title } ) ;
    expect( boton.textContent ).toBe( "" ) ;

    fireEvent.click( boton ) ;

    expect( await screen.findByText( dict.notifications.empty ) ).toBeDefined() ;
  } ) ;

  it( "si listar responde fail (sin sesión) la campana queda vacía y no lanza" , async () => {
    const listar = vi.fn().mockResolvedValue( { success: false , error: "No autorizado" } ) ;
    renderCampana( { listar } ) ;

    await waitFor( () => expect( listar ).toHaveBeenCalledTimes( 1 ) ) ;
    const boton = screen.getByRole( "button" , { name: dict.notifications.title } ) ;
    expect( boton.textContent ).toBe( "" ) ;
  } ) ;

  it( "abrir sin avisos no pide marcar leídos" , async () => {
    const listar       = vi.fn().mockResolvedValue( { success: true , value: { items: [] , noLeidas: 0 , organizaciones: [] } } ) ;
    const marcarLeidas = vi.fn() ;
    renderCampana( { listar , marcarLeidas } ) ;

    await waitFor( () => expect( listar ).toHaveBeenCalled() ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.notifications.title } ) ) ;

    expect( await screen.findByText( dict.notifications.empty ) ).toBeDefined() ;
    expect( marcarLeidas ).not.toHaveBeenCalled() ;
  } ) ;

  it( "un re-render con otra referencia de listar no vuelve a consultar (regresión del bucle de server actions)" , async () => {
    const respuesta = { success: true , value: { items: avisos , noLeidas: 2 , organizaciones: [ { id: "org-1" , nombre: "Casa" , esPersonal: false } ] } } ;
    const primera   = vi.fn().mockResolvedValue( respuesta ) ;
    const segunda   = vi.fn().mockResolvedValue( respuesta ) ;

    const vista = renderCampana( { listar: primera } ) ;
    await waitFor( () => expect( primera ).toHaveBeenCalledTimes( 1 ) ) ;

    vista.rerender(
      <ProfileProvider initialProfile={mockProfile}>
        <NotificationsProvider listar={segunda}>
          <PageHeader title="Inicio" dict={dict} lang="es" />
        </NotificationsProvider>
      </ProfileProvider>
    ) ;
    await new Promise( ( r ) => setTimeout( r , 50 ) ) ;

    expect( primera ).toHaveBeenCalledTimes( 1 ) ;
    expect( segunda ).not.toHaveBeenCalled() ;
  } ) ;

  it( "el select de organizaciones no aparece con una sola organización" , async () => {
    const listar = vi.fn().mockResolvedValue( {
      success: true ,
      value:   { items: avisos , noLeidas: 2 , organizaciones: [ { id: "org-1" , nombre: "Casa" , esPersonal: false } ] } ,
    } ) ;
    renderCampana( { listar } ) ;

    fireEvent.click( await screen.findByRole( "button" , { name: dict.notifications.title } ) ) ;

    expect( screen.queryByRole( "combobox" , { name: dict.notifications.filterLabel } ) ).toBeNull() ;
  } ) ;

  it( "con dos organizaciones cambiar el filtro llama a listar con organizacionId una sola vez" , async () => {
    const avisoPersonal: AvisoVista = {
      id: "p1" , tipo: "charged_to_holder" , actor: "Ana" , titular: "Ana" , descripcion: "Farmacia" ,
      montoEnCentavos: 3000 , divisa: "ARS" , leida: false , creadaEn: "2026-10-08T12:00:00.000Z" ,
      organizacionId: "org-p" , organizacionNombre: "Personal" , organizacionEsPersonal: true ,
    } ;

    const listar = vi.fn().mockImplementation( ( filtro?: { organizacionId?: string } ) => {
      const items = ( filtro?.organizacionId === "org-1" )
        ? avisos
        : ( filtro?.organizacionId === "org-p" ? [ avisoPersonal ] : [ ...avisos , avisoPersonal ] ) ;
      return( Promise.resolve( {
        success: true ,
        value:   { items , noLeidas: 3 , organizaciones: orgsDemo } ,
      } ) ) ;
    } ) ;

    renderCampana( { listar } ) ;

    fireEvent.click( await screen.findByRole( "button" , { name: dict.notifications.title } ) ) ;

    const select = await screen.findByRole( "combobox" , { name: dict.notifications.filterLabel } ) ;
    expect( select ).toBeDefined() ;
    expect( listar ).toHaveBeenCalledTimes( 1 ) ;
    expect( listar ).toHaveBeenLastCalledWith( undefined ) ;

    fireEvent.change( select , { target: { value: "org-1" } } ) ;

    await waitFor( () => expect( listar ).toHaveBeenCalledTimes( 2 ) ) ;
    expect( listar ).toHaveBeenLastCalledWith( { organizacionId: "org-1" } ) ;
  } ) ;

  it( "el filtro se guarda en localStorage y se restaura al remontar" , async () => {
    const listar = vi.fn().mockResolvedValue( {
      success: true ,
      value:   { items: avisos , noLeidas: 2 , organizaciones: orgsDemo } ,
    } ) ;

    const primera = renderCampana( { listar } ) ;
    fireEvent.click( await screen.findByRole( "button" , { name: dict.notifications.title } ) ) ;
    const select = await screen.findByRole( "combobox" , { name: dict.notifications.filterLabel } ) ;

    fireEvent.change( select , { target: { value: "org-1" } } ) ;
    expect( storageMock.getItem( "finanzia.avisos.filtroOrg" ) ).toBe( "org-1" ) ;

    primera.unmount() ;

    const listarRemonte = vi.fn().mockResolvedValue( {
      success: true ,
      value:   { items: avisos , noLeidas: 2 , organizaciones: orgsDemo } ,
    } ) ;

    renderCampana( { listar: listarRemonte } ) ;

    await waitFor( () => expect( listarRemonte ).toHaveBeenCalledWith( { organizacionId: "org-1" } ) ) ;
  } ) ;

  it( "si el id guardado en localStorage no existe entre las organizaciones vuelve a Todas" , async () => {
    storageMock.setItem( "finanzia.avisos.filtroOrg" , "org-abandonada" ) ;

    const listar = vi.fn().mockImplementation( ( filtro?: { organizacionId?: string } ) => {
      if( filtro?.organizacionId === "org-abandonada" ) {
        return( Promise.resolve( { success: false , error: "Organización inválida." } ) ) ;
      }
      return( Promise.resolve( {
        success: true ,
        value:   { items: avisos , noLeidas: 2 , organizaciones: orgsDemo } ,
      } ) ) ;
    } ) ;

    renderCampana( { listar } ) ;

    await waitFor( () => expect( storageMock.getItem( "finanzia.avisos.filtroOrg" ) ).toBeNull() ) ;
    await waitFor( () => expect( listar ).toHaveBeenCalledWith( undefined ) ) ;
  } ) ;

  it( "localStorage que lanza no rompe el render" , async () => {
    storageMock.getItem.mockImplementationOnce( () => {
      throw( new Error( "SecurityError" ) ) ;
    } ) ;

    const listar = vi.fn().mockResolvedValue( {
      success: true ,
      value:   { items: avisos , noLeidas: 2 , organizaciones: orgsDemo } ,
    } ) ;

    renderCampana( { listar } ) ;

    const boton = await screen.findByRole( "button" , { name: dict.notifications.title } ) ;
    expect( boton ).toBeDefined() ;
  } ) ;

  it( "el nombre de la organización aparece en cada aviso sólo en Todas" , async () => {
    const avisoPersonal: AvisoVista = {
      id: "p1" , tipo: "charged_to_holder" , actor: "Ana" , titular: "Ana" , descripcion: "Farmacia" ,
      montoEnCentavos: 3000 , divisa: "ARS" , leida: false , creadaEn: "2026-10-08T12:00:00.000Z" ,
      organizacionId: "org-p" , organizacionNombre: "Personal" , organizacionEsPersonal: true ,
    } ;

    const listar = vi.fn().mockImplementation( ( filtro?: { organizacionId?: string } ) => {
      const items = ( filtro?.organizacionId === "org-1" )
        ? avisos
        : [ ...avisos , avisoPersonal ] ;
      return( Promise.resolve( {
        success: true ,
        value:   { items , noLeidas: 3 , organizaciones: orgsDemo } ,
      } ) ) ;
    } ) ;

    renderCampana( { listar } ) ;

    fireEvent.click( await screen.findByRole( "button" , { name: dict.notifications.title } ) ) ;

    const tagsAntes = ( await screen.findAllByRole( "listitem" ) ).map( ( c ) => c.querySelector( "[class*='cardOrg']" )?.textContent ) ;
    expect( tagsAntes ).toContain( "Personal" ) ;
    expect( tagsAntes ).toContain( "Casa" ) ;

    const select = screen.getByRole( "combobox" , { name: dict.notifications.filterLabel } ) ;
    fireEvent.change( select , { target: { value: "org-1" } } ) ;

    await waitFor( () => {
      const cards = screen.getAllByRole( "listitem" ) ;
      expect( cards ).toHaveLength( 2 ) ;
      cards.forEach( ( card ) => {
        expect( card.querySelector( "[class*='cardOrg']" ) ).toBeNull() ;
      } ) ;
    } ) ;
  } ) ;

  it( "RN-36: ningún aviso es clicable y la organización activa no cambia" , async () => {
    const listar = vi.fn().mockResolvedValue( {
      success: true ,
      value:   { items: avisos , noLeidas: 2 , organizaciones: orgsDemo } ,
    } ) ;

    renderCampana( { listar } ) ;

    fireEvent.click( await screen.findByRole( "button" , { name: dict.notifications.title } ) ) ;

    const items = await screen.findAllByRole( "listitem" ) ;
    expect( items.length ).toBeGreaterThan( 0 ) ;

    items.forEach( ( item ) => {
      expect( item.tagName.toLowerCase() ).toBe( "li" ) ;
      expect( item.getAttribute( "role" ) ).toBeNull() ;
      expect( item.querySelector( "a" ) ).toBeNull() ;
      expect( item.querySelector( "button" ) ).toBeNull() ;
    } ) ;
  } ) ;
} ) ;
