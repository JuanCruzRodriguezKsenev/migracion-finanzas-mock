/**
 * @file goalAmount.test.ts
 * Conversión de texto a centavos con los decimales de la divisa.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Goals
import { parseAmountToCents , centsToInput } from "./goalAmount" ;


describe( "parseAmountToCents" , () => {
  it( "convierte con los decimales de la divisa, aceptando coma o punto" , () => {
    expect( parseAmountToCents( "1500" , "ARS" ) ).toBe( 150000 ) ;
    expect( parseAmountToCents( "1500,5" , "ARS" ) ).toBe( 150050 ) ;
    expect( parseAmountToCents( "0.07" , "USD" ) ).toBe( 7 ) ;
    expect( parseAmountToCents( "19.99" , "ARS" ) ).toBe( 1999 ) ;
  } ) ;

  it( "una divisa sin decimales no multiplica por 100" , () => {
    expect( parseAmountToCents( "1500" , "JPY" ) ).toBe( 1500 ) ;
    expect( parseAmountToCents( "1500.5" , "JPY" ) ).toBeNull() ;
  } ) ;

  it( "rechaza vacío, negativo, texto y demasiados decimales" , () => {
    expect( parseAmountToCents( "" , "ARS" ) ).toBeNull() ;
    expect( parseAmountToCents( "-5" , "ARS" ) ).toBeNull() ;
    expect( parseAmountToCents( "abc" , "ARS" ) ).toBeNull() ;
    expect( parseAmountToCents( "1.234" , "ARS" ) ).toBeNull() ;
  } ) ;
} ) ;

describe( "centsToInput" , () => {
  it( "vuelve a texto editable" , () => {
    expect( centsToInput( 150050 , "ARS" ) ).toBe( "1500.50" ) ;
    expect( centsToInput( 7 , "ARS" ) ).toBe( "0.07" ) ;
    expect( centsToInput( 1500 , "JPY" ) ).toBe( "1500" ) ;
  } ) ;
} ) ;
