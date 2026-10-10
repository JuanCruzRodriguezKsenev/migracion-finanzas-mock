/**
 * @file CardFormModal.tsx
 * Modal para el registro de tarjetas de crédito y débito (RFC 007).
 * Realiza la conversión a centavos en el borde antes de despachar a Server Actions.
 */
"use client" ;

// Librerías externas
import React , { useState , useTransition } from "react" ;

import { nuevaClaveDeEnvio } from "@/shared/lib/claveIdempotencia" ;
// Shared
import { Button } from "@/shared/ui/display/Button/Button" ;
import { Modal }  from "@/shared/ui/feedback/Modal/Modal" ;

// Feature: Accounting
import { Account , FinancialEntity } from "@/features/accounting/types" ;

// Feature: Cards
import { createCardAction } from "../actions/cardsActions" ;
import { Card }             from "../types" ;
import styles               from "./Cards.module.css" ;


interface CardFormModalProps {
  isOpen:            boolean ;
  onClose:           () => void ;
  financialEntities: FinancialEntity[] ;
  accounts:          Account[] ;
  onSuccess:         ( nueva: Card ) => void ;
}

export function CardFormModal( {
  isOpen ,
  onClose ,
  financialEntities ,
  accounts ,
  onSuccess ,
}: CardFormModalProps ) {
  const currentYear = new Date().getFullYear() ;

  const [ type , setType ]                                   = useState< "credit" | "debit" >( "credit" ) ;
  const [ label , setLabel ]                                 = useState( "" ) ;
  const [ network , setNetwork ]                             = useState< "visa" | "mastercard" | "amex" | "other" >( "visa" ) ;
  const [ entityId , setEntityId ]                           = useState( "" ) ;
  const [ linkedAccountId , setLinkedAccountId ]             = useState( "" ) ;
  const [ lastFour , setLastFour ]                           = useState( "" ) ;
  const [ expiryMonth , setExpiryMonth ]                     = useState( "12" ) ;
  const [ expiryYear , setExpiryYear ]                       = useState( String( currentYear + 3 ) ) ;
  const [ currency , setCurrency ]                           = useState( "ARS" ) ;
  const [ creditLimit , setCreditLimit ]                     = useState( "" ) ;
  const [ closingDay , setClosingDay ]                       = useState( "25" ) ;
  const [ dueDay , setDueDay ]                               = useState( "5" ) ;
  const [ interestRateFinancing , setInterestRateFinancing ] = useState( "" ) ;
  const [ monthlyMaintenanceFee , setMonthlyMaintenanceFee ] = useState( "" ) ;
  const [ annualRenewalFee , setAnnualRenewalFee ]           = useState( "" ) ;
  const [ deudaInicial , setDeudaInicial ]                   = useState( "" ) ;

  const [ error , setError ]             = useState< string | null >( null ) ;
  const [ claveDeEnvio , setClaveDeEnvio ] = useState( nuevaClaveDeEnvio ) ;
  const [ isPending , startTransition ] = useTransition() ;

  const handleSubmit = ( e: React.FormEvent ) => {
    e.preventDefault() ;
    setError( null ) ;

    startTransition( async () => {
      // Conversión rigurosa de importes en el borde hacia enteros (centavos o puntos básicos)
      const payload = {
        label:                 label.trim() ,
        type ,
        network ,
        entityId:              entityId ? entityId : null ,
        linkedAccountId:       linkedAccountId ? linkedAccountId : null ,
        lastFour:              lastFour.trim() ,
        expiryMonth:           Number( expiryMonth ) ,
        expiryYear:            Number( expiryYear ) ,
        currency ,
        creditLimit:           ( (type === "credit") && creditLimit ) ? Math.round( Number( creditLimit ) * 100 ) : null ,
        closingDay:            ( (type === "credit") && closingDay ) ? Number( closingDay ) : null ,
        dueDay:                ( (type === "credit") && dueDay ) ? Number( dueDay ) : null ,
        interestRateFinancing: ( (type === "credit") && interestRateFinancing ) ? Math.round( Number( interestRateFinancing ) * 100 ) : null ,
        monthlyMaintenanceFee: ( (type === "credit") && monthlyMaintenanceFee ) ? Math.round( Number( monthlyMaintenanceFee ) * 100 ) : 0 ,
        annualRenewalFee:      ( (type === "credit") && annualRenewalFee ) ? Math.round( Number( annualRenewalFee ) * 100 ) : 0 ,
        deudaInicial:          ( (type === "credit") && deudaInicial ) ? Math.round( Number( deudaInicial ) * 100 ) : 0 ,
      } ;

      const res = await createCardAction( payload , claveDeEnvio ) ;

      if( !res.success ) {
        setError( res.error ) ;
        return ;
      }

      setClaveDeEnvio( nuevaClaveDeEnvio() ) ;
      onSuccess( res.value ) ;
      onClose() ;
    } ) ;
  } ;

  return(
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva Tarjeta"
      subtitle="Registrá un plástico de crédito o débito"
      size="medium"
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        { error ? <div className={styles.errorBanner}>{ error }</div> : null }

        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Tipo de Instrumento</label>
            <select
              className={styles.select}
              value={type}
              onChange={ ( e ) => setType( e.target.value as "credit" | "debit" ) }
            >
              <option value="credit">Crédito</option>
              <option value="debit">Débito</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Red Emisora</label>
            <select
              className={styles.select}
              value={network}
              onChange={ ( e ) => setNetwork( e.target.value as "visa" | "mastercard" | "amex" | "other" ) }
            >
              <option value="visa">Visa</option>
              <option value="mastercard">Mastercard</option>
              <option value="amex">American Express</option>
              <option value="other">Otra</option>
            </select>
          </div>

          <div className={styles.formGroupFull}>
            <label className={styles.label}>Nombre de la Tarjeta</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Ej: Visa Black Galicia"
              value={label}
              onChange={ ( e ) => setLabel( e.target.value ) }
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Entidad Financiera</label>
            <select
              className={styles.select}
              value={entityId}
              onChange={ ( e ) => setEntityId( e.target.value ) }
            >
              <option value="">(Ninguna)</option>
              { financialEntities.map( ( fe ) => (
                <option key={fe.id} value={fe.id}>
                  { fe.name }
                </option>
              ) ) }
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              { type === "debit" ? "Cuenta a Espejar" : "Cuenta de Débito (Opcional)" }
            </label>
            <select
              className={styles.select}
              value={linkedAccountId}
              onChange={ ( e ) => setLinkedAccountId( e.target.value ) }
            >
              <option value="">(Ninguna)</option>
              { accounts.map( ( a ) => (
                <option key={a.id} value={a.id}>
                  { a.name } ({ a.code })
                </option>
              ) ) }
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Últimos 4 Dígitos</label>
            <input
              type="text"
              className={styles.input}
              placeholder="1234"
              maxLength={4}
              pattern="\d{4}"
              value={lastFour}
              onChange={ ( e ) => setLastFour( e.target.value.replace( /\D/g , "" ) ) }
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Vencimiento (MM/AAAA)</label>
            <div style={ { display: "flex" , gap: "0.4rem" } }>
              <input
                type="number"
                className={styles.input}
                placeholder="MM"
                min={1}
                max={12}
                value={expiryMonth}
                onChange={ ( e ) => setExpiryMonth( e.target.value ) }
                required
              />
              <input
                type="number"
                className={styles.input}
                placeholder="AAAA"
                min={currentYear}
                max={currentYear + 20}
                value={expiryYear}
                onChange={ ( e ) => setExpiryYear( e.target.value ) }
                required
              />
            </div>
          </div>

          { type === "credit" ? (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>Moneda</label>
                <select
                  className={styles.select}
                  value={currency}
                  onChange={ ( e ) => setCurrency( e.target.value ) }
                >
                  <option value="ARS">ARS ($)</option>
                  <option value="USD">USD (u$s)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Límite de Crédito</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className={styles.input}
                  placeholder="0.00"
                  value={creditLimit}
                  onChange={ ( e ) => setCreditLimit( e.target.value ) }
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Día de Cierre (1-31)</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className={styles.input}
                  value={closingDay}
                  onChange={ ( e ) => setClosingDay( e.target.value ) }
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Día de Vencimiento (1-31)</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className={styles.input}
                  value={dueDay}
                  onChange={ ( e ) => setDueDay( e.target.value ) }
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Tasa Nominal Anual (TNA %)</label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  className={styles.input}
                  placeholder="Ej: 85.5"
                  value={interestRateFinancing}
                  onChange={ ( e ) => setInterestRateFinancing( e.target.value ) }
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Deuda Inicial</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className={styles.input}
                  placeholder="0.00"
                  value={deudaInicial}
                  onChange={ ( e ) => setDeudaInicial( e.target.value ) }
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Mantenimiento Mensual</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className={styles.input}
                  placeholder="0.00"
                  value={monthlyMaintenanceFee}
                  onChange={ ( e ) => setMonthlyMaintenanceFee( e.target.value ) }
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Renovación Anual</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className={styles.input}
                  placeholder="0.00"
                  value={annualRenewalFee}
                  onChange={ ( e ) => setAnnualRenewalFee( e.target.value ) }
                />
              </div>
            </>
          ) : null }
        </div>

        <div className={styles.modalFooter}>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={isPending}>
            { isPending ? "Guardando..." : "Guardar Tarjeta" }
          </Button>
        </div>
      </form>
    </Modal>
  ) ;
}
