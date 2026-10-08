// @vitest-environment jsdom
/**
 * @file PermissionsProvider.test.tsx
 * El permiso de escritura de la interfaz es fail-closed: sin provider no hay permiso (RN-22).
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;
import { render , screen }         from "@testing-library/react" ;
import React                       from "react" ;

// Shared
import { PermissionsProvider , usePuedeEscribir , SoloConPermiso } from "./PermissionsProvider" ;


function Sonda() {
  return( <span data-testid="sonda">{ usePuedeEscribir() ? "puede" : "no-puede" }</span> ) ;
}

describe( "PermissionsProvider" , () => {
  it( "fuera del provider no hay permiso de escritura" , () => {
    render( <Sonda /> ) ;

    expect( screen.getByTestId( "sonda" ).textContent ).toBe( "no-puede" ) ;
  } ) ;

  it( "dentro del provider vale lo que le pasa el layout" , () => {
    const { unmount } = render( <PermissionsProvider puedeEscribir={true}><Sonda /></PermissionsProvider> ) ;
    expect( screen.getByTestId( "sonda" ).textContent ).toBe( "puede" ) ;
    unmount() ;

    render( <PermissionsProvider puedeEscribir={false}><Sonda /></PermissionsProvider> ) ;
    expect( screen.getByTestId( "sonda" ).textContent ).toBe( "no-puede" ) ;
  } ) ;

  it( "SoloConPermiso renderiza a sus hijos solo con permiso" , () => {
    const { unmount } = render( <PermissionsProvider puedeEscribir={true}><SoloConPermiso><button>Crear</button></SoloConPermiso></PermissionsProvider> ) ;
    expect( screen.getByText( "Crear" ) ).toBeDefined() ;
    unmount() ;

    render( <SoloConPermiso><button>Crear</button></SoloConPermiso> ) ;
    expect( screen.queryByText( "Crear" ) ).toBeNull() ;
  } ) ;
} ) ;
