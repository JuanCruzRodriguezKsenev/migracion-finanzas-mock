// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor }                from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;
import { ok }            from "@/shared/lib/result" ;

// Feature: Cards
import { createInstallmentPlanAction }  from "../actions/installmentPlansActions" ;
import { InstallmentPlanFormModal }     from "./InstallmentPlanFormModal" ;
import { CardWithAccountsAndEntity }    from "../types" ;

// Mocks
vi.mock( "../actions/installmentPlansActions" , () => ( {
  createInstallmentPlanAction: vi.fn() ,
} ) ) ;

vi.mock( "@/features/profile/context/ProfileContext" , () => ( {
  useProfileContext: () => ( {
    profile: {
      timezone:     "America/Argentina/Buenos_Aires" ,
      numberFormat: "es-AR" ,
    } ,
  } ) ,
} ) ) ;

describe( "InstallmentPlanFormModal" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  const mockCard: CardWithAccountsAndEntity = {
    id:                      "card-1" ,
    organizationId:          "org-test" ,
    label:                   "Visa Galicia" ,
    type:                    "credit" ,
    network:                 "visa" ,
    lastFour:                "1234" ,
    expiryMonth:             10 ,
    expiryYear:              2030 ,
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
    accounts: [
      {
        id:        "ca-1" ,
        cardId:    "card-1" ,
        accountId: "acc-1" ,
        currency:  "ARS" ,
        createdAt: new Date() ,
        account: {
          id:             "acc-1" ,
          organizationId: "org-test" ,
          code:           "2.1.01.01" ,
          name:           "Tarjeta Visa" ,
          type:           "liability" ,
          balance:        0 ,
          currency:       "ARS" ,
          entityId:       null ,
          cbuCvu:         null ,
          alias:          null ,
          isCommonPot:    false ,
          createdAt:      new Date() ,
        } ,
      } ,
    ] ,
  } ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  it( "la trampa del mediodía: con closingDay 20 y compra el 2026-09-20 propone mes vigente (2026-09-05) y el 2026-09-21 el siguiente (2026-10-05)" , async () => {
    render(
      <InstallmentPlanFormModal
        card={mockCard}
        isOpen={true}
        onClose={vi.fn()}
        categoryTree={ [] }
        dict={dict}
        locale="es-AR"
        onSuccess={vi.fn()}
      />
    ) ;

    const inputFechaCompra = screen.getByLabelText( /Fecha de compra/i ) as HTMLInputElement ;
    const inputPrimeraCuota = screen.getByLabelText( /Primera cuota/i ) as HTMLInputElement ;

    // 1. Compra el mismo día de cierre: debe vencer en mes vigente (septiembre)
    fireEvent.change( inputFechaCompra , { target: { value: "2026-09-20" } } ) ;
    expect( inputPrimeraCuota.value ).toBe( "2026-09-05" ) ;

    // 2. Compra un día después del cierre: debe saltar al vencimiento del mes siguiente (octubre)
    fireEvent.change( inputFechaCompra , { target: { value: "2026-09-21" } } ) ;
    expect( inputPrimeraCuota.value ).toBe( "2026-10-05" ) ;
  } ) ;

  it( "editar a mano la primera cuota y después cambiar la fecha de compra no pisa lo editado" , () => {
    render(
      <InstallmentPlanFormModal
        card={mockCard}
        isOpen={true}
        onClose={vi.fn()}
        categoryTree={ [] }
        dict={dict}
        locale="es-AR"
        onSuccess={vi.fn()}
      />
    ) ;

    const inputFechaCompra = screen.getByLabelText( /Fecha de compra/i ) as HTMLInputElement ;
    const inputPrimeraCuota = screen.getByLabelText( /Primera cuota/i ) as HTMLInputElement ;

    // Editar manualmente la primera cuota (gracia de 3 meses)
    fireEvent.change( inputPrimeraCuota , { target: { value: "2027-01-10" } } ) ;
    expect( inputPrimeraCuota.value ).toBe( "2027-01-10" ) ;

    // Cambiar la fecha de compra no debe alterar la primera cuota elegida por el usuario
    fireEvent.change( inputFechaCompra , { target: { value: "2026-09-25" } } ) ;
    expect( inputPrimeraCuota.value ).toBe( "2027-01-10" ) ;
  } ) ;

  it( "el envío manda installmentAmount en centavos y totalInstallments sin multiplicar" , async () => {
    vi.mocked( createInstallmentPlanAction ).mockResolvedValueOnce( ok( {
      id: "plan-nuevo" ,
    } as never ) ) ;

    const onSuccess = vi.fn() ;

    render(
      <InstallmentPlanFormModal
        card={mockCard}
        isOpen={true}
        onClose={vi.fn()}
        categoryTree={ [] }
        dict={dict}
        locale="es-AR"
        onSuccess={onSuccess}
      />
    ) ;

    fireEvent.change( screen.getByLabelText( /Qué compraste/i ) , { target: { value: "Smart TV 55" } } ) ;
    fireEvent.change( screen.getByLabelText( /Comercio/i ) , { target: { value: "Frávega" } } ) ;
    fireEvent.change( screen.getByLabelText( /Importe de cada cuota/i ) , { target: { value: "15000.50" } } ) ;
    fireEvent.change( screen.getByLabelText( /Cantidad de cuotas/i ) , { target: { value: "6" } } ) ;
    fireEvent.change( screen.getByLabelText( /Fecha de compra/i ) , { target: { value: "2026-09-20" } } ) ;

    fireEvent.click( screen.getByRole( "button" , { name: /Registrar compra/i } ) ) ;

    await waitFor( () => {
      expect( createInstallmentPlanAction ).toHaveBeenCalledTimes( 1 ) ;
      const llamado = vi.mocked( createInstallmentPlanAction ).mock.calls[0][0] ;

      expect( llamado.installmentAmount ).toBe( 1500050 ) ; // 15000.50 * 100
      expect( llamado.totalInstallments ).toBe( 6 ) ;       // Entero sin multiplicar
      expect( llamado.purchasedAt ).toEqual( new Date( Date.UTC( 2026 , 8 , 20 , 12 , 0 , 0 ) ) ) ;
      expect( llamado.firstInstallmentDate ).toBe( "2026-09-05" ) ;
      expect( onSuccess ).toHaveBeenCalledTimes( 1 ) ;
    } ) ;
  } ) ;

  it( "la línea de total muestra importe × cantidad" , () => {
    render(
      <InstallmentPlanFormModal
        card={mockCard}
        isOpen={true}
        onClose={vi.fn()}
        categoryTree={ [] }
        dict={dict}
        locale="es-AR"
        onSuccess={vi.fn()}
      />
    ) ;

    fireEvent.change( screen.getByLabelText( /Importe de cada cuota/i ) , { target: { value: "10000" } } ) ;
    fireEvent.change( screen.getByLabelText( /Cantidad de cuotas/i ) , { target: { value: "12" } } ) ;

    // 10000 * 12 = 120000 -> $ 120.000,00
    expect( screen.getByText( /120\.000/ ) ).toBeDefined() ;
  } ) ;
} ) ;
