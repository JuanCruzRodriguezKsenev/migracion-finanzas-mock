/**
 * @file subscriptionFactory.ts
 * Factory centralizado para generar instancias de prueba de Subscription.
 */
// Feature: Subscriptions
import { Subscription } from "../types" ;


/**
 * Genera una entidad Subscription para tests con valores canónicos por defecto
 * que pueden ser sobreescritos mediante el parámetro `overrides`.
 *
 * @param overrides - Campos específicos para personalizar la suscripción.
 * @returns Instancia completa de Subscription válida para pruebas.
 */
export function makeSubscription( overrides?: Partial< Subscription > ): Subscription {
  const now = new Date( 2026 , 0 , 31 ) ;

  return( {
    id:              "sub-test-1" ,
    organizationId:  "org-test" ,
    name:            "Servicio Recurrente" ,
    description:     null ,
    amount:          150000 ,
    currency:        "ARS" ,
    frequency:       "monthly" ,
    intervalCount:   1 ,
    startDate:       now ,
    nextPaymentDate: now ,
    resolvedThrough: null ,
    autoDebit:       false ,
    accountId:       null ,
    status:          "active" ,
    logoKey:         "default" ,
    color:           "#EEF2FF" ,
    categoryId:      null ,
    createdAt:       now ,
    updatedAt:       now ,
    ...overrides ,
  } ) ;
}
