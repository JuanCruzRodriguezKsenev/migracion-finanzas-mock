/**
 * @file ContributeModal.tsx
 * Modal de aporte y retiro de una meta (un solo componente con `mode`).
 * Aportar: cuentas compatibles con su saldo libre. Retirar: sólo cuentas donde la meta tiene algo apartado.
 * El monto se convierte a centavos en un único punto (`parseAmountToCents`).
 */
"use client" ;

// Librerías externas
import React , { useState , useTransition } from "react" ;

// Shared
import { FormSelect } from "@/shared/ui/forms/Form/FormSelect" ;
import { FormInput }  from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }  from "@/shared/ui/forms/Form/FormError" ;
import { Button }     from "@/shared/ui/display/Button/Button" ;
import { Modal }      from "@/shared/ui/feedback/Modal/Modal" ;

// Feature: Goals
import { contributeToGoalAction , withdrawFromGoalAction } from "../actions/goalsActions" ;
import { fmt , useGoalMoney }                              from "./goalsDict" ;
import type { GoalsPageDict }                              from "./goalsDict" ;
import type { GoalCompatibleAccount , GoalView }           from "../types" ;
import { parseAmountToCents }                              from "../utils/goalAmount" ;
import styles                                              from "./Goals.module.css" ;


export interface ContributeModalProps {
  isOpen:    boolean ;
  onClose:   () => void ;
  mode:      "contribute" | "withdraw" ;
  view:      GoalView ;
  cuentas:   GoalCompatibleAccount[] ;
  dict:      GoalsPageDict ;
  locale:    string ;
  onSuccess: () => void ;
}

/**
 * Aporta a una meta o retira de ella. Los rechazos del servidor se muestran en `FormError`.
 */
export function ContributeModal( { isOpen , onClose , mode , view , cuentas , dict , locale , onSuccess }: ContributeModalProps ) {
  const money      = useGoalMoney( locale ) ;
  const esAporte   = ( mode === "contribute" ) ;
  const currency   = view.goal.currency ;

  // Opciones: aportar → cuentas compatibles (libre); retirar → cuentas con lo apartado por esta meta
  const opciones = esAporte
    ? cuentas.map( ( c ) => { return( { id: c.id , text: fmt( dict.accountFree , { name: c.name , amount: money( c.libre , c.currency ) } ) } ) ; } )
    : view.reservas.map( ( r ) => { return( { id: r.accountId , text: fmt( dict.accountReserved , { name: r.accountName , amount: money( r.amount , currency ) } ) } ) ; } ) ;

  const [ accountId , setAccountId ]     = useState< string >( opciones[ 0 ]?.id ?? "" ) ;
  const [ amountText , setAmountText ]   = useState< string >( "" ) ;
  const [ amountError , setAmountError ] = useState< string >( "" ) ;
  const [ accountError , setAccountError ] = useState< string >( "" ) ;
  const [ error , setError ]             = useState< string >( "" ) ;
  const [ isPending , startTransition ]  = useTransition() ;

  const sinOpciones = ( opciones.length === 0 ) ;

  const handleSubmit = ( e: React.FormEvent ) => {
    e.preventDefault() ;
    setError( "" ) ;
    setAmountError( "" ) ;
    setAccountError( "" ) ;

    if( !accountId ) {
      setAccountError( dict.accountRequired ) ;
      return ;
    }

    const cents = parseAmountToCents( amountText , currency ) ;
    if( !cents || (cents <= 0) ) {
      setAmountError( dict.amountInvalid ) ;
      return ;
    }

    startTransition( async () => {
      const payload = { goalId: view.goal.id , accountId , amount: cents } ;
      const res     = await ( esAporte ? contributeToGoalAction( payload ) : withdrawFromGoalAction( payload ) ) ;
      if( res.success ) {
        onSuccess() ;
      } else {
        setError( res.error || dict.genericError ) ;
      }
    } ) ;
  } ;

  return(
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ fmt( esAporte ? dict.contributeTitle : dict.withdrawTitle , { name: view.goal.name } ) }
      size="small"
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        { sinOpciones ? (
          <p className={styles.notice} role="status">
            { esAporte ? dict.noCompatibleAccounts : dict.noReserves }
          </p>
        ) : (
          <>
            <FormSelect
              label={dict.accountLabel}
              value={accountId}
              onChange={ ( e ) => setAccountId( e.target.value ) }
              error={accountError}
            >
              { opciones.map( ( o ) => (
                <option key={o.id} value={o.id}>{ o.text }</option>
              ) ) }
            </FormSelect>

            <FormInput
              label={ fmt( dict.amountLabel , { currency } ) }
              type="text"
              inputMode="decimal"
              value={amountText}
              onChange={ ( e ) => setAmountText( e.target.value ) }
              error={amountError}
            />
          </>
        ) }

        { error ? <FormError error={error} /> : null }

        <div className={styles.modalFooter}>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            { dict.cancel }
          </Button>
          <Button type="submit" variant="primary" isLoading={isPending} disabled={sinOpciones}>
            { esAporte ? dict.submitContribute : dict.submitWithdraw }
          </Button>
        </div>
      </form>
    </Modal>
  ) ;
}
