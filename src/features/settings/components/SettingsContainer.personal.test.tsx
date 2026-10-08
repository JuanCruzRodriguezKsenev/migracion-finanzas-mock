// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeAll } from "vitest" ;
import { render , screen }                         from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Notifications
import { NotificationsProvider } from "@/features/notifications/context/NotificationsContext" ;

// Feature: Profile
import { ProfileProvider }  from "@/features/profile/context/ProfileContext" ;
import type { ProfileData } from "@/features/profile/types" ;

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

describe( "SettingsContainer — espacio Personal (AC-12, RN-16)" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  const renderizar = ( esPersonal: boolean ) => (
    render(
      <ProfileProvider initialProfile={mockProfile}>
        <NotificationsProvider>
          <SettingsContainer
            initialTree={[]}
            accounts={[]}
            dict={dict}
            lang="es"
            currentUserId="u-1"
            rol="owner"
            esOwner={true}
            miembros={ { miembros: [ { userId: "u-1" , nombre: "Juan" , email: "juan@ejemplo.com" , rol: "owner" } ] , invitaciones: [] } }
            organizacion={ { nombre: "Personal" , cantidadOrganizaciones: 2 } }
            habilitaciones={ { recibidas: [] , otorgadas: [] , miembros: [] } as never }
            acuerdo={ { rol: "owner" , puedeEscribir: true } as never }
            saldos={ { rol: "owner" , puedeEscribir: true , visible: true , saldos: [] } }
            caja={ { visible: true } as never }
            esPersonal={esPersonal}
          />
        </NotificationsProvider>
      </ProfileProvider>
    )
  ) ;

  const tab = ( nombre: string ) => screen.queryByRole( "tab" , { name: nombre } ) ;

  it( "en una organización común, el owner ve todas las pestañas de gestión" , () => {
    renderizar( false ) ;

    expect( tab( dict.settingsPage.tabOrganization ) ).not.toBeNull() ;
    expect( tab( dict.settingsPage.tabHabilitaciones ) ).not.toBeNull() ;
    expect( tab( dict.settingsPage.tabAcuerdo ) ).not.toBeNull() ;
    expect( tab( dict.settingsPage.tabSaldos ) ).not.toBeNull() ;
    expect( tab( dict.settingsPage.tabCaja ) ).not.toBeNull() ;
  } ) ;

  it( "AC-12: en Personal no hay Organización, Habilitaciones, Acuerdo, Saldos ni Caja; sí Miembros, Categorías y Plan contable" , () => {
    renderizar( true ) ;

    expect( tab( dict.settingsPage.tabOrganization ) ).toBeNull() ;
    expect( tab( dict.settingsPage.tabHabilitaciones ) ).toBeNull() ;
    expect( tab( dict.settingsPage.tabAcuerdo ) ).toBeNull() ;
    expect( tab( dict.settingsPage.tabSaldos ) ).toBeNull() ;
    expect( tab( dict.settingsPage.tabCaja ) ).toBeNull() ;

    expect( tab( dict.settingsPage.tabMembers ) ).not.toBeNull() ;
    expect( tab( dict.settingsPage.tabCategories ) ).not.toBeNull() ;
    expect( tab( dict.settingsPage.tabLedger ) ).not.toBeNull() ;
  } ) ;
} ) ;
