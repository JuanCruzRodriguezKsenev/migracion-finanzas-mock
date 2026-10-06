/**
 * @file goal.schema.ts
 * Esquemas de validación en runtime para las acciones de Metas (RFC 011 §5).
 */
// Librerías externas
import { z } from "zod" ;


export const GOAL_PRIORITIES = [ "normal" , "high" ] as const ;
export const GOAL_FILTERS    = [ "all" , "active" , "completed" ] as const ;

const montoSchema  = z.number( { message: "El monto debe ser un número." } ).int( "El monto debe ser un número entero de centavos." ).positive( "El monto debe ser mayor a cero." ) ;
const uuidSchema   = ( msg: string ) => { return( z.string().uuid( msg ) ) ; } ;
const fechaSchema  = z.string()
  .regex( /^\d{4}-\d{2}-\d{2}$/ , "La fecha debe tener formato YYYY-MM-DD." )
  .refine( ( v ) => {
    const d = new Date( `${v}T00:00:00Z` ) ;
    return( !isNaN( d.getTime() ) && (d.toISOString().slice( 0 , 10 ) === v) ) ;
  } , "La fecha no existe en el calendario." ) ;
const nombreSchema = z.string().trim().min( 1 , "El nombre de la meta es obligatorio." ).max( 150 , "Máximo 150 caracteres." ) ;

/** Alta de una meta. */
export const createGoalSchema = z.object( {
  name:         nombreSchema ,
  currency:     z.string().length( 3 , "La divisa debe tener exactamente 3 caracteres (ej: ARS, USD)." ) ,
  targetAmount: montoSchema ,
  targetDate:   fechaSchema.nullable().optional() ,
  priority:     z.enum( GOAL_PRIORITIES , { message: "Prioridad inválida." } ).default( "normal" )
} ).strict() ;

/** Edición de una meta: nunca la divisa. */
export const updateGoalSchema = z.object( {
  goalId:       uuidSchema( "ID de meta inválido." ) ,
  name:         nombreSchema ,
  targetAmount: montoSchema ,
  targetDate:   fechaSchema.nullable().optional() ,
  priority:     z.enum( GOAL_PRIORITIES , { message: "Prioridad inválida." } )
} ).strict() ;

/** Aporte o retiro. */
export const goalMovementSchema = z.object( {
  goalId:    uuidSchema( "ID de meta inválido." ) ,
  accountId: uuidSchema( "ID de cuenta inválido." ) ,
  amount:    montoSchema
} ).strict() ;

/** Abandono. */
export const abandonGoalSchema = z.object( {
  goalId: uuidSchema( "ID de meta inválido." )
} ).strict() ;

/** Lectura de la vista. */
export const getGoalsSchema = z.object( {
  currency: z.string().length( 3 , "La divisa debe tener 3 caracteres." ).optional() ,
  filter:   z.enum( GOAL_FILTERS , { message: "Filtro inválido." } ).default( "all" )
} ).strict() ;

export type CreateGoalInput = z.input< typeof createGoalSchema > ;
export type UpdateGoalInput = z.input< typeof updateGoalSchema > ;
export type GoalMovementInput = z.input< typeof goalMovementSchema > ;
