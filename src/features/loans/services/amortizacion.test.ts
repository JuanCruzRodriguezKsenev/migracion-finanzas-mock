/**
 * @file amortizacion.test.ts
 * Pruebas unitarias para el servicio de amortización francesa de préstamos (RFC 008).
 * Valida las tres invariantes monetarias y el comportamiento con distintas frecuencias y tasas.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Loans
import {
  calcularTasaPeriodica ,
  cuotaFrancesa ,
  cronogramaFrances
} from "./amortizacion" ;


describe( "amortizacion.ts — Sistema Francés e Invariantes" , () => {
  describe( "Invariante 1: sum( capital ) === principal exactamente (absorción del resto en última cuota)" , () => {
    it( "amortiza exactamente el total de 1.000.000 centavos en 12 cuotas al 85.5% anual" , () => {
      const principal = 1000000 ;
      const tna       = 8550 ;
      const cuotas    = 12 ;
      const crono     = cronogramaFrances( principal , tna , cuotas , "monthly" , 1 ) ;

      expect( crono ).toHaveLength( 12 ) ;
      const sumaCapital = crono.reduce( ( acc , f ) => { return( acc + f.capital ) ; } , 0 ) ;
      expect( sumaCapital ).toBe( principal ) ;
      expect( crono[ 11 ].saldoRestante ).toBe( 0 ) ;
    } ) ;

    it( "amortiza exactamente montos impares con resto indivisible (ej: 100.003 centavos en 7 cuotas)" , () => {
      const principal = 100003 ;
      const tna       = 4500 ;
      const cuotas    = 7 ;
      const crono     = cronogramaFrances( principal , tna , cuotas , "monthly" , 1 ) ;

      const sumaCapital = crono.reduce( ( acc , f ) => { return( acc + f.capital ) ; } , 0 ) ;
      expect( sumaCapital ).toBe( principal ) ;
      expect( crono[ 6 ].saldoRestante ).toBe( 0 ) ;
    } ) ;
  } ) ;

  describe( "Invariante 2: cuota === capital + interes en cada fila" , () => {
    it( "cumple cuota = capital + interes en todas las cuotas de un cronograma quincenal/semanal" , () => {
      const principal = 5000000 ;
      const tna       = 6000 ;
      const cuotas    = 26 ;
      const crono     = cronogramaFrances( principal , tna , cuotas , "weekly" , 1 ) ;

      for( const fila of crono ) {
        expect( fila.cuota ).toBe( fila.capital + fila.interes ) ;
        expect( Number.isInteger( fila.cuota ) ).toBe( true ) ;
        expect( Number.isInteger( fila.capital ) ).toBe( true ) ;
        expect( Number.isInteger( fila.interes ) ).toBe( true ) ;
        expect( Number.isInteger( fila.saldoRestante ) ).toBe( true ) ;
      }
    } ) ;
  } ) ;

  describe( "Invariante 3: interestRateAnnual = 0 genera interes = 0 y cuota = principal / n con ajuste final" , () => {
    it( "produce interes = 0 en todas las filas y ajusta el resto en la última cuota para tasa cero" , () => {
      const principal = 100000 ; // $1.000,00 en centavos
      const tna       = 0 ;
      const cuotas    = 3 ;      // 100.000 / 3 = 33.333,33...
      const crono     = cronogramaFrances( principal , tna , cuotas , "monthly" , 1 ) ;

      expect( crono ).toHaveLength( 3 ) ;
      expect( crono[ 0 ].interes ).toBe( 0 ) ;
      expect( crono[ 1 ].interes ).toBe( 0 ) ;
      expect( crono[ 2 ].interes ).toBe( 0 ) ;

      expect( crono[ 0 ].capital ).toBe( 33333 ) ;
      expect( crono[ 1 ].capital ).toBe( 33333 ) ;
      expect( crono[ 2 ].capital ).toBe( 33334 ) ; // Absorbe el centavo de diferencia

      const suma = crono.reduce( ( acc , f ) => { return( acc + f.capital ) ; } , 0 ) ;
      expect( suma ).toBe( principal ) ;
      expect( crono[ 2 ].saldoRestante ).toBe( 0 ) ;
    } ) ;
  } ) ;

  describe( "Cálculo de tasa periódica por frecuencia" , () => {
    it( "calcula correctamente la tasa para weekly, quarterly, yearly y custom" , () => {
      // 1200 pb = 12% = 0.12 anual
      const tna = 1200 ;

      expect( calcularTasaPeriodica( tna , "monthly" , 1 ) ).toBeCloseTo( 0.12 / 12 , 6 ) ;
      expect( calcularTasaPeriodica( tna , "weekly" , 1 ) ).toBeCloseTo( 0.12 / 52 , 6 ) ;
      expect( calcularTasaPeriodica( tna , "quarterly" , 1 ) ).toBeCloseTo( 0.12 / 4 , 6 ) ;
      expect( calcularTasaPeriodica( tna , "yearly" , 1 ) ).toBeCloseTo( 0.12 / 1 , 6 ) ;
      // custom con intervalCount = 2 (bimestral -> 0.12 * 2 / 12 = 0.02)
      expect( calcularTasaPeriodica( tna , "custom" , 2 ) ).toBeCloseTo( 0.02 , 6 ) ;
    } ) ;
  } ) ;

  describe( "Casos de borde" , () => {
    it( "devuelve 0 cuotas si totalInstallments <= 0" , () => {
      expect( cuotaFrancesa( 100000 , 1000 , 0 , "monthly" , 1 ) ).toBe( 0 ) ;
      expect( cronogramaFrances( 100000 , 1000 , 0 , "monthly" , 1 ) ).toEqual( [] ) ;
    } ) ;
  } ) ;
} ) ;
