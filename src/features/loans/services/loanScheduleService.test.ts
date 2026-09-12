/**
 * @file loanScheduleService.test.ts
 * Pruebas unitarias para el servicio de cronograma y cuotas pendientes de préstamos (RFC 008).
 * Valida el período de gracia (§8.9), la no superación de totalInstallments y el avance de resolvedThrough.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Loans
import { pendientesDeLoan } from "./loanScheduleService" ;
import type { Loan }        from "../types" ;


function crearLoanMock( overrides: Partial< Loan > = {} ): Loan {
  return( {
    id:                   "loan-test-123" ,
    organizationId:       "org-test-123" ,
    name:                 "Préstamo Test" ,
    direction:            "borrowed" ,
    entityId:             "entity-123" ,
    contactId:            null ,
    principalAmount:      1200000 , // $12.000,00
    currency:             "ARS" ,
    interestRateAnnual:   0 ,
    totalInstallments:    12 ,
    frequency:            "monthly" ,
    intervalCount:        1 ,
    startDate:            new Date( "2026-09-15T12:00:00Z" ) ,
    firstInstallmentDate: "2026-11-10" ,
    resolvedThrough:      null ,
    archivedAt:           null ,
    createdAt:            new Date( "2026-09-15T12:00:00Z" ) ,
    updatedAt:            new Date( "2026-09-15T12:00:00Z" ) ,
    ...overrides
  } ) ;
}

describe( "loanScheduleService.ts — Proyección de Cuotas Pendientes" , () => {
  describe( "§8.9 Período de gracia y fecha ancla firstInstallmentDate" , () => {
    it( "startDate 15/09 y firstInstallmentDate 10/11 no propone ninguna cuota hasta el 1/11, y la primera es 10/11" , () => {
      const loan = crearLoanMock( {
        startDate:            new Date( "2026-09-15T12:00:00Z" ) ,
        firstInstallmentDate: "2026-11-10"
      } ) ;

      // Parado en 2026-10-31: la ventana de noviembre no abrió todavía
      const pendientesOctubre = pendientesDeLoan( loan , "2026-10-31" ) ;
      expect( pendientesOctubre ).toHaveLength( 0 ) ;

      // Parado en 2026-11-01: abre la ventana para la cuota del 10/11
      const pendientesNoviembre = pendientesDeLoan( loan , "2026-11-01" ) ;
      expect( pendientesNoviembre.length ).toBeGreaterThanOrEqual( 1 ) ;
      expect( pendientesNoviembre[ 0 ].n ).toBe( 1 ) ;
      expect( pendientesNoviembre[ 0 ].fechaCuota ).toBe( "2026-11-10" ) ;
    } ) ;
  } ) ;

  describe( "Filtro de cuotas ya resueltas (resolvedThrough)" , () => {
    it( "salta las cuotas con fecha <= resolvedThrough" , () => {
      const loan = crearLoanMock( {
        firstInstallmentDate: "2026-01-10" ,
        totalInstallments:    6 ,
        resolvedThrough:      "2026-02-10"
      } ) ;

      // Parado en abril de 2026: cuota 1 (ene) y 2 (feb) ya resueltas
      const pendientes = pendientesDeLoan( loan , "2026-04-15" ) ;

      // Cuotas pendientes: marzo (3) y abril (4)
      expect( pendientes ).toHaveLength( 2 ) ;
      expect( pendientes[ 0 ].n ).toBe( 3 ) ;
      expect( pendientes[ 0 ].fechaCuota ).toBe( "2026-03-10" ) ;
      expect( pendientes[ 1 ].n ).toBe( 4 ) ;
      expect( pendientes[ 1 ].fechaCuota ).toBe( "2026-04-10" ) ;
    } ) ;
  } ) ;

  describe( "Límite totalInstallments" , () => {
    it( "nunca ofrece más allá de totalInstallments (ej: 3 cuotas en total)" , () => {
      const loan = crearLoanMock( {
        firstInstallmentDate: "2026-01-10" ,
        totalInstallments:    3 ,
        resolvedThrough:      null
      } ) ;

      // Parado en fin de año 2026: debe devolver exactamente 3 cuotas, nunca la 4ta
      const pendientes = pendientesDeLoan( loan , "2026-12-31" ) ;
      expect( pendientes ).toHaveLength( 3 ) ;
      expect( pendientes[ 0 ].n ).toBe( 1 ) ;
      expect( pendientes[ 1 ].n ).toBe( 2 ) ;
      expect( pendientes[ 2 ].n ).toBe( 3 ) ;
    } ) ;
  } ) ;

  describe( "Baja lógica (archivedAt)" , () => {
    it( "retorna arreglo vacío si archivedAt no es nulo" , () => {
      const loan = crearLoanMock( {
        archivedAt: new Date( "2026-10-01T10:00:00Z" )
      } ) ;

      const pendientes = pendientesDeLoan( loan , "2026-11-15" ) ;
      expect( pendientes ).toHaveLength( 0 ) ;
    } ) ;
  } ) ;
} ) ;
