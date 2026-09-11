/**
 * @file types.ts
 * Definición de tipos e interfaces TypeScript para el módulo de Tarjetas (RFC 007).
 */
// Feature: Accounting
import { Account , FinancialEntity } from "@/features/accounting/types" ;

// Feature: Cards
import { cards , cardAccounts , cardInstallmentPlans } from "./schema.db" ;


export type Card = typeof cards.$inferSelect ;
export type InsertCard = typeof cards.$inferInsert ;

export type CardAccount = typeof cardAccounts.$inferSelect ;
export type InsertCardAccount = typeof cardAccounts.$inferInsert ;

export type CardInstallmentPlan = typeof cardInstallmentPlans.$inferSelect ;
export type InsertCardInstallmentPlan = typeof cardInstallmentPlans.$inferInsert ;

export interface CardAccountWithAccount extends CardAccount {
  account: Account ;
}

export interface PendienteCuota {
  planId:      string ;
  numeroCuota: number ;
  fechaCuota:  string ;
  plan:        CardInstallmentPlan ;
}

/**
 * Ciclo de facturación resuelto de una tarjeta de crédito, con su partición de saldo.
 * Las fechas viajan como ISO 8601 y no como Date: este objeto cruza del Server Component al
 * cliente, y un Date no sobrevive esa frontera sin deserializarse.
 */
export interface CicloTarjeta {
  cierreAnterior: string ;
  cierreActual:   string ;
  vencimiento:    string ;
  facturado:      number ; // Centavos ya congelados por el cierre: es lo que vence
  enCurso:        number ; // Centavos consumidos después del cierre: vencen el mes que viene
  cuotasFuturas:  Record< string , number > ; // divisa → centavos no imputados
}

export interface CardWithAccountsAndEntity extends Card {
  entity?: FinancialEntity | null ;
  linkedAccount?: Account | null ;
  accounts: CardAccountWithAccount[] ;
  ciclo?: CicloTarjeta | null ;
}
