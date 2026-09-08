/**
 * @file preferences.test.ts
 * Pruebas unitarias para el catálogo de preferencias canónicas y resolución de etiquetas.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Profile
import {
  etiquetaDe ,
  LABEL_TO_CODE_MAP ,
  CURRENCY_OPTIONS ,
  TIMEZONE_OPTIONS ,
  NUMBER_FORMAT_OPTIONS ,
  WEEKLY_START_OPTIONS ,
  DEFAULT_VIEW_OPTIONS ,
  PREFERENCE_CATALOG ,
} from "./preferences" ;


describe( "preferences.ts — Catálogo canónico de preferencias" , () => {
  describe( "etiquetaDe" , () => {
    it( "devuelve la etiqueta correcta para cada código del catálogo" , () => {
      // Monedas
      for( const opt of CURRENCY_OPTIONS ) {
        expect( etiquetaDe( "currency" , opt.code ) ).toBe( opt.label ) ;
      }

      // Husos horarios
      for( const opt of TIMEZONE_OPTIONS ) {
        expect( etiquetaDe( "timezone" , opt.code ) ).toBe( opt.label ) ;
      }

      // Formato numérico
      for( const opt of NUMBER_FORMAT_OPTIONS ) {
        expect( etiquetaDe( "numberFormat" , opt.code ) ).toBe( opt.label ) ;
      }

      // Inicio semanal
      for( const opt of WEEKLY_START_OPTIONS ) {
        expect( etiquetaDe( "weeklyStart" , opt.code ) ).toBe( opt.label ) ;
      }

      // Vista predeterminada
      for( const opt of DEFAULT_VIEW_OPTIONS ) {
        expect( etiquetaDe( "defaultView" , opt.code ) ).toBe( opt.label ) ;
      }
    } ) ;

    it( "devuelve el propio código como respaldo sin romper si el valor no está en el catálogo" , () => {
      expect( etiquetaDe( "currency" , "UNKNOWN_CODE" ) ).toBe( "UNKNOWN_CODE" ) ;
      expect( etiquetaDe( "timezone" , "Invalid/Timezone" ) ).toBe( "Invalid/Timezone" ) ;
      expect( etiquetaDe( "numberFormat" , "xx-XX" ) ).toBe( "xx-XX" ) ;
      expect( etiquetaDe( "weeklyStart" , "wednesday" ) ).toBe( "wednesday" ) ;
      expect( etiquetaDe( "defaultView" , "nonexistent_view" ) ).toBe( "nonexistent_view" ) ;
    } ) ;
  } ) ;

  describe( "LABEL_TO_CODE_MAP — Mapa inverso de migración" , () => {
    it( "cubre todos los valores de etiquetas requeridos para la migración histórica" , () => {
      const requeridosMigracion: Record< string , string > = {
        "Peso argentino (ARS)":     "ARS" ,
        "(GMT-03:00) Buenos Aires": "America/Argentina/Buenos_Aires" ,
        "1.234,56":                 "es-AR" ,
        "1,234.56":                 "en-US" ,
        "Lunes":                    "monday" ,
        "Domingo":                  "sunday" ,
        "Dashboard":                "dashboard" ,
      } ;

      for( const [ etiqueta , codigoEsperado ] of Object.entries( requeridosMigracion ) ) {
        expect( LABEL_TO_CODE_MAP[etiqueta] ).toBe( codigoEsperado ) ;
      }
    } ) ;

    it( "resuelve consistentemente etiquetas adicionales de opciones catalogadas" , () => {
      expect( LABEL_TO_CODE_MAP["Dólar estadounidense (USD)"] ).toBe( "USD" ) ;
      expect( LABEL_TO_CODE_MAP["Euro (EUR)"] ).toBe( "EUR" ) ;
      expect( LABEL_TO_CODE_MAP["Transacciones"] ).toBe( "transactions" ) ;
      expect( LABEL_TO_CODE_MAP["Suscripciones"] ).toBe( "subscriptions" ) ;
      expect( LABEL_TO_CODE_MAP["Cuentas"] ).toBe( "accounts" ) ;
    } ) ;

    it( "no contiene códigos vacíos ni undefined en el mapeo" , () => {
      for( const [ label , code ] of Object.entries( LABEL_TO_CODE_MAP ) ) {
        expect( label.trim().length ).toBeGreaterThan( 0 ) ;
        expect( code.trim().length ).toBeGreaterThan( 0 ) ;
      }
    } ) ;
  } ) ;

  describe( "PREFERENCE_CATALOG — Integridad estructural" , () => {
    it( "define los 5 grupos de preferencias con al menos una opción válida" , () => {
      const grupos = [ "currency" , "timezone" , "numberFormat" , "weeklyStart" , "defaultView" ] as const ;

      for( const g of grupos ) {
        expect( PREFERENCE_CATALOG[g] ).toBeDefined() ;
        expect( PREFERENCE_CATALOG[g].length ).toBeGreaterThan( 0 ) ;
      }
    } ) ;
  } ) ;
} ) ;
