// @vitest-environment jsdom
/**
 * @file AccountsContainer.test.tsx
 * Saldo libre de Metas en el detalle de una entidad (RFC 011 §7): con `reservado` muestra «libre X» y «descubierta»;
 * sin `reservado` el render es el de siempre; saldos y totales no cambian en ningún caso (RN-16).
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll } from "vitest" ;
import { render , screen , fireEvent , within }    from "@testing-library/react" ;
import React                                       from "react" ;

// Shared
import { MetricsVisibilityContext } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { getDictionary }            from "@/shared/lib/dictionary" ;

// Feature: Notifications
import { NotificationsProvider } from "@/features/notifications/context/NotificationsContext" ;

// Feature: Accounting
import { AccountsContainer } from "./AccountsContainer" ;
import type { Account }      from "../types" ;


vi.mock( "next/navigation" , () => ( {
  useRouter:       () => ( { push: vi.fn() , refresh: vi.fn() } ) ,
  usePathname:     () => "/es/accounts" ,
  useParams:       () => ( { lang: "es" } ) ,
  useSearchParams: () => new URLSearchParams()
} ) ) ;

vi.mock( "../actions/accountingActions" , () => ( {
  createAccountAction:         vi.fn() ,
  createFinancialEntityAction: vi.fn()
} ) ) ;

const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" ;
const idB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" ;

function makeAccount( id: string , name: string , balance: number ): Account & { entity: { name: string ; logo: null ; color: null } } {
  return( {
    id , name , balance ,
    organizationId: "org" , code: `1.${name}` , type: "asset" , currency: "ARS" ,
    entityId: null , createdAt: new Date() , updatedAt: new Date() ,
    entity: { name: "Banco X" , logo: null , color: null }
  } as unknown as Account & { entity: { name: string ; logo: null ; color: null } } ) ;
}

let dict: Awaited< ReturnType< typeof getDictionary > > ;

beforeAll( async () => {
  dict = await getDictionary( "es" ) ;
} ) ;

function renderAccounts( reservado?: Record< string , { reservado: number ; libre: number } > , visible = true ) {
  render(
    <NotificationsProvider>
      <MetricsVisibilityContext.Provider value={ { isContentVisible: visible , toggleVisibility: () => {} } }>
        <AccountsContainer
          accounts={[ makeAccount( idA , "Caja A" , 1000000 ) , makeAccount( idB , "Caja B" , 500000 ) ]}
          cards={[]}
          loans={[]}
          financialEntities={[]}
          summaries={[]}
          dict={dict}
          lang="es"
          reservado={reservado}
        />
      </MetricsVisibilityContext.Provider>
    </NotificationsProvider>
  ) ;
  fireEvent.click( screen.getByText( "Banco X" ) ) ;
  return( screen.getByRole( "dialog" ) ) ;
}

describe( "AccountsContainer — saldo libre de Metas" , () => {
  it( "sin `reservado` el detalle no muestra ninguna línea de libre" , () => {
    const dialog = renderAccounts() ;
    expect( within( dialog ).queryByText( /libre/ ) ).toBeNull() ;
    expect( within( dialog ).queryByText( /descubierta/ ) ).toBeNull() ;
    expect( within( dialog ).getByText( /10\.000,00/ ) ).toBeDefined() ;
  } ) ;

  it( "con reserva: «libre X» bajo el saldo, sólo en la cuenta que tiene reserva; el saldo grande no cambia" , () => {
    const dialog = renderAccounts( { [ idA ]: { reservado: 200000 , libre: 800000 } } ) ;
    expect( within( dialog ).getAllByText( /libre/ ) ).toHaveLength( 1 ) ;
    expect( within( dialog ).getByText( /libre/ ).textContent ).toMatch( /8\.000,00/ ) ;
    expect( within( dialog ).getByText( /10\.000,00/ ) ).toBeDefined() ;
    expect( within( dialog ).queryByText( /descubierta/ ) ).toBeNull() ;
  } ) ;

  it( "libre negativo: rótulo «descubierta» en texto" , () => {
    const dialog = renderAccounts( { [ idB ]: { reservado: 800000 , libre: -300000 } } ) ;
    expect( within( dialog ).getByText( /descubierta/ ) ).toBeDefined() ;
    expect( within( dialog ).getByText( /libre/ ).textContent ).toMatch( /3\.000,00/ ) ;
  } ) ;

  it( "Total Activos y Total Pasivos no cambian con reservas (RN-16)" , () => {
    const total = () => { return( screen.getByText( "Total Activos" ).closest( "div" )!.parentElement!.textContent ) ; } ;

    const { unmount } = render(
      <NotificationsProvider>
        <AccountsContainer accounts={[ makeAccount( idA , "Caja A" , 1000000 ) ]} cards={[]} loans={[]} financialEntities={[]} summaries={[]} dict={dict} lang="es" />
      </NotificationsProvider>
    ) ;
    const sinReserva = total() ;
    unmount() ;

    render(
      <NotificationsProvider>
        <AccountsContainer
          accounts={[ makeAccount( idA , "Caja A" , 1000000 ) ]} cards={[]} loans={[]} financialEntities={[]} summaries={[]} dict={dict} lang="es"
          reservado={ { [ idA ]: { reservado: 900000 , libre: 100000 } } }
        />
      </NotificationsProvider>
    ) ;
    expect( total() ).toBe( sinReserva ) ;
    expect( sinReserva ).toMatch( /10\.000,00/ ) ;
  } ) ;

  it( "ojito cerrado: el importe libre se oculta igual que el saldo" , () => {
    const dialog = renderAccounts( { [ idA ]: { reservado: 200000 , libre: 800000 } } , false ) ;
    expect( within( dialog ).queryByText( /8\.000,00/ ) ).toBeNull() ;
    expect( within( dialog ).queryByText( /10\.000,00/ ) ).toBeNull() ;
  } ) ;
} ) ;
