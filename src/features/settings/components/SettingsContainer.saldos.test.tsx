// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeAll } from "vitest" ;
import { render , screen , fireEvent }            from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Notifications
import { NotificationsProvider } from "@/features/notifications/context/NotificationsContext" ;

// Feature: Profile
import { ProfileProvider }  from "@/features/profile/context/ProfileContext" ;
import type { ProfileData } from "@/features/profile/types" ;

// Feature: Splits
import type { VistaSaldos } from "@/features/splits/actions/saldosActions" ;

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

const mockProfile: ProfileData = {
  userId: "11111111-1111-4111-8111-111111111111" , phone: null , currency: "ARS" , timezone: "America/Argentina/Buenos_Aires" ,
  bio: null , theme: "light" , defaultView: "dashboard" , fastLogin: true , weeklyStart: "monday" , dateFormat: "DD/MM/YYYY" ,
  numberFormat: "es-AR" , roundAmounts: false , includeTransfers: true , defaultAccount: null ,
  planName: "Básico" , planBilling: "Mensual" , planNextCharge: ""
} ;

describe( "SettingsContainer - pestaña Saldos" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  const vista = ( visible: boolean , rol = "member" ): VistaSaldos => ( { rol , puedeEscribir: ( rol !== "viewer" ) , visible , saldos: [] } ) ;

  const renderizar = ( rol: string , saldos?: VistaSaldos | null ) => (
    render(
      <ProfileProvider initialProfile={mockProfile}>
        <NotificationsProvider>
          <SettingsContainer
            initialTree={[]}
            accounts={[]}
            dict={dict}
            lang="es"
            currentUserId="u-1"
            rol={rol}
            saldos={saldos}
          />
        </NotificationsProvider>
      </ProfileProvider>
    )
  ) ;

  it( "aparece cuando hay actividad, también para un viewer, y muestra el panel" , () => {
    renderizar( "viewer" , vista( true , "viewer" ) ) ;

    fireEvent.click( screen.getByRole( "tab" , { name: dict.settingsPage.tabSaldos } ) ) ;

    expect( screen.getByText( dict.splits.balances.empty ) ).toBeTruthy() ;
  } ) ;

  it( "no aparece si no hay nada que mostrar" , () => {
    renderizar( "owner" , vista( false , "owner" ) ) ;

    expect( screen.queryByRole( "tab" , { name: dict.settingsPage.tabSaldos } ) ).toBeNull() ;
  } ) ;

  it( "no aparece con saldos = null ni sin la prop" , () => {
    const { unmount } = renderizar( "owner" , null ) ;
    expect( screen.queryByRole( "tab" , { name: dict.settingsPage.tabSaldos } ) ).toBeNull() ;
    unmount() ;

    renderizar( "owner" ) ;
    expect( screen.queryByRole( "tab" , { name: dict.settingsPage.tabSaldos } ) ).toBeNull() ;
  } ) ;
} ) ;
