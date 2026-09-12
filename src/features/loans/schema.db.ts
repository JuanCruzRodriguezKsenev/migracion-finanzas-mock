/**
 * @file schema.db.ts
 * Esquema de base de datos relacional para Préstamos (RFC 008).
 * Modela préstamos otorgados y recibidos, y sus cuentas de mayor asociadas por divisa.
 */
// Librerías externas
import { pgTable , uuid , varchar , integer , bigint , timestamp , date , index , uniqueIndex } from "drizzle-orm/pg-core" ;

// Feature: Accounting
import { accounts , financialEntities } from "@/features/accounting/schema.db" ;

// Feature: Contacts
import { contacts } from "@/features/contacts/schema.db" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;


/**
 * Esquema de la tabla para Préstamos (pedidos y otorgados).
 * Datos del préstamo, cero dinero acumulado: el saldo vive en la cuenta espejo.
 */
export const loans = pgTable( "loans" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,

  name:      varchar( "name"      , {length: 150} ).notNull() , // Ej: "Préstamo Personal Galicia"
  direction: varchar( "direction" , {length: 20 } ).notNull() , // 'borrowed' | 'lent'

  // La contraparte. Exactamente una de las dos, nunca ambas ni ninguna (§4.1)
  entityId:  uuid( "entity_id"  ).references( () => financialEntities.id , {onDelete: "restrict"} ) ,
  contactId: uuid( "contact_id" ).references( () => contacts.id          , {onDelete: "restrict"} ) ,

  // Capital original en centavos. Dato histórico inmutable, NO es el saldo pendiente
  principalAmount: bigint( "principal_amount" , {mode: "number"} ).notNull() ,
  currency:        varchar( "currency" , {length: 10} ).default( "ARS" ).notNull() ,

  // Tasa Nominal Anual en puntos básicos x100: 85.5% = 8550. Entero, NO es dinero
  interestRateAnnual: integer( "interest_rate_annual" ).default( 0 ).notNull() ,

  // Cronograma: se proyecta con ocurrenciaN(), no se materializa
  totalInstallments: integer( "total_installments" ).default( 1 ).notNull() ,
  frequency:         varchar( "frequency" , {length: 20} ).default( "monthly" ).notNull() ,
  intervalCount:     integer( "interval_count" ).default( 1 ).notNull() ,

  // Desembolso y primera cuota son dos fechas independientes (§3.5)
  startDate:            timestamp( "start_date" , {withTimezone: true} ).notNull() , // Cuándo cambió de manos el dinero
  firstInstallmentDate: date( "first_installment_date" ).notNull() ,                 // Ancla del cronograma. Civil YYYY-MM-DD
  resolvedThrough:      date( "resolved_through" ) ,                                 // Puntero de última cuota pagada (RFC 023)

  archivedAt: timestamp( "archived_at" , {withTimezone: true} ) , // Baja lógica
  createdAt:  timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
  updatedAt:  timestamp( "updated_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  orgDirectionIdx: index( "loans_org_direction_idx" ).on( table.organizationId , table.direction ) ,
} ) ; } ) ;

/**
 * Vínculo entre un préstamo y su cuenta del libro mayor: una fila por divisa.
 */
export const loanAccounts = pgTable( "loan_accounts" , {
  id:        uuid( "id"         ).primaryKey().defaultRandom() ,
  loanId:    uuid( "loan_id"    ).references( () => loans.id    , {onDelete: "cascade"}  ).notNull() ,
  accountId: uuid( "account_id" ).references( () => accounts.id , {onDelete: "restrict"} ).notNull() ,
  currency:  varchar( "currency" , {length: 10} ).notNull() ,
  createdAt: timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueLoanCurrency: uniqueIndex( "loan_accounts_loan_currency_unique" ).on( table.loanId , table.currency ) ,
} ) ; } ) ;
