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

/**
 * Pago entre miembros (RN-23): `from_user_id` paga (el deudor) y `to_user_id` recibe (el acreedor, quien lo registra).
 * Vive aparte del libro mayor: no genera asientos. Los tres usuarios quedan en `SET NULL` (A11): quien sale de
 * la organización deja sus pagos visibles.
 */
export const memberPayments = pgTable( "member_payments" , {
  id:                 uuid( "id"                    ).primaryKey().defaultRandom() ,
  organizationId:     uuid( "organization_id"       ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  fromUserId:         uuid( "from_user_id"          ).references( () => users.id         , {onDelete: "set null"} ) ,
  toUserId:           uuid( "to_user_id"            ).references( () => users.id         , {onDelete: "set null"} ) ,
  amountInCents:      bigint( "amount_in_cents" , {mode: "number"} ).notNull() ,
  currency:           varchar( "currency" , {length: 10} ).notNull() ,
  registeredByUserId: uuid( "registered_by_user_id" ).references( () => users.id         , {onDelete: "set null"} ) ,
  createdAt:          timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  amountCheck: check( "member_payments_amount_check" , sql`${table.amountInCents} > 0` ) ,
  pairIdx:     index( "member_payments_org_pair_idx" ).on( table.organizationId , table.fromUserId , table.toUserId ) ,
} ) ; } ) ;

/**
 * Solicitud de pago (RN-11): una por día, par y divisa. `from_user_id` es el acreedor que solicita y `to_user_id`
 * el deudor. La restricción única hace atómico el «una vez por día» y no depende de la campana.
 */
export const paymentRequests = pgTable( "payment_requests" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  fromUserId:     uuid( "from_user_id"    ).references( () => users.id         , {onDelete: "set null"} ) ,
  toUserId:       uuid( "to_user_id"      ).references( () => users.id         , {onDelete: "set null"} ) ,
  currency:       varchar( "currency" , {length: 10} ).notNull() ,
  dayKey:         varchar( "day_key" , {length: 10} ).notNull() , // "AAAA-MM-DD" en la zona del acreedor
  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueDay: uniqueIndex( "payment_requests_day_unique" ).on( table.organizationId , table.fromUserId , table.toUserId , table.currency , table.dayKey ) ,
} ) ; } ) ;

/**
 * Aporte o retiro de la caja común (RN-26): `amount_in_cents` lleva signo (positivo = aporte, negativo = retiro).
 * Vive aparte del libro mayor: no genera asientos ni referencia un movimiento. `user_id` y `registered_by_user_id`
 * quedan en `SET NULL`: quien sale de la organización deja su aporte visible como «Miembro anterior».
 */
export const commonPotContributions = pgTable( "common_pot_contributions" , {
  id:                 uuid( "id"                    ).primaryKey().defaultRandom() ,
  organizationId:     uuid( "organization_id"       ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  userId:             uuid( "user_id"               ).references( () => users.id         , {onDelete: "set null"} ) ,
  amountInCents:      bigint( "amount_in_cents" , {mode: "number"} ).notNull() ,
  currency:           varchar( "currency" , {length: 10} ).notNull() ,
  note:               varchar( "note" , {length: 200} ) ,
  registeredByUserId: uuid( "registered_by_user_id" ).references( () => users.id         , {onDelete: "set null"} ) ,
  occurredAt:         timestamp( "occurred_at" , {withTimezone: true} ).defaultNow().notNull() ,
  createdAt:          timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  amountCheck:     check( "common_pot_contributions_amount_check" , sql`${table.amountInCents} <> 0` ) ,
  orgCurrencyIdx:  index( "common_pot_contributions_org_currency_idx" ).on( table.organizationId , table.currency ) ,
} ) ; } ) ;

/**
 * Reclamo de pago («Ya pagué», RN-37). `from_user_id` es el deudor que reclama y `to_user_id` el acreedor.
 * El índice único parcial asegura a lo sumo un reclamo pendiente por organización, deudor, acreedor y divisa.
 */
export const paymentClaims = pgTable( "payment_claims" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  fromUserId:     uuid( "from_user_id"    ).references( () => users.id         , {onDelete: "set null"} ) ,
  toUserId:       uuid( "to_user_id"      ).references( () => users.id         , {onDelete: "set null"} ) ,
  amountInCents:  bigint( "amount_in_cents" , {mode: "number"} ).notNull() ,
  currency:       varchar( "currency" , {length: 10} ).notNull() ,
  status:         varchar( "status"   , {length: 12} ).default( "pending" ).notNull() ,
  createdAt:      timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
  resolvedAt:     timestamp( "resolved_at" , {withTimezone: true} ) ,
} , ( table ) => { return( {
  amountCheck:   check( "payment_claims_amount_check" , sql`${table.amountInCents} > 0` ) ,
  statusCheck:   check( "payment_claims_status_check" , sql`${table.status} IN ('pending','confirmed','rejected','cancelled')` ) ,
  uniquePending: uniqueIndex( "payment_claims_pending_unique" )
    .on( table.organizationId , table.fromUserId , table.toUserId , table.currency )
    .where( sql`${table.status} = 'pending'` ) ,
  toStatusIdx:   index( "payment_claims_org_to_status_idx" ).on( table.organizationId , table.toUserId , table.status ) ,
} ) ; } ) ;

