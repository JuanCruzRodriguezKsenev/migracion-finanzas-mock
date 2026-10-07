/**
 * @file schema.db.ts
 * Esquema de base de datos de los avisos a personas (campana de notificaciones).
 * Guarda el tipo y las referencias, no el texto (NFR-4); el monto y la divisa son una foto al crear el aviso.
 */
// Librerías externas
import { pgTable , uuid , varchar , bigint , timestamp , index } from "drizzle-orm/pg-core" ;

// Feature: Accounting
import { ledgerTransactions } from "@/features/accounting/schema.db" ;

// Feature: Auth
import { organizations , users } from "@/features/auth/schema.db" ;


/**
 * Avisos dirigidos a un miembro de una organización. `type` es texto y no un enum de Postgres
 * para que los tipos nuevos (deuda, solicitud, pago…) no exijan migrar el tipo.
 * `read_at` nulo = no leída.
 */
export const notifications = pgTable( "notifications" , {
  id:              uuid( "id" ).primaryKey().defaultRandom() ,
  organizationId:  uuid( "organization_id"   ).references( () => organizations.id       , {onDelete: "cascade"} ).notNull() ,
  recipientUserId: uuid( "recipient_user_id" ).references( () => users.id               , {onDelete: "cascade"} ).notNull() ,
  type:            varchar( "type" , {length: 40} ).notNull() , // 'charged_to_holder' | 'transaction_reversed' | 'debt_created' | 'agreement_changed' | 'payment_requested' | 'payment_received'
  actorUserId:     uuid( "actor_user_id"     ).references( () => users.id               , {onDelete: "set null"} ) ,
  transactionId:   uuid( "transaction_id"    ).references( () => ledgerTransactions.id  , {onDelete: "cascade"} ) , // Nulo en los avisos que no cuelgan de un movimiento (cambió el acuerdo)
  amountInCents:   bigint( "amount_in_cents" , {mode: "number"} ) , // Foto del monto en centavos
  currency:        varchar( "currency" , {length: 10} ) ,
  readAt:          timestamp( "read_at"    , {withTimezone: true} ) ,
  createdAt:       timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  recipientIdx: index( "notifications_recipient_idx" ).on( table.organizationId , table.recipientUserId , table.readAt , table.createdAt ) ,
} ) ; } ) ;
