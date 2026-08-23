// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi } from "vitest" ;
import { render , screen , fireEvent } from "@testing-library/react" ;

// Shared
import { Autocomplete , AutocompleteOption } from "./Autocomplete" ;


const OPTIONS: AutocompleteOption[] = [
  {key: "a.com" , label: "Alpha" , sublabel: "a.com"} ,
  {key: "b.com" , label: "Beta"  , sublabel: "b.com"} ,
] ;

/**
 * Suite de pruebas unitarias para el componente Autocomplete.
 * Pinea el comportamiento extraído desde CreateFinancialEntityForm: navegación
 * por teclado, selección con Enter/clic, cierre con Escape y clic afuera.
 */
describe( "Autocomplete" , () => {
  it( "debería renderizar el input con el label provisto" , () => {
    render(
      <Autocomplete
        value=""
        onChange={ () => {} }
        options={[]}
        onSelect={ () => {} }
        isOpen={false}
        onOpenChange={ () => {} }
        label="Nombre"
      />
    ) ;

    expect( screen.getByLabelText( "Nombre" ) ).toBeInTheDocument() ;
  } ) ;

  it( "debería invocar onChange al escribir en el input" , () => {
    const onChange = vi.fn() ;

    render(
      <Autocomplete
        value=""
        onChange={onChange}
        options={[]}
        onSelect={ () => {} }
        isOpen={false}
        onOpenChange={ () => {} }
        label="Nombre"
      />
    ) ;

    fireEvent.change( screen.getByLabelText( "Nombre" ) , {target: {value: "gal"}} ) ;

    expect( onChange ).toHaveBeenCalledWith( "gal" ) ;
  } ) ;

  it( "debería mostrar las opciones cuando isOpen es true y hay opciones" , () => {
    render(
      <Autocomplete
        value="a"
        onChange={ () => {} }
        options={OPTIONS}
        onSelect={ () => {} }
        isOpen={true}
        onOpenChange={ () => {} }
        label="Nombre"
      />
    ) ;

    expect( screen.getByText( "Alpha" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "Beta" ) ).toBeInTheDocument() ;
  } ) ;

  it( "no debería mostrar el dropdown cuando isOpen es false" , () => {
    render(
      <Autocomplete
        value="a"
        onChange={ () => {} }
        options={OPTIONS}
        onSelect={ () => {} }
        isOpen={false}
        onOpenChange={ () => {} }
        label="Nombre"
      />
    ) ;

    expect( screen.queryByText( "Alpha" ) ).not.toBeInTheDocument() ;
  } ) ;

  it( "debería invocar onSelect al hacer clic en una opción" , () => {
    const onSelect = vi.fn() ;

    render(
      <Autocomplete
        value="a"
        onChange={ () => {} }
        options={OPTIONS}
        onSelect={onSelect}
        isOpen={true}
        onOpenChange={ () => {} }
        label="Nombre"
      />
    ) ;

    fireEvent.click( screen.getByText( "Beta" ) ) ;

    expect( onSelect ).toHaveBeenCalledWith( OPTIONS[1] ) ;
  } ) ;

  it( "debería navegar con flechas y seleccionar con Enter" , () => {
    const onSelect = vi.fn() ;

    render(
      <Autocomplete
        value="a"
        onChange={ () => {} }
        options={OPTIONS}
        onSelect={onSelect}
        isOpen={true}
        onOpenChange={ () => {} }
        label="Nombre"
      />
    ) ;

    const input = screen.getByLabelText( "Nombre" ) ;

    fireEvent.keyDown( input , {key: "ArrowDown"} ) ; // activa índice 0 (Alpha)
    fireEvent.keyDown( input , {key: "ArrowDown"} ) ; // activa índice 1 (Beta)
    fireEvent.keyDown( input , {key: "Enter"} ) ;

    expect( onSelect ).toHaveBeenCalledWith( OPTIONS[1] ) ;
  } ) ;

  it( "debería invocar onOpenChange(false) al presionar Escape" , () => {
    const onOpenChange = vi.fn() ;

    render(
      <Autocomplete
        value="a"
        onChange={ () => {} }
        options={OPTIONS}
        onSelect={ () => {} }
        isOpen={true}
        onOpenChange={onOpenChange}
        label="Nombre"
      />
    ) ;

    fireEvent.keyDown( screen.getByLabelText( "Nombre" ) , {key: "Escape"} ) ;

    expect( onOpenChange ).toHaveBeenCalledWith( false ) ;
  } ) ;

  it( "debería invocar onOpenChange(false) al hacer clic fuera del componente" , () => {
    const onOpenChange = vi.fn() ;

    render(
      <div>
        <Autocomplete
          value="a"
          onChange={ () => {} }
          options={OPTIONS}
          onSelect={ () => {} }
          isOpen={true}
          onOpenChange={onOpenChange}
          label="Nombre"
        />
        <button data-testid="outside">Afuera</button>
      </div>
    ) ;

    fireEvent.mouseDown( screen.getByTestId( "outside" ) ) ;

    expect( onOpenChange ).toHaveBeenCalledWith( false ) ;
  } ) ;
} ) ;
