// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi } from "vitest" ;
import { render , screen , fireEvent } from "@testing-library/react" ;

// Shared
import { Button } from "./Button" ;


/**
 * Suite de pruebas unitarias para el componente Button.
 * Verifica el renderizado de contenido, el estado de carga accesible y el manejo de clics.
 */
describe( "Button" , () => {
  it( "debería renderizar el texto de los children" , () => {
    render( <Button>Guardar</Button> ) ;

    expect( screen.getByRole( "button" , {name: "Guardar"} ) ).toBeInTheDocument() ;
  } ) ;

  it( "debería invocar onClick al hacer clic" , () => {
    const onClick = vi.fn() ;

    render( <Button onClick={onClick}>Enviar</Button> ) ;
    fireEvent.click( screen.getByRole( "button" , {name: "Enviar"} ) ) ;

    expect( onClick ).toHaveBeenCalledTimes( 1 ) ;
  } ) ;

  it( "debería deshabilitarse y marcar aria-busy cuando isLoading es true" , () => {
    render( <Button isLoading>Procesando</Button> ) ;

    const button = screen.getByRole( "button" ) ;

    expect( button ).toBeDisabled() ;
    expect( button ).toHaveAttribute( "aria-busy" , "true" ) ;
    expect( screen.getByLabelText( "Cargando" ) ).toBeInTheDocument() ;
  } ) ;

  it( "no debería invocar onClick cuando isLoading es true" , () => {
    const onClick = vi.fn() ;

    render( <Button isLoading onClick={onClick}>Procesando</Button> ) ;
    fireEvent.click( screen.getByRole( "button" ) ) ;

    expect( onClick ).not.toHaveBeenCalled() ;
  } ) ;

  it( "debería renderizar el ícono provisto cuando no está cargando" , () => {
    render( <Button icon={<span data-testid="icon">★</span>}>Con ícono</Button> ) ;

    expect( screen.getByTestId( "icon" ) ).toBeInTheDocument() ;
  } ) ;

  it( "debería respetar el prop disabled nativo" , () => {
    render( <Button disabled>Deshabilitado</Button> ) ;

    expect( screen.getByRole( "button" ) ).toBeDisabled() ;
  } ) ;
} ) ;
