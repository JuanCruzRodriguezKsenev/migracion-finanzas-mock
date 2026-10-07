/**
 * @file schema.db.ts
 * Definición del esquema de base de datos relacional para el Core Contable de Partida Doble.
 * Define las tablas de cuentas, categorías contables, transacciones y asientos de diario.
 */
// Librerías externas
import { pgTable , uuid , varchar , integer , bigint , timestamp , text , jsonb , uniqueIndex , index , boolean , AnyPgColumn } from "drizzle-orm/pg-core" ;

// Feature: Auth
import { organizations , users } from "@/features/auth/schema.db" ;


/**
 * Esquema de la tabla para Categorías Contables (jerarquía de ingresos y gastos).
 */
export const categories = pgTable( "categories" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  parentId:       uuid( "parent_id"       ).references( (): AnyPgColumn => categories.id , {onDelete: "restrict"} ) ,
  name:           varchar( "name"         , {length: 100} ).notNull() ,
  icon:           varchar( "icon"         , {length: 50 } ) ,
  color:          varchar( "color"        , {length: 7  } ) , // Hex (#FFFFFF)
  type:           varchar( "type"         , {length: 20 } ).notNull() ,
  accountCode:    varchar( "account_code" , {length: 50 } ).notNull() ,
  archivedAt:     timestamp( "archived_at" , {withTimezone: true} ) ,
  isSystemLeaf:   boolean( "is_system_leaf" ).default( false ).notNull() ,
  createdAt:      timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueOrgCode: uniqueIndex( "categories_org_account_code_unique" ).on( table.organizationId , table.accountCode ) ,
  orgParentIdx:  index( "categories_org_parent_idx" ).on( table.organizationId , table.parentId ) ,
} ) ; } ) ;

/**
 * Esquema de la tabla para Entidades Financieras (Bancos, Billeteras Virtuales, Efectivo).
 */
export const financialEntities = pgTable( "financial_entities" , {
  id:             uuid( "id"                 ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id"    ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  name:           varchar( "name"         , {length: 150} ).notNull() ,
  logo:           varchar( "logo"         , {length: 100} ) , // Icono de respaldo (bank | wallet | cash | credit-card)
  brandDomain:    varchar( "brand_domain" , {length: 100} ) , // Dominio web de la marca para resolución de logos
  color:          varchar( "color"        , {length: 7  } ) , // Color hexadecimal representativo
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
  balance:        bigint( "balance" , {mode: "number"} ).default( 0 ).notNull() , // Saldo en centavos. Negativo para pasivos o sobregiros
  currency:       varchar( "currency" , {length: 10} ).default( "ARS" ).notNull() ,
  entityId:       uuid( "entity_id" ).references( () => financialEntities.id , {onDelete: "restrict"} ) , // Entidad vinculada
  cbuCvu:         varchar( "cbu_cvu" , {length: 22} ) , // Datos de transferencia propios (22 dígitos)
  alias:          varchar( "alias"   , {length: 20} ) , // Alias bancario/billetera (6-20 caracteres)
  isCommonPot:    boolean( "is_common_pot" ).default( false ).notNull() , // Cuenta de caja común: sus gastos no generan deuda entre miembros
  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueOrgCode: uniqueIndex( "accounts_org_code_unique" ).on( table.organizationId , table.code ) ,
} ) ; } ) ;

/**
 * Vínculo entre una categoría contable y sus cuentas del libro mayor: una fila por divisa.
 * Permite que una categoría agrupe una cuenta por moneda (ej: 5.1.01.01-ARS y 5.1.01.01-USD).
 */
export const categoryAccounts = pgTable( "category_accounts" , {
  id:         uuid( "id"          ).primaryKey().defaultRandom() ,
  categoryId: uuid( "category_id" ).references( () => categories.id , {onDelete: "restrict"} ).notNull() ,
  accountId:  uuid( "account_id"  ).references( () => accounts.id   , {onDelete: "restrict"} ).notNull() ,
  currency:   varchar( "currency" , {length: 10} ).notNull() ,
  createdAt:  timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueCategoryCurrency: uniqueIndex( "category_accounts_category_currency_unique" ).on( table.categoryId , table.currency ) ,
} ) ; } ) ;

/**
 * Esquema de la tabla para Transacciones del Libro Diario (cabecera del asiento).
 */
export const ledgerTransactions = pgTable( "ledger_transactions" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  categoryId:     uuid( "category_id"     ).references( () => categories.id     , {onDelete: "set null"} ) ,
  description:    varchar( "description"     , {length: 255} ).notNull() ,
  merchantName:   varchar( "merchant_name"   , {length: 150} ) ,
  merchantDomain: varchar( "merchant_domain" , {length: 100} ) ,
  occurredAt:     timestamp( "occurred_at" , {withTimezone: true} ).defaultNow().notNull() ,
  // Enlace de reversión, en los dos sentidos. El libro diario es inmutable: una transacción
  // equivocada no se borra, se contra-asienta. Sin estas dos columnas el vínculo sólo existiría en
  // el payload del outbox —un flujo de eventos, no una relación consultable—, así que la interfaz
  // no podría marcar una transacción como reversada ni el servicio impedir que se reverse dos veces.
  reversesTransactionId: uuid( "reverses_transaction_id" ) , // En el contra-asiento: apunta a la original
  reversedAt:            timestamp( "reversed_at" , {withTimezone: true} ) , // En la original: cuándo se reversó
  // Autoría: quién cargó el movimiento y a nombre de quién. Nulables: los movimientos anteriores no
  // se retro-completan, y los generados por cron u outbox no tienen autor. Si el usuario se borra,
  // el movimiento sobrevive con el campo en nulo.
  createdByUserId: uuid( "created_by_user_id" ).references( () => users.id , {onDelete: "set null"} ) ,
  holderUserId:    uuid( "holder_user_id"     ).references( () => users.id , {onDelete: "set null"} ) ,
  createdAt:      timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  // Un único índice para la paginación por cursor, que ordena por (occurred_at, id). El índice
  // sobre (organization_id, occurred_at) que existía antes era redundante: este lo cubre por
  // prefijo, y mantener los dos sólo costaba escrituras.
  orgOccurredIdIdx: index( "ledger_tx_org_occurred_id_idx" ).on( table.organizationId , table.occurredAt , table.id ) ,
  orgHolderIdx:     index( "ledger_tx_org_holder_idx"      ).on( table.organizationId , table.holderUserId ) ,
} ) ; } ) ;

/**
 * Esquema de la tabla para Asientos/Movimientos Contables individuales (partida doble).
 */
export const ledgerEntries = pgTable( "ledger_entries" , {
  id:            uuid( "id"             ).primaryKey().defaultRandom() ,
  transactionId: uuid( "transaction_id" ).references( () => ledgerTransactions.id , {onDelete: "cascade"} ).notNull() ,
  accountId:     uuid( "account_id"     ).references( () => accounts.id           , {onDelete: "restrict"} ).notNull() , // restrict para impedir borrar cuentas con movimientos
  debit:         bigint( "debit"  , {mode: "number"} ).default( 0 ).notNull() , // Monto del Débito (Debe) en centavos
  credit:        bigint( "credit" , {mode: "number"} ).default( 0 ).notNull() , // Monto del Crédito (Haber) en centavos
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
  status:         varchar( "status" , {length: 50} ).default( "PENDING" ).notNull() , // 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED'
  attempts:       integer( "attempts"      ).default( 0 ).notNull() ,
  createdAt:      timestamp( "created_at"   , {withTimezone: true} ).defaultNow().notNull() ,
  processedAt:    timestamp( "processed_at" , {withTimezone: true} ) ,
} , ( table ) => { return( {
  outboxStatusCreatedIdx: index( "outbox_status_created_idx" ).on( table.status , table.createdAt ) ,
} ) ; } ) ;

/**
 * Esquema de la tabla para Resúmenes Mensuales Históricos de la organización (Cierre de mes).
 */
export const monthlySummaries = pgTable( "monthly_summaries" , {
  id:              uuid( "id"               ).primaryKey().defaultRandom() ,
  organizationId:  uuid( "organization_id"  ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  year:            integer( "year"          ).notNull() ,
  month:           integer( "month"         ).notNull() , // 0-indexed (0 = Enero ... 11 = Diciembre), igual que Date.getMonth(). Distinto del parámetro 'beforeMonth' de findRecent(), que es 1-indexed por diseño de API pública.
  totalRevenue:        bigint( "total_revenue"        , {mode: "number"} ).default( 0 ).notNull() ,
  totalExpense:        bigint( "total_expense"        , {mode: "number"} ).default( 0 ).notNull() ,
  balanceSnapshot:     bigint( "balance_snapshot"     , {mode: "number"} ).default( 0 ).notNull() ,
  assetsSnapshot:      bigint( "assets_snapshot"      , {mode: "number"} ).default( 0 ).notNull() ,
  liabilitiesSnapshot: bigint( "liabilities_snapshot" , {mode: "number"} ).default( 0 ).notNull() ,
  createdAt:           timestamp( "created_at"      , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueOrgYearMonth: uniqueIndex( "monthly_summaries_org_year_month_unique" ).on( table.organizationId , table.year , table.month ) ,
} ) ; } ) ;

