// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor }                from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;
import { ok , fail }     from "@/shared/lib/result" ;

// Feature: Cards
import { resolveInstallmentAction }   from "../actions/installmentPlansActions" ;
import { makeInstallmentPlan }        from "../testing/installmentPlanFactory" ;
import { PendingInstallmentsInbox }   from "./PendingInstallmentsInbox" ;
import { CardWithAccountsAndEntity } from "../types" ;
import { PendienteCuota }             from "../types" ;

// Mocks
vi.mock( "../actions/installmentPlansActions" , () => ( {
  resolveInstallmentAction: vi.fn() ,
} ) ) ;

describe( "PendingInstallmentsInbox" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  const mockCards: CardWithAccountsAndEntity[] = [
    {
      id:                      "card-1" ,
      organizationId:          "org-test" ,
      label:                   "Galicia Visa" ,
      type:                    "credit" ,
      network:                 "visa" ,
      lastFour:                "1111" ,
      expiryMonth:             12 ,
      expiryYear:              2028 ,
      creditLimit:             50000000 ,
      closingDay:              20 ,
      dueDay:                  5 ,
      monthlyMaintenanceFee:   0 ,
      annualRenewalFee:        0 ,
      interestRateFinancing:   null ,
      interestRatePenalty:     null ,
      entityId:                null ,
      linkedAccountId:         null ,
      archivedAt:              null ,
      createdAt:               new Date() ,
      updatedAt:               new Date() ,
      accounts:                [] ,
    } ,
    {
      id:                      "card-2" ,
      organizationId:          "org-test" ,
      label:                   "Santander Amex" ,
      type:                    "credit" ,
      network:                 "amex" ,
      lastFour:                "2222" ,
      expiryMonth:             10 ,
      expiryYear:              2029 ,
      creditLimit:             80000000 ,
      closingDay:              25 ,
      dueDay:                  10 ,
      monthlyMaintenanceFee:   0 ,
      annualRenewalFee:        0 ,
      interestRateFinancing:   null ,
      interestRatePenalty:     null ,
      entityId:                null ,
      linkedAccountId:         null ,
      archivedAt:              null ,
      createdAt:               new Date() ,
      updatedAt:               new Date() ,
      accounts:                [] ,
    } ,
  ] ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  it( "con la lista vacía no renderiza nada (container.firstChild es null)" , () => {
    const { container } = render(
      <PendingInstallmentsInbox
        initialPending={ [] }
        cards={mockCards}
        dict={dict}
      />
    ) ;

    expect( container.firstChild ).toBeNull() ;
  } ) ;

  it( "con dos pendientes de dos tarjetas, cada fila muestra la etiqueta de su tarjeta" , () => {
    const plan1 = makeInstallmentPlan( { id: "plan-1" , cardId: "card-1" , description: "Heladera Samsung" } ) ;
    const plan2 = makeInstallmentPlan( { id: "plan-2" , cardId: "card-2" , description: "Pasaje Madrid" } ) ;

    const items: PendienteCuota[] = [
      { planId: "plan-1" , numeroCuota: 3 , fechaCuota: "2026-10-10" , plan: plan1 } ,
      { planId: "plan-2" , numeroCuota: 1 , fechaCuota: "2026-10-15" , plan: plan2 } ,
    ] ;

    render(
      <PendingInstallmentsInbox
        initialPending={items}
        cards={mockCards}
        dict={dict}
      />
    ) ;

    expect( screen.getByText( "Heladera Samsung" ) ).toBeDefined() ;
    expect( screen.getByText( /Galicia Visa/ ) ).toBeDefined() ;

    expect( screen.getByText( "Pasaje Madrid" ) ).toBeDefined() ;
    expect( screen.getByText( /Santander Amex/ ) ).toBeDefined() ;
  } ) ;

  it( "al confirmar, se llama resolveInstallmentAction con planId, occurrenceDate y action: confirm (sin accountId) y la fila desaparece" , async () => {
    vi.mocked( resolveInstallmentAction ).mockResolvedValueOnce( ok( {
      plan: makeInstallmentPlan( { id: "plan-1" } ) ,
    } ) ) ;

    const plan1 = makeInstallmentPlan( { id: "plan-1" , cardId: "card-1" , description: "Heladera Samsung" } ) ;
    const items: PendienteCuota[] = [
      { planId: "plan-1" , numeroCuota: 3 , fechaCuota: "2026-10-10" , plan: plan1 } ,
    ] ;

    render(
      <PendingInstallmentsInbox
        initialPending={items}
        cards={mockCards}
        dict={dict}
      />
    ) ;

    const btnConfirmar = screen.getByRole( "button" , { name: "Confirmar" } ) ;
    fireEvent.click( btnConfirmar ) ;

    await waitFor( () => {
      expect( resolveInstallmentAction ).toHaveBeenCalledTimes( 1 ) ;
      expect( resolveInstallmentAction ).toHaveBeenCalledWith( {
        planId:         "plan-1" ,
        occurrenceDate: "2026-10-10" ,
        action:         "confirm" ,
      } ) ;
      // Verifica explícitamente que no viaja accountId
      const llamado = vi.mocked( resolveInstallmentAction ).mock.calls[0][0] ;
      expect( ( llamado as unknown as Record< string , unknown > ).accountId ).toBeUndefined() ;
    } ) ;

    await waitFor( () => {
      expect( screen.queryByText( "Heladera Samsung" ) ).toBeNull() ;
    } ) ;
  } ) ;

  it( "si la acción devuelve fail, el error se muestra y la fila no desaparece" , async () => {
    vi.mocked( resolveInstallmentAction ).mockResolvedValueOnce( fail( "Error al registrar en el libro mayor" ) ) ;

    const plan1 = makeInstallmentPlan( { id: "plan-1" , cardId: "card-1" , description: "Heladera Samsung" } ) ;
    const items: PendienteCuota[] = [
      { planId: "plan-1" , numeroCuota: 3 , fechaCuota: "2026-10-10" , plan: plan1 } ,
    ] ;

    render(
      <PendingInstallmentsInbox
        initialPending={items}
        cards={mockCards}
        dict={dict}
      />
    ) ;

    const btnConfirmar = screen.getByRole( "button" , { name: "Confirmar" } ) ;
    fireEvent.click( btnConfirmar ) ;

    await waitFor( () => {
      expect( screen.getByText( "Error al registrar en el libro mayor" ) ).toBeDefined() ;
      expect( screen.getByText( "Heladera Samsung" ) ).toBeDefined() ;
    } ) ;
  } ) ;
} ) ;
