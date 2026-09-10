/**
 * @file SubscriptionDashboard.tsx
 * Contenedor principal cliente del dashboard de suscripciones.
 * Renderiza el treemap proporcional al gasto mensual, la barra de totales
 * y el modal de alta/edición (cargado bajo demanda vía dynamic import).
 */
"use client" ;

// Librerías externas
import React , { useState , useMemo , useRef , useEffect , useCallback } from "react" ;
import dynamic                                                           from "next/dynamic" ;

// Shared
import { PageHeader }         from "@/shared/ui/layout/PageHeader/PageHeader" ;
import { EmptyState }         from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { Button }             from "@/shared/ui/display/Button/Button" ;
import { FormError }          from "@/shared/ui/forms/Form/FormError" ;
import type { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Profile
import { useProfileContext } from "@/features/profile/context/ProfileContext" ;

// Feature: Accounting
import { Account } from "@/features/accounting/types" ;

// Feature: Subscriptions
import { PendingOccurrencesInbox } from "./PendingOccurrencesInbox" ;
import { PendienteRecurrencia }     from "../services/recurrenceService" ;
import { useSubscriptions }         from "../hooks/useSubscriptions" ;
import { SubscriptionCard }         from "./SubscriptionCard" ;
import { computeTreemap }           from "../utils/treemap" ;
import { Subscription }             from "../types" ;
import { SummaryBar }               from "./SummaryBar" ;
import styles                       from "./SubscriptionDashboard.module.css" ;

// Modal cargado solo cuando el usuario abre el alta/edición (fuera del bundle inicial)
const AddSubscriptionModal = dynamic(
  () => import( "./AddSubscriptionModal" ).then( ( m ) => ( {default: m.AddSubscriptionModal} ) ) ,
  {ssr: false} ,
) ;

/**
 * Diccionario de la página de suscripciones (subconjunto del diccionario global).
 */
export type SubscriptionsDict = Awaited< ReturnType< typeof getDictionary > >["subscriptionsPage"] ;

interface SubscriptionDashboardProps {
  initialData:    Subscription[] ;
  initialPending: PendienteRecurrencia[] ;
  accounts:       Account[] ;
  dict:           Awaited< ReturnType< typeof getDictionary > > ;
  lang?:          string ;
}

// SVG del botón fuera del componente — no se recrea en cada render
const PLUS_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
) ;

// Peso mínimo agregado a cada nodo para que las suscripciones baratas sigan siendo visibles
const WEIGHT_OFFSET = 500 ;

/**
 * Dashboard de treemap de suscripciones con mutaciones optimistas.
 */
export function SubscriptionDashboard( {
  initialData ,
  initialPending ,
  accounts ,
  dict ,
  lang = "es" ,
}: SubscriptionDashboardProps ) {
  const pageDict = dict.subscriptionsPage ;
  const { profile }                                 = useProfileContext() ;
  const locale                                      = ( profile?.numberFormat || "es-AR" ) ;
  const { summary , error , add , update , remove } = useSubscriptions( initialData ) ;
  const [ modalOpen , setModalOpen ] = useState( false ) ;
  const [ editingId , setEditingId ] = useState< string | null >( null ) ;

  const containerRef = useRef< HTMLDivElement >( null ) ;

  // Dos primitivos en lugar de objeto — evita re-renders cuando el observer
  // dispara con las mismas dimensiones redondeadas
  const [ containerWidth , setContainerWidth ]   = useState( 0 ) ;
  const [ containerHeight , setContainerHeight ] = useState( 0 ) ;

  useEffect( () => {
    const element = containerRef.current ;
    if( !element ){ return ; }

    const observer = new ResizeObserver( ( entries ) => {
      if( !entries || (entries.length === 0) ){ return ; }
      const { width , height } = entries[0].contentRect ;

      // Solo actualizar si realmente cambió — evita re-renders innecesarios
      setContainerWidth( ( prev ) => ( prev === Math.round( width ) ? prev : Math.round( width ) ) ) ;
      setContainerHeight( ( prev ) => ( prev === Math.round( height ) ? prev : Math.round( height ) ) ) ;
    } ) ;

    observer.observe( element ) ;
    return( () => observer.disconnect() ) ;
  } , [] ) ;

  const handleOpenModal  = useCallback( () => setModalOpen( true ) , [] ) ;
  const handleCloseModal = useCallback( () => { setModalOpen( false ) ; setEditingId( null ) ; } , [] ) ;

  const handleEdit = useCallback( ( id: string ) => {
    setEditingId( id ) ;
    setModalOpen( true ) ;
  } , [] ) ;

  const treemapNodes = useMemo( () => (
    summary.subscriptions.map( ( sub ) => ( {
      id:     sub.id ,
      name:   sub.name ,
      price:  sub.monthlyAmount ,
      weight: sub.monthlyAmount + WEIGHT_OFFSET ,
    } ) )
  ) , [ summary.subscriptions ] ) ;

  const w = ( containerWidth || 800 ) ;
  const h = ( containerHeight || 500 ) ;

  const rects = useMemo( () => {
    const raw = computeTreemap( treemapNodes , w , h ) ;

    return( raw.map( ( rect ) => ( {
      ...rect ,
      xPct:      (rect.x / w) * 100 ,
      yPct:      (rect.y / h) * 100 ,
      widthPct:  (rect.width / w) * 100 ,
      heightPct: (rect.height / h) * 100 ,
    } ) ) ) ;
  } , [ treemapNodes , w , h ] ) ;

  // Map para lookup O(1) por tarjeta en lugar de .find() O(n)
  const rectsMap = useMemo(
    () => new Map( rects.map( ( r ) => [ r.id , r ] ) ) ,
    [ rects ] ,
  ) ;

  const editingSubscription = useMemo(
    () => ( editingId ? summary.subscriptions.find( ( s ) => s.id === editingId ) : null ) ,
    [ editingId , summary.subscriptions ] ,
  ) ;

  return(
    <div className={styles.container}>
      <PageHeader
        title={pageDict.title}
        subtitle={pageDict.subtitle}
        actions={
          <>
            <span className={styles.countLabel}>
              { summary.count } { pageDict.activeServices }
            </span>
            <Button variant="primary" icon={PLUS_ICON} onClick={handleOpenModal}>
              { pageDict.addBtn }
            </Button>
          </>
        }
        showMonthSelector={false}
        dict={dict}
        lang={lang}
      />

      {error && (
        <div className={styles.errorBanner}>
          <FormError error={error} />
        </div>
      )}

      {/* Bandeja de recurrencias propuestas (RFC 023) */}
      <PendingOccurrencesInbox
        initialPending={initialPending}
        accounts={accounts}
        locale={locale}
      />

      {summary.count === 0 ? (
        <EmptyState
          title={pageDict.emptyStateTitle}
          description={pageDict.emptyStateDescription}
          action={
            <Button variant="primary" icon={PLUS_ICON} onClick={handleOpenModal}>
              { pageDict.addBtn }
            </Button>
          }
        />
      ) : (
        <div ref={containerRef} className={styles.treemapContainer}>
          {summary.subscriptions.map( ( sub , index ) => {
            const rect = rectsMap.get( sub.id ) ;

            const pct        = sub.percentOfTotal ;
            const rectWidth  = ( rect?.widthPct ?? 0 ) ;
            const rectHeight = ( rect?.heightPct ?? 0 ) ;

            const size = !rect ? "micro"
              : (pct <= 2) ? "micro"
              : (pct <= 4) ? "tiny"
              : ( (rectWidth >= 25) && (rectHeight >= 25) ) ? "large"
              : ( (rectWidth >= 15) && (rectHeight >= 15) ) ? "medium"
              : "small" ;

            return(
              <div
                key={sub.id}
                className={styles.treemapTile}
                style={ {
                  left:           rect ? `${rect.xPct}%` : "0%" ,
                  top:            rect ? `${rect.yPct}%` : "0%" ,
                  width:          rect ? `${rect.widthPct}%` : "0%" ,
                  height:         rect ? `${rect.heightPct}%` : "0%" ,
                  opacity:        rect ? 1 : 0 ,
                  transform:      rect ? "scale(1)" : "scale(0.85)" ,
                  animationDelay: `${index * 30}ms` ,
                } }
              >
                <SubscriptionCard
                  subscription={sub}
                  size={size}
                  yearlySuffix={pageDict.perYearSuffix}
                  editTitle={pageDict.editTitle}
                  deleteTitle={pageDict.deleteTitle}
                  onEdit={handleEdit}
                  onDelete={remove}
                />
              </div>
            ) ;
          } )}
        </div>
      )}

      <SummaryBar
        totalMonthly={summary.totalMonthly}
        totalYearly={summary.totalYearly}
        monthlyLabel={pageDict.totalMonthLabel}
        yearlyLabel={pageDict.yearlyProjectionLabel}
        locale={locale}
      />

      {/* Modal con datos de edición cuando corresponde (key fuerza remount limpio) */}
      <AddSubscriptionModal
        key={ modalOpen ? `sub-modal-${editingId || "new"}` : "closed" }
        open={modalOpen}
        onClose={handleCloseModal}
        onAdd={add}
        onUpdate={update}
        editingData={ editingSubscription ?? undefined }
        dict={pageDict}
      />
    </div>
  ) ;
}
