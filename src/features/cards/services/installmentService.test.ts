/**
 * @file installmentService.test.ts
 * Pruebas unitarias para el servicio puro de cuotas de tarjeta de crédito (RFC 025).
 * Valida proyecciones temporales, ancla de fin de mes, fin de serie y cuotas futuras.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Cards
import {
  ocurrenciaDeCuota ,
  cuotasImputadasDe ,
  pendientesDeCuotas ,
  cuotasFuturasDe ,
  cuotasFuturasPorDivisa ,
  proponerPrimeraCuota
} from "./installmentService" ;
import { makeInstallmentPlan } from "../testing/installmentPlanFactory" ;


describe( "installmentService (RFC 025)" , () => {
  describe( "ocurrenciaDeCuota" , () => {
    it( "proyecta la primera cuota en el ancla civil (n=0)" , () => {
      const plan  = makeInstallmentPlan( { firstInstallmentDate: "2026-04-15" } ) ;
      const fecha = ocurrenciaDeCuota( plan , 0 ) ;

      expect( fecha ).toBe( "2026-04-15" ) ;
    } ) ;

    it( "ancla de fin de mes (§9.7): 31/01 proyecta 28/02 y vuelve a 31/03 sin degradarse" , () => {
      const plan = makeInstallmentPlan( { firstInstallmentDate: "2026-01-31" , totalInstallments: 3 } ) ;

      expect( ocurrenciaDeCuota( plan , 0 ) ).toBe( "2026-01-31" ) ;
      expect( ocurrenciaDeCuota( plan , 1 ) ).toBe( "2026-02-28" ) ;
      expect( ocurrenciaDeCuota( plan , 2 ) ).toBe( "2026-03-31" ) ;
    } ) ;
  } ) ;

  describe( "cuotasImputadasDe" , () => {
    it( "retorna 0 si resolvedThrough es nulo" , () => {
      const plan = makeInstallmentPlan( { resolvedThrough: null } ) ;

      expect( cuotasImputadasDe( plan ) ).toBe( 0 ) ;
    } ) ;

    it( "cuenta exactamente las cuotas anteriores o iguales a resolvedThrough" , () => {
      const plan = makeInstallmentPlan( {
        firstInstallmentDate: "2026-05-10" ,
        totalInstallments:    6 ,
        resolvedThrough:      "2026-07-10" , // cuotas 0 (mayo), 1 (junio), 2 (julio)
      } ) ;

      expect( cuotasImputadasDe( plan ) ).toBe( 3 ) ;
    } ) ;

    it( "corta en totalInstallments si el puntero excede el final del plan" , () => {
      const plan = makeInstallmentPlan( {
        firstInstallmentDate: "2026-01-10" ,
        totalInstallments:    3 ,
        resolvedThrough:      "2026-12-10" ,
      } ) ;

      expect( cuotasImputadasDe( plan ) ).toBe( 3 ) ;
    } ) ;
  } ) ;

  describe( "pendientesDeCuotas" , () => {
    it( "fin de serie (§9.5): un plan de 3 cuotas con las 3 imputadas no propone una cuarta" , () => {
      const plan = makeInstallmentPlan( {
        firstInstallmentDate: "2026-01-10" ,
        totalInstallments:    3 ,
        resolvedThrough:      "2026-03-10" , // las 3 imputadas
      } ) ;

      const pendientes = pendientesDeCuotas( plan , "2026-04-05" ) ;

      expect( pendientes ).toEqual( [] ) ;
    } ) ;

    it( "primera cuota futura (§9.6): compra el 20/09 con primera cuota el 10/11 no propone nada hasta el 01/11" , () => {
      // Puntero inicial para serie que arranca el 10/11 evaluada el 20/09 es 10/10
      const plan = makeInstallmentPlan( {
        purchasedAt:          new Date( "2026-09-20T15:00:00.000Z" ) ,
        firstInstallmentDate: "2026-11-10" ,
        totalInstallments:    3 ,
        resolvedThrough:      "2026-10-10" ,
      } ) ;

      // En octubre la ventana no abrió (abre el 01/11)
      const pendientesOctubre = pendientesDeCuotas( plan , "2026-10-31" ) ;
      expect( pendientesOctubre ).toEqual( [] ) ;

      // El 01/11 la ventana abre y la primera propuesta es la del 10/11
      const pendientesNoviembre = pendientesDeCuotas( plan , "2026-11-01" ) ;
      expect( pendientesNoviembre ).toHaveLength( 1 ) ;
      expect( pendientesNoviembre[0].fechaCuota ).toBe( "2026-11-10" ) ;
      expect( pendientesNoviembre[0].numeroCuota ).toBe( 1 ) ;
    } ) ;

    it( "retorna arreglo vacío si el plan está archivado lógicamente" , () => {
      const plan = makeInstallmentPlan( {
        archivedAt: new Date() ,
      } ) ;

      const pendientes = pendientesDeCuotas( plan , "2026-10-15" ) ;

      expect( pendientes ).toEqual( [] ) ;
    } ) ;
  } ) ;

  describe( "cuotasFuturasDe y cuotasFuturasPorDivisa" , () => {
    it( "calcula correctamente el saldo restante en centavos y nunca es negativo" , () => {
      const plan = makeInstallmentPlan( {
        installmentAmount: 1000000 , // $10.000 en centavos
        totalInstallments: 12 ,
        resolvedThrough:   null ,
      } ) ;

      // 0 imputadas: 12 x $10.000 = $120.000
      expect( cuotasFuturasDe( plan ) ).toBe( 12000000 ) ;

      // 1 imputada: 11 x $10.000 = $110.000 (§9.10)
      const planConUna = { ...plan , resolvedThrough: "2026-10-10" } ;
      expect( cuotasFuturasDe( planConUna ) ).toBe( 11000000 ) ;

      // 12 imputadas: 0 restantes
      const planCompleto = { ...plan , resolvedThrough: "2027-09-10" } ;
      expect( cuotasFuturasDe( planCompleto ) ).toBe( 0 ) ;
    } ) ;

    it( "retorna 0 si el plan está archivado" , () => {
      const plan = makeInstallmentPlan( { archivedAt: new Date() } ) ;
      expect( cuotasFuturasDe( plan ) ).toBe( 0 ) ;
    } ) ;

    it( "cuotasFuturasPorDivisa agrupa por divisa e ignora planes archivados" , () => {
      const p1 = makeInstallmentPlan( { currency: "ARS" , installmentAmount: 1000 , totalInstallments: 2 } ) ;
      const p2 = makeInstallmentPlan( { currency: "ARS" , installmentAmount: 2000 , totalInstallments: 1 } ) ;
      const p3 = makeInstallmentPlan( { currency: "USD" , installmentAmount: 5000 , totalInstallments: 3 } ) ;
      const pArchivado = makeInstallmentPlan( {
        currency:          "ARS" ,
        installmentAmount: 9000 ,
        totalInstallments: 5 ,
        archivedAt:        new Date() ,
      } ) ;

      const agrupado = cuotasFuturasPorDivisa( [ p1 , p2 , p3 , pArchivado ] ) ;

      expect( agrupado ).toEqual( {
        ARS: 4000 ,
        USD: 15000 ,
      } ) ;
    } ) ;
  } ) ;

  describe( "proponerPrimeraCuota" , () => {
    it( "propone el mes vigente si la compra fue antes o en el día de cierre" , () => {
      // Compra el 15/09/2026 con cierre el 18 y vencimiento el 10
      const compra    = new Date( "2026-09-15T14:00:00.000Z" ) ;
      const propuesta = proponerPrimeraCuota( 18 , 10 , compra , "America/Argentina/Buenos_Aires" ) ;

      expect( propuesta ).toBe( "2026-09-10" ) ;
    } ) ;

    it( "propone el mes siguiente si la compra fue posterior al día de cierre" , () => {
      // Compra el 20/09/2026 con cierre el 18 y vencimiento el 10
      const compra    = new Date( "2026-09-20T14:00:00.000Z" ) ;
      const propuesta = proponerPrimeraCuota( 18 , 10 , compra , "America/Argentina/Buenos_Aires" ) ;

      expect( propuesta ).toBe( "2026-10-10" ) ;
    } ) ;

    it( "devuelve la fecha civil de compra si la tarjeta no tiene día de cierre" , () => {
      const compra    = new Date( "2026-09-20T14:00:00.000Z" ) ;
      const propuesta = proponerPrimeraCuota( null , null , compra , "America/Argentina/Buenos_Aires" ) ;

      expect( propuesta ).toBe( "2026-09-20" ) ;
    } ) ;
  } ) ;
} ) ;
