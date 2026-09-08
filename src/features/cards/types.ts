/**
 * @file types.ts
 * Definición de tipos e interfaces TypeScript para el módulo de Tarjetas (RFC 007).
 */
// Feature: Accounting
import { Account , FinancialEntity } from "@/features/accounting/types" ;

// Feature: Cards
import { cards , cardAccounts } from "./schema.db" ;


export type Card = typeof cards.$inferSelect ;
export type InsertCard = typeof cards.$inferInsert ;

export type CardAccount = typeof cardAccounts.$inferSelect ;
export type InsertCardAccount = typeof cardAccounts.$inferInsert ;

export interface CardAccountWithAccount extends CardAccount {
  account: Account ;
}

export interface CardWithAccountsAndEntity extends Card {
  entity?: FinancialEntity | null ;
  linkedAccount?: Account | null ;
  accounts: CardAccountWithAccount[] ;
}
