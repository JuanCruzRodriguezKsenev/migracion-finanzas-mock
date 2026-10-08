// @vitest-environment jsdom
/**
 * @file TransactionsContainer.cuentas.test.tsx
 * Plan 26 (AC-4, RN-13): el movimiento nombra y clasifica con las personales referenciadas (dueño visible),
 * muestra «Cuenta personal de <dueño>» en fila y detalle sin «Ya no compartida», y «Lo absorbió <titular>» si aplica.
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor , within }       from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Notifications
import { NotificationsProvider } from "@/features/notifications/context/NotificationsContext" ;

// Feature: Profile
import { ProfileProvider }  from "@/features/profile/context/ProfileContext" ;
import type { ProfileData } from "@/features/profile/types" ;

// Feature: Accounting
import type { TransactionWithEntries , CuentaPersonalReferenciada } from "@/features/accounting/repositories/ledgerRepository" ;
import type { Account }                                              from "@/features/accounting/types" ;

// Feature: Transactions
import { getTransactionsPageAction } from "../actions/transactionsActions" ;
import { TransactionsContainer }     from "./TransactionsContainer" ;


vi.mock( "next/navigation" , () => ( {
  useRouter:       () => ( { push: vi.fn() , replace: vi.fn() , refresh: vi.fn() } ) ,
  usePathname:     () => "/es/transactions" ,
  useSearchParams: () => new URLSearchParams() ,
} ) ) ;

vi.mock( "../actions/transactionsActions" , () => ( {
  getTransactionsPageAction:             vi.fn() ,
  createTransactionFromFormAction:       vi.fn() ,
  updateLedgerTransactionMetadataAction: vi.fn() ,
  reverseLedgerTransactionAction:        vi.fn() ,
  deleteLedgerTransactionAction:         vi.fn() ,
} ) ) ;

vi.mock( "@/features/accounting/actions/categoryActions" , () => ( {
  createCategoryAction: vi.fn() ,
} ) ) ;

vi.mock( "@/features/accounting/actions/cuentasPersonalesActions" , () => ( {
  compartirCuentaAction: vi.fn() ,
} ) ) ;

vi.mock( "@/features/splits/actions/acuerdoActions" , () => ( {
  previsualizarRepartoAction: vi.fn() ,
} ) ) ;

const perfil: ProfileData = {
  userId: "11111111-1111-4111-8111-111111111111" , phone: null , currency: "ARS" ,
  timezone: "America/Argentina/Buenos_Aires" , bio: null , theme: "light" , defaultView: "dashboard" ,
  fastLogin: true , weeklyStart: "monday" , dateFormat: "DD/MM/YYYY" , numberFormat: "es-AR" ,
  roundAmounts: false , includeTransfers: true , defaultAccount: null ,
  planName: "Básico" , planBilling: "Mensual" , planNextCharge: "" ,
} ;

const gastoSuper: Account = {
  id: "acc-gasto" , organizationId: "org-1" , code: "5.1.01" , name: "Supermercado" , type: "expense" , balance: 0 ,
  currency: "ARS" , entityId: null , cbuCvu: null , alias: null , isCommonPot: false , ownerUserId: null , createdAt: new Date() ,
} ;

function personal( id: string , name: string , ownerNombre: string = "Ana" ): CuentaPersonalReferenciada {
  return( { id , code: `1.9.${name}` , name , type: "asset" , currency: "ARS" , ownerUserId: "u-ana" , ownerNombre } ) ;
}

function gasto( id: string , descripcion: string , cuentaId: string , extra: Partial< TransactionWithEntries > = {} ): TransactionWithEntries {
  return( {
    id , organizationId: "org-1" , categoryId: null , description: descripcion , merchantName: null , merchantDomain: null ,
    occurredAt: new Date( "2026-10-01T12:00:00Z" ) , createdAt: new Date( "2026-10-01T12:00:00Z" ) ,
    reversesTransactionId: null , reversedAt: null , createdByUserId: null , holderUserId: null ,
    absorbedByHolder: false ,
    entries: [
      { id: `${id}-1` , transactionId: id , accountId: cuentaId    , debit: 0     , credit: 12000 , currency: "ARS" , createdAt: new Date() } ,
      { id: `${id}-2` , transactionId: id , accountId: "acc-gasto" , debit: 12000 , credit: 0     , currency: "ARS" , createdAt: new Date() } ,
    ] ,
    ...extra ,
  } as TransactionWithEntries ) ;
}

describe( "TransactionsContainer — personales referenciadas (plan 26, RN-13)" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  const bancoAna = personal( "acc-banco" , "Banco Ana" , "Ana" ) ;
  const dni      = personal( "acc-dni" , "Cuenta DNI" , "Ana" ) ;

  const primeraPagina = {
    items:             [ gasto( "tx-1" , "Súper del barrio" , "acc-banco" ) ] ,
    cuentasPersonales: [ bancoAna ] ,
    nextCursor:        { occurredAt: "2026-10-01T12:00:00.000Z" , id: "tx-1" } ,
    hasMore:           true ,
  } ;

  const segundaPagina = {
    items:             [ gasto( "tx-2" , "Farmacia" , "acc-dni" ) ] ,
    cuentasPersonales: [ dni ] ,
    nextCursor:        null ,
    hasMore:           false ,
  } ;

  /** La primera página para cualquier consulta sin cursor (incluido el reinicio por debounce), la segunda con cursor. */
  function paginar() {
    vi.mocked( getTransactionsPageAction ).mockImplementation( async ( params ) => {
      return( { success: true , value: ( params?.cursor ? segundaPagina : primeraPagina ) } as never ) ;
    } ) ;
  }

  const montar = () => render(
    <NotificationsProvider>
    <ProfileProvider initialProfile={perfil}>
      <TransactionsContainer
        initialTransactions={primeraPagina.items}
        initialNextCursor={primeraPagina.nextCursor}
        initialHasMore={true}
        accounts={ [ gastoSuper ] }
        categories={[]}
        dict={dict}
        cuentasPersonales={ [ bancoAna ] }
      />
    </ProfileProvider>
    </NotificationsProvider>
  ) ;

  it( "la fila nombra la personal (no el id recortado) y la clasifica como gasto" , () => {
    paginar() ;
    montar() ;

    const fila = screen.getByText( "Súper del barrio" ).closest( "tr" )! ;

    expect( within( fila ).getByText( "Banco Ana" ) ).toBeTruthy() ;
    expect( within( fila ).getByText( "Gasto" ) ).toBeTruthy() ;
    expect( within( fila ).queryByText( "acc-banc" ) ).toBeNull() ;
  } ) ;

  it( "AC-4, RN-13: la fila y el detalle muestran «Cuenta personal de <dueño>», sin «Ya no compartida»" , () => {
    paginar() ;
    montar() ;

    const fila = screen.getByText( "Súper del barrio" ).closest( "tr" )! ;
    const textoPersonal = dict.accountsPage.labelPersonalOf.replace( "{dueno}" , "Ana" ) ;
    expect( within( fila ).getByText( textoPersonal ) ).toBeTruthy() ;
    expect( within( fila ).queryByText( /Ya no compartida/i ) ).toBeNull() ;

    fireEvent.click( within( fila ).getByRole( "button" , { name: "Detalle" } ) ) ;

    const detalle = screen.getByRole( "dialog" ) ;
    expect( within( detalle ).getByText( /Banco Ana \(asset\)/ ) ).toBeTruthy() ;
    expect( within( detalle ).getByText( textoPersonal ) ).toBeTruthy() ;
    expect( within( detalle ).queryByText( /Ya no compartida/i ) ).toBeNull() ;
  } ) ;

  it( "RN-19: con absorbedByHolder: true muestra «Lo absorbió <titular>» en la fila y en el detalle" , () => {
    const txnAbsorbida = gasto( "tx-1" , "Súper del barrio" , "acc-banco" , {
      absorbedByHolder: true ,
      holder:           { id: "u-ana" , nombre: "Ana" } ,
      createdBy:        { id: "u-ana" , nombre: "Ana" } ,
    } ) ;
    render(
      <NotificationsProvider>
      <ProfileProvider initialProfile={perfil}>
        <TransactionsContainer
          initialTransactions={ [ txnAbsorbida ] }
          initialNextCursor={null}
          initialHasMore={false}
          accounts={ [ gastoSuper ] }
          categories={[]}
          dict={dict}
          cuentasPersonales={ [ bancoAna ] }
        />
      </ProfileProvider>
      </NotificationsProvider>
    ) ;

    const fila = screen.getByText( "Súper del barrio" ).closest( "tr" )! ;
    const textoAbsorbio = dict.transactionsPage.absorbedBy.replace( "{titular}" , "Ana" ) ;
    expect( within( fila ).getByText( textoAbsorbio ) ).toBeTruthy() ;

    fireEvent.click( within( fila ).getByRole( "button" , { name: "Detalle" } ) ) ;
    const detalle = screen.getByRole( "dialog" ) ;
    expect( within( detalle ).getByText( new RegExp( textoAbsorbio ) ) ).toBeTruthy() ;
  } ) ;

  it( "«cargar más» fusiona las personales de la segunda página sin perder las de la primera" , async () => {
    paginar() ;
    montar() ;

    await waitFor( () => expect( getTransactionsPageAction ).toHaveBeenCalled() ) ;
    fireEvent.click( await screen.findByRole( "button" , { name: "Cargar más transacciones" } ) ) ;

    const segunda = await screen.findByText( "Farmacia" ) ;
    const filaNueva = segunda.closest( "tr" )! ;

    expect( within( filaNueva ).getByText( "Cuenta DNI" ) ).toBeTruthy() ;
    expect( within( filaNueva ).getByText( "Gasto" ) ).toBeTruthy() ;
    expect( within( filaNueva ).getByText( dict.accountsPage.labelPersonalOf.replace( "{dueno}" , "Ana" ) ) ).toBeTruthy() ;

    // La de la primera página no se perdió
    const primera = screen.getByText( "Súper del barrio" ).closest( "tr" )! ;
    expect( within( primera ).getByText( "Banco Ana" ) ).toBeTruthy() ;
    expect( within( primera ).getByText( dict.accountsPage.labelPersonalOf.replace( "{dueno}" , "Ana" ) ) ).toBeTruthy() ;
  } ) ;

  it( "una cuenta que llega en dos páginas no se duplica ni cambia el resultado" , async () => {
    vi.mocked( getTransactionsPageAction ).mockImplementation( async ( params ) => {
      return( {
        success: true ,
        value:   ( params?.cursor
          ? { ...segundaPagina , cuentasPersonales: [ dni , bancoAna ] }
          : primeraPagina ) ,
      } as never ) ;
    } ) ;
    montar() ;

    await waitFor( () => expect( getTransactionsPageAction ).toHaveBeenCalled() ) ;
    fireEvent.click( await screen.findByRole( "button" , { name: "Cargar más transacciones" } ) ) ;
    await screen.findByText( "Farmacia" ) ;

    // Una vez en la lista de la fila y una sola vez en el filtro por cuenta
    expect( screen.getAllByRole( "option" , { name: "Banco Ana" } ) ).toHaveLength( 1 ) ;
    expect( screen.getAllByText( "Banco Ana" ).filter( ( e ) => e.tagName !== "OPTION" ) ).toHaveLength( 1 ) ;
  } ) ;
} ) ;
