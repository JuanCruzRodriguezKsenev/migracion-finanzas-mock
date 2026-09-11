/**
 * @file installmentPlanFactory.ts
 * Factory centralizado para generar instancias de prueba de CardInstallmentPlan.
 */
// Feature: Cards
import { CardInstallmentPlan } from "../types" ;


/**
 * Genera una entidad CardInstallmentPlan para tests con valores canónicos por defecto
 * que pueden ser sobreescritos mediante el parámetro `overrides`.
 *
 * @param overrides - Campos específicos para personalizar el plan de cuotas.
 * @returns Instancia completa de CardInstallmentPlan válida para pruebas.
 */
export function makeInstallmentPlan( overrides?: Partial< CardInstallmentPlan > ): CardInstallmentPlan {
  const now = new Date( 2026 , 8 , 20 ) ; // 2026-09-20

  return( {
    id:                   "plan-test-1" ,
    organizationId:       "org-test" ,
    cardId:               "card-test-1" ,
    description:          "Heladera Samsung" ,
    merchantName:         "Fravega" ,
    categoryId:           null ,
    installmentAmount:    1000000 , // $10.000 en centavos
    totalInstallments:    12 ,
    currency:             "ARS" ,
    purchasedAt:          now ,
    firstInstallmentDate: "2026-10-10" ,
    resolvedThrough:      null ,
    archivedAt:           null ,
    createdAt:            now ,
    updatedAt:            now ,
    ...overrides ,
  } ) ;
}
