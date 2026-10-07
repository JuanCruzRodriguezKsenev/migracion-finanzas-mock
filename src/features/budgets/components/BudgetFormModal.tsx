/**
 * @file BudgetFormModal.tsx
 * Modal de alta y edición de presupuestos (RFC 028 §5).
 * Alta: categoría + límite + divisa. Edición: sólo el límite; categoría y divisa quedan en sólo lectura.
 * El texto del límite se convierte a centavos enteros en un único punto (`limiteACentavos`).
 */
"use client" ;

// Librerías externas
import React , { useRef , useState , useTransition } from "react" ;

// Shared
import type { getDictionary } from "@/shared/lib/dictionary" ;
import { FormSelect }         from "@/shared/ui/forms/Form/FormSelect" ;
import { FormInput }          from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }          from "@/shared/ui/forms/Form/FormError" ;
import { Button }             from "@/shared/ui/display/Button/Button" ;
import { Modal }              from "@/shared/ui/feedback/Modal/Modal" ;

// Feature: Accounting
import type { CategoryTreeNode } from "@/features/accounting/types" ;

// Feature: Budgets
import { createBudgetAction , updateBudgetLimitAction } from "../actions/budgetsActions" ;
import { limiteACentavos , centavosALimite }            from "../utils/limite" ;
import { BudgetCategoryOptions }                        from "./BudgetCategoryOptions" ;
import type { PresupuestoEvaluado }                     from "../types" ;
import styles                                           from "./Budgets.module.css" ;


export interface BudgetFormModalProps {
  isOpen:       boolean ;
  onClose:      () => void ;
  /** Presupuesto a editar; sin él, el modal es de alta. */
  presupuesto?: PresupuestoEvaluado ;
  categoryTree: CategoryTreeNode[] ;
  /** Ids con presupuesto vigente en `currency` (la divisa de la vista). */
  ocupados:     ReadonlySet< string > ;
  /** Divisa de la vista: valor inicial del alta. */
  currency:     string ;
  divisas:      string[] ;
  dict:         Awaited< ReturnType< typeof getDictionary > > ;
  onSuccess:    () => void ;
}

const SIN_OCUPADOS: ReadonlySet< string > = new Set< string >() ;

/**
 * Modal de alta o edición de un presupuesto.
 */
export function BudgetFormModal( {
  isOpen ,
  onClose ,
  presupuesto ,
  categoryTree ,
  ocupados ,
  currency ,
  divisas ,
  dict ,
  onSuccess
}: BudgetFormModalProps ) {
  const d          = dict.budgetsPage.form ;
  const esEdicion  = !!presupuesto ;
  const limiteRef  = useRef< HTMLInputElement >( null ) ;

  const [ categoryId , setCategoryId ]         = useState< string >( "" ) ;
  const [ divisa , setDivisa ]                 = useState< string >( presupuesto?.currency ?? currency ) ;
  const [ limite , setLimite ]                 = useState< string >( presupuesto ? centavosALimite( presupuesto.limite , presupuesto.currency ) : "" ) ;
  const [ errorCategoria , setErrorCategoria ] = useState< string >( "" ) ;
  const [ errorLimite , setErrorLimite ]       = useState< string >( "" ) ;
  const [ errorServidor , setErrorServidor ]   = useState< string >( "" ) ;
  const [ isPending , startTransition ]        = useTransition() ;

  // Los ocupados que conoce la vista valen para su divisa; en otra, el servidor rechaza el duplicado.
  const ocupadosDeLaDivisa = ( divisa === currency ) ? ocupados : SIN_OCUPADOS ;

  const handleSubmit = ( e: React.FormEvent ) => {
    e.preventDefault() ;
    setErrorCategoria( "" ) ;
    setErrorLimite( "" ) ;
    setErrorServidor( "" ) ;

    if( !esEdicion && !categoryId ) {
      setErrorCategoria( d.categoryRequired ) ;
      return ;
    }

    const parsed = limiteACentavos( limite , divisa ) ;
    if( !parsed.ok ) {
      setErrorLimite( parsed.motivo === "no_positivo" ? d.limitPositive : d.limitInvalid ) ;
      limiteRef.current?.focus() ;
      return ;
    }

    startTransition( async () => {
      const res = esEdicion
        ? await updateBudgetLimitAction( { budgetId: presupuesto!.budgetId , amount: parsed.centavos } )
        : await createBudgetAction( { categoryId , currency: divisa , amount: parsed.centavos } ) ;

      if( res.success ) {
        onSuccess() ;
      } else {
        setErrorServidor( res.error ) ;
      }
    } ) ;
  } ;

  return(
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ esEdicion ? d.editTitle : d.createTitle }
      size="small"
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        { esEdicion ? (
          <>
            <FormInput label={d.categoryLabel} value={presupuesto!.categoryName} disabled readOnly />
            <FormInput label={d.currencyLabel} value={presupuesto!.currency} disabled readOnly />
          </>
        ) : (
          <>
            <FormSelect
              label={d.categoryLabel}
              value={categoryId}
              error={errorCategoria}
              onChange={ ( e ) => setCategoryId( e.target.value ) }
            >
              <option value="">{ d.categoryPlaceholder }</option>
              <BudgetCategoryOptions
                tree={categoryTree}
                ocupados={ocupadosDeLaDivisa}
                wholeParentTpl={d.wholeParent}
              />
            </FormSelect>

            <FormSelect
              label={d.currencyLabel}
              value={divisa}
              onChange={ ( e ) => {
                setDivisa( e.target.value ) ;
                setCategoryId( "" ) ;
              } }
            >
              { divisas.map( ( c ) => { return( <option key={c} value={c}>{ c }</option> ) ; } ) }
            </FormSelect>
          </>
        ) }

        <FormInput
          ref={limiteRef}
          label={d.limitLabel}
          type="text"
          inputMode="decimal"
          value={limite}
          error={errorLimite}
          helperText={d.limitHelper}
          onChange={ ( e ) => setLimite( e.target.value ) }
        />

        { errorServidor ? <FormError error={errorServidor} /> : null }

        <div className={styles.modalFooter}>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            { d.cancel }
          </Button>
          <Button type="submit" variant="primary" isLoading={isPending}>
            { d.save }
          </Button>
        </div>
      </form>
    </Modal>
  ) ;
}
