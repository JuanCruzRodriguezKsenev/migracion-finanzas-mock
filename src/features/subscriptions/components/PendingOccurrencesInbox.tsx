/**
 * @file PendingOccurrencesInbox.tsx
 * Bandeja de transacciones propuestas para suscripciones recurrentes (RFC 023).
 * Se ubica sobre el treemap en /subscriptions y solo se renderiza cuando existen
 * ocurrencias pendientes de confirmar. Soporta confirmación al libro diario,
 * confirmación con monto variable, descarte sin cobro y baja de la suscripción.
 */
"use client" ;

// Librerías externas
import React , { useState , useTransition } from "react" ;

// Shared
import { FormSelect }    from "@/shared/ui/forms/Form/FormSelect" ;
import { FormInput }     from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }     from "@/shared/ui/forms/Form/FormError" ;
import { Button }        from "@/shared/ui/display/Button/Button" ;
import { Modal }         from "@/shared/ui/feedback/Modal/Modal" ;
import { formatCurrency } from "@/shared/lib/currencyFormatter" ;
import { usePuedeEscribir } from "@/shared/providers/PermissionsProvider" ;

// Feature: Accounting
import { Account } from "@/features/accounting/types" ;

// Feature: Subscriptions
import {
  resolveSubscriptionAction ,
  ResolveSubscriptionParams
} from "../actions/resolveSubscriptionAction" ;
import { PendienteRecurrencia } from "../services/recurrenceService" ;
import { SubscriptionIcon }     from "./SubscriptionIcon" ;
import styles                   from "./PendingOccurrencesInbox.module.css" ;


interface PendingOccurrencesInboxProps {
  initialPending: PendienteRecurrencia[] ;
  accounts:       Account[] ;
  locale?:        string ;
}

/**
 * Formatea una fecha civil YYYY-MM-DD en texto legible (ej: "5 de septiembre de 2026").
 */
function formatearFechaCivil( fechaCivil: string , locale: string ): string {
  const [ y , m , d ] = fechaCivil.split( "-" ).map( Number ) ;
  const date          = new Date( Date.UTC( y , m - 1 , d , 12 , 0 , 0 ) ) ;

  return( new Intl.DateTimeFormat( locale , {
    year:     "numeric" ,
    month:    "long" ,
    day:      "numeric" ,
    timeZone: "UTC" ,
  } ).format( date ) ) ;
}

/**
 * Bandeja de confirmación para ocurrencias de cobro pendientes de suscripciones.
 */
export function PendingOccurrencesInbox( {
  initialPending ,
  accounts ,
  locale = "es-AR" ,
}: PendingOccurrencesInboxProps ) {
  const puedeEscribir                      = usePuedeEscribir() ;
  const [ pendingItems , setPendingItems ] = useState< PendienteRecurrencia[] >( initialPending ) ;
  const [ isPending , startTransition ]    = useTransition() ;
  const [ actionError , setActionError ]   = useState< string | null >( null ) ;

  // Estado para el modal de asignación de cuenta de pago rápida
  const [ accountModalTarget , setAccountModalTarget ] = useState< PendienteRecurrencia | null >( null ) ;
  const [ selectedAccountId , setSelectedAccountId ]   = useState< string >( "" ) ;

  // Estado para el modal de confirmar con otro monto
  const [ customAmountTarget , setCustomAmountTarget ] = useState< PendienteRecurrencia | null >( null ) ;
  const [ customAmountValue , setCustomAmountValue ]   = useState< string >( "" ) ;
  const [ customAmountStep , setCustomAmountStep ]     = useState< "input" | "question" >( "input" ) ;

  // Estado para el modal de baja
  const [ cancelTarget , setCancelTarget ] = useState< PendienteRecurrencia | null >( null ) ;

  // Regla estricta del diseño y RFC 023 §5: Si no hay pendientes, no se renderiza nada
  if( pendingItems.length === 0 ) {
    return( null ) ;
  }

  const handleExecuteResolution = ( params: ResolveSubscriptionParams ) => {
    setActionError( null ) ;
    startTransition( async () => {
      const res = await resolveSubscriptionAction( params ) ;
      if( res.success ) {
        // Remover el pendiente resuelto del estado local
        setPendingItems( ( prev ) => prev.filter(
          ( item ) => !( (item.subscriptionId === params.subscriptionId) && (item.fechaCobro === params.occurrenceDate) )
        ) ) ;
        setAccountModalTarget( null ) ;
        setCustomAmountTarget( null ) ;
        setCancelTarget( null ) ;
      } else {
        setActionError( res.error ) ;
      }
    } ) ;
  } ;

  // 1. Confirmar cargo estándar
  const handleConfirmClick = ( item: PendienteRecurrencia ) => {
    setActionError( null ) ;
    if( !item.subscription.accountId ) {
      // Exige seleccionar cuenta si la suscripción no tenía una asignada
      setAccountModalTarget( item ) ;
      const defaultAcc = accounts.find( ( a ) => a.currency === item.subscription.currency ) ;
      setSelectedAccountId( defaultAcc ? defaultAcc.id : "" ) ;
      return ;
    }

    handleExecuteResolution( {
      subscriptionId: item.subscriptionId ,
      occurrenceDate: item.fechaCobro ,
      action:         "confirm" ,
    } ) ;
  } ;

  // 2. Confirmar con cuenta seleccionada
  const handleAccountModalSubmit = () => {
    if( !accountModalTarget || !selectedAccountId ) { return ; }
    handleExecuteResolution( {
      subscriptionId: accountModalTarget.subscriptionId ,
      occurrenceDate: accountModalTarget.fechaCobro ,
      action:         "confirm" ,
      accountId:      selectedAccountId ,
    } ) ;
  } ;

  // 3. Abrir modal de monto personalizado
  const handleCustomAmountClick = ( item: PendienteRecurrencia ) => {
    setActionError( null ) ;
    setCustomAmountTarget( item ) ;
    setCustomAmountValue( ( item.subscription.amount / 100 ).toString() ) ;
    setCustomAmountStep( "input" ) ;

    const currentAcc = item.subscription.accountId || accounts.find( ( a ) => a.currency === item.subscription.currency )?.id || "" ;
    setSelectedAccountId( currentAcc ) ;
  } ;

  // 4. Pasar a la pregunta de precio permanente
  const handleCustomAmountNext = () => {
    const val = parseFloat( customAmountValue ) ;
    if( isNaN( val ) || (val <= 0) ) {
      setActionError( "Ingresá un monto válido mayor a 0." ) ;
      return ;
    }
    setActionError( null ) ;
    setCustomAmountStep( "question" ) ;
  } ;

  // 5. Enviar confirmación con otro monto
  const handleCustomAmountSubmit = ( updateSubscriptionAmount: boolean ) => {
    if( !customAmountTarget ) { return ; }
    const amountInCents = Math.round( parseFloat( customAmountValue ) * 100 ) ;

    handleExecuteResolution( {
      subscriptionId:           customAmountTarget.subscriptionId ,
      occurrenceDate:           customAmountTarget.fechaCobro ,
      action:                   "confirm_custom_amount" ,
      customAmount:             amountInCents ,
      accountId:                selectedAccountId || customAmountTarget.subscription.accountId ,
      updateSubscriptionAmount ,
    } ) ;
  } ;

  // 6. No me lo cobraron
  const handleNotChargedClick = ( item: PendienteRecurrencia ) => {
    handleExecuteResolution( {
      subscriptionId: item.subscriptionId ,
      occurrenceDate: item.fechaCobro ,
      action:         "not_charged" ,
    } ) ;
  } ;

  // 7. Abrir modal de baja
  const handleCancelClick = ( item: PendienteRecurrencia ) => {
    setActionError( null ) ;
    setCancelTarget( item ) ;
  } ;

  // 8. Confirmar baja
  const handleCancelSubmit = () => {
    if( !cancelTarget ) { return ; }
    handleExecuteResolution( {
      subscriptionId: cancelTarget.subscriptionId ,
      occurrenceDate: cancelTarget.fechaCobro ,
      action:         "cancel" ,
    } ) ;
  } ;

  return(
    <div className={styles.inboxWrapper}>
      <div className={styles.inboxHeader}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>Transacciones propuestas</h2>
          <span className={styles.badge}>{ pendingItems.length } pendientes</span>
        </div>
        <p className={styles.description}>
          Períodos de suscripciones listos para asentar en el libro mayor.
        </p>
      </div>

      {actionError && (
        <div className={styles.errorBanner}>
          <FormError error={actionError} />
        </div>
      )}

      <div className={styles.itemsList}>
        {pendingItems.map( ( item ) => {
          const sub = item.subscription ;

          return(
            <div
              key={ `${item.subscriptionId}-${item.fechaCobro}` }
              className={styles.itemCard}
            >
              <div className={styles.itemInfo}>
                <div
                  className={styles.itemIcon}
                  style={ {backgroundColor: sub.color || "var(--color-primary-light)"} }
                >
                  <SubscriptionIcon logoKey={sub.logoKey} size={28} />
                </div>
                <div className={styles.itemDetails}>
                  <p className={styles.itemName}>{ sub.name }</p>
                  <p className={styles.itemPeriod}>
                    Período: { formatearFechaCivil( item.fechaCobro , locale ) }
                  </p>
                </div>
              </div>

              <div className={styles.itemAmountSection}>
                <span className={styles.amountLabel}>Monto esperado</span>
                <span className={styles.amountValue}>
                  { formatCurrency( sub.amount , sub.currency , locale ) }
                </span>
              </div>

              {puedeEscribir && (
                <div className={styles.actionsGroup}>
                  <Button
                    variant="primary"
                    isLoading={isPending}
                    onClick={ () => handleConfirmClick( item ) }
                  >
                    Confirmar
                  </Button>
                  <Button
                    variant="outline"
                    isLoading={isPending}
                    onClick={ () => handleCustomAmountClick( item ) }
                  >
                    Otro monto
                  </Button>
                  <Button
                    variant="outline"
                    isLoading={isPending}
                    onClick={ () => handleNotChargedClick( item ) }
                  >
                    No me lo cobraron
                  </Button>
                  <Button
                    variant="danger"
                    isLoading={isPending}
                    onClick={ () => handleCancelClick( item ) }
                  >
                    Dar de baja
                  </Button>
                </div>
              )}
            </div>
          ) ;
        } )}
      </div>

      {/* Modal: Seleccionar cuenta de pago al confirmar */}
      {accountModalTarget && (
        <Modal
          isOpen={ Boolean( accountModalTarget ) }
          title="Seleccionar cuenta de pago"
          subtitle={ accountModalTarget.subscription.name }
          onClose={ () => setAccountModalTarget( null ) }
          size="small"
        >
          <div className={styles.modalContent}>
            <p className={styles.modalDescription}>
              Esta suscripción no tiene una cuenta de pago asociada. Elegí de qué cuenta se debitó
              el cobro de { formatCurrency( accountModalTarget.subscription.amount , accountModalTarget.subscription.currency , locale ) }:
            </p>

            <FormSelect
              label="Cuenta de pago"
              name="accountId"
              value={selectedAccountId}
              onChange={ ( e ) => setSelectedAccountId( e.target.value ) }
              required
            >
              <option value="">Seleccionar cuenta...</option>
              {accounts
                .filter( ( a ) => a.currency === accountModalTarget.subscription.currency )
                .map( ( a ) => (
                  <option key={a.id} value={a.id}>
                    { `${a.name} (${a.currency})` }
                  </option>
                ) )}
            </FormSelect>

            <div className={styles.modalActions}>
              <Button
                variant="outline"
                onClick={ () => setAccountModalTarget( null ) }
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                isLoading={isPending}
                disabled={!selectedAccountId}
                onClick={handleAccountModalSubmit}
              >
                Confirmar y guardar cuenta
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Confirmar con otro monto */}
      {customAmountTarget && (
        <Modal
          isOpen={ Boolean( customAmountTarget ) }
          title="Confirmar con otro monto"
          subtitle={ customAmountTarget.subscription.name }
          onClose={ () => setCustomAmountTarget( null ) }
          size="small"
        >
          <div className={styles.modalContent}>
            {customAmountStep === "input" ? (
              <>
                <p className={styles.modalDescription}>
                  Ingresá el importe real que te cobraron para el período { formatearFechaCivil( customAmountTarget.fechaCobro , locale ) }:
                </p>

                <FormInput
                  label={ `Monto pagado (${customAmountTarget.subscription.currency})` }
                  name="customAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={customAmountValue}
                  onChange={ ( e ) => setCustomAmountValue( e.target.value ) }
                  required
                />

                {!customAmountTarget.subscription.accountId && (
                  <FormSelect
                    label="Cuenta de pago"
                    name="accountId"
                    value={selectedAccountId}
                    onChange={ ( e ) => setSelectedAccountId( e.target.value ) }
                    required
                  >
                    <option value="">Seleccionar cuenta...</option>
                    {accounts
                      .filter( ( a ) => a.currency === customAmountTarget.subscription.currency )
                      .map( ( a ) => (
                        <option key={a.id} value={a.id}>
                          { `${a.name} (${a.currency})` }
                        </option>
                      ) )}
                  </FormSelect>
                )}

                <div className={styles.modalActions}>
                  <Button
                    variant="outline"
                    onClick={ () => setCustomAmountTarget( null ) }
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    disabled={ !customAmountValue || (parseFloat( customAmountValue ) <= 0) }
                    onClick={handleCustomAmountNext}
                  >
                    Continuar
                  </Button>
                </div>
              </>
            ) : (
              <div className={styles.questionActions}>
                <h3 className={styles.modalQuestion}>
                  ¿Fue sólo este mes o cambió el precio?
                </h3>
                <p className={styles.modalDescription}>
                  Elegí si querés registrar este cobro por { formatCurrency( Math.round( parseFloat( customAmountValue ) * 100 ) , customAmountTarget.subscription.currency , locale ) } únicamente para este período, o actualizar el monto base de la suscripción para los próximos cobros.
                </p>

                <Button
                  variant="outline"
                  isLoading={isPending}
                  onClick={ () => handleCustomAmountSubmit( false ) }
                >
                  Fue sólo este mes
                </Button>
                <Button
                  variant="primary"
                  isLoading={isPending}
                  onClick={ () => handleCustomAmountSubmit( true ) }
                >
                  Cambió el precio (actualizar suscripción)
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal: Confirmación de dar de baja */}
      {cancelTarget && (
        <Modal
          isOpen={ Boolean( cancelTarget ) }
          title="Dar de baja suscripción"
          subtitle={ cancelTarget.subscription.name }
          onClose={ () => setCancelTarget( null ) }
          size="small"
        >
          <div className={styles.modalContent}>
            <p className={styles.modalDescription}>
              ¿Confirmás que querés dar de baja la suscripción a <strong>{ cancelTarget.subscription.name }</strong>? Esta acción la marcará como cancelada y no propondrá más cobros en el futuro. No se registrará ningún asiento contable para este período.
            </p>

            <div className={styles.modalActions}>
              <Button
                variant="outline"
                onClick={ () => setCancelTarget( null ) }
              >
                Volver
              </Button>
              <Button
                variant="danger"
                isLoading={isPending}
                onClick={handleCancelSubmit}
              >
                Confirmar baja
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  ) ;
}
