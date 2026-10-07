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

vi.mock( "@/features/organizations/actions/habilitacionesActions" , () => ( {
  listarHabilitacionesAction: vi.fn() ,
  otorgarHabilitacionAction:  vi.fn() ,
  revocarHabilitacionAction:  vi.fn() ,
} ) ) ;

vi.mock( "@/features/accounting/actions/categoryActions" , () => ( {
  getCategoryTreeAction:           vi.fn() ,
  createCategoryAction:            vi.fn() ,
  updateCategoryAction:            vi.fn() ,
  archiveCategoryAction:           vi.fn() ,
  unarchiveCategoryAction:         vi.fn() ,
  getCategoryMovementsCountAction: vi.fn() ,
} ) ) ;

describe( "SettingsContainer - pestaña Habilitaciones (owner y member, no viewer)" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  const habilitaciones = {
    otorgadas:  [] ,
    candidatos: [ { userId: "u-beto" , nombre: "Beto" } ] ,
    recibidas:  [] ,
  } ;

  const renderizar = ( rol: string , conDatos = true ) => (
    render(
      <NotificationsProvider>
        <SettingsContainer
          initialTree={[]}
          accounts={[]}
          dict={dict}
          lang="es"
          currentUserId="u-1"
          rol={rol}
          habilitaciones={ conDatos ? habilitaciones : null }
        />
      </NotificationsProvider>
    )
  ) ;

  it( "un member ve la pestaña y su panel" , () => {
    renderizar( "member" ) ;

    fireEvent.click( screen.getByRole( "tab" , { name: dict.settingsPage.tabHabilitaciones } ) ) ;

    expect( screen.getByText( dict.habilitaciones.title ) ).toBeTruthy() ;
  } ) ;

  it( "un owner también la ve" , () => {
    renderizar( "owner" ) ;

    expect( screen.getByRole( "tab" , { name: dict.settingsPage.tabHabilitaciones } ) ).toBeTruthy() ;
  } ) ;

  it( "un viewer no la ve" , () => {
    renderizar( "viewer" ) ;

    expect( screen.queryByRole( "tab" , { name: dict.settingsPage.tabHabilitaciones } ) ).toBeNull() ;
  } ) ;

  it( "sin rol informado no aparece (por defecto, oculta)" , () => {
    renderizar( "" ) ;

    expect( screen.queryByRole( "tab" , { name: dict.settingsPage.tabHabilitaciones } ) ).toBeNull() ;
  } ) ;

  it( "sin datos de habilitaciones no aparece aunque el rol sea member" , () => {
    renderizar( "member" , false ) ;

    expect( screen.queryByRole( "tab" , { name: dict.settingsPage.tabHabilitaciones } ) ).toBeNull() ;
  } ) ;
} ) ;
