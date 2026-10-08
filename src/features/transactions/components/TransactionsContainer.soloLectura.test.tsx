// @vitest-environment jsdom
/**
 * @file TransactionsContainer.soloLectura.test.tsx
 * Un `viewer` ve los movimientos y su detalle, pero ninguna alta, edición, reversa ni borrado (RN-22, AC-18).
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { screen , fireEvent }                                    from "@testing-library/react" ;

// Shared
import { renderConPermisos as render } from "@/shared/lib/renderConPermisos" ;
import { getDictionary }               from "@/shared/lib/dictionary" ;

// Feature: Notifications
import { NotificationsProvider } from "@/features/notifications/context/NotificationsContext" ;

// Feature: Profile
import { ProfileProvider }  from "@/features/profile/context/ProfileContext" ;
import type { ProfileData } from "@/features/profile/types" ;

// Feature: Accounting
import type { TransactionWithEntries } from "@/features/accounting/repositories/ledgerRepository" ;
import type { Account }                from "@/features/accounting/types" ;

// Feature: Transactions
import { TransactionsContainer } from "./TransactionsContainer" ;


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

vi.mock( "@/features/accounting/actions/categoryActions" , () => ( { createCategoryAction: vi.fn() } ) ) ;
vi.mock( "@/features/accounting/actions/cuentasPersonalesActions" , () => ( { compartirCuentaAction: vi.fn() } ) ) ;
vi.mock( "@/features/splits/actions/acuerdoActions" , () => ( { previsualizarRepartoAction: vi.fn() } ) ) ;

const perfil: ProfileData = {
  userId: "11111111-1111-4111-8111-111111111111" , phone: null , currency: "ARS" ,
  timezone: "America/Argentina/Buenos_Aires" , bio: null , theme: "light" , defaultView: "dashboard" ,
  fastLogin: true , weeklyStart: "monday" , dateFormat: "DD/MM/YYYY" , numberFormat: "es-AR" ,
  roundAmounts: false , includeTransfers: true , defaultAccount: null ,
  planName: "Básico" , planBilling: "Mensual" , planNextCharge: "" ,
} ;

const cuenta = ( id: string , name: string , type: string ): Account => ( {
  id , organizationId: "org-1" , code: `9.${name}` , name , type , balance: 0 ,
  currency: "ARS" , entityId: null , cbuCvu: null , alias: null , isCommonPot: false , ownerUserId: null , createdAt: new Date() ,
} as unknown as Account ) ;

const movimiento: TransactionWithEntries = {
  id: "tx-1" , organizationId: "org-1" , categoryId: null , description: "Súper del barrio" , merchantName: null , merchantDomain: null ,
  occurredAt: new Date( "2026-10-01T12:00:00Z" ) , createdAt: new Date( "2026-10-01T12:00:00Z" ) ,
  reversesTransactionId: null , reversedAt: null , createdByUserId: null , holderUserId: null , absorbedByHolder: false ,
  entries: [
    { id: "e-1" , transactionId: "tx-1" , accountId: "acc-banco" , debit: 0     , credit: 12000 , currency: "ARS" , createdAt: new Date() } ,
    { id: "e-2" , transactionId: "tx-1" , accountId: "acc-gasto" , debit: 12000 , credit: 0     , currency: "ARS" , createdAt: new Date() } ,
  ] ,
} as unknown as TransactionWithEntries ;

describe( "TransactionsContainer — solo lectura (RN-22)" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  const montar = ( puedeEscribir: boolean ) => render(
    <NotificationsProvider>
      <ProfileProvider initialProfile={perfil}>
        <TransactionsContainer
          initialTransactions={ [ movimiento ] }
          initialNextCursor={null}
          initialHasMore={false}
          accounts={ [ cuenta( "acc-banco" , "Banco" , "asset" ) , cuenta( "acc-gasto" , "Supermercado" , "expense" ) ] }
          categories={[]}
          dict={dict}
        />
      </ProfileProvider>
    </NotificationsProvider> ,
    { puedeEscribir }
  ) ;

  it( "con permiso: «Nueva Transacción» y, en el detalle, guardar, reversar y eliminar" , () => {
    montar( true ) ;

    expect( screen.getByText( "+ Nueva Transacción" ) ).toBeDefined() ;

    fireEvent.click( screen.getByText( "Súper del barrio" ) ) ;

    expect( screen.getByText( "Reversar Asiento" ) ).toBeDefined() ;
    expect( screen.getByText( "Eliminar" ) ).toBeDefined() ;
    expect( screen.getByText( "Guardar Cambios" ) ).toBeDefined() ;
  } ) ;

  it( "sin permiso: se ve el movimiento y su detalle, pero ni alta, ni guardar, ni reversar, ni eliminar" , () => {
    montar( false ) ;

    expect( screen.queryByText( "+ Nueva Transacción" ) ).toBeNull() ;

    fireEvent.click( screen.getByText( "Súper del barrio" ) ) ;

    expect( screen.getByText( "Detalle del Asiento Contable" ) ).toBeDefined() ;
    expect( screen.getByText( "Cerrar" ) ).toBeDefined() ;
    expect( screen.queryByText( "Reversar Asiento" ) ).toBeNull() ;
    expect( screen.queryByText( "Eliminar" ) ).toBeNull() ;
    expect( screen.queryByText( "Guardar Cambios" ) ).toBeNull() ;
  } ) ;
} ) ;
