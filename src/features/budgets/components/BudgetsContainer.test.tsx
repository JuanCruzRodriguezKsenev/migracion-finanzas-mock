// @vitest-environment jsdom
/**
 * @file BudgetsContainer.test.tsx
 * Tests del contenedor y la fila de presupuestos con diccionario y provider reales (AC-2, AC-3, AC-15, AC-16).
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { screen , fireEvent , within , waitFor } from "@testing-library/react" ;
import React                                                    from "react" ;

// Shared
import { renderConPermisos as render } from "@/shared/lib/renderConPermisos" ;
import { MetricsVisibilityContext } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { getDictionary }            from "@/shared/lib/dictionary" ;

// Feature: Accounting
import type { CategoryTreeNode } from "@/features/accounting/types" ;

// Feature: Budgets
import { deleteBudgetAction }  from "../actions/budgetsActions" ;
import { resumen }             from "../services/budgetEvaluation" ;
import { BudgetsContainer }    from "./BudgetsContainer" ;
import type { EvaluacionMes , PresupuestoEvaluado } from "../types" ;


const routerMock = vi.hoisted( () => ( { push: vi.fn() , replace: vi.fn() , refresh: vi.fn() } ) ) ;

vi.mock( "next/navigation" , () => ( {
  useRouter:       () => routerMock ,
  usePathname:     () => "/es/budgets" ,
  useParams:       () => ( { lang: "es" } ) ,
  useSearchParams: () => new URLSearchParams() ,
} ) ) ;

vi.mock( "../actions/budgetsActions" , () => ( {
  createBudgetAction:      vi.fn() ,
  updateBudgetLimitAction: vi.fn() ,
  deleteBudgetAction:      vi.fn() ,
} ) ) ;

function pres( id: string , nombre: string , limite: number , gastado: number , extra: Partial< PresupuestoEvaluado > = {} ): PresupuestoEvaluado {
  const pct = Math.round( (gastado * 100) / limite ) ;
  return( {
    budgetId: `b-${id}` , categoryId: id , categoryName: nombre , parentId: null , esPadre: false , archivada: false ,
    currency: "ARS" , limite , gastado , restante: limite - gastado , porcentaje: pct ,
    estado: ( (gastado * 100) > (limite * 100) ) ? "excedido" : ( (gastado * 100) >= (limite * 85) ) ? "en_alerta" : "en_orden" ,
    esSublimite: false ,
    ...extra ,
  } ) ;
}

function evaluacion( presupuestos: PresupuestoEvaluado[] , extra: Partial< EvaluacionMes > = {} ): EvaluacionMes {
  return( { presupuestos , resumen: resumen( presupuestos ) , divisas: [ "ARS" ] , monthKey: "2026-10" , diasRestantes: 12 , ...extra } ) ;
}

const arbol: CategoryTreeNode[] = [] ;

// Importes distintivos para detectarlos en pantalla
const orden     = pres( "a" , "Ocio" , 1000000 , 500000 ) ;             // 50 %
const alerta    = pres( "b" , "Transporte" , 1000000 , 900000 ) ;       // 90 %
const excedido  = pres( "c" , "Hogar" , 1000000 , 1040000 ) ;           // 104 %
const sub       = pres( "d" , "Alquiler" , 400000 , 123456 , { parentId: "c" , esSublimite: true } ) ;

describe( "BudgetsContainer" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => { dict = await getDictionary( "es" ) ; } ) ;
  beforeEach( () => { vi.clearAllMocks() ; } ) ;

  function renderContainer( ev: EvaluacionMes , opciones: { puedeEscribir?: boolean ; visible?: boolean } = {} ) {
    return( render(
      <MetricsVisibilityContext.Provider value={ { isContentVisible: opciones.visible ?? true , toggleVisibility: vi.fn() } }>
        <BudgetsContainer
          evaluacion={ev}
          currency="ARS"
          categoryTree={arbol}
          dict={dict}
          lang="es"
        />
      </MetricsVisibilityContext.Provider> ,
      { puedeEscribir: ( opciones.puedeEscribir ?? true ) }
    ) ) ;
  }

  it( "muestra los tres estados con su texto (no sólo color) y la barra de cada fila" , () => {
    renderContainer( evaluacion( [ orden , alerta , excedido ] ) ) ;

    const lista = screen.getByRole( "list" , { name: dict.budgetsPage.listAriaLabel } ) ;
    expect( within( lista ).getByText( "En orden" ) ).toBeDefined() ;
    expect( within( lista ).getByText( "En alerta" ) ).toBeDefined() ;
    expect( within( lista ).getByText( "Excedido" ) ).toBeDefined() ;
    expect( within( lista ).getAllByRole( "progressbar" ) ).toHaveLength( 3 ) ;
    expect( screen.getByRole( "progressbar" , { name: "Hogar: 104 % utilizado, Excedido" } ) ).toBeDefined() ;
  } ) ;

  it( "muestra «excedido por X» y «restante X»" , () => {
    renderContainer( evaluacion( [ orden , excedido ] ) ) ;

    expect( screen.getByText( /excedido por .*400,00/ ) ).toBeDefined() ;
    expect( screen.getByText( /restante .*5\.000,00/ ) ).toBeDefined() ;
  } ) ;

  it( "ordena las raíces de mayor a menor porcentaje usado" , () => {
    renderContainer( evaluacion( [ orden , excedido , alerta ] ) ) ;

    const nombres = within( screen.getByRole( "list" , { name: dict.budgetsPage.listAriaLabel } ) )
      .getAllByRole( "progressbar" )
      .map( ( b ) => { return( b.getAttribute( "aria-label" )!.split( ":" )[ 0 ] ) ; } ) ;

    expect( nombres ).toEqual( [ "Hogar" , "Transporte" , "Ocio" ] ) ;
  } ) ;

  it( "muestra el sub-límite dentro de su padre y no suma su límite al total" , () => {
    renderContainer( evaluacion( [ excedido , sub ] ) ) ;

    const filaPadre = screen.getAllByRole( "listitem" ).find( ( li ) => { return( li.textContent?.includes( "Hogar" ) && li.querySelector( "ul" ) ) ; } )! ;
    expect( within( filaPadre ).getByText( "Alquiler" ) ).toBeDefined() ;
    expect( within( filaPadre ).getByText( dict.budgetsPage.subLimitTag ) ).toBeDefined() ;
    // El total del resumen es el del padre (10.000,00), sin sumar 4.000,00
    expect( screen.getByText( /Gastado .*10\.400,00 de .*10\.000,00/ ) ).toBeDefined() ;
  } ) ;

  it( "con el ojito cerrado no hay ningún importe legible, pero sí porcentajes y estados (AC-16)" , () => {
    renderContainer( evaluacion( [ orden , alerta , excedido , sub ] ) , { visible: false } ) ;

    const texto = document.body.textContent || "" ;
    expect( texto ).not.toContain( "$" ) ;
    expect( texto ).not.toMatch( /[0-9]\.[0-9]{3},[0-9]{2}/ ) ;
    expect( texto ).not.toMatch( /[0-9]+,[0-9]{2}/ ) ;
    expect( screen.getAllByText( /••••••/ ).length ).toBeGreaterThan( 0 ) ;
    expect( screen.getByText( "50 % utilizado" ) ).toBeDefined() ;
    expect( screen.getByText( "104 % utilizado" ) ).toBeDefined() ;
    expect( screen.getByText( "Excedido" ) ).toBeDefined() ;
  } ) ;

  it( "estado vacío del mes en curso (A1): invita a crear el primero" , () => {
    renderContainer( evaluacion( [] ) ) ;

    expect( screen.getByText( dict.budgetsPage.emptyTitle ) ).toBeDefined() ;
    expect( screen.getByRole( "button" , { name: dict.budgetsPage.emptyAction } ) ).toBeDefined() ;
  } ) ;

  it( "mes anterior a todos los presupuestos (A2): «Sin presupuestos en este mes»" , () => {
    renderContainer( evaluacion( [] , { monthKey: "2026-03" , diasRestantes: null } ) ) ;

    expect( screen.getByText( dict.budgetsPage.noBudgetsMonthTitle ) ).toBeDefined() ;
    expect( screen.queryByText( dict.budgetsPage.emptyTitle ) ).toBeNull() ;
  } ) ;

  it( "con permiso de escritura hay «Nuevo», «Editar» y «Eliminar»" , () => {
    renderContainer( evaluacion( [ orden ] ) , { puedeEscribir: true } ) ;

    expect( screen.getByRole( "button" , { name: dict.budgetsPage.newBudget } ) ).toBeDefined() ;
    expect( screen.getByRole( "button" , { name: "Editar Ocio" } ) ).toBeDefined() ;
    expect( screen.getByRole( "button" , { name: "Eliminar Ocio" } ) ).toBeDefined() ;
  } ) ;

  it( "sin permiso de escritura no hay «Nuevo», «Editar» ni «Eliminar» (AC-15), ni en el vacío" , () => {
    const { unmount } = renderContainer( evaluacion( [ orden ] ) , { puedeEscribir: false } ) ;

    expect( screen.queryByRole( "button" , { name: dict.budgetsPage.newBudget } ) ).toBeNull() ;
    expect( screen.queryByRole( "button" , { name: /Editar/ } ) ).toBeNull() ;
    expect( screen.queryByRole( "button" , { name: /Eliminar/ } ) ).toBeNull() ;
    expect( screen.getByText( "Ocio" ) ).toBeDefined() ;
    unmount() ;

    renderContainer( evaluacion( [] ) , { puedeEscribir: false } ) ;
    expect( screen.queryByRole( "button" , { name: dict.budgetsPage.emptyAction } ) ).toBeNull() ;
  } ) ;

  it( "eliminar pide confirmación y, si se acepta, llama a la acción y refresca" , async () => {
    vi.mocked( deleteBudgetAction ).mockResolvedValue( { success: true , value: {} as never } ) ;
    const confirmSpy = vi.spyOn( window , "confirm" ) ;

    confirmSpy.mockReturnValueOnce( false ) ;
    renderContainer( evaluacion( [ orden ] ) ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Eliminar Ocio" } ) ) ;
    expect( deleteBudgetAction ).not.toHaveBeenCalled() ;

    confirmSpy.mockReturnValueOnce( true ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Eliminar Ocio" } ) ) ;
    await waitFor( () => { expect( routerMock.refresh ).toHaveBeenCalled() ; } ) ;
    expect( deleteBudgetAction ).toHaveBeenCalledWith( { budgetId: "b-a" } ) ;
    confirmSpy.mockRestore() ;
  } ) ;

  it( "días restantes: «—» en un mes pasado" , () => {
    renderContainer( evaluacion( [ orden ] , { monthKey: "2026-09" , diasRestantes: null } ) ) ;

    const tarjeta = screen.getByText( dict.budgetsPage.daysLeftLabel ).closest( "div" )!.parentElement! ;
    expect( tarjeta.textContent ).toContain( "—" ) ;
  } ) ;
} ) ;
