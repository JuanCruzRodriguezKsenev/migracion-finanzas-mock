// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor }                from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;
import { ok }            from "@/shared/lib/result" ;

// Feature: Accounting
import type { Account } from "@/features/accounting/types" ;

// Feature: Loans
import { PendingLoanSettlementsInbox } from "./PendingLoanSettlementsInbox" ;
import { payLoanInstallmentAction }    from "../actions/loansActions" ;
import type { Loan , PendienteCuota }  from "../types" ;
import { makeLoan }                    from "../testing/loanFactory" ;


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
  payLoanInstallmentAction: vi.fn()
} ) ) ;

const mockAccountARS: Account = {
  id:             "acc-ars-1" ,
  organizationId: "org-1" ,
  code:           "1.1.01.01" ,
  name:           "Caja de Ahorro ARS" ,
  type:           "asset" ,
  balance:        5000000 ,
  currency:       "ARS" ,
  entityId:       null ,
  cbuCvu:         null ,
  alias:          null ,
  isCommonPot:    false ,
  createdAt:      new Date()
} ;

function makePendiente( n: number , loan: Loan , overrides?: Partial< PendienteCuota > ): PendienteCuota {
  return( {
    loanId:        loan.id ,
    n ,
    fechaCuota:    `2026-1${n}-10` ,
    cuota:         100000 ,
    interes:       10000 ,
    capital:       90000 ,
    saldoRestante: 500000 ,
    loan ,
    ...overrides
  } ) ;
}

describe( "PendingLoanSettlementsInbox" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  it( "1. sin pendientes retorna null y no renderiza nada" , () => {
    const { container } = render(
      <PendingLoanSettlementsInbox
        initialPending={[]}
        accounts={[ mockAccountARS ]}
        dict={dict}
      />
    ) ;

    expect( container.firstChild ).toBeNull() ;
  } ) ;

  it( "2. con tres pendientes de un mismo préstamo, hay una sola fila y aparece moreOverdue" , () => {
    const loan = makeLoan( { id: "loan-unique-1" , name: "Préstamo En Mora" } ) ;
    const p1   = makePendiente( 1 , loan , { fechaCuota: "2026-07-10" } ) ;
    const p2   = makePendiente( 2 , loan , { fechaCuota: "2026-08-10" } ) ;
    const p3   = makePendiente( 3 , loan , { fechaCuota: "2026-09-10" } ) ;

    render(
      <PendingLoanSettlementsInbox
        initialPending={[ p1 , p2 , p3 ]}
        accounts={[ mockAccountARS ]}
        dict={dict}
      />
    ) ;

    // Solo debe haber un botón "Liquidar"
    const settleButtons = screen.getAllByText( dict.loansPage.settlement.settle ) ;
    expect( settleButtons ).toHaveLength( 1 ) ;

    // Debe mostrar la insignia con "+2 vencidas más"
    const expectedOverdue = dict.loansPage.settlement.moreOverdue.replace( "{count}" , "2" ) ;
    expect( screen.getByText( expectedOverdue ) ).toBeDefined() ;
  } ) ;

  it( "3. abrir el modal y confirmar llama a payLoanInstallmentAction con la cuota más antigua" , async () => {
    const loan = makeLoan( { id: "loan-settle-1" , name: "Préstamo Para Liquidar" , direction: "borrowed" , currency: "ARS" } ) ;
    const p1   = makePendiente( 1 , loan , { fechaCuota: "2026-08-10" } ) ;
    const p2   = makePendiente( 2 , loan , { fechaCuota: "2026-09-10" } ) ;

    vi.mocked( payLoanInstallmentAction ).mockResolvedValue(
      ok( { loan , transactionId: "tx-mock-123" } )
    ) ;

    render(
      <PendingLoanSettlementsInbox
        initialPending={[ p1 , p2 ]}
        accounts={[ mockAccountARS ]}
        dict={dict}
      />
    ) ;

    // Click en "Liquidar"
    const settleBtn = screen.getByText( dict.loansPage.settlement.settle ) ;
    fireEvent.click( settleBtn ) ;

    // Modal se abre
    expect( screen.getByText( dict.loansPage.settlement.modalTitle ) ).toBeDefined() ;

    // Confirmar pago
    const confirmBtn = screen.getByText( dict.loansPage.settlement.confirmPayment ) ;
    fireEvent.click( confirmBtn ) ;

    await waitFor( () => {
      expect( payLoanInstallmentAction ).toHaveBeenCalledWith( {
        loanId:            "loan-settle-1" ,
        paymentAccountId:  mockAccountARS.id ,
        installmentNumber: 1
      } ) ;
    } ) ;
  } ) ;

  it( "4. sin cuentas de la divisa del préstamo el botón de confirmar está disabled" , () => {
    // Préstamo en USD y sólo cuenta en ARS
    const loanUSD = makeLoan( { id: "loan-usd-1" , name: "Préstamo Dólares" , currency: "USD" , direction: "borrowed" } ) ;
    const pUSD    = makePendiente( 1 , loanUSD ) ;

    render(
      <PendingLoanSettlementsInbox
        initialPending={[ pUSD ]}
        accounts={[ mockAccountARS ]}
        dict={dict}
      />
    ) ;

    const settleBtn = screen.getByText( dict.loansPage.settlement.settle ) ;
    fireEvent.click( settleBtn ) ;

    // Debe mostrar advertencia de falta de cuenta en la divisa
    expect( screen.getByText( dict.loansPage.settlement.noAccountForCurrency ) ).toBeDefined() ;

    // Botón de confirmar disabled
    const confirmBtn = screen.getByText( dict.loansPage.settlement.confirmPayment ) ;
    expect( confirmBtn.closest( "button" )?.disabled ).toBe( true ) ;
  } ) ;
} ) ;
