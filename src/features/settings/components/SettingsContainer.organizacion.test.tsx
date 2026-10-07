// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeAll } from "vitest" ;
import { render , screen , fireEvent }            from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Notifications
import { NotificationsProvider } from "@/features/notifications/context/NotificationsContext" ;

// Feature: Settings
import { SettingsContainer } from "./SettingsContainer" ;

// Mocks
vi.mock( "next-auth/react" , () => ( {
  useSession: () => ( { data: null , update: vi.fn() } ) ,
} ) ) ;

vi.mock( "@/features/organizations/actions/organizationActions" , () => ( {
  renombrarOrganizacionAction: vi.fn() ,
  eliminarOrganizacionAction:  vi.fn() ,
} ) ) ;

vi.mock( "@/features/organizations/actions/membersActions" , () => ( {
  listarMiembrosAction:    vi.fn() ,
  invitarMiembroAction:    vi.fn() ,
  revocarInvitacionAction: vi.fn() ,
  quitarMiembroAction:     vi.fn() ,
  cambiarRolAction:        vi.fn() ,
} ) ) ;

vi.mock( "@/features/accounting/actions/categoryActions" , () => ( {
  getCategoryTreeAction:           vi.fn() ,
  createCategoryAction:            vi.fn() ,
  updateCategoryAction:            vi.fn() ,
  archiveCategoryAction:           vi.fn() ,
  unarchiveCategoryAction:         vi.fn() ,
  getCategoryMovementsCountAction: vi.fn() ,
} ) ) ;

describe( "SettingsContainer - pestaña Organización (sólo owner)" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  const renderizar = ( esOwner: boolean ) => (
    render(
      <NotificationsProvider>
        <SettingsContainer
          initialTree={[]}
          accounts={[]}
          dict={dict}
          lang="es"
          esOwner={esOwner}
          miembros={ esOwner ? { miembros: [] , invitaciones: [] } : null }
          currentUserId="u-1"
          organizacion={ { nombre: "Casa" , cantidadOrganizaciones: 2 } }
        />
      </NotificationsProvider>
    )
  ) ;

  it( "con esOwner = false no existe la pestaña Organización" , () => {
    renderizar( false ) ;

    expect( screen.queryByRole( "tab" , { name: dict.settingsPage.tabOrganization } ) ).toBeNull() ;
  } ) ;

  it( "con esOwner = true aparece la pestaña y muestra el panel con la zona de peligro" , () => {
    renderizar( true ) ;

    fireEvent.click( screen.getByRole( "tab" , { name: dict.settingsPage.tabOrganization } ) ) ;

    expect( screen.getByText( dict.organizations.panel.dangerZoneTitle ) ).toBeTruthy() ;
  } ) ;

  it( "con esOwner pero sin datos de la organización la pestaña tampoco existe" , () => {
    render(
      <NotificationsProvider>
        <SettingsContainer initialTree={[]} accounts={[]} dict={dict} lang="es" esOwner miembros={ { miembros: [] , invitaciones: [] } } />
      </NotificationsProvider>
    ) ;

    expect( screen.queryByRole( "tab" , { name: dict.settingsPage.tabOrganization } ) ).toBeNull() ;
  } ) ;
} ) ;
