/**
 * @file LoanFormModal.tsx
 * Modal para el alta de préstamos tomados y otorgados (RFC 008).
 * Convierte montos y tasas en el borde y proyecta la cuota estimada en tiempo real.
 */
"use client" ;

// Librerías externas
import React , { useState , useTransition } from "react" ;

// Shared
import { formatCurrency }   from "@/shared/lib/currencyFormatter" ;
import type { getDictionary } from "@/shared/lib/dictionary" ;
import { FormSelect }       from "@/shared/ui/forms/Form/FormSelect" ;
import { FormInput }        from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }        from "@/shared/ui/forms/Form/FormError" ;
import { Button }           from "@/shared/ui/display/Button/Button" ;
import { Modal }            from "@/shared/ui/feedback/Modal/Modal" ;
import styles               from "./Loans.module.css" ;

// Feature: Accounting
import type { Account , FinancialEntity } from "@/features/accounting/types" ;

// Feature: Contacts
import type { Contact } from "@/features/contacts/types" ;

// Feature: Loans
import type { CreateLoanInput } from "../schemas/loans.schema" ;
import { cuotaFrancesa }        from "../services/amortizacion" ;
import { createLoanAction }     from "../actions/loansActions" ;
import type { LoanFrequency }   from "../types" ;


export interface LoanFormModalProps {
  isOpen:            boolean ;
  onClose:           () => void ;
  financialEntities: FinancialEntity[] ;
  contacts:          Contact[] ;
  accounts:          Account[] ;
  dict:              Awaited< ReturnType< typeof getDictionary > > ;
  locale?:           string ;
  onSuccess:         () => void ;
}

/**
 * Componente modal para crear un nuevo préstamo.
 */
export function LoanFormModal( {
  isOpen ,
  onClose ,
  financialEntities ,
  contacts ,
  accounts ,
  dict ,
  locale = "es-AR" ,
  onSuccess
}: LoanFormModalProps ) {
  const todayStr = new Date().toISOString().slice( 0 , 10 ) ;

  const [ direction , setDirection ]                             = useState< "borrowed" | "lent" >( "borrowed" ) ;
  const [ counterpartyType , setCounterpartyType ]               = useState< "entity" | "contact" >( "entity" ) ;
  const [ entityId , setEntityId ]                               = useState< string >( financialEntities[ 0 ]?.id || "" ) ;
  const [ contactId , setContactId ]                             = useState< string >( contacts[ 0 ]?.id || "" ) ;
  const [ name , setName ]                                       = useState< string >( "" ) ;
  const [ principalAmount , setPrincipalAmount ]                 = useState< string >( "" ) ;
  const [ currency , setCurrency ]                               = useState< string >( "ARS" ) ;
  const [ rateAnnual , setRateAnnual ]                           = useState< string >( "0" ) ;
  const [ totalInstallments , setTotalInstallments ]             = useState< string >( "12" ) ;
  const [ frequency , setFrequency ]                             = useState< LoanFrequency >( "monthly" ) ;
  const [ startDateStr , setStartDateStr ]                       = useState< string >( todayStr ) ;
  const [ firstInstallmentDateStr , setFirstInstallmentDateStr ] = useState< string >( todayStr ) ;
  const [ primeraCuotaTocada , setPrimeraCuotaTocada ]           = useState< boolean >( false ) ;
  const [ disbursementAccountId , setDisbursementAccountId ]     = useState< string >( "" ) ;

  const [ error , setError ]             = useState< string | null >( null ) ;
  const [ isPending , startTransition ] = useTransition() ;

  // Cuentas de activo elegibles para desembolso con la divisa elegida
  const eligibleDisbursementAccounts = accounts.filter(
    ( a ) => ( a.type === "asset" ) && ( a.currency === currency )
  ) ;

  const handleStartDateChange = ( e: React.ChangeEvent< HTMLInputElement > ) => {
    const newVal = e.target.value ;
    setStartDateStr( newVal ) ;
    if( !primeraCuotaTocada ) {
      setFirstInstallmentDateStr( newVal ) ;
    }
  } ;

  const handleFirstInstallmentChange = ( e: React.ChangeEvent< HTMLInputElement > ) => {
    setPrimeraCuotaTocada( true ) ;
    setFirstInstallmentDateStr( e.target.value ) ;
  } ;

  // Cálculo de cuota estimada
  const principalCents = Math.round( ( Number( principalAmount ) || 0 ) * 100 ) ;
  const rateBps        = Math.round( ( Number( rateAnnual ) || 0 ) * 100 ) ;
  const installments   = ( Number( totalInstallments ) || 1 ) ;
  const estimatedCuotaCents = (
    ( principalCents > 0 ) && ( installments > 0 )
      ? cuotaFrancesa( principalCents , rateBps , installments , frequency , 1 )
      : 0
  ) ;

  const handleSubmit = ( e: React.FormEvent ) => {
    e.preventDefault() ;
    setError( null ) ;

    if( !name.trim() ) {
      setError( "El nombre es obligatorio." ) ;
      return ;
    }

    const pCents = Math.round( Number( principalAmount ) * 100 ) ;
    if( !pCents || ( pCents <= 0 ) ) {
      setError( "El capital debe ser mayor a 0." ) ;
      return ;
    }

    if( ( counterpartyType === "entity" ) && !entityId ) {
      setError( "Debe seleccionar una entidad financiera." ) ;
      return ;
    }

    if( ( counterpartyType === "contact" ) && !contactId ) {
      setError( "Debe seleccionar un contacto." ) ;
      return ;
    }

    const [ y , m , d ] = startDateStr.split( "-" ).map( Number ) ;
    const startDate     = new Date( Date.UTC( y , ( m - 1 ) , d , 12 , 0 , 0 ) ) ;

    const payload: CreateLoanInput = {
      name:                  name.trim() ,
      direction ,
      entityId:              ( counterpartyType === "entity" ? ( entityId || null ) : null ) ,
      contactId:             ( counterpartyType === "contact" ? ( contactId || null ) : null ) ,
      principalAmount:       pCents ,
      currency ,
      interestRateAnnual:    Math.round( ( Number( rateAnnual ) || 0 ) * 100 ) ,
      totalInstallments:     Math.max( 1 , Math.round( Number( totalInstallments ) || 1 ) ) ,
      frequency ,
      intervalCount:         1 ,
      startDate ,
      firstInstallmentDate:  firstInstallmentDateStr ,
      disbursementAccountId: ( disbursementAccountId || null )
    } ;

    startTransition( async () => {
      const res = await createLoanAction( payload ) ;
      if( res.success ) {
        onSuccess() ;
      } else {
        setError( res.error ) ;
      }
    } ) ;
  } ;

  return(
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={dict.loansPage.newLoan}
      size="medium"
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGrid}>
          {/* Dirección */}
          <FormSelect
            label={dict.loansPage.form.directionLabel}
            value={direction}
            onChange={ ( e ) => setDirection( e.target.value as "borrowed" | "lent" ) }
          >
            <option value="borrowed">{dict.loansPage.form.directionBorrowed}</option>
            <option value="lent">{dict.loansPage.form.directionLent}</option>
          </FormSelect>

          {/* Tipo de contraparte */}
          <FormSelect
            label={dict.loansPage.form.counterpartyLabel}
            value={counterpartyType}
            onChange={ ( e ) => setCounterpartyType( e.target.value as "entity" | "contact" ) }
          >
            <option value="entity">{dict.loansPage.form.counterpartyEntity}</option>
            <option value="contact">{dict.loansPage.form.counterpartyContact}</option>
          </FormSelect>

          {/* Selector de contraparte condicional */}
          <div className={styles.formGroupFull}>
            { counterpartyType === "entity" ? (
              <FormSelect
                label={dict.loansPage.form.counterpartyEntity}
                value={entityId}
                onChange={ ( e ) => setEntityId( e.target.value ) }
              >
                {financialEntities.map( ( ent ) => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ) )}
              </FormSelect>
            ) : (
              <FormSelect
                label={dict.loansPage.form.counterpartyContact}
                value={contactId}
                onChange={ ( e ) => setContactId( e.target.value ) }
              >
                {contacts.map( ( ct ) => (
                  <option key={ct.id} value={ct.id}>{ct.name}</option>
                ) )}
              </FormSelect>
            ) }
          </div>

          {/* Nombre / Descripción */}
          <div className={styles.formGroupFull}>
            <FormInput
              label={dict.loansPage.form.nameLabel}
              value={name}
              onChange={ ( e ) => setName( e.target.value ) }
              maxLength={150}
              required
            />
          </div>

          {/* Capital */}
          <FormInput
            label={dict.loansPage.form.principalLabel}
            type="number"
            step="0.01"
            value={principalAmount}
            onChange={ ( e ) => setPrincipalAmount( e.target.value ) }
            required
          />

          {/* Divisa */}
          <FormSelect
            label={dict.loansPage.form.currencyLabel}
            value={currency}
            onChange={ ( e ) => {
              setCurrency( e.target.value ) ;
              setDisbursementAccountId( "" ) ;
            } }
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </FormSelect>

          {/* TNA (%) */}
          <FormInput
            label={dict.loansPage.form.rateLabel}
            type="number"
            step="0.01"
            value={rateAnnual}
            onChange={ ( e ) => setRateAnnual( e.target.value ) }
            helperText={dict.loansPage.form.rateHelper}
          />

          {/* Cuotas */}
          <FormInput
            label={dict.loansPage.form.installmentsLabel}
            type="number"
            min="1"
            step="1"
            value={totalInstallments}
            onChange={ ( e ) => setTotalInstallments( e.target.value ) }
            required
          />

          {/* Frecuencia */}
          <FormSelect
            label={dict.loansPage.form.frequencyLabel}
            value={frequency}
            onChange={ ( e ) => setFrequency( e.target.value as LoanFrequency ) }
          >
            <option value="monthly">{dict.loansPage.form.frequencyMonthly}</option>
            <option value="weekly">{dict.loansPage.form.frequencyWeekly}</option>
            <option value="quarterly">{dict.loansPage.form.frequencyQuarterly}</option>
            <option value="yearly">{dict.loansPage.form.frequencyYearly}</option>
          </FormSelect>

          {/* Fecha de desembolso */}
          <div className={styles.formGroup}>
            <label className={styles.label}>{dict.loansPage.form.startDateLabel}</label>
            <input
              type="date"
              className={styles.inputDate}
              value={startDateStr}
              onChange={handleStartDateChange}
              required
            />
          </div>

          {/* Primera cuota */}
          <div className={styles.formGroup}>
            <label className={styles.label}>{dict.loansPage.form.firstInstallmentLabel}</label>
            <input
              type="date"
              className={styles.inputDate}
              value={firstInstallmentDateStr}
              onChange={handleFirstInstallmentChange}
              required
            />
            <span className={styles.helperText}>{dict.loansPage.form.firstInstallmentHelper}</span>
          </div>

          {/* Cuenta de desembolso */}
          <div className={styles.formGroupFull}>
            <FormSelect
              label={dict.loansPage.form.disbursementLabel}
              value={disbursementAccountId}
              onChange={ ( e ) => setDisbursementAccountId( e.target.value ) }
              helperText={dict.loansPage.form.disbursementHelper}
            >
              <option value="">{dict.loansPage.form.disbursementNone}</option>
              {eligibleDisbursementAccounts.map( ( acc ) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.code}) - {formatCurrency( acc.balance , acc.currency , locale )}
                </option>
              ) )}
            </FormSelect>
          </div>
        </div>

        {/* Cuota estimada */}
        <div className={styles.estimatedBox}>
          <span className={styles.estimatedLabel}>{dict.loansPage.form.estimatedInstallment}</span>
          <span className={styles.estimatedValue}>
            {formatCurrency( estimatedCuotaCents , currency , locale )}
          </span>
        </div>

        { error ? <FormError error={error} /> : null }

        <div className={styles.modalFooter}>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            {dict.loansPage.form.cancel}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isPending}
          >
            {dict.loansPage.form.submit}
          </Button>
        </div>
      </form>
    </Modal>
  ) ;
}
