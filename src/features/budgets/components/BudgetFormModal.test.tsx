// @vitest-environment jsdom
/**
 * @file BudgetFormModal.test.tsx
 * Tests del modal de alta y edición de presupuestos (AC-14): conversión a centavos y errores junto al campo.
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor }                 from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Accounting
import type { Category , CategoryTreeNode } from "@/features/accounting/types" ;

// Feature: Budgets
import { createBudgetAction , updateBudgetLimitAction } from "../actions/budgetsActions" ;
import { BudgetFormModal }                              from "./BudgetFormModal" ;
import type { PresupuestoEvaluado }                     from "../types" ;


vi.mock( "../actions/budgetsActions" , () => ( {
  createBudgetAction:      vi.fn() ,
  updateBudgetLimitAction: vi.fn() ,
  deleteBudgetAction:      vi.fn() ,
} ) ) ;

function cat( id: string , name: string , parentId: string | null = null ): Category {
  return( {
    id , organizationId: "org-1" , parentId , name , icon: null , color: null , type: "expense" ,
    accountCode: id , archivedAt: null , isSystemLeaf: false , createdAt: new Date() ,
  } ) ;
}

const arbol: CategoryTreeNode[] = [
  { ...cat( "p-hogar" , "Hogar" ) , children: [ cat( "h-alquiler" , "Alquiler" , "p-hogar" ) ] } ,
] ;

const existente: PresupuestoEvaluado = {
  budgetId: "b-1" , categoryId: "h-alquiler" , categoryName: "Alquiler" , parentId: "p-hogar" , esPadre: false ,
  archivada: false , currency: "ARS" , limite: 150050 , gastado: 0 , restante: 150050 , porcentaje: 0 ,
  estado: "en_orden" , esSublimite: false ,
} ;

describe( "BudgetFormModal" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;
  const onSuccess = vi.fn() ;

  beforeAll( async () => { dict = await getDictionary( "es" ) ; } ) ;
  beforeEach( () => { vi.clearAllMocks() ; } ) ;

  function renderAlta() {
    return( render(
      <BudgetFormModal
        isOpen={true} onClose={vi.fn()} categoryTree={arbol} ocupados={new Set< string >()}
        currency="ARS" divisas={[ "ARS" , "USD" ]} dict={dict} onSuccess={onSuccess}
      />
    ) ) ;
  }

  it( "alta feliz: llama a la acción con centavos enteros" , async () => {
    vi.mocked( createBudgetAction ).mockResolvedValue( { success: true , value: {} as never } ) ;
    renderAlta() ;

    fireEvent.change( screen.getByLabelText( /Categoría/ ) , { target: { value: "h-alquiler" } } ) ;
    fireEvent.change( screen.getByLabelText( /Límite mensual/ ) , { target: { value: "1500,50" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Guardar" } ) ) ;

    await waitFor( () => { expect( onSuccess ).toHaveBeenCalled() ; } ) ;
    expect( createBudgetAction ).toHaveBeenCalledWith( { categoryId: "h-alquiler" , currency: "ARS" , amount: 150050 } ) ;
  } ) ;

  it.each( [ [ "0" ] , [ "-10" ] , [ "abc" ] ] )( "el límite «%s» no llama a la acción y muestra el error junto al campo con foco" , ( texto ) => {
    renderAlta() ;

    fireEvent.change( screen.getByLabelText( /Categoría/ ) , { target: { value: "h-alquiler" } } ) ;
    const campo = screen.getByLabelText( /Límite mensual/ ) ;
    fireEvent.change( campo , { target: { value: texto } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Guardar" } ) ) ;

    expect( createBudgetAction ).not.toHaveBeenCalled() ;
    expect( campo.getAttribute( "aria-invalid" ) ).toBe( "true" ) ;
    expect( document.activeElement ).toBe( campo ) ;
    const esperado = ( texto === "abc" ) ? dict.budgetsPage.form.limitInvalid : dict.budgetsPage.form.limitPositive ;
    expect( screen.getByText( esperado ) ).toBeDefined() ;
  } ) ;

  it( "sin categoría elegida no llama a la acción" , () => {
    renderAlta() ;

    fireEvent.change( screen.getByLabelText( /Límite mensual/ ) , { target: { value: "100" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Guardar" } ) ) ;

    expect( createBudgetAction ).not.toHaveBeenCalled() ;
    expect( screen.getByText( dict.budgetsPage.form.categoryRequired ) ).toBeDefined() ;
  } ) ;

  it( "edición: categoría y divisa en sólo lectura, límite precargado y llama a la acción de límite" , async () => {
    vi.mocked( updateBudgetLimitAction ).mockResolvedValue( { success: true , value: {} as never } ) ;
    render(
      <BudgetFormModal
        isOpen={true} onClose={vi.fn()} presupuesto={existente} categoryTree={arbol} ocupados={new Set< string >()}
        currency="ARS" divisas={[ "ARS" ]} dict={dict} onSuccess={onSuccess}
      />
    ) ;

    const categoria = screen.getByLabelText( /Categoría/ ) as HTMLInputElement ;
    const divisa    = screen.getByLabelText( /Divisa/ ) as HTMLInputElement ;
    const limite    = screen.getByLabelText( /Límite mensual/ ) as HTMLInputElement ;

    expect( categoria.disabled ).toBe( true ) ;
    expect( categoria.value ).toBe( "Alquiler" ) ;
    expect( divisa.disabled ).toBe( true ) ;
    expect( limite.value ).toBe( "1500.50" ) ;

    fireEvent.change( limite , { target: { value: "2000" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Guardar" } ) ) ;

    await waitFor( () => { expect( onSuccess ).toHaveBeenCalled() ; } ) ;
    expect( updateBudgetLimitAction ).toHaveBeenCalledWith( { budgetId: "b-1" , amount: 200000 } ) ;
    expect( createBudgetAction ).not.toHaveBeenCalled() ;
  } ) ;

  it( "muestra el error del servidor en el FormError" , async () => {
    vi.mocked( createBudgetAction ).mockResolvedValue( { success: false , error: "Ya hay un presupuesto vigente para esa categoría y divisa." } ) ;
    renderAlta() ;

    fireEvent.change( screen.getByLabelText( /Categoría/ ) , { target: { value: "h-alquiler" } } ) ;
    fireEvent.change( screen.getByLabelText( /Límite mensual/ ) , { target: { value: "100" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Guardar" } ) ) ;

    const alerta = await screen.findByRole( "alert" ) ;
    expect( alerta.textContent ).toContain( "Ya hay un presupuesto vigente" ) ;
    expect( onSuccess ).not.toHaveBeenCalled() ;
  } ) ;
} ) ;
