// @vitest-environment jsdom
/**
 * @file ContributeModal.test.tsx
 * Aporte feliz con centavos enteros, sin cuenta compatible (A2), error del servidor en FormError y retiro por cuenta con reserva.
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor }               from "@testing-library/react" ;
import React                                                   from "react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Goals
import { contributeToGoalAction , withdrawFromGoalAction } from "../actions/goalsActions" ;
import { makeGoalView , makeAccount }                      from "../testing/goalViewFactory" ;
import type { GoalsPageDict }                              from "./goalsDict" ;
import { ContributeModal }                                 from "./ContributeModal" ;


vi.mock( "../actions/goalsActions" , () => ( {
  contributeToGoalAction: vi.fn() ,
  withdrawFromGoalAction: vi.fn() ,
  createGoalAction:       vi.fn() ,
  updateGoalAction:       vi.fn() ,
  abandonGoalAction:      vi.fn()
} ) ) ;

let gDict: GoalsPageDict ;

beforeAll( async () => {
  gDict = ( await getDictionary( "es" ) ).goalsPage ;
} ) ;

beforeEach( () => {
  vi.clearAllMocks() ;
} ) ;

function renderModal( props: { mode: "contribute" | "withdraw" ; view?: ReturnType< typeof makeGoalView > ; cuentas?: ReturnType< typeof makeAccount >[] } ) {
  const onSuccess = vi.fn() ;
  render(
    <ContributeModal
      isOpen={true}
      onClose={ () => {} }
      mode={props.mode}
      view={props.view ?? makeGoalView()}
      cuentas={props.cuentas ?? [ makeAccount() ]}
      dict={gDict}
      locale="es-AR"
      onSuccess={onSuccess}
    />
  ) ;
  return( { onSuccess } ) ;
}

describe( "ContributeModal" , () => {
  it( "aportar feliz: llama a la acción con centavos enteros y avisa el éxito" , async () => {
    vi.mocked( contributeToGoalAction ).mockResolvedValue( { success: true , value: { status: "active" , ahorrado: 1 } } as never ) ;
    const { onSuccess } = renderModal( { mode: "contribute" } ) ;

    fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: "1500,50" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Aportar" } ) ) ;

    await waitFor( () => expect( onSuccess ).toHaveBeenCalledTimes( 1 ) ) ;
    expect( contributeToGoalAction ).toHaveBeenCalledWith( {
      goalId:    "11111111-1111-4111-8111-111111111111" ,
      accountId: "33333333-3333-4333-8333-333333333333" ,
      amount:    150050
    } ) ;
    expect( Number.isInteger( vi.mocked( contributeToGoalAction ).mock.calls[ 0 ][ 0 ].amount ) ).toBe( true ) ;
  } ) ;

  it( "ofrece las cuentas compatibles con su saldo libre" , () => {
    renderModal( { mode: "contribute" } ) ;
    expect( screen.getByRole( "option" , { name: /Caja de ahorro · libre .*800\.000,00/ } ) ).toBeDefined() ;
  } ) ;

  it( "A2: sin cuenta compatible lo dice y deshabilita «Aportar»" , () => {
    renderModal( { mode: "contribute" , cuentas: [] } ) ;
    expect( screen.getByText( gDict.noCompatibleAccounts ) ).toBeDefined() ;
    expect( ( screen.getByRole( "button" , { name: "Aportar" } ) as HTMLButtonElement ).disabled ).toBe( true ) ;
  } ) ;

  it( "monto mayor al libre: el error del servidor se muestra en FormError" , async () => {
    vi.mocked( contributeToGoalAction ).mockResolvedValue( { success: false , error: "El monto supera el saldo libre de la cuenta ($ 800.000,00)." } as never ) ;
    const { onSuccess } = renderModal( { mode: "contribute" } ) ;

    fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: "9000000" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Aportar" } ) ) ;

    const alerta = await screen.findByRole( "alert" ) ;
    expect( alerta.textContent ).toContain( "saldo libre" ) ;
    expect( onSuccess ).not.toHaveBeenCalled() ;
  } ) ;

  it( "un monto inválido se marca junto al campo y no llama al servidor" , () => {
    renderModal( { mode: "contribute" } ) ;
    fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: "0" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Aportar" } ) ) ;
    expect( screen.getByText( gDict.amountInvalid ) ).toBeDefined() ;
    expect( contributeToGoalAction ).not.toHaveBeenCalled() ;
  } ) ;

  it( "retirar sólo ofrece las cuentas donde esa meta tiene algo apartado, con lo apartado" , async () => {
    vi.mocked( withdrawFromGoalAction ).mockResolvedValue( { success: true , value: { status: "active" , ahorrado: 0 } } as never ) ;
    const view = makeGoalView( { reservas: [ { accountId: "44444444-4444-4444-8444-444444444444" , accountName: "Cuenta B" , amount: 5000000 } ] } ) ;
    const { onSuccess } = renderModal( { mode: "withdraw" , view , cuentas: [ makeAccount() , makeAccount( { id: "44444444-4444-4444-8444-444444444444" , name: "Cuenta B" } ) ] } ) ;

    const opciones = screen.getAllByRole( "option" ) ;
    expect( opciones ).toHaveLength( 1 ) ;
    expect( opciones[ 0 ].textContent ).toMatch( /Cuenta B · apartado .*50\.000,00/ ) ;

    fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: "100" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Retirar" } ) ) ;
    await waitFor( () => expect( onSuccess ).toHaveBeenCalled() ) ;
    expect( withdrawFromGoalAction ).toHaveBeenCalledWith( expect.objectContaining( { accountId: "44444444-4444-4444-8444-444444444444" , amount: 10000 } ) ) ;
  } ) ;

  it( "retirar sin nada apartado lo explica y deshabilita el botón" , () => {
    renderModal( { mode: "withdraw" } ) ;
    expect( screen.getByText( gDict.noReserves ) ).toBeDefined() ;
    expect( ( screen.getByRole( "button" , { name: "Retirar" } ) as HTMLButtonElement ).disabled ).toBe( true ) ;
  } ) ;
} ) ;
