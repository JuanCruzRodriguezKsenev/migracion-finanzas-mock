// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect } from "vitest" ;
import { render }                 from "@testing-library/react" ;

// Shared
import { Skeleton } from "./Skeleton" ;


/**
 * Suite de pruebas unitarias para el componente Skeleton.
 * Verifica el renderizado de un único bloque y de múltiples bloques apilados.
 */
describe( "Skeleton" , () => {
  it( "debería renderizar un único bloque con las dimensiones provistas" , () => {
    const { container } = render( <Skeleton width="50%" height="2rem" radius="1rem" /> ) ;

    const block = container.querySelector( ".skeleton" ) as HTMLElement ;

    expect( block ).toBeInTheDocument() ;
    expect( block.style.width ).toBe( "50%" ) ;
    expect( block.style.height ).toBe( "2rem" ) ;
    expect( block.style.borderRadius ).toBe( "1rem" ) ;
  } ) ;

  it( "debería usar dimensiones por defecto cuando no se especifican" , () => {
    const { container } = render( <Skeleton /> ) ;

    const block = container.querySelector( ".skeleton" ) as HTMLElement ;

    expect( block.style.width ).toBe( "100%" ) ;
    expect( block.style.height ).toBe( "1rem" ) ;
  } ) ;

  it( "debería renderizar múltiples bloques apilados cuando count es mayor a 1" , () => {
    const { container } = render( <Skeleton count={3} /> ) ;

    const blocks = container.querySelectorAll( ".skeleton" ) ;

    expect( blocks.length ).toBe( 3 ) ;
  } ) ;

  it( "debería renderizar un único bloque cuando count es 1 o no se especifica" , () => {
    const { container } = render( <Skeleton count={1} /> ) ;

    expect( container.querySelectorAll( ".skeleton" ).length ).toBe( 1 ) ;
  } ) ;
} ) ;
