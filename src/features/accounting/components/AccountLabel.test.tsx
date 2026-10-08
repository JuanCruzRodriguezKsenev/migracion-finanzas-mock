// @vitest-environment jsdom
/**
 * @file AccountLabel.test.tsx
 * Etiquetas de cuenta (RN-15, RN-13) con el diccionario real de los tres idiomas.
 */
// Librerías externas
import { describe , it , expect , beforeAll } from "vitest" ;
import { render , screen }                    from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Accounting
import { AccountLabel , textoDeEtiqueta , AccountLabelDict } from "./AccountLabel" ;


describe( "AccountLabel" , () => {
  let dict: AccountLabelDict ;

  beforeAll( async () => {
    dict = ( await getDictionary( "es" ) ).accountsPage ;
  } ) ;

  it( "de la organización" , () => {
    render( <AccountLabel etiqueta={ {tipo: "organizacion"} } dict={dict} /> ) ;
    expect( screen.getByText( "De la organización" ) ).toBeDefined() ;
  } ) ;

  it( "privada" , () => {
    render( <AccountLabel etiqueta={ {tipo: "privada"} } dict={dict} /> ) ;
    expect( screen.getByText( "Privada" ) ).toBeDefined() ;
  } ) ;

  it( "compartida nombra la organización" , () => {
    render( <AccountLabel etiqueta={ {tipo: "compartida" , organizaciones: [ {id: "o1" , nombre: "reparto-demo"} ]} } dict={dict} /> ) ;
    expect( screen.getByText( "Compartida · reparto-demo" ) ).toBeDefined() ;
  } ) ;

  it( "compartida con varias las separa con coma" , () => {
    expect( textoDeEtiqueta( {tipo: "compartida" , organizaciones: [ {id: "1" , nombre: "Casa"} , {id: "2" , nombre: "Taller"} ]} , dict ) )
      .toBe( "Compartida · Casa, Taller" ) ;
  } ) ;

  it( "cuenta personal de un dueño (RN-13)" , () => {
    render( <AccountLabel etiqueta={ {tipo: "personal" , dueno: "Ana"} } dict={dict} /> ) ;
    expect( screen.getByText( "Cuenta personal de Ana" ) ).toBeDefined() ;
  } ) ;

  it.each( [ "en" , "br" ] )( "los textos existen en %s y difieren del español" , async ( lang ) => {
    const otro = ( await getDictionary( lang ) ).accountsPage ;

    for( const clave of [ "labelPrivate" , "labelShared" , "labelOrganization" , "labelPersonalOf" ] as const ) {
      expect( otro[clave] ).toBeTruthy() ;
    }
    expect( textoDeEtiqueta( {tipo: "personal" , dueno: "Ana"} , otro ) ).not.toBe( "Cuenta personal de Ana" ) ;
  } ) ;
} ) ;
