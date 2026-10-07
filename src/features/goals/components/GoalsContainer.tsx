/**
 * @file GoalsContainer.tsx
 * Contenedor cliente de la pantalla de Metas (/goals): indicadores por divisa, selector de divisa,
 * filtro en la URL, lista de metas y los modales de alta, edición, aporte y retiro (RFC 011 §6).
 */
"use client" ;

// Librerías externas
import React , { useState , useTransition } from "react" ;
import { useRouter }                        from "next/navigation" ;

// Shared
import { useMetricsVisibility } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { MetricsSection }       from "@/shared/ui/layout/MetricsSection/MetricsSection" ;
import { EmptyState }           from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { MetricCard }           from "@/shared/ui/MetricCard/MetricCard" ;
import { PageHeader }           from "@/shared/ui/layout/PageHeader/PageHeader" ;
import { FormError }            from "@/shared/ui/forms/Form/FormError" ;
import { Button }               from "@/shared/ui/display/Button/Button" ;
import { formatCurrency }       from "@/shared/lib/currencyFormatter" ;
import type { getDictionary }   from "@/shared/lib/dictionary" ;

// Feature: Reports
import { CurrencySelector } from "@/features/reports/components/CurrencySelector" ;

// Feature: Goals
import { abandonGoalAction }                         from "../actions/goalsActions" ;
import { GoalFormModal }                             from "./GoalFormModal" ;
import { ContributeModal }                           from "./ContributeModal" ;
import { GoalsFilter }                               from "./GoalsFilter" ;
import { GoalCard }                                  from "./GoalCard" ;
import { fmt , HIDDEN_AMOUNT , localeDe }            from "./goalsDict" ;
import type { GoalFilter , GoalView , GoalsViewData } from "../types" ;
import styles                                        from "./Goals.module.css" ;


export interface GoalsContainerProps {
  data:           GoalsViewData ;
  filter:         GoalFilter ;
  dict:           Awaited< ReturnType< typeof getDictionary > > ;
  lang?:          string ;
  /**
   * Permiso de escritura. Hasta que el plan 4b del acceso lo cablee (`usePuedeEscribir()`),
   * llega por props y vale `true` por omisión.
   */
  puedeEscribir?: boolean ;
}

type ModalState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit" ; view: GoalView }
  | { kind: "contribute" | "withdraw" ; view: GoalView } ;

/**
 * Pantalla de Metas.
 */
export function GoalsContainer( { data , filter , dict , lang = "es" , puedeEscribir = true }: GoalsContainerProps ) {
  const router               = useRouter() ;
  const { isContentVisible } = useMetricsVisibility() ;
  const gDict                = dict.goalsPage ;
  const locale               = localeDe( lang ) ;
  const { currency , indicadores , metas , cuentas , divisas } = data ;

  const [ modal , setModal ]            = useState< ModalState >( { kind: "none" } ) ;
  const [ actionError , setActionError ] = useState< string >( "" ) ;
  const [ , startTransition ]           = useTransition() ;

  const money = ( cents: number ) => {
    return( isContentVisible ? formatCurrency( cents , currency , locale ) : HIDDEN_AMOUNT ) ;
  } ;

  const closeModal = () => setModal( { kind: "none" } ) ;
  const handleDone = () => {
    closeModal() ;
    router.refresh() ;
  } ;

  const handleAbandon = ( view: GoalView ) => {
    if( !confirm( fmt( gDict.abandonConfirm , { name: view.goal.name } ) ) ) {
      return ;
    }
    setActionError( "" ) ;
    startTransition( async () => {
      const res = await abandonGoalAction( { goalId: view.goal.id } ) ;
      if( res.success ) {
        router.refresh() ;
      } else {
        setActionError( res.error || gDict.genericError ) ;
      }
    } ) ;
  } ;

  const newButton = puedeEscribir ? (
    <Button variant="primary" onClick={ () => setModal( { kind: "create" } ) }>
      + { gDict.newGoal }
    </Button>
  ) : undefined ;

  const sinMetas = ( indicadores.cantidad === 0 ) ;

  return(
    <div className={styles.container}>
      <PageHeader
        title={gDict.title}
        subtitle={gDict.subtitle}
        actions={newButton}
        showMonthSelector={false}
        dict={dict}
        lang={lang}
      />

      <div className={styles.topBar}>
        <GoalsFilter current={filter} dict={gDict} />
        <CurrencySelector
          currencies={divisas}
          currentCurrency={currency}
          label={gDict.currencyLabel}
        />
      </div>

      { sinMetas ? (
        <EmptyState
          title={gDict.emptyTitle}
          description={gDict.emptyDescription}
          action={ puedeEscribir ? (
            <Button variant="primary" onClick={ () => setModal( { kind: "create" } ) }>
              { gDict.emptyAction }
            </Button>
          ) : undefined }
        />
      ) : (
        <>
          <MetricsSection allowVisibilityToggle={true}>
            <MetricCard title={gDict.metricGoals} value={indicadores.cantidad} isSensitive={false} />
            <MetricCard title={gDict.metricTarget} value={money( indicadores.objetivoTotal )} isSensitive={false} />
            <MetricCard
              title={gDict.metricSaved}
              value={money( indicadores.ahorradoTotal )}
              count={ `${indicadores.porcentajeTotal} %` }
              isSensitive={false}
            />
            <MetricCard title={gDict.metricCompleted} value={indicadores.completadas} isSensitive={false} />
            <MetricCard title={gDict.metricPending} value={indicadores.porCompletar} isSensitive={false} />
          </MetricsSection>

          { actionError ? <FormError error={actionError} /> : null }

          { ( metas.length === 0 ) ? (
            <p className={styles.notice} role="status">{ gDict.emptyFilter }</p>
          ) : (
            <div className={styles.grid}>
              { metas.map( ( view ) => (
                <GoalCard
                  key={view.goal.id}
                  view={view}
                  dict={gDict}
                  locale={locale}
                  puedeEscribir={puedeEscribir}
                  onContribute={ ( v ) => setModal( { kind: "contribute" , view: v } ) }
                  onWithdraw={ ( v ) => setModal( { kind: "withdraw" , view: v } ) }
                  onEdit={ ( v ) => setModal( { kind: "edit" , view: v } ) }
                  onAbandon={handleAbandon}
                />
              ) ) }
            </div>
          ) }
        </>
      ) }

      { ( modal.kind === "create" ) ? (
        <GoalFormModal
          isOpen={true}
          onClose={closeModal}
          currencies={divisas}
          defaultCurrency={currency}
          dict={gDict}
          onSuccess={handleDone}
        />
      ) : null }

      { ( modal.kind === "edit" ) ? (
        <GoalFormModal
          isOpen={true}
          onClose={closeModal}
          goal={modal.view.goal}
          currencies={divisas}
          defaultCurrency={currency}
          dict={gDict}
          onSuccess={handleDone}
        />
      ) : null }

      { ( ( modal.kind === "contribute" ) || ( modal.kind === "withdraw" ) ) ? (
        <ContributeModal
          isOpen={true}
          onClose={closeModal}
          mode={modal.kind}
          view={modal.view}
          cuentas={cuentas}
          dict={gDict}
          locale={locale}
          onSuccess={handleDone}
        />
      ) : null }
    </div>
  ) ;
}
