// @vitest-environment jsdom
/**
 * @file AccountsContainer.test.tsx
 * Saldo libre de Metas en el detalle de una entidad (RFC 011 §7): con `reservado` muestra «libre X» y «descubierta»;
 * sin `reservado` el render es el de siempre; saldos y totales no cambian en ningún caso (RN-16).
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll } from "vitest" ;
import { screen , fireEvent , within , waitFor } from "@testing-library/react" ;
import React                                       from "react" ;

// Shared
import { renderConPermisos as render } from "@/shared/lib/renderConPermisos" ;
import { MetricsVisibilityContext } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { getDictionary }            from "@/shared/lib/dictionary" ;

// Feature: Notifications
import { NotificationsProvider } from "@/features/notifications/context/NotificationsContext" ;

// Feature: Accounting
import { AccountsContainer }                                                                                                  from "./AccountsContainer" ;
import type { Account , CuentaDeListado }                                                                                         from "../types" ;
import { obtenerMisCuentasAction , compartirCuentaAction , dejarDeCompartirAction , listarOrganizacionesParaCompartirAction }     from "../actions/cuentasPersonalesActions" ;


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

vi.mock( "../actions/cuentasPersonalesActions" , () => ( {
  crearCuentaPersonalAction:               vi.fn() ,
  obtenerMisCuentasAction:                 vi.fn() ,
  compartirCuentaAction:                   vi.fn() ,
  dejarDeCompartirAction:                  vi.fn() ,
  listarOrganizacionesParaCompartirAction: vi.fn() ,
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

const idAna = "cccccccc-cccc-4ccc-8ccc-cccccccccccc" ;
const idDeAna = "dddddddd-dddd-4ddd-8ddd-dddddddddddd" ;

function personalAjena( id: string , name: string ): CuentaDeListado {
  return( {
    id , name , balance: null ,
    organizationId: "org" , code: `1.9.${name}` , type: "asset" , currency: "ARS" ,
    entityId: null , ownerUserId: idDeAna , createdAt: new Date() , updatedAt: new Date() ,
    etiqueta: { tipo: "compartida" , organizaciones: [ {id: "org" , nombre: "reparto-demo"} ] } ,
    entity: { name: "Banco X" , logo: null , color: null }
  } as unknown as CuentaDeListado ) ;
}

describe( "AccountsContainer — etiquetas y personales compartidas (plan 25, RN-15, RN-16)" , () => {
  it( "una personal ajena se lista con su etiqueta y sin saldo, y no entra en los totales (AC-3)" , () => {
    render(
      <NotificationsProvider>
        <AccountsContainer
          accounts={[ makeAccount( idA , "Caja A" , 1000000 ) , personalAjena( idAna , "Banco Ana" ) ]}
          cards={[]} loans={[]} financialEntities={[]} summaries={[]} dict={dict} lang="es"
        />
      </NotificationsProvider>
    ) ;

    fireEvent.click( screen.getByText( "Banco X" ) ) ;
    const dialog = screen.getByRole( "dialog" ) ;

    expect( within( dialog ).getByText( "Banco Ana" ) ).toBeDefined() ;
    expect( within( dialog ).getByText( "Compartida · reparto-demo" ) ).toBeDefined() ;
    expect( within( dialog ).getByText( dict.accountsPage.balanceHidden ) ).toBeDefined() ;

    const total = screen.getByText( "Total Activos" ).closest( "div" )!.parentElement!.textContent ;
    expect( total ).toMatch( /10\.000,00/ ) ;
  } ) ;
} ) ;

describe( "AccountsContainer — vista «Mis cuentas» (plan 25, RN-16)" , () => {
  const miCuenta = ( id: string , name: string , comp: string[] ) => ( {
    cuenta: {
      id , name , balance: 250000 ,
      organizationId: "org" , code: `1.9.${name}` , type: "asset" , currency: "ARS" ,
      entityId: null , ownerUserId: idDeAna , createdAt: new Date() , updatedAt: new Date() ,
    } as unknown as Account ,
    etiqueta: ( comp.length === 0
      ? { tipo: "privada" as const }
      : { tipo: "compartida" as const , organizaciones: comp.map( ( n ) => ( {id: `id-${n}` , nombre: n} ) ) } ) ,
    organizacionesIds: comp.map( ( n ) => `id-${n}` ) ,
  } ) ;

  function abrirMisCuentas() {
    render(
      <NotificationsProvider>
        <AccountsContainer accounts={[ makeAccount( idA , "Caja A" , 1000000 ) ]} cards={[]} loans={[]} financialEntities={[]} summaries={[]} dict={dict} lang="es" />
      </NotificationsProvider>
    ) ;
    fireEvent.click( screen.getByRole( "button" , {name: dict.accountsPage.viewMine} ) ) ;
  }

  function preparar() {
    vi.clearAllMocks() ;
    vi.mocked( obtenerMisCuentasAction ).mockResolvedValue( { success: true , value: [
      miCuenta( "ca1" , "Banco Ana" , [] ) ,
      miCuenta( "ca2" , "Cuenta DNI" , [ "reparto-demo" ] ) ,
    ] } as never ) ;
    vi.mocked( listarOrganizacionesParaCompartirAction ).mockResolvedValue( { success: true , value: [
      {id: "id-reparto-demo" , nombre: "reparto-demo"} , {id: "id-taller" , nombre: "Taller"} ,
    ] } as never ) ;
    vi.mocked( compartirCuentaAction ).mockResolvedValue( { success: true , value: null } as never ) ;
    vi.mocked( dejarDeCompartirAction ).mockResolvedValue( { success: true , value: null } as never ) ;
  }

  it( "muestra todas las cuentas del usuario con su etiqueta y deja de mostrar la lista de la organización" , async () => {
    preparar() ;
    abrirMisCuentas() ;

    expect( await screen.findByText( "Banco Ana" ) ).toBeDefined() ;
    expect( screen.getByText( "Privada" ) ).toBeDefined() ;
    expect( screen.getByText( "Compartida · reparto-demo" ) ).toBeDefined() ;
    expect( screen.queryByText( "Total Activos" ) ).toBeNull() ;

    fireEvent.click( screen.getByRole( "button" , {name: dict.accountsPage.viewOrganization} ) ) ;
    expect( screen.getByText( "Total Activos" ) ).toBeDefined() ;
  } ) ;

  it( "compartir con… llama a la acción con la cuenta y la organización elegida" , async () => {
    preparar() ;
    abrirMisCuentas() ;
    await screen.findByText( "Banco Ana" ) ;

    const selector = screen.getByLabelText( `${dict.accountsPage.btnShareWith} Banco Ana` ) ;
    fireEvent.change( selector , {target: {value: "id-taller"}} ) ;
    fireEvent.click( screen.getAllByRole( "button" , {name: dict.accountsPage.btnShareWith} )[0] ) ;

    await waitFor( () => expect( compartirCuentaAction ).toHaveBeenCalledWith( {accountId: "ca1" , organizationId: "id-taller"} ) ) ;
  } ) ;

  it( "dejar de compartir llama a la acción y no ofrece la opción en una privada" , async () => {
    preparar() ;
    abrirMisCuentas() ;
    await screen.findByText( "Banco Ana" ) ;

    const dejar = screen.getAllByRole( "button" , {name: dict.accountsPage.btnStopSharing} ) ;
    expect( dejar ).toHaveLength( 1 ) ;
    fireEvent.click( dejar[0] ) ;

    await waitFor( () => expect( dejarDeCompartirAction ).toHaveBeenCalledWith( {accountId: "ca2" , organizationId: "id-reparto-demo"} ) ) ;
  } ) ;

  it( "un fallo al compartir se muestra y no rompe la vista" , async () => {
    preparar() ;
    vi.mocked( compartirCuentaAction ).mockResolvedValue( {success: false , error: "No autorizado."} as never ) ;
    abrirMisCuentas() ;
    await screen.findByText( "Banco Ana" ) ;

    fireEvent.change( screen.getByLabelText( `${dict.accountsPage.btnShareWith} Banco Ana` ) , {target: {value: "id-taller"}} ) ;
    fireEvent.click( screen.getAllByRole( "button" , {name: dict.accountsPage.btnShareWith} )[0] ) ;

    expect( await screen.findByText( "No autorizado." ) ).toBeDefined() ;
  } ) ;

  it( "AC-6: desde una organización «Mis cuentas» no tiene el botón de crear una cuenta propia" , async () => {
    preparar() ;
    abrirMisCuentas() ;
    await screen.findByText( "Banco Ana" ) ;

    expect( screen.queryByRole( "button" , {name: new RegExp( dict.accountsPage.btnNewPersonal )} ) ).toBeNull() ;
    // sigue pudiendo compartir y dejar de compartir
    expect( screen.getAllByRole( "button" , {name: dict.accountsPage.btnStopSharing} ) ).toHaveLength( 1 ) ;
  } ) ;

  it( "AC-12: en Personal la vista única es «Mis cuentas» (sin selector de vista ni alta de cuenta de la organización)" , async () => {
    preparar() ;
    render(
      <NotificationsProvider>
        <AccountsContainer accounts={[ makeAccount( idA , "Caja A" , 1000000 ) ]} cards={[]} loans={[]} financialEntities={[]} summaries={[]} dict={dict} lang="es" esPersonal={true} />
      </NotificationsProvider>
    ) ;

    expect( await screen.findByText( "Banco Ana" ) ).toBeDefined() ;
    expect( screen.queryByRole( "button" , {name: dict.accountsPage.viewOrganization} ) ).toBeNull() ;
    expect( screen.queryByRole( "button" , {name: dict.accountsPage.viewMine} ) ).toBeNull() ;
    expect( screen.queryByText( "Total Activos" ) ).toBeNull() ;
    expect( screen.queryByRole( "button" , {name: /\+ Nueva Cuenta/} ) ).toBeNull() ;
  } ) ;

  it( "AC-3 / AC-4: en Personal «Nueva cuenta propia» abre el formulario en modo personal (sin selector de tipo)" , async () => {
    preparar() ;
    render(
      <NotificationsProvider>
        <AccountsContainer accounts={[]} cards={[]} loans={[]} financialEntities={[]} summaries={[]} dict={dict} lang="es" esPersonal={true} />
      </NotificationsProvider>
    ) ;
    await screen.findByText( "Banco Ana" ) ;

    fireEvent.click( screen.getByRole( "button" , {name: new RegExp( dict.accountsPage.btnNewPersonal )} ) ) ;

    const dialog = await screen.findByRole( "dialog" ) ;
    expect( within( dialog ).queryByLabelText( new RegExp( dict.accountsPage.formType ) ) ).toBeNull() ;
    expect( within( dialog ).getByLabelText( new RegExp( dict.accountsPage.formName ) ) ).toBeDefined() ;
  } ) ;
} ) ;

describe( "AccountsContainer — ya no hay formulario de entidad suelto (plan 29, AC-4)" , () => {
  it( "no hay botón «Nueva Entidad» y «Nueva Cuenta» es el único alta" , () => {
    render(
      <NotificationsProvider>
        <AccountsContainer accounts={[ makeAccount( idA , "Caja A" , 1000000 ) ]} cards={[]} loans={[]} financialEntities={[]} summaries={[]} dict={dict} lang="es" />
      </NotificationsProvider>
    ) ;

    expect( screen.queryByRole( "button" , {name: /Nueva Entidad/} ) ).toBeNull() ;
    expect( screen.getByRole( "button" , {name: /Nueva Cuenta/} ) ).toBeDefined() ;
    expect( screen.queryByText( "Registrar Entidad Financiera" ) ).toBeNull() ;
  } ) ;
} ) ;

describe( "AccountsContainer — solo lectura (RN-22)" , () => {
  const montar = ( puedeEscribir: boolean ) => render(
    <NotificationsProvider>
      <AccountsContainer
        accounts={[ makeAccount( idA , "Caja A" , 1000000 ) ]} cards={[]} loans={[]} financialEntities={[]} summaries={[]} dict={dict} lang="es"
      />
    </NotificationsProvider> ,
    { puedeEscribir }
  ) ;

  it( "con permiso, el encabezado ofrece «Nueva Cuenta» y el detalle de la entidad «Agregar Cuenta»" , () => {
    montar( true ) ;

    expect( screen.getByText( "+ Nueva Cuenta" ) ).toBeDefined() ;
    fireEvent.click( screen.getByText( "Banco X" ) ) ;
    expect( screen.getByText( /Agregar Cuenta a/ ) ).toBeDefined() ;
  } ) ;

  it( "sin permiso, no hay ningún botón de alta, ni en el encabezado ni en el detalle de la entidad" , () => {
    montar( false ) ;

    expect( screen.queryByText( "+ Nueva Cuenta" ) ).toBeNull() ;
    fireEvent.click( screen.getByText( "Banco X" ) ) ;
    expect( screen.getByRole( "dialog" ) ).toBeDefined() ;
    expect( screen.queryByText( /Agregar Cuenta a/ ) ).toBeNull() ;
  } ) ;
} ) ;
