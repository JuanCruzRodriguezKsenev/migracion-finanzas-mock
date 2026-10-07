/**
 * @file GoalCard.tsx
 * Tarjeta de una meta: progreso, ahorrado, fecha, aporte sugerido, estado en texto, último movimiento y acciones.
 * Los botones de escritura no se renderizan si no hay permiso (RN-18/AC-16).
 */
"use client" ;

// Shared
import { ProgressBar }     from "@/shared/ui/display/ProgressBar/ProgressBar" ;
import type { ProgressBarState } from "@/shared/ui/display/ProgressBar/ProgressBar" ;
import { Button }          from "@/shared/ui/display/Button/Button" ;
import { Card }            from "@/shared/ui/display/Card/Card" ;

// Feature: Goals
import { fmt , formatCivilDate , formatInstant , useGoalMoney } from "./goalsDict" ;
import type { GoalsPageDict }                                   from "./goalsDict" ;
import type { GoalView }                                        from "../types" ;
import styles                                                   from "./Goals.module.css" ;


export interface GoalCardProps {
  view:          GoalView ;
  dict:          GoalsPageDict ;
  locale:        string ;
  puedeEscribir: boolean ;
  onContribute:  ( view: GoalView ) => void ;
  onWithdraw:    ( view: GoalView ) => void ;
  onEdit:        ( view: GoalView ) => void ;
  onAbandon:     ( view: GoalView ) => void ;
}

/**
 * Estado visual de la barra: descubierta pesa más que vencida (la plata apartada no está).
 */
function estadoDeBarra( view: GoalView ): ProgressBarState {
  if( view.descubierta ) {
    return( "danger" ) ;
  }
  if( view.vencida ) {
    return( "warning" ) ;
  }
  return( "ok" ) ;
}

/**
 * Tarjeta de meta. El porcentaje real se muestra aunque la barra se recorte a 100 %.
 */
export function GoalCard( { view , dict , locale , puedeEscribir , onContribute , onWithdraw , onEdit , onAbandon }: GoalCardProps ) {
  const money                = useGoalMoney( locale ) ;
  const { goal }             = view ;
  const completada           = ( goal.status === "completed" ) ;
  const ultimo               = view.historial[ 0 ] ;
  const estadoTexto          = ( view.descubierta ? dict.uncovered : view.vencida ? dict.overdue : completada ? dict.statusCompleted : dict.statusActive ) ;

  return(
    <Card className={styles.goalCard}>
      <div className={styles.goalHeader}>
        <h3 className={styles.goalName}>
          { goal.priority === "high" ? <span className={styles.star} title={dict.priorityBadge} aria-label={dict.priorityBadge}>★</span> : null }
          { goal.name }
        </h3>
        <div className={styles.badges}>
          <span className={ completada ? styles.badgeOk : styles.badgeNeutral }>
            { completada ? dict.statusCompleted : dict.statusActive }
          </span>
          { view.vencida ? <span className={styles.badgeWarning}>{ dict.overdue }</span> : null }
          { view.descubierta ? <span className={styles.badgeDanger}>{ dict.uncovered }</span> : null }
        </div>
      </div>

      <ProgressBar
        value={view.porcentaje}
        state={estadoDeBarra( view )}
        label={ fmt( dict.progressLabel , { name: goal.name , percent: view.porcentaje , state: estadoTexto } ) }
      />

      <div className={styles.progressRow}>
        <span className={styles.percent}>{ view.porcentaje } %</span>
        <span className={styles.savedOf}>
          { fmt( dict.savedOf , { saved: money( view.ahorrado , goal.currency ) , target: money( goal.targetAmount , goal.currency ) } ) }
        </span>
      </div>

      <div className={styles.metaLines}>
        <span>
          { goal.targetDate
            ? fmt( dict.dueDate , { date: formatCivilDate( goal.targetDate , locale ) } )
            : dict.noDueDate }
        </span>
        { ( view.aporteSugerido !== null ) ? (
          <span>{ fmt( dict.suggested , { amount: money( view.aporteSugerido , goal.currency ) } ) }</span>
        ) : null }
        <span className={styles.history}>
          { ultimo
            ? fmt( ( ultimo.kind === "contribution" ) ? dict.lastContribution : dict.lastWithdrawal , {
                amount:  money( ultimo.amount , goal.currency ) ,
                account: ultimo.accountName ,
                date:    formatInstant( ultimo.occurredAt , locale )
              } )
            : dict.noHistory }
        </span>
      </div>

      { puedeEscribir ? (
        <div className={styles.actions}>
          <Button variant="primary" onClick={ () => onContribute( view ) }>{ dict.contribute }</Button>
          <Button variant="outline" onClick={ () => onWithdraw( view ) }>{ dict.withdraw }</Button>
          <Button variant="outline" onClick={ () => onEdit( view ) }>{ dict.edit }</Button>
          <Button variant="danger" onClick={ () => onAbandon( view ) }>{ dict.abandon }</Button>
        </div>
      ) : null }
    </Card>
  ) ;
}
