// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi } from "vitest" ;
import { render , screen , fireEvent } from "@testing-library/react" ;

// Shared
import { FormInput } from "./FormInput" ;


/**
 * Suite de pruebas unitarias para el componente FormInput.
 * Verifica la asociación label/input, el estado de error accesible y el manejo de cambios.
 */
describe( "FormInput" , () => {
  it( "debería asociar el label con el input mediante htmlFor/id" , () => {
    render( <FormInput label="Email" /> ) ;

    const input = screen.getByLabelText( "Email" ) ;
    expect( input ).toBeInTheDocument() ;
  } ) ;

  it( "debería invocar onChange con el nuevo valor" , () => {
    const onChange = vi.fn() ;

    render( <FormInput label="Nombre" value="" onChange={onChange} /> ) ;
    fireEvent.change( screen.getByLabelText( "Nombre" ) , {target: {value: "Juan"}} ) ;

    expect( onChange ).toHaveBeenCalledTimes( 1 ) ;
  } ) ;

  it( "debería mostrar el mensaje de error de forma accesible cuando se provee" , () => {
    render( <FormInput label="Email" error="Email inválido" /> ) ;

    const input = screen.getByLabelText( "Email" ) ;
    const error = screen.getByText( "Email inválido" ) ;

    expect( input ).toHaveAttribute( "aria-invalid" , "true" ) ;
    expect( input.getAttribute( "aria-describedby" ) ).toBe( error.id ) ;
  } ) ;

  it( "no debería marcar aria-invalid cuando no hay error" , () => {
    render( <FormInput label="Email" /> ) ;

    expect( screen.getByLabelText( "Email" ) ).toHaveAttribute( "aria-invalid" , "false" ) ;
  } ) ;

  it( "debería mostrar el asterisco de requerido cuando required es true" , () => {
    render( <FormInput label="Email" required /> ) ;

    expect( screen.getByText( "*" ) ).toBeInTheDocument() ;
  } ) ;

  it( "debería mostrar el texto de ayuda cuando no hay error" , () => {
    render( <FormInput label="Email" helperText="Nunca lo compartiremos" /> ) ;

    expect( screen.getByText( "Nunca lo compartiremos" ) ).toBeInTheDocument() ;
  } ) ;
} ) ;
