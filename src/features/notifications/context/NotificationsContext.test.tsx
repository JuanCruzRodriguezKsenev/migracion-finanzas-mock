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
import { NotificationsProvider } from "./NotificationsContext" ;
import type { AvisoVista }       from "../types" ;


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

beforeAll( async () => {
  dict = await getDictionary( "es" ) ;
} ) ;

beforeEach( () => {
  vi.clearAllMocks() ;
} ) ;

const avisos: AvisoVista[] = [
  { id: "1" , tipo: "charged_to_holder"    , actor: "Beto" , titular: "Ana" , descripcion: "Súper"    , montoEnCentavos: 120000 , divisa: "ARS" , leida: false , creadaEn: "2026-10-01T12:00:00.000Z" } ,
  { id: "2" , tipo: "transaction_reversed" , actor: "Carla" , titular: "Ana" , descripcion: "Farmacia" , montoEnCentavos: 50000  , divisa: "ARS" , leida: false , creadaEn: "2026-10-02T12:00:00.000Z" } ,
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
    const listar       = vi.fn().mockResolvedValue( { success: true , value: { items: avisos , noLeidas: 2 } } ) ;
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
      { id: "3" , tipo: "debt_created"      , actor: "Ana" , titular: "Ana" , descripcion: "Súper" , montoEnCentavos: 5000 , divisa: "ARS" , leida: false , creadaEn: "2026-10-03T12:00:00.000Z" } ,
      { id: "4" , tipo: "agreement_changed" , actor: "Ana" , titular: null  , descripcion: ""      , montoEnCentavos: null , divisa: null  , leida: false , creadaEn: "2026-10-04T12:00:00.000Z" } ,
    ] ;
    const listar = vi.fn().mockResolvedValue( { success: true , value: { items: nuevos , noLeidas: 2 } } ) ;
    renderCampana( { listar , marcarLeidas: vi.fn().mockResolvedValue( { success: true , value: true } ) } ) ;

    fireEvent.click( await screen.findByRole( "button" , { name: dict.notifications.title } ) ) ;

    expect( await screen.findByText( /te toca/ ) ).toBeDefined() ;
    expect( screen.getByText( /50,00/ ) ).toBeDefined() ;
    expect( screen.getByText( /cambió el acuerdo de la organización/ ) ).toBeDefined() ;
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
    const listar       = vi.fn().mockResolvedValue( { success: true , value: { items: [] , noLeidas: 0 } } ) ;
    const marcarLeidas = vi.fn() ;
    renderCampana( { listar , marcarLeidas } ) ;

    await waitFor( () => expect( listar ).toHaveBeenCalled() ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.notifications.title } ) ) ;

    expect( await screen.findByText( dict.notifications.empty ) ).toBeDefined() ;
    expect( marcarLeidas ).not.toHaveBeenCalled() ;
  } ) ;

  it( "un re-render con otra referencia de listar no vuelve a consultar (regresión del bucle de server actions)" , async () => {
    const respuesta = { success: true , value: { items: avisos , noLeidas: 2 } } ;
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
} ) ;
