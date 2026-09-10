// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Subscriptions
import {
  ocurrenciaN ,
  ventanaAbierta ,
  pendientesDe ,
  calcularPunteroInicial ,
  proximaOcurrenciaPosteriorA
} from "./recurrenceService" ;
import { makeSubscription } from "../testing/subscriptionFactory" ;
import { Subscription }     from "../types" ;

describe( "recurrenceService" , () => {
  describe( "ocurrenciaN" , () => {
    it( "ancla en el día nominal a lo largo de un año que cruza febrero" , () => {
      const inicio = "2026-01-31" ; // 31 de enero de 2026 (no bisiesto)

      expect( ocurrenciaN( inicio , "monthly" , 1 , 0 ) ).toBe( "2026-01-31" ) ;
      expect( ocurrenciaN( inicio , "monthly" , 1 , 1 ) ).toBe( "2026-02-28" ) ; // Recorta en febrero
      expect( ocurrenciaN( inicio , "monthly" , 1 , 2 ) ).toBe( "2026-03-31" ) ; // Vuelve al 31 en marzo
      expect( ocurrenciaN( inicio , "monthly" , 1 , 3 ) ).toBe( "2026-04-30" ) ; // Recorta en abril (30 días)
      expect( ocurrenciaN( inicio , "monthly" , 1 , 4 ) ).toBe( "2026-05-31" ) ; // Vuelve al 31 en mayo
      expect( ocurrenciaN( inicio , "monthly" , 1 , 11 ) ).toBe( "2026-12-31" ) ;
      expect( ocurrenciaN( inicio , "monthly" , 1 , 12 ) ).toBe( "2027-01-31" ) ;
    } ) ;

    it( "calcula correctamente ocurrencias semanales sumando 7 días exactos" , () => {
      const inicio = "2026-01-05" ; // Lunes

      expect( ocurrenciaN( inicio , "weekly" , 1 , 0 ) ).toBe( "2026-01-05" ) ;
      expect( ocurrenciaN( inicio , "weekly" , 1 , 1 ) ).toBe( "2026-01-12" ) ;
      expect( ocurrenciaN( inicio , "weekly" , 1 , 4 ) ).toBe( "2026-02-02" ) ;
    } ) ;

    it( "calcula correctamente ocurrencias anuales" , () => {
      const inicio = "2026-06-05" ;

      expect( ocurrenciaN( inicio , "yearly" , 1 , 0 ) ).toBe( "2026-06-05" ) ;
      expect( ocurrenciaN( inicio , "yearly" , 1 , 1 ) ).toBe( "2027-06-05" ) ;
    } ) ;
  } ) ;

  describe( "ventanaAbierta" , () => {
    it( "para frecuencia mensual abre el día 1 del mes del cargo" , () => {
      const fechaCobro = "2026-09-15" ;

      // Antes del mes de cobro: cerrada
      expect( ventanaAbierta( fechaCobro , "monthly" , "2026-08-31" ) ).toBe( false ) ;

      // Primer día del mes de cobro: abierta
      expect( ventanaAbierta( fechaCobro , "monthly" , "2026-09-01" ) ).toBe( true ) ;

      // Día del cobro: abierta
      expect( ventanaAbierta( fechaCobro , "monthly" , "2026-09-15" ) ).toBe( true ) ;

      // Pasado el cobro: sigue abierta mientras no se resuelva
      expect( ventanaAbierta( fechaCobro , "monthly" , "2026-09-30" ) ).toBe( true ) ;
    } ) ;

    it( "para frecuencia weekly abre únicamente el mismo día del cobro" , () => {
      const fechaCobro = "2026-09-15" ;

      // Día anterior: cerrada
      expect( ventanaAbierta( fechaCobro , "weekly" , "2026-09-14" ) ).toBe( false ) ;

      // Mismo día: abierta
      expect( ventanaAbierta( fechaCobro , "weekly" , "2026-09-15" ) ).toBe( true ) ;

      // Posterior: abierta
      expect( ventanaAbierta( fechaCobro , "weekly" , "2026-09-16" ) ).toBe( true ) ;
    } ) ;
  } ) ;

  describe( "pendientesDe" , () => {
    it( "con el puntero en el período anterior devuelve exactamente uno" , () => {
      const sub = makeSubscription( {
        startDate:       new Date( 2026 , 5 , 5 ) , // 2026-06-05
        frequency:       "monthly" ,
        intervalCount:   1 ,
        resolvedThrough: "2026-08-05" , // resuelto hasta agosto
      } ) ;

      // Hoy es 10 de septiembre de 2026: ventana abierta para el cobro del 2026-09-05
      const pendientes = pendientesDe( sub , "2026-09-10" ) ;

      expect( pendientes.length ).toBe( 1 ) ;
      expect( pendientes[0].fechaCobro ).toBe( "2026-09-05" ) ;
      expect( pendientes[0].subscriptionId ).toBe( sub.id ) ;
    } ) ;

    it( "devuelve arreglo vacío si la suscripción no está active" , () => {
      const sub = makeSubscription( {
        startDate:       new Date( 2026 , 5 , 5 ) ,
        frequency:       "monthly" ,
        status:          "cancelled" ,
        resolvedThrough: null ,
      } ) ;

      expect( pendientesDe( sub , "2026-09-10" ) ).toEqual( [] ) ;
    } ) ;

    it( "el tope de seguridad de 24 ocurrencias corta" , () => {
      // Suscripción vieja de 5 años atrás sin puntero resuelto
      const sub = makeSubscription( {
        startDate:       new Date( 2020 , 0 , 1 ) ,
        frequency:       "monthly" ,
        intervalCount:   1 ,
        resolvedThrough: null ,
      } ) ;

      const pendientes = pendientesDe( sub , "2026-09-10" ) ;
      expect( pendientes.length ).toBe( 24 ) ;
    } ) ;
  } ) ;

  describe( "calcularPunteroInicial y proximaOcurrenciaPosteriorA" , () => {
    it( "calcula el puntero inicial en la ocurrencia anterior al período en curso" , () => {
      // Suscripción iniciada el 2026-06-05, evaluada en septiembre 2026
      const puntero = calcularPunteroInicial( "2026-06-05" , "monthly" , 1 , "2026-09-10" ) ;
      expect( puntero ).toBe( "2026-08-05" ) ;
    } ) ;

    it( "calcula la próxima ocurrencia como Date posterior a resolvedThrough" , () => {
      const prox = proximaOcurrenciaPosteriorA( "2026-06-05" , "monthly" , 1 , "2026-09-05" ) ;
      expect( prox.getFullYear() ).toBe( 2026 ) ;
      expect( prox.getMonth() ).toBe( 9 ) ; // Octubre (0-indexed: 9)
      expect( prox.getDate() ).toBe( 5 ) ;
    } ) ;
  } ) ;
} ) ;
