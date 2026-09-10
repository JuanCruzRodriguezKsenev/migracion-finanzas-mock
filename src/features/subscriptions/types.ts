/**
 * @file types.ts
 * Interfaces y tipos de datos del dominio de Suscripciones Recurrentes.
 */
// Librerías externas
import { InferSelectModel , InferInsertModel } from "drizzle-orm" ;

// Feature: Subscriptions
import { subscriptions } from "./schema.db" ;


export type Subscription       = InferSelectModel< typeof subscriptions > ;
export type InsertSubscription = InferInsertModel< typeof subscriptions > ;

/**
 * Frecuencias de cobro soportadas por el módulo (RFC 004).
 */
export type SubscriptionFrequency = "weekly" | "monthly" | "quarterly" | "yearly" | "custom" ;

/**
 * Datos que el formulario de alta/edición envía a las Server Actions.
 * El monto viaja en centavos enteros; organizationId lo aporta la sesión.
 */
export interface SubscriptionFormData {
  name:        string ;
  amount:      number ;
  frequency:   SubscriptionFrequency ;
  logoKey:     string ;
  color:       string ;
  categoryId?: string | null ;
}

/**
 * Suscripción enriquecida con estadísticas normalizadas para el dashboard.
 * Todos los montos derivados se expresan en centavos enteros.
 */
export interface SubscriptionWithStats extends Subscription {
  monthlyAmount:  number ; // normalizado siempre a mensual, en centavos
  yearlyAmount:   number ; // proyección anual, en centavos
  percentOfTotal: number ; // porcentaje redondeado del gasto mensual total
}

/**
 * Resumen agregado del gasto en suscripciones para la barra de totales.
 */
export interface SubscriptionSummary {
  totalMonthly:  number ; // centavos
  totalYearly:   number ; // centavos
  count:         number ;
  subscriptions: SubscriptionWithStats[] ;
}
