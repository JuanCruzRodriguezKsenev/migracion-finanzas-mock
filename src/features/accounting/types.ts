/**
 * @file types.ts
 * Interfaces y tipos de datos del dominio de contabilidad e integridad contable.
 */
// Librerías externas
import { InferSelectModel , InferInsertModel } from "drizzle-orm" ;

// Feature: Accounting
import { categories , accounts , ledgerTransactions , ledgerEntries , monthlySummaries , financialEntities , categoryAccounts } from "./schema.db" ;


export type Category       = InferSelectModel< typeof categories > ;
export type InsertCategory = InferInsertModel< typeof categories > ;

export type CategoryAccount       = InferSelectModel< typeof categoryAccounts > ;
export type InsertCategoryAccount = InferInsertModel< typeof categoryAccounts > ;

export type FinancialEntity       = InferSelectModel< typeof financialEntities > ;
export type InsertFinancialEntity = InferInsertModel< typeof financialEntities > ;

export type Account       = InferSelectModel< typeof accounts > ;
export type InsertAccount = InferInsertModel< typeof accounts > ;

export type LedgerTransaction       = InferSelectModel< typeof ledgerTransactions > ;
export type InsertLedgerTransaction = InferInsertModel< typeof ledgerTransactions > ;

export type LedgerEntry       = InferSelectModel< typeof ledgerEntries > ;
export type InsertLedgerEntry = InferInsertModel< typeof ledgerEntries > ;

export type MonthlySummary       = InferSelectModel< typeof monthlySummaries > ;
export type InsertMonthlySummary = InferInsertModel< typeof monthlySummaries > ;

/**
 * Parámetros requeridos para crear un asiento contable.
 * Garantiza que una transacción incluya su descripción, organización, la categoría (opcional),
 * y un arreglo no vacío con sus respectivos movimientos (entradas) del diario.
 */
export interface CreateTransactionParams {
  organizationId:  string ;
  categoryId?:     string | null ;
  description:     string ;
  merchantName?:   string | null ;
  merchantDomain?: string | null ;
  occurredAt?:     Date | string | null ;
  entries: {
    accountId: string ;
    debit:     number ;
    credit:    number ;
    currency?: string ;
  } [] ;
}