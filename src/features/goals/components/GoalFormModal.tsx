/**
 * @file GoalFormModal.tsx
 * Modal de alta y edición de metas. En edición la divisa va en sólo lectura (RN-1).
 * Las validaciones de campo se muestran junto al campo; los rechazos del servidor, en `FormError`.
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
import { createGoalAction , updateGoalAction } from "../actions/goalsActions" ;
import type { GoalsPageDict }                  from "./goalsDict" ;
import { parseAmountToCents , centsToInput }   from "../utils/goalAmount" ;
import type { Goal , GoalPriority }            from "../types" ;
import styles                                  from "./Goals.module.css" ;


export interface GoalFormModalProps {
  isOpen:          boolean ;
  onClose:         () => void ;
  /** Meta a editar; sin ella el modal es de alta. */
  goal?:           Goal ;
  currencies:      string[] ;
  defaultCurrency: string ;
  dict:            GoalsPageDict ;
  onSuccess:       () => void ;
}

interface FieldErrors {
  name?:   string ;
  target?: string ;
  date?:   string ;
}

/** `YYYY-MM-DD` que existe en el calendario. */
function esFechaCivilValida( v: string ): boolean {
  if( !/^\d{4}-\d{2}-\d{2}$/.test( v ) ) {
    return( false ) ;
  }
  const d = new Date( `${v}T00:00:00Z` ) ;
  return( !isNaN( d.getTime() ) && (d.toISOString().slice( 0 , 10 ) === v) ) ;
}

/**
 * Formulario de meta (alta o edición).
 */
export function GoalFormModal( { isOpen , onClose , goal , currencies , defaultCurrency , dict , onSuccess }: GoalFormModalProps ) {
  const esEdicion = !!goal ;
  const opciones  = ( currencies.length > 0 ? currencies : [ defaultCurrency ] ) ;

  const [ name , setName ]         = useState< string >( goal?.name ?? "" ) ;
  const [ currency , setCurrency ] = useState< string >( goal?.currency ?? defaultCurrency ) ;
  const [ target , setTarget ]     = useState< string >( goal ? centsToInput( goal.targetAmount , goal.currency ) : "" ) ;
  const [ date , setDate ]         = useState< string >( goal?.targetDate ?? "" ) ;
  const [ priority , setPriority ] = useState< GoalPriority >( ( goal?.priority as GoalPriority ) ?? "normal" ) ;

  const [ errors , setErrors ]          = useState< FieldErrors >( {} ) ;
  const [ error , setError ]            = useState< string >( "" ) ;
  const [ isPending , startTransition ] = useTransition() ;

  const handleSubmit = ( e: React.FormEvent ) => {
    e.preventDefault() ;
    setError( "" ) ;

    const next: FieldErrors = {} ;
    const trimmed           = name.trim() ;
    if( !trimmed ) {
      next.name = dict.nameRequired ;
    } else if( trimmed.length > 150 ) {
      next.name = dict.nameTooLong ;
    }

    const cents = parseAmountToCents( target , currency ) ;
    if( !cents || (cents <= 0) ) {
      next.target = dict.targetInvalid ;
    }

    if( date && !esFechaCivilValida( date ) ) {
      next.date = dict.dateInvalid ;
    }

    setErrors( next ) ;
    if( next.name || next.target || next.date ) {
      return ;
    }

    startTransition( async () => {
      const common = { name: trimmed , targetAmount: cents as number , targetDate: ( date || null ) , priority } ;
      const res    = await ( goal
        ? updateGoalAction( { goalId: goal.id , ...common } )
        : createGoalAction( { currency , ...common } ) ) ;
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
      title={ esEdicion ? dict.editTitle : dict.createTitle }
      size="small"
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <FormInput
          label={dict.nameLabel}
          value={name}
          onChange={ ( e ) => setName( e.target.value ) }
          error={errors.name}
          required
        />

        <FormSelect
          label={dict.currencyFieldLabel}
          value={currency}
          onChange={ ( e ) => setCurrency( e.target.value ) }
          disabled={esEdicion}
          helperText={ esEdicion ? dict.currencyReadOnly : undefined }
        >
          { opciones.map( ( c ) => (
            <option key={c} value={c}>{ c }</option>
          ) ) }
        </FormSelect>

        <FormInput
          label={ `${dict.targetLabel} (${currency})` }
          type="text"
          inputMode="decimal"
          value={target}
          onChange={ ( e ) => setTarget( e.target.value ) }
          error={errors.target}
          required
        />

        <FormInput
          label={dict.dateLabel}
          type="date"
          value={date}
          onChange={ ( e ) => setDate( e.target.value ) }
          error={errors.date}
        />

        <FormSelect
          label={dict.priorityLabel}
          value={priority}
          onChange={ ( e ) => setPriority( e.target.value as GoalPriority ) }
        >
          <option value="normal">{ dict.priorityNormal }</option>
          <option value="high">{ dict.priorityHigh }</option>
        </FormSelect>

        { error ? <FormError error={error} /> : null }

        <div className={styles.modalFooter}>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            { dict.cancel }
          </Button>
          <Button type="submit" variant="primary" isLoading={isPending}>
            { esEdicion ? dict.submitSave : dict.submitCreate }
          </Button>
        </div>
      </form>
    </Modal>
  ) ;
}
