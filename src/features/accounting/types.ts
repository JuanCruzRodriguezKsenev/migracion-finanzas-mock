/**
 * @file types.ts
 * Interfaces y tipos de datos del dominio de contabilidad e integridad contable.
 */
import { InferSelectModel , InferInsertModel } from "drizzle-orm" ;
import { categories , accounts , ledgerTransactions , ledgerEntries } from "./schema.db" ;

export type Category       = InferSelectModel< typeof categories > ;
export type InsertCategory = InferInsertModel< typeof categories > ;

export type Account       = InferSelectModel< typeof accounts > ;
export type InsertAccount = InferInsertModel< typeof accounts > ;

export type LedgerTransaction       = InferSelectModel< typeof ledgerTransactions > ;
export type InsertLedgerTransaction = InferInsertModel< typeof ledgerTransactions > ;

export type LedgerEntry       = InferSelectModel< typeof ledgerEntries > ;
export type InsertLedgerEntry = InferInsertModel< typeof ledgerEntries > ;

/**
 * Parámetros requeridos para crear un asiento contable.
 * Garantiza que una transacción incluya su descripción, organización, la categoría (opcional),
 * y un arreglo no vacío con sus respectivos movimientos (entradas) del diario.
 */
export interface CreateTransactionParams {
  organizationId:  string ;
  categoryId?:     string ;
  description:     string ;
  merchantName?:   string ;
  merchantDomain?: string ;
  entries: {
    accountId: string ;
    debit:     number ;
    credit:    number ;
    currency?: string ;
  } [] ;
}