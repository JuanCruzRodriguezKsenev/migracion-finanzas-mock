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

/**
 * Nodo del árbol de categorías contables con sus hijas anidadas (RFC 022).
 */
export interface CategoryTreeNode extends Category {
  children: Category[] ;
}

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
  /** Quién carga el movimiento (RN-1). Nulo si no hay sesión (cron, outbox). */
  createdByUserId?: string | null ;
  /** A nombre de quién se carga (RN-2). Sólo lo informa la carga a mano; nunca los asientos generados (RN-8). */
  holderUserId?:    string | null ;
  /**
   * Aplica el reparto del acuerdo de la organización (RN-7, RN-18). Sólo la carga manual lo pasa en `true`:
   * los movimientos generados (apertura, tarjetas, cuotas, suscripciones, préstamos) nunca reparten (RN-8).
   */
  aplicarReparto?:   boolean ;
  /** Titular que se asigna **sólo** si el reparto aplica y no se pidió ninguno (RN-7): el autor. */
  titularPorDefecto?:     string | null ;
  /** Si el titular absorbe el gasto en vez de repartir la deuda entre los miembros (RN-19). */
  absorbidoPorElTitular?: boolean ;
  entries: {
    accountId: string ;
    debit:     number ;
    credit:    number ;
    currency?: string ;
  } [] ;
}

/**
 * Cómo se presenta una cuenta (RN-15). Sin textos: la interfaz los traduce.
 * - `organizacion`: cuenta de la organización (sin titular).
 * - `privada`: personal, sin comparticiones.
 * - `compartida`: personal, visible en las organizaciones indicadas.
 */
export type EtiquetaCuenta =
  | { tipo: "organizacion" }
  | { tipo: "privada" }
  | { tipo: "compartida" ; organizaciones: { id: string ; nombre: string }[] } ;

/**
 * Calcula la etiqueta de una cuenta a partir de su titular y de las organizaciones donde está compartida.
 *
 * @param cuenta - La cuenta (sólo importa su titular).
 * @param shares - Organizaciones con las que se compartió; vacío si no se compartió.
 * @returns La etiqueta de la cuenta.
 */
export function etiquetaDeCuenta( cuenta: Pick< Account , "ownerUserId" > , shares: { id: string ; nombre: string }[] ): EtiquetaCuenta {
  if( !cuenta.ownerUserId ) {
    return( {tipo: "organizacion"} ) ;
  }
  if( shares.length === 0 ) {
    return( {tipo: "privada"} ) ;
  }
  return( {tipo: "compartida" , organizaciones: shares} ) ;
}

/**
 * Etiqueta que la interfaz sabe dibujar: las de {@link EtiquetaCuenta} más «Cuenta personal de <dueño>» (RN-13),
 * que se usa en las filas y detalle de movimientos.
 */
export type EtiquetaVisible =
  | EtiquetaCuenta
  | { tipo: "personal" ; dueno: string } ;

/**
 * Cuenta tal como la necesitan la lista y el detalle de movimientos: lo justo para nombrarla y clasificar
 * el asiento, **sin saldo**. Una {@link Account} cabe en este tipo; una personal trae su dueño (RN-13)
 * para etiquetarse en las filas de movimientos.
 */
export type CuentaReferenciada = Pick< Account , "id" | "code" | "name" | "type" | "currency" > & {
  entityId?:    string | null ;
  ownerUserId?: string | null ;
  ownerNombre?: string | null ;
} ;

/**
 * Cuenta de la lista de `/accounts` (RN-16): de la organización o personal compartida ahí. El `balance` es
 * `null` en una personal ajena: el saldo se omite en el servidor (RN-11).
 */
export type CuentaDeListado = Omit< Account , "balance" > & {
  balance:   number | null ;
  etiqueta?: EtiquetaCuenta ;
  entity?:   { name: string ; logo: string | null ; color: string | null } | null ;
} ;
