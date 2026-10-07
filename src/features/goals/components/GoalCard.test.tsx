// @vitest-environment jsdom
/**
 * @file GoalCard.test.tsx
 * Variantes de estado, prioridad, vencida, aporte sugerido, barra topada, permisos y ojito cerrado.
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll } from "vitest" ;
import { render , screen , fireEvent }             from "@testing-library/react" ;
import React                                       from "react" ;

// Shared
import { MetricsVisibilityContext } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { getDictionary }            from "@/shared/lib/dictionary" ;

// Feature: Goals
import { makeGoalView }     from "../testing/goalViewFactory" ;
import type { GoalsPageDict } from "./goalsDict" ;
import { GoalCard }         from "./GoalCard" ;


let gDict: GoalsPageDict ;

beforeAll( async () => {
  gDict = ( await getDictionary( "es" ) ).goalsPage ;
} ) ;

function renderCard( view = makeGoalView() , props?: { puedeEscribir?: boolean ; visible?: boolean } ) {
  const handlers = { onContribute: vi.fn() , onWithdraw: vi.fn() , onEdit: vi.fn() , onAbandon: vi.fn() } ;
  const visible  = ( props?.visible ?? true ) ;
  const utils    = render(
    <MetricsVisibilityContext.Provider value={ { isContentVisible: visible , toggleVisibility: () => {} } }>
      <GoalCard view={view} dict={gDict} locale="es-AR" puedeEscribir={props?.puedeEscribir ?? true} {...handlers} />
    </MetricsVisibilityContext.Provider>
  ) ;
  return( { ...utils , ...handlers } ) ;
}

describe( "GoalCard" , () => {
  it( "estado normal: barra ok, porcentaje, ahorrado de objetivo, fecha y sugerido" , () => {
    renderCard() ;
    expect( screen.getByRole( "progressbar" ).getAttribute( "data-state" ) ).toBe( "ok" ) ;
    expect( screen.getByText( "10 %" ) ).toBeDefined() ;
    expect( screen.getByText( /ahorrado de/ ).textContent ).toMatch( /200\.000,00.*2\.000\.000,00/ ) ;
    expect( screen.getByText( /Fecha objetivo/ ) ).toBeDefined() ;
    expect( screen.getByText( /Aporte sugerido: .*180\.000,00 por mes/ ) ).toBeDefined() ;
    expect( screen.getByText( "Activa" ) ).toBeDefined() ;
  } ) ;

  it( "vencida: barra warning y rótulo «Vencida» en texto; sin sugerido" , () => {
    renderCard( makeGoalView( { vencida: true , aporteSugerido: null , mesesRestantes: null } ) ) ;
    expect( screen.getByRole( "progressbar" ).getAttribute( "data-state" ) ).toBe( "warning" ) ;
    expect( screen.getByText( "Vencida" ) ).toBeDefined() ;
    expect( screen.queryByText( /Aporte sugerido/ ) ).toBeNull() ;
  } ) ;

  it( "descubierta: barra danger y rótulo «Descubierta» en texto" , () => {
    renderCard( makeGoalView( { descubierta: true } ) ) ;
    expect( screen.getByRole( "progressbar" ).getAttribute( "data-state" ) ).toBe( "danger" ) ;
    expect( screen.getByText( "Descubierta" ) ).toBeDefined() ;
  } ) ;

  it( "prioritaria muestra la estrella; la normal no" , () => {
    const { unmount } = renderCard( makeGoalView( undefined , { priority: "high" } ) ) ;
    expect( screen.getByLabelText( "Prioritaria" ) ).toBeDefined() ;
    unmount() ;
    renderCard() ;
    expect( screen.queryByLabelText( "Prioritaria" ) ).toBeNull() ;
  } ) ;

  it( "sin fecha no hay sugerido y dice que no hay fecha objetivo" , () => {
    renderCard( makeGoalView( { aporteSugerido: null , mesesRestantes: null } , { targetDate: null } ) ) ;
    expect( screen.getByText( "Sin fecha objetivo" ) ).toBeDefined() ;
    expect( screen.queryByText( /Aporte sugerido/ ) ).toBeNull() ;
  } ) ;

  it( "completada pasada del objetivo: la barra se topa en 100 % pero el porcentaje real es visible" , () => {
    renderCard( makeGoalView( { porcentaje: 104 , porcentajeBarra: 100 , aporteSugerido: null } , { status: "completed" } ) ) ;
    const bar = screen.getByRole( "progressbar" ) ;
    expect( bar.getAttribute( "aria-valuenow" ) ).toBe( "100" ) ;
    expect( screen.getByTestId( "progress-fill" ).style.getPropertyValue( "--progress" ) ).toBe( "100%" ) ;
    expect( screen.getByText( "104 %" ) ).toBeDefined() ;
    expect( screen.getByText( "Completada" ) ).toBeDefined() ;
  } ) ;

  it( "muestra el último movimiento del historial" , () => {
    renderCard( makeGoalView( { historial: [ {
      id: "h1" , goalId: "g" , accountId: "a" , accountName: "Caja de ahorro" , kind: "contribution" , amount: 20000000 , occurredAt: new Date( "2026-10-06T12:00:00Z" )
    } ] } ) ) ;
    expect( screen.getByText( /Último aporte: .*200\.000,00 desde Caja de ahorro/ ) ).toBeDefined() ;
  } ) ;

  it( "con permiso de escritura los cuatro botones disparan sus acciones" , () => {
    const { onContribute , onWithdraw , onEdit , onAbandon } = renderCard() ;
    fireEvent.click( screen.getByRole( "button" , { name: "Aportar" } ) ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Retirar" } ) ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Editar" } ) ) ;
    fireEvent.click( screen.getByRole( "button" , { name: "Abandonar" } ) ) ;
    expect( onContribute ).toHaveBeenCalledTimes( 1 ) ;
    expect( onWithdraw ).toHaveBeenCalledTimes( 1 ) ;
    expect( onEdit ).toHaveBeenCalledTimes( 1 ) ;
    expect( onAbandon ).toHaveBeenCalledTimes( 1 ) ;
  } ) ;

  it( "sin permiso de escritura no se renderiza ningún botón" , () => {
    renderCard( makeGoalView() , { puedeEscribir: false } ) ;
    expect( screen.queryAllByRole( "button" ) ).toHaveLength( 0 ) ;
  } ) ;

  it( "ojito cerrado: los importes se ocultan; porcentaje y estado siguen" , () => {
    renderCard( makeGoalView( { aporteSugerido: 18000000 } ) , { visible: false } ) ;
    expect( screen.queryByText( /200\.000,00/ ) ).toBeNull() ;
    expect( screen.queryByText( /2\.000\.000,00/ ) ).toBeNull() ;
    expect( screen.queryByText( /180\.000,00/ ) ).toBeNull() ;
    expect( screen.getAllByText( /••••••/ ).length ).toBeGreaterThan( 0 ) ;
    expect( screen.getByText( "10 %" ) ).toBeDefined() ;
    expect( screen.getByText( "Activa" ) ).toBeDefined() ;
  } ) ;
} ) ;
