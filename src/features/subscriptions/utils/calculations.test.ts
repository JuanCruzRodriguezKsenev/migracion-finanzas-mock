// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Subscriptions
import { toMonthlyAmount , toYearlyAmount , addInterval , enrichSubscriptions , buildSummary } from "./calculations" ;
import { makeSubscription }                                                                    from "../testing/subscriptionFactory" ;

/**
 * Suite de pruebas unitarias para las conversiones de montos de suscripciones.
 * Todos los montos en centavos enteros.
 */
describe( "calculations" , () => {
  describe( "toMonthlyAmount" , () => {
    it( "debería retornar el mismo monto para frecuencia mensual" , () => {
      expect( toMonthlyAmount( 100000 , "monthly" ) ).toBe( 100000 ) ;
    } ) ;

    it( "debería convertir frecuencia anual dividiendo por 12" , () => {
      expect( toMonthlyAmount( 1200000 , "yearly" ) ).toBe( 100000 ) ;
    } ) ;

    it( "debería convertir frecuencia trimestral dividiendo por 3" , () => {
      expect( toMonthlyAmount( 300000 , "quarterly" ) ).toBe( 100000 ) ;
    } ) ;

    it( "debería convertir frecuencia semanal multiplicando por 52/12" , () => {
      expect( toMonthlyAmount( 12000 , "weekly" ) ).toBe( 52000 ) ;
    } ) ;

    it( "debería dividir por intervalCount (ej: cada 2 meses)" , () => {
      expect( toMonthlyAmount( 100000 , "monthly" , 2 ) ).toBe( 50000 ) ;
    } ) ;

    it( "debería tolerar intervalCount inválido usando 1" , () => {
      expect( toMonthlyAmount( 100000 , "monthly" , 0 ) ).toBe( 100000 ) ;
    } ) ;

    it( "debería redondear a centavos enteros" , () => {
      expect( Number.isInteger( toMonthlyAmount( 99999 , "yearly" ) ) ).toBe( true ) ;
    } ) ;
  } ) ;

  describe( "toYearlyAmount" , () => {
    it( "debería proyectar el mensual multiplicado por 12" , () => {
      expect( toYearlyAmount( 100000 , "monthly" ) ).toBe( 1200000 ) ;
    } ) ;
  } ) ;

  describe( "addInterval" , () => {
    it( "debería sumar un mes para frecuencia mensual" , () => {
      const next = addInterval( new Date( 2026 , 0 , 15 ) , "monthly" ) ;
      expect( next.getMonth() ).toBe( 1 ) ;
      expect( next.getDate() ).toBe( 15 ) ;
    } ) ;

    it( "debería sumar 7 días para frecuencia semanal" , () => {
      const next = addInterval( new Date( 2026 , 0 , 1 ) , "weekly" ) ;
      expect( next.getDate() ).toBe( 8 ) ;
    } ) ;

    it( "debería sumar 3 meses para frecuencia trimestral" , () => {
      const next = addInterval( new Date( 2026 , 0 , 1 ) , "quarterly" ) ;
      expect( next.getMonth() ).toBe( 3 ) ;
    } ) ;

    it( "debería sumar un año para frecuencia anual" , () => {
      const next = addInterval( new Date( 2026 , 5 , 1 ) , "yearly" ) ;
      expect( next.getFullYear() ).toBe( 2027 ) ;
    } ) ;

    it( "debería recortar al último día del mes sin desbordar (31 de enero a 28 de febrero)" , () => {
      const enero31 = new Date( 2026 , 0 , 31 ) ;
      const febrero = addInterval( enero31 , "monthly" ) ;
      expect( febrero.getMonth() ).toBe( 1 ) ;
      expect( febrero.getDate() ).toBe( 28 ) ;

      // Con ancla en el nominal (intervalCount = 2), proyecta al 31 de marzo
      const marzo = addInterval( enero31 , "monthly" , 2 ) ;
      expect( marzo.getMonth() ).toBe( 2 ) ;
      expect( marzo.getDate() ).toBe( 31 ) ;
    } ) ;
  } ) ;

  describe( "enrichSubscriptions" , () => {
    it( "debería retornar un arreglo vacío sin suscripciones" , () => {
      expect( enrichSubscriptions( [] ) ).toEqual( [] ) ;
    } ) ;

    it( "debería ordenar por gasto mensual descendente sin mutar la entrada" , () => {
      const items = [
        makeSubscription( {id: "a" , amount: 100000 , frequency: "monthly"} ) ,
        makeSubscription( {id: "b" , amount: 500000 , frequency: "monthly"} ) ,
      ] ;

      const enriched = enrichSubscriptions( items ) ;

      expect( enriched[0].id ).toBe( "b" ) ;
      expect( items[0].id ).toBe( "a" ) ; // la entrada no fue mutada
    } ) ;

    it( "debería calcular porcentajes del total mensual" , () => {
      const items = [
        makeSubscription( {id: "a" , amount: 750000 , frequency: "monthly"} ) ,
        makeSubscription( {id: "b" , amount: 250000 , frequency: "monthly"} ) ,
      ] ;

      const enriched = enrichSubscriptions( items ) ;

      expect( enriched[0].percentOfTotal ).toBe( 75 ) ;
      expect( enriched[1].percentOfTotal ).toBe( 25 ) ;
    } ) ;

    it( "debería usar porcentaje 0 cuando el total es cero" , () => {
      // amount es positivo por schema, pero la función debe ser robusta ante total 0
      const enriched = enrichSubscriptions( [] ) ;
      expect( enriched.length ).toBe( 0 ) ;
    } ) ;

    it( "debería normalizar la frecuencia anual dentro del porcentaje" , () => {
      const items = [
        makeSubscription( {id: "anual"   , amount: 1200000 , frequency: "yearly"} ) ,  // 100000/mes
        makeSubscription( {id: "mensual" , amount: 100000  , frequency: "monthly"} ) , // 100000/mes
      ] ;

      const enriched = enrichSubscriptions( items ) ;

      expect( enriched[0].monthlyAmount ).toBe( enriched[1].monthlyAmount ) ;
      expect( enriched[0].percentOfTotal ).toBe( 50 ) ;
    } ) ;
  } ) ;

  describe( "buildSummary" , () => {
    it( "debería agregar totales mensual y anual en centavos" , () => {
      const items = [
        makeSubscription( {id: "a" , amount: 100000 , frequency: "monthly"} ) ,
        makeSubscription( {id: "b" , amount: 600000 , frequency: "yearly"} ) , // 50000/mes
      ] ;

      const summary = buildSummary( items ) ;

      expect( summary.totalMonthly ).toBe( 150000 ) ;
      expect( summary.totalYearly ).toBe( 1800000 ) ;
      expect( summary.count ).toBe( 2 ) ;
      expect( summary.subscriptions.length ).toBe( 2 ) ;
    } ) ;

    it( "debería manejar el listado vacío" , () => {
      const summary = buildSummary( [] ) ;

      expect( summary.totalMonthly ).toBe( 0 ) ;
      expect( summary.totalYearly ).toBe( 0 ) ;
      expect( summary.count ).toBe( 0 ) ;
    } ) ;
  } ) ;
} ) ;
