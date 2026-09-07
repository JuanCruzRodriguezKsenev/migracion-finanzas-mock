/**
 * @file schema.db.ts
 * Esquema de base de datos para el módulo de Suscripciones Recurrentes (RFC 004).
 * Montos en centavos enteros, multi-tenant por organización y vínculo opcional
 * a cuentas contables para el débito automático (worker pendiente según RFC).
 */
// Librerías externas
import { pgTable , uuid , varchar , integer , bigint , boolean , timestamp , text } from "drizzle-orm/pg-core" ;

// Feature: Accounting
import { accounts } from "@/features/accounting/schema.db" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;


/**
 * Esquema de la tabla de Suscripciones Recurrentes.
 * Extensión visual respecto al RFC 004: logoKey, color y category alimentan el
 * dashboard de treemap; currency default "ARS" por coherencia con `accounts`.
 */
export const subscriptions = pgTable( "subscriptions" , {
  id:              uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId:  uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  name:            varchar( "name" , {length: 150} ).notNull() ,
  description:     text( "description" ) ,
  amount:          bigint( "amount" , {mode: "number"} ).notNull() , // Monto exacto en centavos (ej: $15.99 = 1599)
  currency:        varchar( "currency" , {length: 10} ).default( "ARS" ).notNull() ,

  // Frecuencia del ciclo de cobro
  frequency:       varchar( "frequency" , {length: 20} ).notNull() , // 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
  intervalCount:   integer( "interval_count" ).default( 1 ).notNull() , // Ej: cada 2 meses (frequency='monthly', intervalCount=2)

  // Fechas clave
  startDate:       timestamp( "start_date"        , {withTimezone: true} ).notNull() ,
  nextPaymentDate: timestamp( "next_payment_date" , {withTimezone: true} ).notNull() ,

  // Configuración del débito automático (worker fuera de alcance en esta entrega)
  autoDebit:       boolean( "auto_debit" ).default( false ).notNull() ,
  accountId:       uuid( "account_id" ).references( () => accounts.id , {onDelete: "set null"} ) ,

  // Estado de la suscripción
  status:          varchar( "status" , {length: 20} ).default( "active" ).notNull() , // 'active' | 'paused' | 'cancelled'

  // Presentación (extensión visual del RFC 004 para el dashboard de treemap)
  logoKey:         varchar( "logo_key" , {length: 500} ).default( "default" ).notNull() ,
  color:           varchar( "color"    , {length: 7  } ).default( "#EEF2FF" ).notNull() ,
  category:        varchar( "category" , {length: 30 } ).default( "other" ).notNull() , // 'design' | 'productivity' | 'entertainment' | 'fitness' | 'security' | 'storage' | 'other'

  createdAt:       timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
  updatedAt:       timestamp( "updated_at" , {withTimezone: true} ).defaultNow().notNull() ,
} ) ;
