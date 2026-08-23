// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi } from "vitest" ;
import { render , screen , fireEvent , waitFor } from "@testing-library/react" ;

// Shared
import { Modal } from "./Modal" ;


/**
 * Suite de pruebas unitarias para el componente Modal.
 * Verifica el renderizado condicional, cierre con Escape y cierre por clic en el overlay.
 */
describe( "Modal" , () => {
  it( "no debería renderizar nada cuando isOpen es false" , () => {
    render(
      <Modal isOpen={false} onClose={ () => {} } title="Título">
        <p>Contenido</p>
      </Modal>
    ) ;

    expect( screen.queryByText( "Contenido" ) ).not.toBeInTheDocument() ;
  } ) ;

  it( "debería renderizar el título y el contenido cuando isOpen es true" , () => {
    render(
      <Modal isOpen={true} onClose={ () => {} } title="Título del Modal">
        <p>Contenido visible</p>
      </Modal>
    ) ;

    expect( screen.getByText( "Título del Modal" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "Contenido visible" ) ).toBeInTheDocument() ;
  } ) ;

  it( "debería llamar a onClose al presionar Escape" , async () => {
    const onClose = vi.fn() ;

    render(
      <Modal isOpen={true} onClose={onClose} title="Título">
        <p>Contenido</p>
      </Modal>
    ) ;

    fireEvent.keyDown( document , {key: "Escape"} ) ;

    await waitFor( () => expect( onClose ).toHaveBeenCalledTimes( 1 ) ) ;
  } ) ;

  it( "debería llamar a onClose al hacer clic en el overlay (fuera del contenido)" , () => {
    const onClose = vi.fn() ;

    render(
      <Modal isOpen={true} onClose={onClose} title="Título">
        <p>Contenido</p>
      </Modal>
    ) ;

    const overlay = screen.getByRole( "dialog" ).parentElement as HTMLElement ;

    fireEvent.mouseDown( overlay ) ;
    fireEvent.mouseUp( overlay ) ;

    expect( onClose ).toHaveBeenCalledTimes( 1 ) ;
  } ) ;

  it( "no debería llamar a onClose al hacer clic dentro del contenido" , () => {
    const onClose = vi.fn() ;

    render(
      <Modal isOpen={true} onClose={onClose} title="Título">
        <p>Contenido</p>
      </Modal>
    ) ;

    const dialog = screen.getByRole( "dialog" ) ;

    fireEvent.mouseDown( dialog ) ;
    fireEvent.mouseUp( dialog ) ;

    expect( onClose ).not.toHaveBeenCalled() ;
  } ) ;

  it( "debería invocar el botón de cierre explícito" , () => {
    const onClose = vi.fn() ;

    render(
      <Modal isOpen={true} onClose={onClose} title="Título">
        <p>Contenido</p>
      </Modal>
    ) ;

    fireEvent.click( screen.getByLabelText( "Cerrar modal" ) ) ;

    expect( onClose ).toHaveBeenCalledTimes( 1 ) ;
  } ) ;
} ) ;
