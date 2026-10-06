/**
 * @file schema.db.ts
 * Esquema de base de datos de Presupuestos mensuales por categoría (RFC 028 §2).
 * Un presupuesto es la identidad (categoría, divisa, ciclo de vida); sus límites guardan la historia con vigencia.
 */
// Librerías externas
import { pgTable , uuid , varchar , bigint , timestamp , uniqueIndex , check } from "drizzle-orm/pg-core" ;
import { sql }                                                                 from "drizzle-orm" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { categories } from "@/features/accounting/schema.db" ;


/**
 * Presupuesto por categoría y divisa. `endedFrom` ("YYYY-MM") nulo significa vigente.
 */
export const budgets = pgTable( "budgets" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  categoryId:     uuid( "category_id"     ).references( () => categories.id    , {onDelete: "restrict"} ).notNull() ,
  currency:       varchar( "currency"   , {length: 10} ).notNull() ,
  endedFrom:      varchar( "ended_from" , {length: 7 } ) ,
  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( t ) => { return( {
  // Un solo presupuesto vigente por categoría y divisa (RN-2): índice único parcial.
  vigentePorCategoria: uniqueIndex( "budgets_active_category_currency_unique" )
                         .on( t.organizationId , t.categoryId , t.currency )
                         .where( sql`${t.endedFrom} IS NULL` ) ,
  endedFromFormato:    check( "budgets_ended_from_format" , sql`${t.endedFrom} IS NULL OR ${t.endedFrom} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'` ) ,
} ) ; } ) ;

/**
 * Límite mensual con vigencia desde `effectiveFrom` ("YYYY-MM"). Monto en centavos, siempre positivo.
 */
export const budgetLimits = pgTable( "budget_limits" , {
  id:            uuid( "id"        ).primaryKey().defaultRandom() ,
  budgetId:      uuid( "budget_id" ).references( () => budgets.id , {onDelete: "cascade"} ).notNull() ,
  effectiveFrom: varchar( "effective_from" , {length: 7} ).notNull() ,
  amount:        bigint( "amount" , {mode: "number"} ).notNull() ,
} , ( t ) => { return( {
  unicoPorMes:      uniqueIndex( "budget_limits_budget_month_unique" ).on( t.budgetId , t.effectiveFrom ) ,
  montoPositivo:    check( "budget_limits_amount_positive" , sql`${t.amount} > 0` ) ,
  vigenciaFormato:  check( "budget_limits_effective_from_format" , sql`${t.effectiveFrom} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'` ) ,
} ) ; } ) ;
