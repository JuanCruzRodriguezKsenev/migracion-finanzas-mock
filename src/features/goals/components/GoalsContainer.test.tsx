// @vitest-environment jsdom
/**
 * @file GoalsContainer.test.tsx
 * Pantalla de Metas con diccionario real y proveedores reales: indicadores, filtros en la URL, orden, vacío,
 * permisos, ojito y abandono.
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor , within }       from "@testing-library/react" ;
import React                                                   from "react" ;

// Shared
import { MetricsVisibilityContext } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { getDictionary }            from "@/shared/lib/dictionary" ;

// Feature: Profile
import { ProfileProvider } from "@/features/profile/context/ProfileContext" ;
import type { ProfileData } from "@/features/profile/types" ;

// Feature: Notifications
import { NotificationsProvider } from "@/features/notifications/context/NotificationsContext" ;

// Feature: Goals
import { makeGoalView , makeViewData } from "../testing/goalViewFactory" ;
import { abandonGoalAction }          from "../actions/goalsActions" ;
import { GoalsContainer }             from "./GoalsContainer" ;
import type { GoalFilter }            from "../types" ;


const routerMock = vi.hoisted( () => ( { push: vi.fn() , replace: vi.fn() , refresh: vi.fn() , back: vi.fn() , forward: vi.fn() } ) ) ;

vi.mock( "next/navigation" , () => ( {
  useRouter:       () => routerMock ,
  usePathname:     () => "/es/goals" ,
  useParams:       () => ( { lang: "es" } ) ,
  useSearchParams: () => new URLSearchParams( "currency=ARS" )
} ) ) ;

vi.mock( "../actions/goalsActions" , () => ( {
  contributeToGoalAction: vi.fn() ,
  withdrawFromGoalAction: vi.fn() ,
  createGoalAction:       vi.fn() ,
  updateGoalAction:       vi.fn() ,
  abandonGoalAction:      vi.fn()
} ) ) ;

const mockProfile: ProfileData = {
  userId: "11111111-1111-4111-8111-111111111111" , phone: null , currency: "ARS" , timezone: "America/Argentina/Buenos_Aires" ,
  bio: null , theme: "light" , defaultView: "dashboard" , fastLogin: true , weeklyStart: "monday" , dateFormat: "DD/MM/YYYY" ,
  numberFormat: "es-AR" , roundAmounts: false , includeTransfers: true , defaultAccount: null ,
  planName: "Básico" , planBilling: "Mensual" , planNextCharge: ""
} ;

let dict: Awaited< ReturnType< typeof getDictionary > > ;

beforeAll( async () => {
  dict = await getDictionary( "es" ) ;
} ) ;

beforeEach( () => {
  vi.clearAllMocks() ;
} ) ;

const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" ;
const idB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" ;

function renderContainer( props?: { data?: ReturnType< typeof makeViewData > ; filter?: GoalFilter ; puedeEscribir?: boolean ; visible?: boolean } ) {
  const metas = [
    makeGoalView( undefined , { id: idA , name: "Casa" , priority: "high" } ) ,
    makeGoalView( { ahorrado: 200000000 , porcentaje: 100 , porcentajeBarra: 100 , aporteSugerido: null } , { id: idB , name: "Auto" , status: "completed" } )
  ] ;
  return( render(
    <ProfileProvider initialProfile={mockProfile}>
      <NotificationsProvider>
        <MetricsVisibilityContext.Provider value={ { isContentVisible: props?.visible ?? true , toggleVisibility: () => {} } }>
          <GoalsContainer
            data={props?.data ?? makeViewData( metas )}
            filter={props?.filter ?? "all"}
            dict={dict}
            lang="es"
            puedeEscribir={props?.puedeEscribir}
          />
        </MetricsVisibilityContext.Provider>
      </NotificationsProvider>
    </ProfileProvider>
  ) ) ;
}

describe( "GoalsContainer" , () => {
  it( "A1: sin metas muestra el estado vacío con la acción de crear" , () => {
    renderContainer( { data: makeViewData( [] ) } ) ;
    expect( screen.getByText( "Todavía no tenés metas" ) ).toBeDefined() ;
    expect( screen.getByRole( "button" , { name: "Crear mi primera meta" } ) ).toBeDefined() ;
    expect( screen.queryByRole( "progressbar" ) ).toBeNull() ;
  } ) ;

  it( "indicadores de la divisa: metas, objetivo, ahorrado con su %, completadas y por completar" , () => {
    renderContainer() ;
    const total = screen.getByText( "Ahorrado total" ).closest( "div" )!.parentElement! ;
    expect( within( total ).getByText( /2\.200\.000,00/ ) ).toBeDefined() ;
    expect( within( total ).getByText( "55 %" ) ).toBeDefined() ;
    expect( screen.getByText( /4\.000\.000,00/ ) ).toBeDefined() ;
    expect( screen.getByText( "Completadas" , { selector: "span" } ).parentElement!.parentElement!.textContent ).toContain( "1" ) ;
  } ) ;

  it( "la lista respeta el orden recibido (prioritaria primero)" , () => {
    renderContainer() ;
    const nombres = screen.getAllByRole( "heading" , { level: 3 } ).map( ( h ) => { return( h.textContent ) ; } ) ;
    expect( nombres[ 0 ] ).toContain( "Casa" ) ;
    expect( nombres[ 1 ] ).toContain( "Auto" ) ;
  } ) ;

  it( "los tres filtros viven en la URL y preservan la divisa" , () => {
    renderContainer( { filter: "active" } ) ;
    expect( screen.getByRole( "tab" , { name: "Activas" } ).getAttribute( "aria-selected" ) ).toBe( "true" ) ;

    fireEvent.click( screen.getByRole( "tab" , { name: "Completadas" } ) ) ;
    expect( routerMock.push ).toHaveBeenLastCalledWith( "/es/goals?currency=ARS&filter=completed" ) ;
    fireEvent.click( screen.getByRole( "tab" , { name: "Todas" } ) ) ;
    expect( routerMock.push ).toHaveBeenLastCalledWith( "/es/goals?currency=ARS" ) ;
    fireEvent.click( screen.getByRole( "tab" , { name: "Activas" } ) ) ;
    expect( routerMock.push ).toHaveBeenLastCalledWith( "/es/goals?currency=ARS&filter=active" ) ;
  } ) ;

  it( "un filtro sin resultados lo dice" , () => {
    const data = makeViewData( [ makeGoalView() ] ) ;
    renderContainer( { data: { ...data , metas: [] } , filter: "completed" } ) ;
    expect( screen.getByText( dict.goalsPage.emptyFilter ) ).toBeDefined() ;
  } ) ;

  it( "el selector de divisa cambia ?currency= sin mezclar divisas" , () => {
    renderContainer( { data: makeViewData( [ makeGoalView() ] , { divisas: [ "ARS" , "USD" ] } ) } ) ;
    fireEvent.change( screen.getByLabelText( "Divisa:" ) , { target: { value: "USD" } } ) ;
    expect( routerMock.push ).toHaveBeenLastCalledWith( "/es/goals?currency=USD" ) ;
  } ) ;

  it( "sin permiso de escritura no hay «Nueva meta» ni botones en las tarjetas" , () => {
    renderContainer( { puedeEscribir: false } ) ;
    expect( screen.queryByRole( "button" , { name: /Nueva meta/ } ) ).toBeNull() ;
    expect( screen.queryByRole( "button" , { name: "Aportar" } ) ).toBeNull() ;
    expect( screen.queryByRole( "button" , { name: "Abandonar" } ) ).toBeNull() ;
  } ) ;

  it( "ojito cerrado: ningún importe legible; porcentajes y estados siguen" , () => {
    renderContainer( { visible: false } ) ;
    expect( screen.queryByText( /\d\.\d{3},\d{2}/ ) ).toBeNull() ;
    expect( screen.getAllByText( /••••••/ ).length ).toBeGreaterThan( 0 ) ;
    expect( screen.getByText( "55 %" ) ).toBeDefined() ;
    expect( screen.getByText( "Completada" ) ).toBeDefined() ;
  } ) ;

  it( "abandonar pide confirmación que menciona la devolución, llama a la acción y refresca" , async () => {
    vi.mocked( abandonGoalAction ).mockResolvedValue( { success: true , value: makeGoalView().goal } as never ) ;
    const confirmSpy = vi.spyOn( window , "confirm" ).mockReturnValue( true ) ;
    renderContainer() ;

    fireEvent.click( screen.getAllByRole( "button" , { name: "Abandonar" } )[ 0 ] ) ;
    expect( confirmSpy.mock.calls[ 0 ][ 0 ] ).toContain( "devuelve lo apartado" ) ;
    await waitFor( () => expect( abandonGoalAction ).toHaveBeenCalledWith( { goalId: idA } ) ) ;
    await waitFor( () => expect( routerMock.refresh ).toHaveBeenCalled() ) ;
  } ) ;

  it( "abandonar cancelado no llama a la acción" , () => {
    vi.spyOn( window , "confirm" ).mockReturnValue( false ) ;
    renderContainer() ;
    fireEvent.click( screen.getAllByRole( "button" , { name: "Abandonar" } )[ 0 ] ) ;
    expect( abandonGoalAction ).not.toHaveBeenCalled() ;
  } ) ;

  it( "«Nueva meta» abre el formulario de alta" , () => {
    renderContainer() ;
    fireEvent.click( screen.getByRole( "button" , { name: /Nueva meta/ } ) ) ;
    expect( screen.getByRole( "dialog" ) ).toBeDefined() ;
  } ) ;
} ) ;
