/**
 * @file schema.db.ts
 * Esquema del reparto de gastos entre miembros: el acuerdo de la organización y las deudas que genera cada gasto.
 * El reparto no crea asientos: es una deuda entre personas, aparte del libro mayor. Los porcentajes se guardan
 * en puntos básicos enteros (`10000` = 100 %) y los montos en centavos, nunca en punto flotante.
 */
// Librerías externas
import { pgTable , uuid , varchar , integer , bigint , boolean , timestamp , uniqueIndex , index , check } from "drizzle-orm/pg-core" ;
import { sql }                                                                                              from "drizzle-orm" ;

// Feature: Accounting
import { ledgerTransactions } from "@/features/accounting/schema.db" ;

// Feature: Auth
import { organizations , users } from "@/features/auth/schema.db" ;


/**
 * Acuerdo de reparto de una organización (una fila por organización). Sin fila = «sin reparto» (RN-13).
 * `uses_common_pot` queda guardado sin efecto hasta el plan de la caja común.
 */
export const organizationAgreements = pgTable( "organization_agreements" , {
  organizationId:  uuid( "organization_id" ).primaryKey().references( () => organizations.id , {onDelete: "cascade"} ) ,
  mode:            varchar( "mode" , {length: 30} ).notNull() , // 'none' | 'fixed_percentages' | 'monthly_contributions'
  usesCommonPot:   boolean( "uses_common_pot" ).default( false ).notNull() ,
  updatedByUserId: uuid( "updated_by_user_id" ).references( () => users.id , {onDelete: "set null"} ) ,
  updatedAt:       timestamp( "updated_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  modeCheck: check( "organization_agreements_mode_check" , sql`${table.mode} IN ('none','fixed_percentages','monthly_contributions')` ) ,
} ) ; } ) ;

/**
 * Porcentaje fijo de cada miembro en el modo `fixed_percentages`, en puntos básicos (`10000` = 100 %).
 */
export const agreementPercentages = pgTable( "agreement_percentages" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  userId:         uuid( "user_id"         ).references( () => users.id         , {onDelete: "cascade"} ).notNull() ,
  percentageBp:   integer( "percentage_bp" ).notNull() ,
} , ( table ) => { return( {
  uniqueOrgUser: uniqueIndex( "agreement_percentages_org_user_unique" ).on( table.organizationId , table.userId ) ,
  bpCheck:       check( "agreement_percentages_bp_check" , sql`${table.percentageBp} BETWEEN 0 AND 10000` ) ,
} ) ; } ) ;

/**
 * Aporte mensual declarado por un miembro (modo `monthly_contributions`). No lleva divisa: es sólo el peso
 * del miembro en el reparto (RN-16). `month` va de 1 a 12.
 */
export const monthlyContributions = pgTable( "monthly_contributions" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  userId:         uuid( "user_id"         ).references( () => users.id         , {onDelete: "cascade"} ).notNull() ,
  year:           integer( "year"  ).notNull() ,
  month:          integer( "month" ).notNull() ,
  amountInCents:  bigint( "amount_in_cents" , {mode: "number"} ).notNull() ,
} , ( table ) => { return( {
  uniqueOrgUserMonth: uniqueIndex( "monthly_contributions_org_user_month_unique" ).on( table.organizationId , table.userId , table.year , table.month ) ,
  monthCheck:         check( "monthly_contributions_month_check"  , sql`${table.month} BETWEEN 1 AND 12` ) ,
  amountCheck:        check( "monthly_contributions_amount_check" , sql`${table.amountInCents} >= 0` ) ,
} ) ; } ) ;

/**
 * Deuda de un miembro por un gasto repartido. El acreedor no se guarda: es el `holder_user_id` de la
 * transacción. `debtor_user_id` queda en `SET NULL`: quien sale de la organización deja sus saldos visibles.
 */
export const expenseSplits = pgTable( "expense_splits" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id       , {onDelete: "cascade"} ).notNull() ,
  transactionId:  uuid( "transaction_id"  ).references( () => ledgerTransactions.id  , {onDelete: "cascade"} ).notNull() ,
  debtorUserId:   uuid( "debtor_user_id"  ).references( () => users.id               , {onDelete: "set null"} ) ,
  amountInCents:  bigint( "amount_in_cents" , {mode: "number"} ).notNull() ,
  currency:       varchar( "currency" , {length: 10} ).notNull() ,
  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueTxDebtor: uniqueIndex( "expense_splits_tx_debtor_unique" ).on( table.transactionId , table.debtorUserId ) ,
  amountCheck:    check( "expense_splits_amount_check" , sql`${table.amountInCents} > 0` ) ,
  debtorIdx:      index( "expense_splits_org_debtor_idx" ).on( table.organizationId , table.debtorUserId ) ,
} ) ; } ) ;
