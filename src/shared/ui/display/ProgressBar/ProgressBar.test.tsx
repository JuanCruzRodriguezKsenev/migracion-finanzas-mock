// @vitest-environment jsdom
/**
 * @file ProgressBar.test.tsx
 * Tests de la barra de progreso: valores límite, atributos ARIA y recorte del ancho visual.
 */
// Librerías externas
import { render , screen }        from "@testing-library/react" ;
import { describe , it , expect } from "vitest" ;
import React                      from "react" ;

// Shared
import { ProgressBar , anchoVisual } from "./ProgressBar" ;


describe( "ProgressBar" , () => {
  it.each( [
    [ 0 , "0%" ] ,
    [ 50 , "50%" ] ,
    [ 100 , "100%" ] ,
    [ 104 , "100%" ] ,
  ] )( "con valor %i el ancho visual es %s" , ( value , ancho ) => {
    render( <ProgressBar value={value} state="ok" label={`Uso ${value} %`} /> ) ;

    expect( screen.getByTestId( "progress-fill" ).style.width ).toBe( ancho ) ;
  } ) ;

  it( "expone role progressbar con los atributos ARIA y el texto" , () => {
    render( <ProgressBar value={50} state="warning" label="Hogar: 50 % utilizado, en alerta" /> ) ;

    const barra = screen.getByRole( "progressbar" ) ;
    expect( barra.getAttribute( "aria-valuenow" ) ).toBe( "50" ) ;
    expect( barra.getAttribute( "aria-valuemin" ) ).toBe( "0" ) ;
    expect( barra.getAttribute( "aria-valuemax" ) ).toBe( "100" ) ;
    expect( barra.getAttribute( "aria-label" ) ).toBe( "Hogar: 50 % utilizado, en alerta" ) ;
  } ) ;

  it( "con 104 informa el valor real en el texto y recorta el valor numérico a 100" , () => {
    render( <ProgressBar value={104} state="danger" label="Hogar: 104 % utilizado, excedido" /> ) ;

    const barra = screen.getByRole( "progressbar" ) ;
    expect( barra.getAttribute( "aria-valuenow" ) ).toBe( "100" ) ;
    expect( barra.getAttribute( "aria-valuetext" ) ).toContain( "104" ) ;
  } ) ;

  it( "anchoVisual recorta negativos y no finitos a 0" , () => {
    expect( anchoVisual( -5 ) ).toBe( 0 ) ;
    expect( anchoVisual( Number.NaN ) ).toBe( 0 ) ;
  } ) ;
} ) ;
