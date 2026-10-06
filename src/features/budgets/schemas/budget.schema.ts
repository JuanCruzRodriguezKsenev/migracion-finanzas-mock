/**
 * @file budget.schema.ts
 * Esquemas de validación en runtime para las acciones de presupuestos (RFC 028 §4).
 */
// Librerías externas
import { z } from "zod" ;


const montoCentavos = z.number( { message: "El límite debe ser un número." } )
                       .int( "El límite debe ser un número entero de centavos." )
                       .positive( "El límite debe ser mayor a cero." ) ;

/**
 * Lectura de presupuestos de un mes (ambos campos opcionales: se completan con los defaults del usuario).
 */
export const getBudgetsSchema = z.object( {
  monthKey: z.string().regex( /^[0-9]{4}-(0[1-9]|1[0-2])$/ , "El mes debe tener formato AAAA-MM." ).optional() ,
  currency: z.string().regex( /^[A-Z]{3}$/ , "La divisa debe tener 3 letras mayúsculas (ej: ARS)." ).optional() ,
} ) ;

/**
 * Alta de un presupuesto.
 */
export const createBudgetSchema = z.object( {
  categoryId: z.string().uuid( "ID de categoría inválido." ) ,
  currency:   z.string().regex( /^[A-Z]{3}$/ , "La divisa debe tener 3 letras mayúsculas (ej: ARS)." ) ,
  amount:     montoCentavos ,
} ) ;

/**
 * Cambio del límite del mes en curso.
 */
export const updateBudgetLimitSchema = z.object( {
  budgetId: z.string().uuid( "ID de presupuesto inválido." ) ,
  amount:   montoCentavos ,
} ) ;

/**
 * Eliminación (fin de vigencia) de un presupuesto.
 */
export const deleteBudgetSchema = z.object( {
  budgetId: z.string().uuid( "ID de presupuesto inválido." ) ,
} ) ;

export type GetBudgetsInput         = z.infer< typeof getBudgetsSchema > ;
export type CreateBudgetInput       = z.infer< typeof createBudgetSchema > ;
export type UpdateBudgetLimitInput  = z.infer< typeof updateBudgetLimitSchema > ;
export type DeleteBudgetInput       = z.infer< typeof deleteBudgetSchema > ;
