// @vitest-environment jsdom
/**
 * @file TransactionFormModal.personal.test.tsx
 * Plan 29 (RN-5, AC-12): en el espacio Personal el único titular posible es el dueño, así que el formulario
 * no ofrece «a nombre de» ni vista previa de reparto.
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll } from "vitest" ;
import { render , screen }                         from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Transactions
import { TransactionFormModal } from "./TransactionFormModal" ;


vi.mock( "@/features/accounting/actions/categoryActions" , () => ( {
  createCategoryAction: vi.fn() ,
} ) ) ;

vi.mock( "../actions/transactionsActions" , () => ( {
  createTransactionFromFormAction: vi.fn() ,
} ) ) ;

describe( "TransactionFormModal — espacio Personal (AC-12)" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  const montar = ( titulares: { userId: string ; nombre: string }[] ) => (
    render(
      <TransactionFormModal
        isOpen
        onClose={ () => {} }
        onSuccess={ () => {} }
        accounts={[]}
        titulares={titulares}
        holderDict={dict.transactionsPage}
      />
    )
  ) ;

  it( "con un solo titular posible (el dueño) no aparece «a nombre de»" , () => {
    montar( [ { userId: "u-juan" , nombre: "Juan" } ] ) ;

    expect( screen.queryByLabelText( dict.transactionsPage.holderSelectLabel ) ).toBeNull() ;
  } ) ;

  it( "control: con más de un titular posible el selector sí aparece" , () => {
    montar( [ { userId: "u-juan" , nombre: "Juan" } , { userId: "u-ana" , nombre: "Ana" } ] ) ;

    expect( screen.getByLabelText( dict.transactionsPage.holderSelectLabel ) ).toBeTruthy() ;
  } ) ;
} ) ;
