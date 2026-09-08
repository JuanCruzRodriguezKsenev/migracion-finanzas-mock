/**
 * @file schema.db.ts
 * Esquema de base de datos relacional para Tarjetas de Crédito y Débito (RFC 007).
 * Modela atributos de plásticos y sus cuentas de pasivo asociadas por divisa.
 */
// Librerías externas
import { pgTable , uuid , varchar , integer , bigint , timestamp , index , uniqueIndex } from "drizzle-orm/pg-core" ;

// Feature: Accounting
import { accounts , financialEntities } from "@/features/accounting/schema.db" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;


/**
 * Esquema de la tabla para Tarjetas (crédito y débito).
 * Atributos del plástico, cero dinero acumulado.
 */
export const cards = pgTable( "cards" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,

  // Entidad emisora: de acá salen el logotipo y el color de marca de §8C, vía brandDomain
  entityId:        uuid( "entity_id"         ).references( () => financialEntities.id , {onDelete: "restrict"} ) ,
  // Débito: la cuenta que la tarjeta espeja. Crédito: la cuenta de la que se debita el pago del resumen
  linkedAccountId: uuid( "linked_account_id" ).references( () => accounts.id          , {onDelete: "set null"} ) ,

  label:   varchar( "label"   , {length: 100} ).notNull() , // Ej: "Visa Black Galicia"
  type:    varchar( "type"    , {length: 20 } ).notNull() , // 'credit' | 'debit'
  network: varchar( "network" , {length: 20 } ).notNull() , // 'visa' | 'mastercard' | 'amex' | 'other'

  // Seguridad PCI (§3). Prohibido PAN y CVV
  lastFour:    varchar( "last_four" , {length: 4} ).notNull() ,
  expiryMonth: integer( "expiry_month" ).notNull() , // 1-12
  expiryYear:  integer( "expiry_year"  ).notNull() , // Ej: 2029

  // Campos exclusivos de crédito (anulables)
  creditLimit: bigint( "credit_limit" , {mode: "number"} ) , // Centavos enteros

  closingDay: integer( "closing_day" ) , // Día del mes de cierre (1-31)
  dueDay:     integer( "due_day"     ) , // Día del mes de vencimiento (1-31)

  // Tasas: puntos básicos x100 (85.5% TNA = 8550). Enteros, no dinero
  interestRateFinancing: integer( "interest_rate_financing" ) ,
  interestRatePenalty:   integer( "interest_rate_penalty"   ) ,

  // Costos fijos en centavos
  monthlyMaintenanceFee: bigint( "monthly_maintenance_fee" , {mode: "number"} ).default( 0 ).notNull() ,
  annualRenewalFee:      bigint( "annual_renewal_fee"      , {mode: "number"} ).default( 0 ).notNull() ,

  archivedAt: timestamp( "archived_at" , {withTimezone: true} ) , // Baja lógica
  createdAt:  timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
  updatedAt:  timestamp( "updated_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  orgLabelIdx: index( "cards_org_label_idx" ).on( table.organizationId , table.label ) ,
} ) ; } ) ;

/**
 * Vínculo entre una tarjeta y sus cuentas del libro mayor: una fila por divisa.
 * Permite el saldo dual ARS/USD con una cuenta de pasivo por moneda.
 */
export const cardAccounts = pgTable( "card_accounts" , {
  id:        uuid( "id"         ).primaryKey().defaultRandom() ,
  cardId:    uuid( "card_id"    ).references( () => cards.id    , {onDelete: "cascade"}  ).notNull() ,
  accountId: uuid( "account_id" ).references( () => accounts.id , {onDelete: "restrict"} ).notNull() ,
  currency:  varchar( "currency" , {length: 10} ).notNull() ,
  createdAt: timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueCardCurrency: uniqueIndex( "card_accounts_card_currency_unique" ).on( table.cardId , table.currency ) ,
} ) ; } ) ;
