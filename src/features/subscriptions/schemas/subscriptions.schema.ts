/**
 * @file subscriptions.schema.ts
 * Esquemas de validación de datos en runtime para el módulo de suscripciones usando Zod.
 */
// Librerías externas
import { z } from "zod" ;

/**
 * Esquema de validación en runtime para la creación de una suscripción.
 * El monto se exige en centavos enteros positivos, igual que el resto del dominio contable.
 */
export const createSubscriptionSchema = z.object( {
  name:      z.string().min( 1 , "El nombre es requerido." ).max( 150 , "El nombre no puede superar los 150 caracteres." ) ,
  amount:    z.number().int( "El monto debe ser en centavos enteros." ).positive( "El monto debe ser mayor a 0." ).max( 999_999_999 ) ,
  frequency: z.enum( [ "weekly" , "monthly" , "quarterly" , "yearly" , "custom" ] , {
    error: "La frecuencia debe ser weekly, monthly, quarterly, yearly o custom." ,
  } ) ,
  logoKey:    z.string().min( 1 ).max( 500 ) ,
  color:      z.string().regex( /^#[0-9A-Fa-f]{6}$/ , "El color debe ser un hexadecimal válido (#RRGGBB)." ) ,
  categoryId: z.string().uuid( "El ID de categoría debe ser un UUID válido." ).optional().nullable() ,
} ) ;

/**
 * Tipo para la entrada de creación de suscripciones inferido del esquema de Zod.
 */
export type CreateSubscriptionInput = z.infer< typeof createSubscriptionSchema > ;

/**
 * Esquema de validación en runtime para la actualización parcial de una suscripción.
 */
export const updateSubscriptionSchema = createSubscriptionSchema.partial() ;

/**
 * Tipo para la entrada de actualización de suscripciones inferido del esquema de Zod.
 */
export type UpdateSubscriptionInput = z.infer< typeof updateSubscriptionSchema > ;
