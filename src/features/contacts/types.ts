/**
 * @file types.ts
 * Definición de tipos e interfaces TypeScript para el módulo de Contactos (RFC 006).
 */
// Feature: Contacts
import { contacts , contactPaymentMethods } from "./schema.db" ;

// Feature: Accounting
import { FinancialEntity } from "@/features/accounting/types" ;


export type Contact = typeof contacts.$inferSelect ;
export type InsertContact = typeof contacts.$inferInsert ;

export type ContactPaymentMethod = typeof contactPaymentMethods.$inferSelect ;
export type InsertContactPaymentMethod = typeof contactPaymentMethods.$inferInsert ;

export interface ContactPaymentMethodWithEntity extends ContactPaymentMethod {
  financialEntity: FinancialEntity ;
}

export interface ContactWithPaymentMethods extends Contact {
  paymentMethods: ContactPaymentMethodWithEntity[] ;
}
