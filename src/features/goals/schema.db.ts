/**
 * @file schema.db.ts
 * Esquema de base de datos para las Metas de ahorro y sus reservas virtuales (RFC 011 §2).
 * Montos en centavos enteros. El ahorrado y lo reservado no se guardan: son sumas de `goal_movements`.
 */
// Librerías externas
import { pgTable , uuid , varchar , bigint , timestamp , date , index , check } from "drizzle-orm/pg-core" ;
import { sql }                                                                  from "drizzle-orm" ;

// Feature: Accounting
import { accounts } from "@/features/accounting/schema.db" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;


/**
 * Metas de ahorro: objetivo con monto y divisa. No es una cuenta ni mueve el libro (RN-5).
 */
export const goals = pgTable( "goals" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  name:           varchar( "name"     , {length: 150} ).notNull() ,
  currency:       varchar( "currency" , {length: 10 } ).notNull() ,
  targetAmount:   bigint( "target_amount" , {mode: "number"} ).notNull() ,            // Centavos, > 0
  targetDate:     date( "target_date" ) ,                                              // Nulo = sin fecha
  priority:       varchar( "priority" , {length: 10} ).default( "normal" ).notNull() , // 'normal' | 'high'
  status:         varchar( "status"   , {length: 20} ).default( "active" ).notNull() , // 'active' | 'completed' | 'abandoned'
  completedAt:    timestamp( "completed_at" , {withTimezone: true} ) ,
  createdAt:      timestamp( "created_at"   , {withTimezone: true} ).defaultNow().notNull() ,
  updatedAt:      timestamp( "updated_at"   , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  orgStatusIdx:   index( "goals_org_status_idx" ).on( table.organizationId , table.status ) ,
  targetPositive: check( "goals_target_amount_positive" , sql`${table.targetAmount} > 0` ) ,
  priorityValid:  check( "goals_priority_valid"         , sql`${table.priority} IN ('normal','high')` ) ,
  statusValid:    check( "goals_status_valid"           , sql`${table.status} IN ('active','completed','abandoned')` ) ,
} ) ; } ) ;

/**
 * Registro de aportes y retiros de una meta. **Sólo recibe INSERT**: nunca UPDATE ni DELETE.
 */
export const goalMovements = pgTable( "goal_movements" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  goalId:         uuid( "goal_id"         ).references( () => goals.id          , {onDelete: "restrict"} ).notNull() ,
  accountId:      uuid( "account_id"      ).references( () => accounts.id       , {onDelete: "restrict"} ).notNull() ,
  kind:           varchar( "kind" , {length: 12} ).notNull() ,                         // 'contribution' | 'withdrawal'
  amount:         bigint( "amount" , {mode: "number"} ).notNull() ,                    // Centavos, > 0
  occurredAt:     timestamp( "occurred_at" , {withTimezone: true} ).defaultNow().notNull() ,
  createdAt:      timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  goalIdx:        index( "goal_movements_goal_idx"    ).on( table.goalId ) ,
  accountIdx:     index( "goal_movements_account_idx" ).on( table.accountId ) ,
  amountPositive: check( "goal_movements_amount_positive" , sql`${table.amount} > 0` ) ,
  kindValid:      check( "goal_movements_kind_valid"      , sql`${table.kind} IN ('contribution','withdrawal')` ) ,
} ) ; } ) ;
