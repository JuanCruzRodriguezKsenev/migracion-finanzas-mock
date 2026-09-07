// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi } from "vitest" ;
import { render , screen , fireEvent } from "@testing-library/react" ;

// Shared
import { SearchInput } from "./SearchInput" ;


describe( "SearchInput" , () => {
  it( "debería renderizar el placeholder y el valor" , () => {
    render( <SearchInput value="test" onChange={vi.fn()} placeholder="Buscar transacción..." /> ) ;

    const input = screen.getByPlaceholderText( "Buscar transacción..." ) ;
    expect( input ).toBeInTheDocument() ;
    expect( input ).toHaveValue( "test" ) ;
  } ) ;

  it( "debería emitir cambios cuando el usuario escribe" , () => {
    const handleChange = vi.fn() ;
    render( <SearchInput value="" onChange={handleChange} /> ) ;

    const input = screen.getByRole( "searchbox" ) ;
    fireEvent.change( input , {target: {value: "Supermercado"}} ) ;

    expect( handleChange ).toHaveBeenCalledTimes( 1 ) ;
    expect( handleChange ).toHaveBeenCalledWith( "Supermercado" ) ;
  } ) ;

  it( "debería mostrar el botón de limpiar solo cuando hay valor y limpiar al hacer clic" , () => {
    const handleChange = vi.fn() ;
    const handleClear  = vi.fn() ;
    const { rerender } = render(
      <SearchInput value="" onChange={handleChange} onClear={handleClear} />
    ) ;

    expect( screen.queryByLabelText( "Limpiar búsqueda" ) ).not.toBeInTheDocument() ;

    rerender(
      <SearchInput value="algo" onChange={handleChange} onClear={handleClear} />
    ) ;

    const clearBtn = screen.getByLabelText( "Limpiar búsqueda" ) ;
    expect( clearBtn ).toBeInTheDocument() ;

    fireEvent.click( clearBtn ) ;
    expect( handleChange ).toHaveBeenCalledWith( "" ) ;
    expect( handleClear ).toHaveBeenCalledTimes( 1 ) ;
  } ) ;
} ) ;
