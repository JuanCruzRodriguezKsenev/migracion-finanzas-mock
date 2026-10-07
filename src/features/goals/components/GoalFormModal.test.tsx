// @vitest-environment jsdom
/**
 * @file GoalFormModal.test.tsx
 * Validaciones junto al campo, alta con centavos enteros y edición con la divisa en sólo lectura.
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor }               from "@testing-library/react" ;
import React                                                   from "react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Goals
import { createGoalAction , updateGoalAction } from "../actions/goalsActions" ;
import { makeGoalView }                        from "../testing/goalViewFactory" ;
import type { GoalsPageDict }                  from "./goalsDict" ;
import { GoalFormModal }                       from "./GoalFormModal" ;


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

function renderForm( goal?: ReturnType< typeof makeGoalView >["goal"] ) {
  const onSuccess = vi.fn() ;
  render(
    <GoalFormModal
      isOpen={true}
      onClose={ () => {} }
      goal={goal}
      currencies={[ "ARS" , "USD" ]}
      defaultCurrency="ARS"
      dict={gDict}
      onSuccess={onSuccess}
    />
  ) ;
  return( { onSuccess } ) ;
}

describe( "GoalFormModal" , () => {
  // La fecha mal formada no se puede teclear: `<input type="date">` descarta ("sanitiza") cualquier valor inválido,
  // en el navegador y en jsdom. La validación de la fecha en el formulario queda como defensa y la cubre el esquema Zod.
  it( "nombre vacío y objetivo 0: error junto a cada campo, sin llamar al servidor" , () => {
    renderForm() ;
    fireEvent.change( screen.getByLabelText( /Objetivo/ ) , { target: { value: "0" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Crear meta" } ) ) ;

    expect( screen.getByText( gDict.nameRequired ) ).toBeDefined() ;
    expect( screen.getByText( gDict.targetInvalid ) ).toBeDefined() ;
    expect( createGoalAction ).not.toHaveBeenCalled() ;
  } ) ;

  it( "nombre de más de 150 caracteres se marca junto al campo" , () => {
    renderForm() ;
    fireEvent.change( screen.getByLabelText( /Nombre/ ) , { target: { value: "x".repeat( 151 ) } } ) ;
    fireEvent.change( screen.getByLabelText( /Objetivo/ ) , { target: { value: "100" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Crear meta" } ) ) ;
    expect( screen.getByText( gDict.nameTooLong ) ).toBeDefined() ;
    expect( createGoalAction ).not.toHaveBeenCalled() ;
  } ) ;

  it( "alta feliz: manda el objetivo en centavos enteros, la divisa, la fecha y la prioridad" , async () => {
    vi.mocked( createGoalAction ).mockResolvedValue( { success: true , value: makeGoalView().goal } as never ) ;
    const { onSuccess } = renderForm() ;

    fireEvent.change( screen.getByLabelText( /Nombre/ ) , { target: { value: "  Viaje  " } } ) ;
    fireEvent.change( screen.getByLabelText( /Objetivo/ ) , { target: { value: "2000000" } } ) ;
    fireEvent.change( screen.getByLabelText( /Fecha objetivo/ ) , { target: { value: "2027-08-06" } } ) ;
    fireEvent.change( screen.getByLabelText( /Prioridad/ ) , { target: { value: "high" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Crear meta" } ) ) ;

    await waitFor( () => expect( onSuccess ).toHaveBeenCalled() ) ;
    expect( createGoalAction ).toHaveBeenCalledWith( {
      name: "Viaje" , currency: "ARS" , targetAmount: 200000000 , targetDate: "2027-08-06" , priority: "high"
    } ) ;
  } ) ;

  it( "rechazo del servidor en FormError" , async () => {
    vi.mocked( createGoalAction ).mockResolvedValue( { success: false , error: "Error al crear la meta en el servidor." } as never ) ;
    renderForm() ;
    fireEvent.change( screen.getByLabelText( /Nombre/ ) , { target: { value: "Viaje" } } ) ;
    fireEvent.change( screen.getByLabelText( /Objetivo/ ) , { target: { value: "10" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Crear meta" } ) ) ;
    expect( ( await screen.findByRole( "alert" ) ).textContent ).toContain( "servidor" ) ;
  } ) ;

  it( "edición: precarga, divisa en sólo lectura y no envía divisa" , async () => {
    vi.mocked( updateGoalAction ).mockResolvedValue( { success: true , value: makeGoalView().goal } as never ) ;
    const goal          = makeGoalView( undefined , { currency: "USD" } ).goal ;
    const { onSuccess } = renderForm( goal ) ;

    expect( ( screen.getByLabelText( /Nombre/ ) as HTMLInputElement ).value ).toBe( "Viaje" ) ;
    expect( ( screen.getByLabelText( /Objetivo/ ) as HTMLInputElement ).value ).toBe( "2000000.00" ) ;
    expect( ( screen.getByLabelText( "Divisa" ) as HTMLSelectElement ).disabled ).toBe( true ) ;
    expect( screen.getByText( gDict.currencyReadOnly ) ).toBeDefined() ;

    fireEvent.click( screen.getByRole( "button" , { name: "Guardar cambios" } ) ) ;
    await waitFor( () => expect( onSuccess ).toHaveBeenCalled() ) ;
    const llamada = vi.mocked( updateGoalAction ).mock.calls[ 0 ][ 0 ] ;
    expect( llamada ).not.toHaveProperty( "currency" ) ;
    expect( llamada.targetAmount ).toBe( 200000000 ) ;
  } ) ;
} ) ;
