// @vitest-environment jsdom
/**
 * @file SubscriptionDashboard.soloLectura.test.tsx
 * Un `viewer` ve las suscripciones y la bandeja de recurrencias propuestas como lista, sin altas ni
 * «Confirmar», «Otro monto», «No me lo cobraron» ni «Dar de baja» (RN-22, AC-18).
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll } from "vitest" ;
import { screen }                                  from "@testing-library/react" ;

// Shared
import { renderConPermisos as render } from "@/shared/lib/renderConPermisos" ;
import { getDictionary }               from "@/shared/lib/dictionary" ;

// Feature: Notifications
import { NotificationsProvider } from "@/features/notifications/context/NotificationsContext" ;

// Feature: Profile
import { ProfileProvider }  from "@/features/profile/context/ProfileContext" ;
import type { ProfileData } from "@/features/profile/types" ;

// Feature: Subscriptions
import { SubscriptionDashboard } from "./SubscriptionDashboard" ;
import type { Subscription }     from "../types" ;


vi.mock( "next/navigation" , () => ( {
  useRouter:       () => ( { push: vi.fn() , refresh: vi.fn() } ) ,
  usePathname:     () => "/es/subscriptions" ,
  useParams:       () => ( { lang: "es" } ) ,
  useSearchParams: () => new URLSearchParams() ,
} ) ) ;

vi.mock( "../actions/subscriptionsActions" , () => ( {
  createSubscriptionAction: vi.fn() ,
  updateSubscriptionAction: vi.fn() ,
  deleteSubscriptionAction: vi.fn() ,
} ) ) ;

vi.mock( "../actions/resolveSubscriptionAction" , () => ( {
  resolveSubscriptionAction: vi.fn() ,
} ) ) ;

const perfil: ProfileData = {
  userId: "11111111-1111-4111-8111-111111111111" , phone: null , currency: "ARS" ,
  timezone: "America/Argentina/Buenos_Aires" , bio: null , theme: "light" , defaultView: "dashboard" ,
  fastLogin: true , weeklyStart: "monday" , dateFormat: "DD/MM/YYYY" , numberFormat: "es-AR" ,
  roundAmounts: false , includeTransfers: true , defaultAccount: null ,
  planName: "Básico" , planBilling: "Mensual" , planNextCharge: "" ,
} ;

const suscripcion = {
  id: "sub-1" , organizationId: "org-1" , name: "Streaming" , description: null , amount: 500000 , currency: "ARS" ,
  frequency: "monthly" , intervalCount: 1 , logoKey: "netflix" , color: "#e50914" , status: "active" ,
  startDate: new Date( "2026-01-01T12:00:00Z" ) , nextPaymentDate: new Date( "2026-11-01T12:00:00Z" ) ,
  resolvedThrough: "2026-09-01" , createdAt: new Date() , updatedAt: new Date() ,
} as unknown as Subscription ;

describe( "SubscriptionDashboard — solo lectura (RN-22)" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;

    // jsdom no trae ResizeObserver, que usa el treemap
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver ;
  } ) ;

  const montar = ( puedeEscribir: boolean , conSuscripciones: boolean ) => render(
    <NotificationsProvider>
    <ProfileProvider initialProfile={perfil}>
      <SubscriptionDashboard
        initialData={ conSuscripciones ? [ suscripcion ] : [] }
        initialPending={ conSuscripciones ? [ { subscriptionId: "sub-1" , fechaCobro: "2026-10-01" , subscription: suscripcion } ] : [] }
        accounts={[]}
        dict={dict}
        lang="es"
      />
    </ProfileProvider>
    </NotificationsProvider> ,
    { puedeEscribir }
  ) ;

  it( "con permiso: alta en el encabezado y en el estado vacío" , () => {
    montar( true , false ) ;

    expect( screen.getAllByText( dict.subscriptionsPage.addBtn ) ).toHaveLength( 2 ) ;
  } ) ;

  it( "sin permiso: ni el encabezado ni el estado vacío ofrecen el alta" , () => {
    montar( false , false ) ;

    expect( screen.queryByText( dict.subscriptionsPage.addBtn ) ).toBeNull() ;
  } ) ;

  it( "con permiso la bandeja ofrece «Confirmar»; sin permiso lista la recurrencia sin botones" , () => {
    const { unmount } = montar( true , true ) ;
    expect( screen.getByText( "Confirmar" ) ).toBeDefined() ;
    expect( screen.getByTitle( dict.subscriptionsPage.editTitle ) ).toBeDefined() ;
    unmount() ;

    montar( false , true ) ;
    expect( screen.getAllByText( "Streaming" ).length ).toBeGreaterThan( 0 ) ;
    expect( screen.queryByText( "Confirmar" ) ).toBeNull() ;
    expect( screen.queryByText( "Otro monto" ) ).toBeNull() ;
    expect( screen.queryByText( "No me lo cobraron" ) ).toBeNull() ;
    expect( screen.queryByText( "Dar de baja" ) ).toBeNull() ;
    expect( screen.queryByTitle( dict.subscriptionsPage.editTitle ) ).toBeNull() ;
    expect( screen.queryByTitle( dict.subscriptionsPage.deleteTitle ) ).toBeNull() ;
  } ) ;
} ) ;
