/**
 * @file types.ts
 * Tipos del dominio de Presupuestos (RFC 028).
 */
// Librerías externas
import { InferSelectModel , InferInsertModel } from "drizzle-orm" ;

// Feature: Budgets
import { budgets , budgetLimits } from "./schema.db" ;


export type Budget            = InferSelectModel< typeof budgets > ;
export type InsertBudget      = InferInsertModel< typeof budgets > ;
export type BudgetLimit       = InferSelectModel< typeof budgetLimits > ;

/**
 * Presupuesto con todos sus límites históricos.
 */
export interface BudgetConLimites extends Budget {
  limits: BudgetLimit[] ;
}

/**
 * Estado de un presupuesto frente a su límite (AC-3).
 */
export type EstadoPresupuesto = "en_orden" | "en_alerta" | "excedido" ;

/**
 * Presupuesto evaluado en un mes concreto.
 */
export interface PresupuestoEvaluado {
  budgetId:     string ;
  categoryId:   string ;
  categoryName: string ;
  parentId:     string | null ;
  esPadre:      boolean ;
  archivada:    boolean ;
  currency:     string ;
  limite:       number ;
  gastado:      number ;
  restante:     number ;
  porcentaje:   number ;
  estado:       EstadoPresupuesto ;
  esSublimite:  boolean ;
}

/**
 * Resumen del mes: sólo las raíces suman dinero (RN-13, RN-14).
 */
export interface ResumenPresupuestos {
  limiteTotal:   number ;
  gastadoTotal:  number ;
  restanteTotal: number ;
  porcentaje:    number ;
  excedidas:     number ;
  enAlerta:      number ;
}

/**
 * Resultado de evaluar un mes.
 */
export interface EvaluacionMes {
  presupuestos:  PresupuestoEvaluado[] ;
  resumen:       ResumenPresupuestos ;
  divisas:       string[] ;
  monthKey:      string ;
  diasRestantes: number | null ;
}
