/**
 * @file ciclo.test.ts
 * Pruebas unitarias para las funciones de cálculo de ciclos y vencimientos de tarjetas (RFC 007).
 * Valida las 4 trampas temporales: recortes de fin de mes, bisiestos, desfases de vencimiento y zonas horarias IANA.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Cards
import {
  calcularPeriodos ,
  diasEnMes ,
  recortarDia ,
  crearFinDeDiaEnZona ,
  descomponerFechaEnZona ,
  deudaDe
} from "./ciclo" ;


describe( "ciclo.ts — Lógica de Ciclos de Facturación y Vencimientos" , () => {
  describe( "Trampa 1: Cierre 31 en Febrero no existe (recorte al fin de mes sin desborde)" , () => {
    it( "recorta día 31 al día 28 en febrero de año no bisiesto" , () => {
      const dias = diasEnMes( 2026 , 2 ) ;
      expect( dias ).toBe( 28 ) ;

      const recortado = recortarDia( 31 , 2026 , 2 ) ;
      expect( recortado ).toBe( 28 ) ;
    } ) ;

    it( "calcula periodos con closingDay = 31 parado en marzo de 2026" , () => {
      // 15 de marzo de 2026: el cierre del mes anterior (febrero) debe ser el 28 de febrero, no marzo
      const hoy = new Date( "2026-03-15T12:00:00Z" ) ;
      const periodos = calcularPeriodos( 31 , 10 , hoy , "America/Argentina/Buenos_Aires" ) ;

      const localCierreActual = descomponerFechaEnZona( periodos.cierreActual , "America/Argentina/Buenos_Aires" ) ;
      expect( localCierreActual.year ).toBe( 2026 ) ;
      expect( localCierreActual.month ).toBe( 2 ) ;
      expect( localCierreActual.day ).toBe( 28 ) ;
    } ) ;
  } ) ;

  describe( "Trampa 2: Año bisiesto (Febrero 2028 tiene 29 días)" , () => {
    it( "detecta 29 días para febrero de 2028 y recorta a 29" , () => {
      const dias = diasEnMes( 2028 , 2 ) ;
      expect( dias ).toBe( 29 ) ;

      const recortado = recortarDia( 31 , 2028 , 2 ) ;
      expect( recortado ).toBe( 29 ) ;
    } ) ;

    it( "fija el cierre al 29 de febrero de 2028 si closingDay es 30 o 31" , () => {
      const hoy = new Date( "2028-03-10T12:00:00Z" ) ;
      const periodos = calcularPeriodos( 30 , 5 , hoy , "America/Argentina/Buenos_Aires" ) ;

      const localCierre = descomponerFechaEnZona( periodos.cierreActual , "America/Argentina/Buenos_Aires" ) ;
      expect( localCierre.year ).toBe( 2028 ) ;
      expect( localCierre.month ).toBe( 2 ) ;
      expect( localCierre.day ).toBe( 29 ) ;
    } ) ;
  } ) ;

  describe( "Trampa 3: dueDay < closingDay desfasa el vencimiento al mes siguiente" , () => {
    it( "si dueDay (5) < closingDay (25), el vencimiento cae en el mes siguiente al cierre" , () => {
      // Hoy 26 de marzo de 2026: el cierre actual ocurrió el 25 de marzo
      const hoy = new Date( "2026-03-26T12:00:00Z" ) ;
      const periodos = calcularPeriodos( 25 , 5 , hoy , "America/Argentina/Buenos_Aires" ) ;

      const localCierre = descomponerFechaEnZona( periodos.cierreActual , "America/Argentina/Buenos_Aires" ) ;
      expect( localCierre.month ).toBe( 3 ) ;
      expect( localCierre.day ).toBe( 25 ) ;

      const localVencimiento = descomponerFechaEnZona( periodos.vencimiento , "America/Argentina/Buenos_Aires" ) ;
      expect( localVencimiento.year ).toBe( 2026 ) ;
      expect( localVencimiento.month ).toBe( 4 ) ; // Abril
      expect( localVencimiento.day ).toBe( 5 ) ;
    } ) ;

    it( "si dueDay (28) > closingDay (20), el vencimiento cae en el mismo mes del cierre" , () => {
      const hoy = new Date( "2026-03-22T12:00:00Z" ) ;
      const periodos = calcularPeriodos( 20 , 28 , hoy , "America/Argentina/Buenos_Aires" ) ;

      const localCierre = descomponerFechaEnZona( periodos.cierreActual , "America/Argentina/Buenos_Aires" ) ;
      expect( localCierre.month ).toBe( 3 ) ;
      expect( localCierre.day ).toBe( 20 ) ;

      const localVencimiento = descomponerFechaEnZona( periodos.vencimiento , "America/Argentina/Buenos_Aires" ) ;
      expect( localVencimiento.month ).toBe( 3 ) ; // Mismo mes
      expect( localVencimiento.day ).toBe( 28 ) ;
    } ) ;
  } ) ;

  describe( "Trampa 4: La zona horaria y consumo a las 22:30 en Buenos Aires" , () => {
    it( "un consumo a las 22:30 del 25 en Buenos Aires (01:30 UTC del 26) entra en el cierre del 25" , () => {
      // 25 de Marzo de 2026 a las 22:30 hora de Buenos Aires (UTC-3)
      // En UTC corresponde a 2026-03-26T01:30:00.000Z
      const consumo = new Date( "2026-03-26T01:30:00.000Z" ) ;

      // Cierre del día 25 en Buenos Aires (25 de marzo a las 23:59:59.999 local)
      const cierreDel25 = crearFinDeDiaEnZona( 2026 , 3 , 25 , "America/Argentina/Buenos_Aires" ) ;

      // El cierre en UTC corresponde a 2026-03-26T02:59:59.999Z
      expect( consumo.getTime() ).toBeLessThanOrEqual( cierreDel25.getTime() ) ;

      // Un consumo a las 00:30 del 26 en Buenos Aires (03:30 UTC) cae fuera del cierre
      const consumoDiaSiguiente = new Date( "2026-03-26T03:30:00.000Z" ) ;
      expect( consumoDiaSiguiente.getTime() ).toBeGreaterThan( cierreDel25.getTime() ) ;
    } ) ;
  } ) ;

  describe( "deudaDe: Conversión de signo de pasivo" , () => {
    it( "invierte el saldo negativo del libro mayor a deuda exigible positiva" , () => {
      const cuenta = { balance: -2500000 } ; // $25.000,00 ARS adeudados
      expect( deudaDe( cuenta ) ).toBe( 2500000 ) ;
    } ) ;

    it( "devuelve 0 si la cuenta está en cero" , () => {
      expect( deudaDe( { balance: 0 } ) ).toBe( 0 ) ;
    } ) ;
  } ) ;
} ) ;
