// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeAll } from "vitest" ;
import { render , screen , fireEvent , waitFor }  from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Profile
import { ProfileProvider } from "@/features/profile/context/ProfileContext" ;
import type { ProfileData } from "@/features/profile/types" ;

// Feature: Accounting
import type { TransactionWithEntries } from "@/features/accounting/repositories/ledgerRepository" ;
import type { Account }                from "@/features/accounting/types" ;

// Feature: Transactions
import { createTransactionFromFormAction } from "../actions/transactionsActions" ;
import { TransactionDetailModal }          from "./TransactionDetailModal" ;
import { TransactionFormModal }            from "./TransactionFormModal" ;
import { TransactionsControls }            from "./TransactionsControls" ;
import { TransactionsTable }               from "./TransactionsTable" ;


vi.mock( "next/navigation" , () => ( {
  useRouter:       () => ( { push: vi.fn() , replace: vi.fn() , refresh: vi.fn() } ) ,
  usePathname:     () => "/es/transactions" ,
  useSearchParams: () => new URLSearchParams() ,
} ) ) ;

vi.mock( "../actions/transactionsActions" , () => ( {
  createTransactionFromFormAction:       vi.fn() ,
  updateLedgerTransactionMetadataAction: vi.fn() ,
  reverseLedgerTransactionAction:        vi.fn() ,
  deleteLedgerTransactionAction:         vi.fn() ,
} ) ) ;

vi.mock( "@/features/accounting/actions/categoryActions" , () => ( {
  createCategoryAction: vi.fn() ,
} ) ) ;

const perfil: ProfileData = {
  userId: "11111111-1111-4111-8111-111111111111" , phone: null , currency: "ARS" ,
  timezone: "America/Argentina/Buenos_Aires" , bio: null , theme: "light" , defaultView: "dashboard" ,
  fastLogin: true , weeklyStart: "monday" , dateFormat: "DD/MM/YYYY" , numberFormat: "es-AR" ,
  roundAmounts: false , includeTransfers: true , defaultAccount: null ,
  planName: "Básico" , planBilling: "Mensual" , planNextCharge: "" ,
} ;

const cuenta: Account = {
  id: "acc-1" , organizationId: "org-1" , code: "1.1.01" , name: "Caja" , type: "asset" , balance: 0 ,
  currency: "ARS" , entityId: null , cbuCvu: null , alias: null , isCommonPot: false , createdAt: new Date() ,
} ;

function movimiento( extra: Partial< TransactionWithEntries > ): TransactionWithEntries {
  return( {
    id: "tx-1" , organizationId: "org-1" , categoryId: null , description: "Súper del barrio" , merchantName: null ,
    merchantDomain: null , occurredAt: new Date( "2026-10-01T12:00:00Z" ) , createdAt: new Date( "2026-10-01T12:00:00Z" ) ,
    reversesTransactionId: null , reversedAt: null , createdByUserId: null , holderUserId: null ,
    entries: [
      { id: "e1" , transactionId: "tx-1" , accountId: "acc-1" , debit: 0    , credit: 1200 , currency: "ARS" , createdAt: new Date() } ,
      { id: "e2" , transactionId: "tx-1" , accountId: "acc-2" , debit: 1200 , credit: 0    , currency: "ARS" , createdAt: new Date() } ,
    ] ,
    ...extra ,
  } ) ;
}

function conPerfil( ui: React.ReactElement ) {
  return( render( <ProfileProvider initialProfile={perfil}>{ui}</ProfileProvider> ) ) ;
}

describe( "autoría en la interfaz de movimientos" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  describe( "TransactionsTable (AC-25, AC-26)" , () => {
    it( "AC-25: la fila muestra el chip con el nombre del titular" , () => {
      conPerfil(
        <TransactionsTable
          transactions={ [ movimiento( { holder: { id: "u-ana" , nombre: "Ana" } , createdBy: { id: "u-beto" , nombre: "Beto" } } ) ] }
          accounts={ [ cuenta ] }
          categories={[]}
          holderDict={dict.transactionsPage}
          onSelectTransaction={ () => {} }
        />
      ) ;

      const chip = screen.getByText( "Ana" ) ;

      expect( chip ).toBeTruthy() ;
      expect( chip.getAttribute( "title" ) ).toBe( "Titular: Ana" ) ;
    } ) ;

    it( "AC-26: la fila sin titular no lleva chip, aunque tenga autor" , () => {
      conPerfil(
        <TransactionsTable
          transactions={ [ movimiento( { holder: null , createdBy: { id: "u-beto" , nombre: "Beto" } } ) ] }
          accounts={ [ cuenta ] }
          categories={[]}
          holderDict={dict.transactionsPage}
          onSelectTransaction={ () => {} }
        />
      ) ;

      expect( screen.queryByText( "Beto" ) ).toBeNull() ;
      expect( screen.getByText( "Súper del barrio" ) ).toBeTruthy() ;
    } ) ;

    it( "AC-26: un movimiento viejo (sin holder ni createdBy) se muestra sin chip" , () => {
      conPerfil(
        <TransactionsTable
          transactions={ [ movimiento( {} ) ] }
          accounts={ [ cuenta ] }
          categories={[]}
          holderDict={dict.transactionsPage}
          onSelectTransaction={ () => {} }
        />
      ) ;

      expect( screen.getByText( "Súper del barrio" ) ).toBeTruthy() ;
      expect( document.querySelector( "[title^='Titular']" ) ).toBeNull() ;
    } ) ;
  } ) ;

  describe( "TransactionDetailModal (AC-25, AC-26)" , () => {
    const detalle = ( tx: TransactionWithEntries ) => conPerfil(
      <TransactionDetailModal
        transaction={tx}
        isOpen={true}
        onClose={ () => {} }
        onSuccess={ () => {} }
        accounts={ [ cuenta ] }
        categories={[]}
        holderDict={dict.transactionsPage}
      />
    ) ;

    it( "autor y titular distintos: «Cargado por {autor} a nombre de {titular}»" , () => {
      detalle( movimiento( { holder: { id: "u-ana" , nombre: "Ana" } , createdBy: { id: "u-beto" , nombre: "Beto" } } ) ) ;

      expect( screen.getByText( "Cargado por Beto a nombre de Ana" ) ).toBeTruthy() ;
    } ) ;

    it( "autor sin titular: «Cargado por {autor}»" , () => {
      detalle( movimiento( { holder: null , createdBy: { id: "u-beto" , nombre: "Beto" } } ) ) ;

      expect( screen.getByText( "Cargado por Beto" ) ).toBeTruthy() ;
    } ) ;

    it( "el titular es el propio autor: «Cargado por {autor}», sin «a nombre de»" , () => {
      detalle( movimiento( { holder: { id: "u-ana" , nombre: "Ana" } , createdBy: { id: "u-ana" , nombre: "Ana" } } ) ) ;

      expect( screen.getByText( "Cargado por Ana" ) ).toBeTruthy() ;
      expect( screen.queryByText( /a nombre de/ ) ).toBeNull() ;
    } ) ;

    it( "sin autor no dice nada de autoría (movimientos viejos)" , () => {
      detalle( movimiento( { holder: null , createdBy: null } ) ) ;

      expect( screen.queryByText( /Cargado por/ ) ).toBeNull() ;
    } ) ;
  } ) ;

  describe( "TransactionFormModal — selector «A nombre de»" , () => {
    const formulario = ( titulares: { userId: string ; nombre: string }[] ) => conPerfil(
      <TransactionFormModal
        isOpen={true}
        onClose={ () => {} }
        onSuccess={ () => {} }
        accounts={ [ cuenta ] }
        categories={[]}
        titulares={titulares}
        holderDict={dict.transactionsPage}
      />
    ) ;

    it( "aparece con más de una opción, con uno mismo preseleccionado" , () => {
      formulario( [ { userId: "u-beto" , nombre: "Beto" } , { userId: "u-ana" , nombre: "Ana" } ] ) ;

      const selector = screen.getByLabelText( dict.transactionsPage.holderSelectLabel ) as HTMLSelectElement ;

      expect( selector.value ).toBe( "u-beto" ) ;
      expect( screen.getByRole( "option" , { name: "Beto (vos)" } ) ).toBeTruthy() ;
      expect( screen.getByRole( "option" , { name: "Ana" } ) ).toBeTruthy() ;
    } ) ;

    it( "no aparece con una sola opción (uno mismo)" , () => {
      formulario( [ { userId: "u-beto" , nombre: "Beto" } ] ) ;

      expect( screen.queryByLabelText( dict.transactionsPage.holderSelectLabel ) ).toBeNull() ;
    } ) ;

    it( "no aparece sin titulares" , () => {
      formulario( [] ) ;

      expect( screen.queryByLabelText( dict.transactionsPage.holderSelectLabel ) ).toBeNull() ;
    } ) ;

    /** Completa lo mínimo del formulario y lo envía. */
    const enviar = async ( titularElegido?: string ) => {
      vi.mocked( createTransactionFromFormAction ).mockResolvedValue( { success: true , value: {} as never } ) ;
      formulario( [ { userId: "u-beto" , nombre: "Beto" } , { userId: "u-ana" , nombre: "Ana" } ] ) ;

      fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: "120" } } ) ;
      fireEvent.change( screen.getByLabelText( /Descripción/ ) , { target: { value: "Súper del barrio" } } ) ;
      fireEvent.change( screen.getByLabelText( /Cuenta de pago/ ) , { target: { value: "acc-1" } } ) ;

      if( titularElegido ) {
        fireEvent.change( screen.getByLabelText( dict.transactionsPage.holderSelectLabel ) , { target: { value: titularElegido } } ) ;
      }

      fireEvent.click( screen.getByRole( "button" , { name: "Guardar Transacción" } ) ) ;
      await waitFor( () => expect( createTransactionFromFormAction ).toHaveBeenCalledTimes( 1 ) ) ;

      return( vi.mocked( createTransactionFromFormAction ).mock.calls[0][0] ) ;
    } ;

    it( "manda holderUserId cuando se elige a otra persona" , async () => {
      vi.mocked( createTransactionFromFormAction ).mockClear() ;

      expect( (await enviar( "u-ana" )).holderUserId ).toBe( "u-ana" ) ;
    } ) ;

    it( "no manda holderUserId si se deja uno mismo (el valor por defecto)" , async () => {
      vi.mocked( createTransactionFromFormAction ).mockClear() ;

      expect( (await enviar()).holderUserId ).toBeUndefined() ;
    } ) ;
  } ) ;

  describe( "TransactionsControls — filtro «Titular»" , () => {
    const controles = ( holderOptions: { userId: string ; nombre: string }[] ) => render(
      <TransactionsControls
        searchTerm="" setSearchTerm={ () => {} }
        selectedAccount="" setSelectedAccount={ () => {} }
        selectedCategory="" setSelectedCategory={ () => {} }
        selectedType="" setSelectedType={ () => {} }
        selectedCurrency="" setSelectedCurrency={ () => {} }
        currencies={ [ "ARS" ] } accounts={[]} categories={[]}
        columns={[]} visibleColumns={[]}
        onToggleColumn={ () => {} } onShowAllColumns={ () => {} } onHideAllColumns={ () => {} } onClear={ () => {} }
        holderOptions={holderOptions}
        selectedHolder=""
        setSelectedHolder={ () => {} }
        holderDict={dict.transactionsPage}
      />
    ) ;

    it( "con más de un miembro muestra el filtro con todos los titulares" , () => {
      controles( [ { userId: "u-beto" , nombre: "Beto" } , { userId: "u-ana" , nombre: "Ana" } ] ) ;

      expect( screen.getByLabelText( dict.transactionsPage.holderFilterLabel ) ).toBeTruthy() ;
      expect( screen.getByRole( "option" , { name: dict.transactionsPage.holderFilterAll } ) ).toBeTruthy() ;
      expect( screen.getByRole( "option" , { name: "Ana" } ) ).toBeTruthy() ;
    } ) ;

    it( "con un solo miembro el filtro se oculta" , () => {
      controles( [ { userId: "u-beto" , nombre: "Beto" } ] ) ;

      expect( screen.queryByLabelText( dict.transactionsPage.holderFilterLabel ) ).toBeNull() ;
    } ) ;
  } ) ;
} ) ;
