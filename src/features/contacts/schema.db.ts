/**
 * @file schema.db.ts
 * Esquema de base de datos relacional para la agenda de Contactos y Métodos de Cobro (RFC 006).
 * Modela la agenda organizacional y las cuentas bancarias/billeteras de cobro asociadas.
 */
// Librerías externas
import { pgTable , uuid , varchar , text , boolean , timestamp , index } from "drizzle-orm/pg-core" ;

// Feature: Accounting
import { financialEntities } from "@/features/accounting/schema.db" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;


/**
 * Esquema de la tabla para Contactos (agenda por organización).
 */
export const contacts = pgTable( "contacts" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  name:           varchar( "name"  , {length: 150} ).notNull() ,
  email:          varchar( "email" , {length: 255} ) ,
  phone:          varchar( "phone" , {length: 50 } ) ,
  notes:          text( "notes" ) ,
  archivedAt:     timestamp( "archived_at" , {withTimezone: true} ) , // Baja lógica
  createdAt:      timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
  updatedAt:      timestamp( "updated_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  orgNameIdx: index( "contacts_org_name_idx" ).on( table.organizationId , table.name ) ,
} ) ; } ) ;

/**
 * Esquema de la tabla para Métodos de Cobro de Contactos (CBU/CVU y Alias de destino).
 */
export const contactPaymentMethods = pgTable( "contact_payment_methods" , {
  id:                uuid( "id"                  ).primaryKey().defaultRandom() ,
  contactId:         uuid( "contact_id"          ).references( () => contacts.id , {onDelete: "cascade"} ).notNull() ,
  financialEntityId: uuid( "financial_entity_id" ).references( () => financialEntities.id , {onDelete: "restrict"} ).notNull() ,
  type:              varchar( "type" , {length: 20} ).default( "wallet" ).notNull() , // 'bank_account' | 'wallet'
  cbuCvu:            varchar( "cbu_cvu"       , {length: 22 } ) ,
  alias:             varchar( "alias"         , {length: 20 } ) ,
  holderName:        varchar( "holder_name"   , {length: 150} ) ,
  holderTaxId:       varchar( "holder_tax_id" , {length: 20 } ) ,
  isDefault:         boolean( "is_default" ).default( false ).notNull() ,
  createdAt:         timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  contactIdIdx: index( "contact_payment_methods_contact_id_idx" ).on( table.contactId ) ,
} ) ; } ) ;
