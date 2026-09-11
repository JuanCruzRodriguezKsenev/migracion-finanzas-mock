/**
 * @file InstallmentPlansModal.tsx
 * Modal de visualización y gestión de planes de compra en cuotas de una tarjeta (RFC 025).
 * Muestra el avance de cada compra, la próxima cuota a imputar y permite la baja lógica
 * o el disparo del alta de una nueva compra financiada.
 */
"use client" ;

// Librerías externas
import React , { useState , useTransition } from "react" ;

// Shared
import { EmptyState }         from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { FormError }          from "@/shared/ui/forms/Form/FormError" ;
import { Button }             from "@/shared/ui/display/Button/Button" ;
import { Modal }              from "@/shared/ui/feedback/Modal/Modal" ;
import { formatCurrency }     from "@/shared/lib/currencyFormatter" ;
import type { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Accounting
import { CategoryTreeNode } from "@/features/accounting/types" ;

// Feature: Cards
import { archiveInstallmentPlanAction } from "../actions/installmentPlansActions" ;
import { ocurrenciaDeCuota }            from "../services/installmentService" ;
import { CardWithAccountsAndEntity }    from "../types" ;
import { InstallmentPlanFormModal }     from "./InstallmentPlanFormModal" ;
import styles                           from "./InstallmentPlansModal.module.css" ;


export interface InstallmentPlansModalProps {
  card:         CardWithAccountsAndEntity ;
  isOpen:       boolean ;
  onClose:      () => void ;
  categoryTree: CategoryTreeNode[] ;
  dict:         Awaited< ReturnType< typeof getDictionary > > ;
  locale:       string ;
  onChanged:    () => void ;
}

/**
 * Formatea una fecha civil YYYY-MM-DD en texto legible (ej: "10 oct").
 */
function formatearFechaCivil( fechaCivil: string , locale: string ): string {
  const [ y , m , d ] = fechaCivil.split( "-" ).map( Number ) ;
  const date          = new Date( Date.UTC( y , ( m - 1 ) , d , 12 , 0 , 0 ) ) ;

  return( new Intl.DateTimeFormat( locale , {
    day:      "numeric" ,
    month:    "short" ,
    timeZone: "UTC" ,
  } ).format( date ) ) ;
}

/**
 * Modal con el listado detallado de planes de cuotas activos para una tarjeta de crédito.
 */
export function InstallmentPlansModal( {
  card ,
  isOpen ,
  onClose ,
  categoryTree ,
  dict ,
  locale ,
  onChanged ,
}: InstallmentPlansModalProps ) {
  const [ isFormOpen , setIsFormOpen ] = useState( false ) ;
  const [ isPending , startTransition ]  = useTransition() ;
  const [ actionError , setActionError ] = useState< string | null >( null ) ;

  const activePlans = ( card.planes || [] ).filter( ( p ) => !p.archivedAt ) ;

  const monedaPrincipal        = card.accounts[0]?.currency || "ARS" ;
  const cuotasFuturasPrincipal = ( card.ciclo?.cuotasFuturas?.[monedaPrincipal] ?? 0 ) ;
  const planesPrincipal        = activePlans.filter( ( p ) => p.currency === monedaPrincipal ) ;
  const cuotasPendientes       = planesPrincipal.reduce(
    ( sum , p ) => sum + Math.max( 0 , ( p.totalInstallments - p.cuotasImputadas ) ) , 0
  ) ;

  const modalTitlePrefix = ( dict.cardsPage?.installments?.modalTitlePrefix || "Cuotas de" ) ;
  const title            = `${modalTitlePrefix} ${card.label}` ;

  const handleArchive = ( planId: string ) => {
    const confirmMsg = (
      dict.cardsPage?.installments?.archivePlanConfirm ||
      "Al dar de baja el plan dejás de ver sus cuotas futuras. Las cuotas ya imputadas quedan en el libro. ¿Confirmás?"
    ) ;

    if( !confirm( confirmMsg ) ) {
      return ;
    }

    setActionError( null ) ;
    startTransition( async () => {
      const res = await archiveInstallmentPlanAction( planId ) ;
      if( res.success ) {
        onChanged() ;
      } else {
        setActionError( res.error ) ;
      }
    } ) ;
  } ;

  return(
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        size="medium"
        footer={
          <div style={ { display: "flex" , justifyContent: "flex-end" , width: "100%" , gap: "0.5rem" } }>
            <Button
              variant="secondary"
              onClick={onClose}
            >
              { dict.cardsPage?.installments?.cancel || "Cancelar" }
            </Button>
            <Button
              variant="primary"
              onClick={ () => setIsFormOpen( true ) }
            >
              { dict.cardsPage?.installments?.newPlan || "Nueva compra en cuotas" }
            </Button>
          </div>
        }
      >
        <div className={styles.container}>
          { actionError ? (
            <FormError error={actionError} />
          ) : null }

          <div className={styles.headerSummary}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                { dict.cardsPage?.installments?.futureTotalLabel || "Cuotas futuras" } ({ monedaPrincipal })
              </span>
              <span className={styles.summaryValue}>
                { formatCurrency( cuotasFuturasPrincipal , monedaPrincipal , locale ) }
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>
                { dict.cardsPage?.installmentsPendingSuffix || "cuotas pendientes" }
              </span>
              <span className={styles.summaryValueSoft}>
                { cuotasPendientes }
              </span>
            </div>
          </div>

          { activePlans.length === 0 ? (
            <EmptyState
              title={ dict.cardsPage?.installments?.noPlansTitle || "Sin compras en cuotas" }
              description={
                dict.cardsPage?.installments?.noPlansDescription ||
                "Las compras que financies con esta tarjeta van a aparecer acá, con su avance y su próxima cuota."
              }
            />
          ) : (
            <div className={styles.plansList}>
              { activePlans.map( ( plan ) => {
                const tienePendientes = ( plan.cuotasImputadas < plan.totalInstallments ) ;
                const proximaFecha    = tienePendientes ? ocurrenciaDeCuota( plan , plan.cuotasImputadas ) : null ;
                const porcentaje      = Math.min( 100 , Math.round( ( plan.cuotasImputadas / plan.totalInstallments ) * 100 ) ) ;

                return(
                  <div key={plan.id} className={styles.planCard}>
                    <div className={styles.planTopRow}>
                      <div className={styles.planInfo}>
                        <span className={styles.planDescription}>{ plan.description }</span>
                        { plan.merchantName ? (
                          <span className={styles.planMerchant}>{ plan.merchantName }</span>
                        ) : null }
                      </div>

                      <div className={styles.planFinancials}>
                        <span className={styles.planAmount}>
                          { formatCurrency( plan.installmentAmount , plan.currency , locale ) }
                        </span>
                        <span className={styles.planProgress}>
                          { plan.cuotasImputadas } { dict.cardsPage?.installments?.progressSeparator || "de" } { plan.totalInstallments }
                        </span>
                      </div>
                    </div>

                    <div className={styles.progressTrack}>
                      <div
                        className={styles.progressBar}
                        style={ { width: `${porcentaje}%` } }
                      />
                    </div>

                    <div className={styles.planBottomRow}>
                      <div className={styles.nextDate}>
                        { proximaFecha ? (
                          <span>
                            { dict.cardsPage?.installments?.nextInstallmentPrefix || "próxima" }: { formatearFechaCivil( proximaFecha , locale ) }
                          </span>
                        ) : null }
                      </div>

                      <button
                        type="button"
                        className={styles.archiveButton}
                        disabled={isPending}
                        onClick={ () => handleArchive( plan.id ) }
                      >
                        { dict.cardsPage?.installments?.archivePlan || "Dar de baja" }
                      </button>
                    </div>
                  </div>
                ) ;
              } ) }
            </div>
          ) }
        </div>
      </Modal>

      { isFormOpen ? (
        <InstallmentPlanFormModal
          card={card}
          isOpen={isFormOpen}
          onClose={ () => setIsFormOpen( false ) }
          categoryTree={categoryTree}
          dict={dict}
          locale={locale}
          onSuccess={ () => {
            setIsFormOpen( false ) ;
            onChanged() ;
          } }
        />
      ) : null }
    </>
  ) ;
}
