// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeAll } from "vitest" ;
import { render , screen , fireEvent }             from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Profile
import { ProfileProvider } from "@/features/profile/context/ProfileContext" ;
import type { ProfileData } from "@/features/profile/types" ;

// Feature: Notifications
import { NotificationsProvider } from "@/features/notifications/context/NotificationsContext" ;

// Feature: Loans
import type { LoanConResumen } from "../types" ;
import { LoansContainer }                       from "./LoansContainer" ;
import { makeLoan }                             from "../testing/loanFactory" ;


const routerMock = vi.hoisted( () => ( {
  push:    vi.fn() ,
  replace: vi.fn() ,
  refresh: vi.fn() ,
  back:    vi.fn() ,
  forward: vi.fn()
} ) ) ;

export { routerMock } ;

vi.mock( "next/navigation" , () => ( {
  useRouter:       () => routerMock ,
  usePathname:     () => "/es/loans" ,
  useParams:       () => ( { lang: "es" } ) ,
  useSearchParams: () => new URLSearchParams()
} ) ) ;

vi.mock( "../actions/loansActions" , () => ( {
  archiveLoanAction: vi.fn() ,
  createLoanAction:  vi.fn()
} ) ) ;

const mockProfile: ProfileData = {
  userId:           "11111111-1111-4111-8111-111111111111" ,
  phone:            null ,
  currency:         "ARS" ,
  timezone:         "America/Argentina/Buenos_Aires" ,
  bio:              null ,
  theme:            "light" ,
  defaultView:      "dashboard" ,
  fastLogin:        true ,
  weeklyStart:      "monday" ,
  dateFormat:       "DD/MM/YYYY" ,
  numberFormat:     "es-AR" ,
  roundAmounts:     false ,
  includeTransfers: true ,
  defaultAccount:   null ,
  planName:         "Básico" ,
  planBilling:      "Mensual" ,
  planNextCharge:   ""
} ;

function renderWithProviders( ui: React.ReactElement ) {
  return( render(
    <ProfileProvider initialProfile={mockProfile}>
      <NotificationsProvider>
        {ui}
      </NotificationsProvider>
    </ProfileProvider>
  ) ) ;
}

function makeResumenLoan( overrides?: Partial< LoanConResumen > ): LoanConResumen {
  const base = makeLoan( overrides ) ;
  return( {
    ...base ,
    accounts:       [] ,
    saldoPendiente: ( overrides?.saldoPendiente !== undefined ? overrides.saldoPendiente : 500000 ) ,
    cuotasPagadas:  ( overrides?.cuotasPagadas !== undefined ? overrides.cuotasPagadas : 2 ) ,
    progreso:       ( overrides?.progreso !== undefined ? overrides.progreso : 50 ) ,
    pendientes:     ( overrides?.pendientes !== undefined ? overrides.pendientes : [] ) ,
    ...overrides
  } ) ;
}

describe( "LoansContainer" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  it( "1. con dos préstamos, la tabla pinta las dos filas y el saldo del borrowed sale positivo" , () => {
    const loanBorrowed = makeResumenLoan( {
      id:              "loan-b-1" ,
      name:            "Préstamo Santander Personal" ,
      direction:       "borrowed" ,
      principalAmount: 1000000 ,
      saldoPendiente:  660000 ,
      currency:        "ARS"
    } ) ;

    const loanLent = makeResumenLoan( {
      id:              "loan-l-1" ,
      name:            "Préstamo Amigo Juan" ,
      direction:       "lent" ,
      principalAmount: 500000 ,
      saldoPendiente:  250000 ,
      currency:        "ARS"
    } ) ;

    renderWithProviders(
      <LoansContainer
        initialLoans={[ loanBorrowed , loanLent ]}
        initialPending={[]}
        accounts={[]}
        financialEntities={[]}
        contacts={[]}
        dict={dict}
        lang="es"
      />
    ) ;

    expect( screen.getByText( "Préstamo Santander Personal" ) ).toBeDefined() ;
    expect( screen.getByText( "Préstamo Amigo Juan" ) ).toBeDefined() ;

    // El saldo del borrowed sale en la tabla formateado en positivo sin signo menos delante
    const saldoElements = screen.getAllByText( /6\.600/ ) ;
    expect( saldoElements.length ).toBeGreaterThan( 0 ) ;
    for( const el of saldoElements ) {
      expect( el.textContent ).not.toContain( "-" ) ;
    }
  } ) ;

  it( "2. tocar el tab Dados deja sólo el lent" , () => {
    const loanBorrowed = makeResumenLoan( {
      id:        "loan-b-1" ,
      name:      "Préstamo Auto Pedido" ,
      direction: "borrowed"
    } ) ;

    const loanLent = makeResumenLoan( {
      id:        "loan-l-1" ,
      name:      "Préstamo Hermano Dado" ,
      direction: "lent"
    } ) ;

    renderWithProviders(
      <LoansContainer
        initialLoans={[ loanBorrowed , loanLent ]}
        initialPending={[]}
        accounts={[]}
        financialEntities={[]}
        contacts={[]}
        dict={dict}
        lang="es"
      />
    ) ;

    expect( screen.getByText( "Préstamo Auto Pedido" ) ).toBeDefined() ;
    expect( screen.getByText( "Préstamo Hermano Dado" ) ).toBeDefined() ;

    const tabDados = screen.getByRole( "tab" , { name: /dados/i } ) ;
    fireEvent.click( tabDados ) ;

    expect( screen.queryByText( "Préstamo Auto Pedido" ) ).toBeNull() ;
    expect( screen.getByText( "Préstamo Hermano Dado" ) ).toBeDefined() ;
  } ) ;

  it( "3. con initialLoans: [] se pinta el EmptyState y no hay tabla ni métricas" , () => {
    const { container } = renderWithProviders(
      <LoansContainer
        initialLoans={[]}
        initialPending={[]}
        accounts={[]}
        financialEntities={[]}
        contacts={[]}
        dict={dict}
        lang="es"
      />
    ) ;

    expect( screen.getByText( dict.loansPage.emptyTitle ) ).toBeDefined() ;
    expect( screen.queryByRole( "table" ) ).toBeNull() ;
    expect( screen.queryByRole( "tablist" ) ).toBeNull() ;
    expect( container.querySelector( `.${dict.loansPage.heroLabel}` ) ).toBeNull() ;
  } ) ;

  it( "4. un préstamo con saldoPendiente: null pinta balanceUnavailable y no rompe el render" , () => {
    const loanSinSaldo = makeResumenLoan( {
      id:             "loan-null-1" ,
      name:           "Préstamo Sin Cuenta Espejo" ,
      saldoPendiente: null ,
      progreso:       null
    } ) ;

    renderWithProviders(
      <LoansContainer
        initialLoans={[ loanSinSaldo ]}
        initialPending={[]}
        accounts={[]}
        financialEntities={[]}
        contacts={[]}
        dict={dict}
        lang="es"
      />
    ) ;

    expect( screen.getByText( "Préstamo Sin Cuenta Espejo" ) ).toBeDefined() ;
    // Se muestra balanceUnavailable ("—") en saldo y progreso
    const unavailables = screen.getAllByText( dict.loansPage.balanceUnavailable ) ;
    expect( unavailables.length ).toBeGreaterThanOrEqual( 1 ) ;
  } ) ;
} ) ;
