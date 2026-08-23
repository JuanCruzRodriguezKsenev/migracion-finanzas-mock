// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect } from "vitest" ;
import { render , screen }        from "@testing-library/react" ;

// Shared
import { EmptyState } from "./EmptyState" ;


/**
 * Suite de pruebas unitarias para el componente EmptyState.
 * Verifica el renderizado condicional de descripción, ícono y acción.
 */
describe( "EmptyState" , () => {
  it( "debería renderizar el título" , () => {
    render( <EmptyState title="Sin resultados" /> ) ;

    expect( screen.getByText( "Sin resultados" ) ).toBeInTheDocument() ;
  } ) ;

  it( "no debería renderizar descripción, ícono ni acción cuando no se proveen" , () => {
    const { container } = render( <EmptyState title="Sin resultados" /> ) ;

    // Solo el <p> del título debe existir; sin descripción, ícono ni acción
    expect( container.querySelectorAll( "p" ).length ).toBe( 1 ) ;
    expect( container.querySelector( "svg, img" ) ).not.toBeInTheDocument() ;
    expect( container.querySelector( "button, a" ) ).not.toBeInTheDocument() ;
  } ) ;

  it( "debería renderizar la descripción cuando se provee" , () => {
    render( <EmptyState title="Sin cuentas" description="Creá tu primera cuenta." /> ) ;

    expect( screen.getByText( "Creá tu primera cuenta." ) ).toBeInTheDocument() ;
  } ) ;

  it( "debería renderizar el ícono y la acción cuando se proveen" , () => {
    render(
      <EmptyState
        title="Sin cuentas"
        icon={<span data-testid="icon">📭</span>}
        action={<button>Crear</button>}
      />
    ) ;

    expect( screen.getByTestId( "icon" ) ).toBeInTheDocument() ;
    expect( screen.getByRole( "button" , {name: "Crear"} ) ).toBeInTheDocument() ;
  } ) ;
} ) ;
