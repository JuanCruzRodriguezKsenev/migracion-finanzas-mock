import { describe , it , expect } from "vitest" ;
import { formatCurrency , getCurrencyDecimalPlaces } from "./currencyFormatter" ;

/**
 * Suite de pruebas unitarias para el formateador de monedas escalable (currencyFormatter).
 */
describe( "currencyFormatter" , () => {
  describe( "getCurrencyDecimalPlaces" , () => {
    it( "debería retornar 2 decimales para ARS, USD y EUR" , () => {
      expect( getCurrencyDecimalPlaces("ARS") ).toBe( 2 ) ;
      expect( getCurrencyDecimalPlaces("USD") ).toBe( 2 ) ;
      expect( getCurrencyDecimalPlaces("EUR") ).toBe( 2 ) ;
    } ) ;

    it( "debería retornar 0 decimales para JPY y CLP" , () => {
      expect( getCurrencyDecimalPlaces("JPY") ).toBe( 0 ) ;
      expect( getCurrencyDecimalPlaces("CLP") ).toBe( 0 ) ;
    } ) ;

    it( "debería retornar 3 decimales para KWD" , () => {
      expect( getCurrencyDecimalPlaces("KWD") ).toBe( 3 ) ;
    } ) ;

    it( "debería retornar 2 decimales por defecto para códigos de moneda inválidos" , () => {
      expect( getCurrencyDecimalPlaces("INVALID") ).toBe( 2 ) ;
    } ) ;
  } ) ;

  describe( "formatCurrency" , () => {
    it( "debería formatear correctamente monedas con 2 decimales" , () => {
      const formatted = formatCurrency( 123456 , "ARS" , "es-AR" ) ;
      expect( formatted.replace(/\s/g , " ") ).toContain( "1.234,56" ) ;
    } ) ;

    it( "debería formatear correctamente monedas con 0 decimales" , () => {
      const formatted = formatCurrency( 1234 , "JPY" , "ja-JP" ) ;
      expect( formatted.replace(/\s/g , " ") ).toContain( "1,234" ) ;
    } ) ;

    it( "debería formatear correctamente monedas con 3 decimales" , () => {
      const formatted = formatCurrency( 1234567 , "KWD" , "en-US" ) ;
      expect( formatted.replace(/\s/g , " ") ).toContain( "1,234.567" ) ;
    } ) ;
  } ) ;
} ) ;