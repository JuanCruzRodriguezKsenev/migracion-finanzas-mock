/**
 * @file schema.db.ts
 * Definición del esquema de base de datos relacional para el Core Contable de Partida Doble.
 * Define las tablas de cuentas, categorías contables, transacciones y asientos de diario.
 */
// Librerías externas
import { pgTable , uuid , varchar , integer , timestamp , text , jsonb , uniqueIndex } from "drizzle-orm/pg-core" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;


/**
 * Esquema de la tabla para Categorías Contables (jerarquía de ingresos y gastos).
 */
export const categories = pgTable( "categories" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  parentId:       uuid( "parent_id"       ) , // Auto-referencia para árbol jerárquico
  name:           varchar( "name"  , {length: 100} ).notNull() ,
  icon:           varchar( "icon"  , {length: 50 } ) ,
  color:          varchar( "color" , {length: 7  } ) , // Hex (#FFFFFF)
  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} ) ;

/**
 * Esquema de la tabla para Entidades Financieras (Bancos, Billeteras Virtuales, Efectivo).
 */
export const financialEntities = pgTable( "financial_entities" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  name:           varchar( "name"  , {length: 150} ).notNull() ,
  logo:           varchar( "logo"  , {length: 100} ) , // Identificador de logo o icono
  color:          varchar( "color" , {length: 7  } ) , // Color hexadecimal representative
  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} ) ;

/**
 * Esquema de la tabla para Cuentas del Libro Mayor (Activos, Pasivos, Patrimonio, Ingresos, Gastos).
 */
export const accounts = pgTable( "accounts" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  code:           varchar( "code" , {length: 50 } ).notNull() , // Código contable del plan de cuentas
  name:           varchar( "name" , {length: 150} ).notNull() ,
  type:           varchar( "type" , {length: 50 } ).notNull() , // 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  balance:        integer( "balance" ).default( 0 ).notNull() , // Saldo en centavos. Negativo para pasivos o sobregiros
  currency:       varchar( "currency" , {length: 10} ).default( "ARS" ).notNull() ,
  entityId:       uuid( "entity_id" ).references( () => financialEntities.id , {onDelete: "restrict"} ) , // Entidad vinculada
  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueOrgCode: uniqueIndex( "accounts_org_code_unique" ).on( table.organizationId , table.code ) ,
} ) ; } ) ;

/**
 * Esquema de la tabla para Transacciones del Libro Diario (cabecera del asiento).
 */
export const ledgerTransactions = pgTable( "ledger_transactions" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  categoryId:     uuid( "category_id"     ).references( () => categories.id , {onDelete: "set null"} ) ,
  description:    varchar( "description"     , {length: 255} ).notNull() ,
  merchantName:   varchar( "merchant_name"   , {length: 150} ) ,
  merchantDomain: varchar( "merchant_domain" , {length: 100} ) ,
  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} ) ;

/**
 * Esquema de la tabla para Asientos/Movimientos Contables individuales (partida doble).
 */
export const ledgerEntries = pgTable( "ledger_entries" , {
  id:            uuid( "id"             ).primaryKey().defaultRandom() ,
  transactionId: uuid( "transaction_id" ).references( () => ledgerTransactions.id , {onDelete: "cascade"} ).notNull() ,
  accountId:     uuid( "account_id"     ).references( () => accounts.id           , {onDelete: "restrict"} ).notNull() , // restrict para impedir borrar cuentas con movimientos
  debit:         integer( "debit"  ).default( 0 ).notNull() , // Monto del Débito (Debe) en centavos
  credit:        integer( "credit" ).default( 0 ).notNull() , // Monto del Crédito (Haber) en centavos
  currency:      varchar( "currency" , {length: 10} ).default( "ARS" ).notNull() ,
  createdAt:     timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} ) ;

/**
 * Esquema de la tabla para el control de Idempotencia.
 */
export const idempotencyKeys = pgTable( "idempotency_keys" , {
  key:          varchar( "key"    , {length: 255} ).primaryKey() , // UUID u hash provisto por el cliente
  status:       varchar( "status" , {length: 50 } ).notNull() , // 'PROCESSING' | 'COMPLETED'
  responseBody: text( "response_body" ) ,
  createdAt:    timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} ) ;

/**
 * Esquema de la tabla para el registro de Eventos Outbox (Garantía transaccional ACID para webhooks/eventos).
 */
export const outboxEvents = pgTable( "outbox_events" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  eventType:      varchar( "event_type" , {length: 100} ).notNull() , // ej: 'TRANSACTION_CREATED'
  payload:        jsonb( "payload" ).notNull() ,
  status:         varchar( "status" , {length: 50} ).default( "PENDING" ).notNull() , // 'PENDING' | 'SENT' | 'FAILED'
  attempts:       integer( "attempts"      ).default( 0 ).notNull() ,
  createdAt:      timestamp( "created_at"   , {withTimezone: true} ).defaultNow().notNull() ,
  processedAt:    timestamp( "processed_at" , {withTimezone: true} ) ,
} ) ;

/**
 * Esquema de la tabla para Resúmenes Mensuales Históricos de la organización (Cierre de mes).
 */
export const monthlySummaries = pgTable( "monthly_summaries" , {
  id:              uuid( "id"               ).primaryKey().defaultRandom() ,
  organizationId:  uuid( "organization_id"  ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  year:            integer( "year"          ).notNull() ,
  month:           integer( "month"         ).notNull() , // 0-indexed (0 = Enero ... 11 = Diciembre), igual que Date.getMonth(). Distinto del parámetro 'beforeMonth' de findRecent(), que es 1-indexed por diseño de API pública.
  totalRevenue:        integer( "total_revenue"     ).default( 0 ).notNull() ,
  totalExpense:        integer( "total_expense"     ).default( 0 ).notNull() ,
  balanceSnapshot:     integer( "balance_snapshot"  ).default( 0 ).notNull() ,
  assetsSnapshot:      integer( "assets_snapshot"   ).default( 0 ).notNull() ,
  liabilitiesSnapshot: integer( "liabilities_snapshot" ).default( 0 ).notNull() ,
  createdAt:           timestamp( "created_at"      , {withTimezone: true} ).defaultNow().notNull() ,
} ) ;

