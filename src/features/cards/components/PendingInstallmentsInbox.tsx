/**
 * @file PendingInstallmentsInbox.tsx
 * Bandeja global de cuotas de compras financiadas esperando confirmación (RFC 025).
 * Se ubica arriba de la grilla de tarjetas en /cards y sólo se renderiza si hay cuotas pendientes.
 * Imputar una cuota emite el asiento contable de pasivo vs gasto sin movimiento de fondos bancarios.
 */
"use client" ;

// Librerías externas
import React , { useState , useTransition } from "react" ;

// Shared
import { FormInput }          from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }          from "@/shared/ui/forms/Form/FormError" ;
import { Button }             from "@/shared/ui/display/Button/Button" ;
import { Modal }              from "@/shared/ui/feedback/Modal/Modal" ;
import { formatCurrency }     from "@/shared/lib/currencyFormatter" ;
import type { getDictionary } from "@/shared/lib/dictionary" ;
import { usePuedeEscribir }   from "@/shared/providers/PermissionsProvider" ;

// Feature: Cards
import {
  resolveInstallmentAction ,
  ResolveInstallmentParams
} from "../actions/installmentPlansActions" ;
import { CardWithAccountsAndEntity , PendienteCuota } from "../types" ;
import styles                                        from "./PendingInstallmentsInbox.module.css" ;


export interface PendingInstallmentsInboxProps {
  initialPending: PendienteCuota[] ;
  cards:          CardWithAccountsAndEntity[] ;
  dict:           Awaited< ReturnType< typeof getDictionary > > ;
  locale?:        string ;
}

/**
 * Formatea una fecha civil YYYY-MM-DD en texto legible (ej: "10 de octubre de 2026").
 */
function formatearFechaCivil( fechaCivil: string , locale: string ): string {
  const [ y , m , d ] = fechaCivil.split( "-" ).map( Number ) ;
  const date          = new Date( Date.UTC( y , ( m - 1 ) , d , 12 , 0 , 0 ) ) ;

  return( new Intl.DateTimeFormat( locale , {
    year:     "numeric" ,
    month:    "short" ,
    day:      "numeric" ,
    timeZone: "UTC" ,
  } ).format( date ) ) ;
}

/**
 * Bandeja global de confirmación de cuotas propuestas para todas las tarjetas de la organización.
 */
export function PendingInstallmentsInbox( {
  initialPending ,
  cards ,
  dict ,
  locale = "es-AR" ,
}: PendingInstallmentsInboxProps ) {
  const puedeEscribir                      = usePuedeEscribir() ;
  const [ pendingItems , setPendingItems ] = useState< PendienteCuota[] >( initialPending ) ;
  const [ isPending , startTransition ]    = useTransition() ;
  const [ actionError , setActionError ]   = useState< string | null >( null ) ;

  // Estado para el modal de confirmar con otro importe
  const [ customAmountTarget , setCustomAmountTarget ] = useState< PendienteCuota | null >( null ) ;
  const [ customAmountValue , setCustomAmountValue ]   = useState< string >( "" ) ;

  // Si no hay pendientes, no se renderiza nada
  if( pendingItems.length === 0 ) {
    return( null ) ;
  }

  const handleExecuteResolution = ( params: ResolveInstallmentParams ) => {
    setActionError( null ) ;
    startTransition( async () => {
      const res = await resolveInstallmentAction( params ) ;
      if( res.success ) {
        setPendingItems( ( prev ) => prev.filter(
          ( item ) => !( ( item.planId === params.planId ) && ( item.fechaCuota === params.occurrenceDate ) )
        ) ) ;
        setCustomAmountTarget( null ) ;
      } else {
        setActionError( res.error ) ;
      }
    } ) ;
  } ;

  // Confirmar cuota estándar
  const handleConfirmClick = ( item: PendienteCuota ) => {
    handleExecuteResolution( {
      planId:         item.planId ,
      occurrenceDate: item.fechaCuota ,
      action:         "confirm" ,
    } ) ;
  } ;

  // Abrir modal de importe personalizado
  const handleCustomAmountClick = ( item: PendienteCuota ) => {
    setActionError( null ) ;
    setCustomAmountTarget( item ) ;
    setCustomAmountValue( ( item.plan.installmentAmount / 100 ).toString() ) ;
  } ;

  // Enviar confirmación con otro importe
  const handleCustomAmountSubmit = ( e: React.FormEvent ) => {
    e.preventDefault() ;
    if( !customAmountTarget ) { return ; }

    const val = parseFloat( customAmountValue ) ;
    if( isNaN( val ) || ( val <= 0 ) ) {
      setActionError( "Ingresá un monto válido mayor a 0." ) ;
      return ;
    }

    handleExecuteResolution( {
      planId:         customAmountTarget.planId ,
      occurrenceDate: customAmountTarget.fechaCuota ,
      action:         "confirm_custom_amount" ,
      customAmount:   Math.round( val * 100 ) ,
    } ) ;
  } ;

  // Descartar cuota sin imputar
  const handleSkipClick = ( item: PendienteCuota ) => {
    const confirmMsg = (
      dict.cardsPage?.installments?.skipConfirm ||
      "Descartar la cuota avanza el plan sin registrar ningún asiento. ¿Confirmás?"
    ) ;

    if( !confirm( confirmMsg ) ) {
      return ;
    }

    handleExecuteResolution( {
      planId:         item.planId ,
      occurrenceDate: item.fechaCuota ,
      action:         "skip" ,
    } ) ;
  } ;

  return(
    <section className={styles.inboxWrapper}>
      <header className={styles.inboxHeader}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>
            { dict.cardsPage?.installments?.inboxTitlePrefix || "Cuotas esperando confirmación" }
          </h3>
          <span className={styles.badge}>{ pendingItems.length }</span>
        </div>
        <p className={styles.description}>
          { dict.cardsPage?.installments?.inboxSubtitle || "Confirmá la cuota cuando entre al resumen de la tarjeta. No mueve plata de ninguna cuenta." }
        </p>
      </header>

      { actionError ? (
        <div style={ { marginBottom: "0.75rem" } }>
          <FormError error={actionError} />
        </div>
      ) : null }

      <div className={styles.itemsList}>
        { pendingItems.map( ( item ) => {
          const cardLabel = cards.find( ( c ) => c.id === item.plan.cardId )?.label ;

          return(
            <div key={`${item.planId}-${item.fechaCuota}`} className={styles.itemCard}>
              <div className={styles.itemInfo}>
                <div className={styles.itemDetails}>
                  <span className={styles.itemName}>{ item.plan.description }</span>
                  <span className={styles.itemMeta}>
                    { cardLabel ? `${cardLabel} · ` : "" }
                    { item.numeroCuota } { dict.cardsPage?.installments?.progressSeparator || "de" } { item.plan.totalInstallments }
                    { " · " }
                    { formatearFechaCivil( item.fechaCuota , locale ) }
                  </span>
                </div>
              </div>

              <div className={styles.itemAmountActions}>
                <span className={styles.itemAmount}>
                  { formatCurrency( item.plan.installmentAmount , item.plan.currency , locale ) }
                </span>

                {puedeEscribir && (
                  <div className={styles.itemActions}>
                    <Button
                      variant="primary"
                      disabled={isPending}
                      onClick={ () => handleConfirmClick( item ) }
                    >
                      { dict.cardsPage?.installments?.confirm || "Confirmar" }
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={isPending}
                      onClick={ () => handleCustomAmountClick( item ) }
                    >
                      { dict.cardsPage?.installments?.confirmOther || "Otro importe" }
                    </Button>
                    <button
                      type="button"
                      className={styles.skipButton}
                      disabled={isPending}
                      onClick={ () => handleSkipClick( item ) }
                    >
                      { dict.cardsPage?.installments?.skip || "Descartar" }
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) ;
        } ) }
      </div>

      { customAmountTarget ? (
        <Modal
          isOpen={Boolean( customAmountTarget )}
          onClose={ () => setCustomAmountTarget( null ) }
          title={ dict.cardsPage?.installments?.otherAmountTitle || "Confirmar con otro importe" }
          size="small"
        >
          <form onSubmit={handleCustomAmountSubmit} style={ { display: "flex" , flexDirection: "column" , gap: "1rem" } }>
            { actionError ? (
              <FormError error={actionError} />
            ) : null }

            <FormInput
              label={ dict.cardsPage?.installments?.otherAmountLabel || "Importe real de esta cuota" }
              type="number"
              step="0.01"
              min="0.01"
              value={customAmountValue}
              onChange={ ( e ) => setCustomAmountValue( e.target.value ) }
              required
              autoFocus
            />

            <div style={ { display: "flex" , justifyContent: "flex-end" , gap: "0.5rem" , marginTop: "0.5rem" } }>
              <Button
                variant="secondary"
                type="button"
                onClick={ () => setCustomAmountTarget( null ) }
              >
                { dict.cardsPage?.installments?.cancel || "Cancelar" }
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={isPending}
              >
                { dict.cardsPage?.installments?.confirm || "Confirmar" }
              </Button>
            </div>
          </form>
        </Modal>
      ) : null }
    </section>
  ) ;
}
