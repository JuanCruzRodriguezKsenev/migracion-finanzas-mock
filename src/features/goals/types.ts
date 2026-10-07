/**
 * @file types.ts
 * Definición de tipos e interfaces TypeScript para el módulo de Metas (RFC 011).
 */
// Feature: Goals
import { goals , goalMovements } from "./schema.db" ;


export type Goal               = typeof goals.$inferSelect ;
export type InsertGoal         = typeof goals.$inferInsert ;
export type GoalMovement       = typeof goalMovements.$inferSelect ;
export type InsertGoalMovement = typeof goalMovements.$inferInsert ;

export type GoalStatus   = "active" | "completed" | "abandoned" ;
export type GoalPriority = "normal" | "high" ;
export type GoalKind     = "contribution" | "withdrawal" ;

/** Filtro de la lista de metas. */
export type GoalFilter = "all" | "active" | "completed" ;

/** Un movimiento del historial de una meta, con el nombre de la cuenta. */
export interface GoalHistoryItem {
  id:          string ;
  goalId:      string ;
  accountId:   string ;
  accountName: string ;
  kind:        GoalKind ;
  amount:      number ;
  occurredAt:  Date ;
}

/** Lo apartado por una meta en una cuenta (siempre mayor a cero). */
export interface GoalReserve {
  accountId:   string ;
  accountName: string ;
  amount:      number ;
}

/** Meta con lo que se calcula al vuelo (RFC 011 §3). */
export interface GoalView {
  goal:             Goal ;
  ahorrado:         number ;
  porcentaje:       number ;
  porcentajeBarra:  number ;
  mesesRestantes:   number | null ;
  aporteSugerido:   number | null ;
  vencida:          boolean ;
  historial:        GoalHistoryItem[] ;
  reservas:         GoalReserve[] ;
  descubierta:      boolean ;
}

/** Indicadores de una divisa. */
export interface GoalIndicators {
  cantidad:         number ;
  objetivoTotal:    number ;
  ahorradoTotal:    number ;
  porcentajeTotal:  number ;
  completadas:      number ;
  porCompletar:     number ;
}

/** Cuenta compatible para aportar, con su saldo libre. */
export interface GoalCompatibleAccount {
  id:       string ;
  name:     string ;
  currency: string ;
  balance:  number ;
  reservado: number ;
  libre:    number ;
}

export interface GoalsViewData {
  currency:    string ;
  divisas:     string[] ;
  metas:       GoalView[] ;
  indicadores: GoalIndicators ;
  cuentas:     GoalCompatibleAccount[] ;
}

export interface ReservedByAccount {
  reservado: number ;
  libre:     number ;
}
