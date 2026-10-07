/**
 * @file BudgetsContainer.tsx
 * Contenedor cliente de la pantalla de presupuestos (/budgets) (RFC 028 §5).
 * Compone el resumen del mes, los tres indicadores, la lista ordenada por porcentaje usado
 * y el alta, edición y eliminación. Tras cada escritura refresca la ruta.
 */
"use client" ;

// Librerías externas
import React , { useMemo , useState , useTransition } from "react" ;
import { useRouter }                                  from "next/navigation" ;

// Shared
import { formatMonthKeyLabel }  from "@/shared/ui/display/RechartsSparkline/sparklineUtils" ;
import { useMetricsVisibility } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { MetricsSection }       from "@/shared/ui/layout/MetricsSection/MetricsSection" ;
import { formatCurrency }       from "@/shared/lib/currencyFormatter" ;
import type { getDictionary }   from "@/shared/lib/dictionary" ;
import { ProgressBar }          from "@/shared/ui/display/ProgressBar/ProgressBar" ;
import { EmptyState }           from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { Skeleton }             from "@/shared/ui/feedback/Skeleton/Skeleton" ;
import { MetricCard }           from "@/shared/ui/MetricCard/MetricCard" ;
import { FormError }            from "@/shared/ui/forms/Form/FormError" ;
import { Button }               from "@/shared/ui/display/Button/Button" ;

// Feature: Accounting
import type { CategoryTreeNode } from "@/features/accounting/types" ;

// Feature: Reports
import { CurrencySelector } from "@/features/reports/components/CurrencySelector" ;

// Feature: Budgets
import { MASCARA_IMPORTE , estadoABarra , localeDe , plantilla } from "../utils/presentacion" ;
import { deleteBudgetAction }                                    from "../actions/budgetsActions" ;
import { BudgetRow , type BudgetRowItem }                        from "./BudgetRow" ;
import { estadoDe }                                              from "../services/budgetEvaluation" ;
import { BudgetFormModal }                                       from "./BudgetFormModal" ;
import type { EvaluacionMes , PresupuestoEvaluado }              from "../types" ;
import styles                                                    from "./Budgets.module.css" ;


export interface BudgetsContainerProps {
  evaluacion:     EvaluacionMes ;
  /** Divisa de la vista. */
  currency:       string ;
  categoryTree:   CategoryTreeNode[] ;
  dict:           Awaited< ReturnType< typeof getDictionary > > ;
  lang?:          string ;
  /** Si puede crear, editar y eliminar. El plan 4b del acceso lo cablea desde el provider; hasta entonces llega por props. */
  puedeEscribir?: boolean ;
}

type Modal = { tipo: "alta" } | { tipo: "edicion" ; presupuesto: PresupuestoEvaluado } | null ;

/**
 * Contenedor principal de la vista /budgets.
 */
export function BudgetsContainer( {
  evaluacion ,
  currency ,
  categoryTree ,
  dict ,
  lang = "es" ,
  puedeEscribir = true
}: BudgetsContainerProps ) {
  const router               = useRouter() ;
  const { isContentVisible } = useMetricsVisibility() ;
  const t                    = dict.budgetsPage ;
  const locale               = localeDe( lang ) ;

  const [ modal , setModal ]             = useState< Modal >( null ) ;
  const [ errorAccion , setErrorAccion ] = useState< string >( "" ) ;
  const [ isPending , startTransition ]  = useTransition() ;

  const { presupuestos , resumen , divisas , monthKey , diasRestantes } = evaluacion ;

  const importe = ( cents: number ) => {
    return( isContentVisible ? formatCurrency( Math.abs( cents ) , currency , locale ) : MASCARA_IMPORTE ) ;
  } ;

  // Íconos del árbol y ids con presupuesto vigente
  const iconoDe = useMemo( () => {
    const mapa = new Map< string , string | null >() ;
    for( const padre of categoryTree ) {
      mapa.set( padre.id , padre.icon ) ;
      for( const hoja of padre.children ) {
        mapa.set( hoja.id , hoja.icon ) ;
      }
    }
    return( mapa ) ;
  } , [ categoryTree ] ) ;

  const ocupados = useMemo( () => {
    return( new Set( presupuestos.map( ( p ) => { return( p.categoryId ) ; } ) ) ) ;
  } , [ presupuestos ] ) ;

  // Raíces por porcentaje descendente; los sub-límites quedan dentro de su padre (RN-18)
  const filas = useMemo( () => {
    const porcentajeDesc = ( a: PresupuestoEvaluado , b: PresupuestoEvaluado ) => {
      return( (b.porcentaje - a.porcentaje) || a.categoryName.localeCompare( b.categoryName ) ) ;
    } ;
    const item = ( p: PresupuestoEvaluado ): BudgetRowItem => {
      return( { presupuesto: p , icono: iconoDe.get( p.categoryId ) ?? null } ) ;
    } ;

    const idsRaiz  = new Set( presupuestos.filter( ( p ) => { return( !p.esSublimite ) ; } ).map( ( p ) => { return( p.categoryId ) ; } ) ) ;
    const esAnidado = ( p: PresupuestoEvaluado ) => { return( p.esSublimite && !!p.parentId && idsRaiz.has( p.parentId ) ) ; } ;

    return(
      presupuestos
        .filter( ( p ) => { return( !esAnidado( p ) ) ; } )
        .sort( porcentajeDesc )
        .map( ( raiz ) => {
          return( {
            raiz:       item( raiz ) ,
            subLimites: presupuestos.filter( ( s ) => { return( esAnidado( s ) && (s.parentId === raiz.categoryId) ) ; } )
                                    .sort( porcentajeDesc )
                                    .map( item ) ,
          } ) ;
        } )
    ) ;
  } , [ presupuestos , iconoDe ] ) ;

  const refrescar = () => {
    startTransition( () => { router.refresh() ; } ) ;
  } ;

  const handleEliminar = ( p: PresupuestoEvaluado ) => {
    if( !confirm( t.deleteConfirm ) ) {
      return ;
    }
    setErrorAccion( "" ) ;

    startTransition( async () => {
      const res = await deleteBudgetAction( { budgetId: p.budgetId } ) ;
      if( res.success ) {
        router.refresh() ;
      } else {
        setErrorAccion( res.error || t.deleteError ) ;
      }
    } ) ;
  } ;

  const hayPresupuestos = ( presupuestos.length > 0 ) ;
  const esMesEnCurso    = ( diasRestantes !== null ) ;
  const estadoResumen   = estadoDe( resumen.gastadoTotal , resumen.limiteTotal ) ;
  const estadoResumenTx = ( estadoResumen === "excedido" ) ? t.stateExceeded : ( estadoResumen === "en_alerta" ) ? t.stateWarning : t.stateOk ;

  const restanteResumen = ( resumen.restanteTotal < 0 )
    ? plantilla( t.summaryExceeded , { amount: importe( resumen.restanteTotal ) } )
    : plantilla( t.summaryRemaining , { amount: importe( resumen.restanteTotal ) } ) ;
  const progresoResumen = `${plantilla( t.summaryAmounts , { spent: importe( resumen.gastadoTotal ) , limit: importe( resumen.limiteTotal ) } )} · ${restanteResumen}` ;

  const botonNuevo = puedeEscribir ? (
    <Button variant="primary" onClick={ () => setModal( { tipo: "alta" } ) }>
      { t.newBudget }
    </Button>
  ) : null ;

  return(
    <div className={styles.container}>
      <div className={styles.topBar}>
        <CurrencySelector
          currencies={divisas}
          currentCurrency={currency}
          label={t.currencySelectorLabel}
        />
        { hayPresupuestos ? botonNuevo : null }
      </div>

      { errorAccion ? <FormError error={errorAccion} /> : null }

      { !hayPresupuestos && esMesEnCurso ? (
        <EmptyState
          title={t.emptyTitle}
          description={t.emptyDescription}
          action={ puedeEscribir ? (
            <Button variant="primary" onClick={ () => setModal( { tipo: "alta" } ) }>
              { t.emptyAction }
            </Button>
          ) : undefined }
        />
      ) : null }

      { !hayPresupuestos && !esMesEnCurso ? (
        <EmptyState
          title={t.noBudgetsMonthTitle}
          description={ plantilla( t.noBudgetsMonthDescription , { month: formatMonthKeyLabel( monthKey , lang ) } ) }
        />
      ) : null }

      { hayPresupuestos ? (
        <>
          <MetricsSection
            allowVisibilityToggle={true}
            isLoading={isPending}
            skeletonCount={3}
            heroComponent={
              <MetricCard
                variant="hero"
                title={t.summaryTitle}
                value={ `${resumen.porcentaje} %` }
                isSensitive={false}
                hasVisibilityToggle={true}
                isLoading={isPending}
                progressBar={
                  <ProgressBar
                    value={resumen.porcentaje}
                    state={estadoABarra( estadoResumen )}
                    label={ plantilla( t.summaryAriaLabel , { pct: resumen.porcentaje , state: estadoResumenTx } ) }
                  />
                }
                progressLabel={progresoResumen}
              />
            }
          >
            <MetricCard title={t.exceededLabel} value={resumen.excedidas} isSensitive={false} isDanger={resumen.excedidas > 0} />
            <MetricCard title={t.alertLabel} value={resumen.enAlerta} isSensitive={false} />
            <MetricCard
              title={t.daysLeftLabel}
              value={ diasRestantes ?? "—" }
              count={ esMesEnCurso ? t.daysLeftSuffix : undefined }
              isSensitive={false}
            />
          </MetricsSection>

          { isPending ? (
            <div className={styles.lista} aria-busy="true">
              <Skeleton height="4.5rem" width="100%" />
              <Skeleton height="4.5rem" width="100%" />
            </div>
          ) : (
            <ul className={styles.lista} aria-label={t.listAriaLabel}>
              { filas.map( ( f ) => {
                return(
                  <BudgetRow
                    key={f.raiz.presupuesto.budgetId}
                    item={f.raiz}
                    subLimites={f.subLimites}
                    dict={dict}
                    lang={lang}
                    puedeEscribir={puedeEscribir}
                    onEdit={ ( p ) => setModal( { tipo: "edicion" , presupuesto: p } ) }
                    onDelete={handleEliminar}
                  />
                ) ;
              } ) }
            </ul>
          ) }
        </>
      ) : null }

      { modal ? (
        <BudgetFormModal
          key={ modal.tipo === "edicion" ? modal.presupuesto.budgetId : "alta" }
          isOpen={true}
          onClose={ () => setModal( null ) }
          presupuesto={ modal.tipo === "edicion" ? modal.presupuesto : undefined }
          categoryTree={categoryTree}
          ocupados={ocupados}
          currency={currency}
          divisas={divisas}
          dict={dict}
          onSuccess={ () => {
            setModal( null ) ;
            refrescar() ;
          } }
        />
      ) : null }
    </div>
  ) ;
}
