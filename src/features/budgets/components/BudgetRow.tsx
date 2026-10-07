/**
 * @file BudgetRow.tsx
 * Fila de un presupuesto: categoría, barra de progreso, porcentaje, estado en texto y restante/excedido.
 * Los sub-límites se muestran anidados con sangría dentro de su padre (RN-18).
 * Con el ojito cerrado se enmascaran los importes; el porcentaje y el estado siguen visibles (RN-19).
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import { useMetricsVisibility } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { formatCurrency }       from "@/shared/lib/currencyFormatter" ;
import type { getDictionary }   from "@/shared/lib/dictionary" ;
import { ProgressBar }          from "@/shared/ui/display/ProgressBar/ProgressBar" ;
import { Button }               from "@/shared/ui/display/Button/Button" ;

// Feature: Accounting
import { iconoDeCategoria } from "@/features/accounting/utils/categoryIcons" ;

// Feature: Budgets
import { MASCARA_IMPORTE , estadoABarra , localeDe , plantilla } from "../utils/presentacion" ;
import type { PresupuestoEvaluado }                                from "../types" ;
import styles                                                      from "./Budgets.module.css" ;


export interface BudgetRowItem {
  presupuesto: PresupuestoEvaluado ;
  /** Identificador de ícono de la categoría (catálogo de `categoryIcons`). */
  icono:       string | null ;
}

export interface BudgetRowProps {
  item:          BudgetRowItem ;
  /** Sub-límites de este presupuesto, ya ordenados. */
  subLimites?:   BudgetRowItem[] ;
  dict:          Awaited< ReturnType< typeof getDictionary > > ;
  lang:          string ;
  puedeEscribir: boolean ;
  onEdit:        ( p: PresupuestoEvaluado ) => void ;
  onDelete:      ( p: PresupuestoEvaluado ) => void ;
}

interface LineaProps extends Omit< BudgetRowProps , "subLimites" > {
  anidada: boolean ;
}

/**
 * Una línea de presupuesto (raíz o sub-límite).
 */
function Linea( { item , dict , lang , puedeEscribir , onEdit , onDelete , anidada }: LineaProps ) {
  const { isContentVisible } = useMetricsVisibility() ;
  const t                    = dict.budgetsPage ;
  const p                    = item.presupuesto ;
  const locale               = localeDe( lang ) ;

  const importe = ( cents: number ) => {
    return( isContentVisible ? formatCurrency( Math.abs( cents ) , p.currency , locale ) : MASCARA_IMPORTE ) ;
  } ;

  const estadoTexto = ( p.estado === "excedido" ) ? t.stateExceeded : ( p.estado === "en_alerta" ) ? t.stateWarning : t.stateOk ;
  const restanteTxt = ( p.restante < 0 )
    ? plantilla( t.exceededBy , { amount: importe( p.restante ) } )
    : plantilla( t.remaining , { amount: importe( p.restante ) } ) ;

  const claseEstado = ( p.estado === "excedido" ) ? styles.estadoDanger : ( p.estado === "en_alerta" ) ? styles.estadoWarning : styles.estadoOk ;

  return(
    <div className={ `${styles.linea} ${anidada ? styles.lineaAnidada : ""}` }>
      <div className={styles.lineaTop}>
        <span className={styles.lineaNombre}>
          <span aria-hidden="true">{ iconoDeCategoria( item.icono ) }</span>
          <span className={styles.lineaTexto}>{ p.categoryName }</span>
          { p.archivada ? <span className={styles.tag}>{ t.archivedTag }</span> : null }
          { anidada ? <span className={styles.tag}>{ t.subLimitTag }</span> : null }
        </span>

        <span className={ `${styles.estadoTexto} ${claseEstado}` }>{ estadoTexto }</span>

        { puedeEscribir ? (
          <span className={styles.acciones}>
            <Button type="button" variant="outline" onClick={ () => onEdit( p ) } aria-label={ `${t.edit} ${p.categoryName}` }>
              { t.edit }
            </Button>
            <Button type="button" variant="outline" onClick={ () => onDelete( p ) } aria-label={ `${t.delete} ${p.categoryName}` }>
              { t.delete }
            </Button>
          </span>
        ) : null }
      </div>

      <ProgressBar
        value={p.porcentaje}
        state={estadoABarra( p.estado )}
        label={ plantilla( t.progressAriaLabel , { name: p.categoryName , pct: p.porcentaje , state: estadoTexto } ) }
      />

      <div className={styles.lineaMeta}>
        <span>{ plantilla( t.percentUsed , { pct: p.porcentaje } ) }</span>
        <span>{ restanteTxt }</span>
      </div>
    </div>
  ) ;
}

/**
 * Fila de presupuesto con sus sub-límites anidados.
 */
export function BudgetRow( { subLimites = [] , ...resto }: BudgetRowProps ) {
  return(
    <li className={styles.fila}>
      <Linea {...resto} anidada={false} />
      { subLimites.length > 0 ? (
        <ul className={styles.sublista}>
          { subLimites.map( ( s ) => {
            return(
              <li key={s.presupuesto.budgetId}>
                <Linea {...resto} item={s} anidada={true} />
              </li>
            ) ;
          } ) }
        </ul>
      ) : null }
    </li>
  ) ;
}
