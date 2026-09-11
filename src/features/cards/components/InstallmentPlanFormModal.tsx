/**
 * @file InstallmentPlanFormModal.tsx
 * Modal de alta para compras financiadas en cuotas con tarjeta de crédito (RFC 025).
 * El alta se asocia automáticamente a la tarjeta contextual sin selector de instrumento.
 * Incluye cálculo y propuesta no restrictiva de la primera cuota según día de cierre y zona horaria.
 */
"use client" ;

// Librerías externas
import React , { useState , useTransition } from "react" ;

// Shared
import { FormSelect }         from "@/shared/ui/forms/Form/FormSelect" ;
import { FormInput }          from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }          from "@/shared/ui/forms/Form/FormError" ;
import { Button }             from "@/shared/ui/display/Button/Button" ;
import { Modal }              from "@/shared/ui/feedback/Modal/Modal" ;
import { formatCurrency }     from "@/shared/lib/currencyFormatter" ;
import type { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Profile
import { useProfileContext } from "@/features/profile/context/ProfileContext" ;

// Feature: Accounting
import { iconoDeCategoria }  from "@/features/accounting/utils/categoryIcons" ;
import { CategoryTreeNode }  from "@/features/accounting/types" ;

// Feature: Cards
import { createInstallmentPlanAction } from "../actions/installmentPlansActions" ;
import styles                           from "./InstallmentPlanFormModal.module.css" ;
import { proponerPrimeraCuota }         from "../services/installmentService" ;
import { CardWithAccountsAndEntity }    from "../types" ;


export interface InstallmentPlanFormModalProps {
  card:         CardWithAccountsAndEntity ;
  isOpen:       boolean ;
  onClose:      () => void ;
  categoryTree: CategoryTreeNode[] ;
  dict:         Awaited< ReturnType< typeof getDictionary > > ;
  locale:       string ;
  onSuccess:    () => void ;
}

/**
 * Genera la fecha civil actual YYYY-MM-DD en la zona horaria del usuario.
 */
function formatearHoyCivil( timeZone: string ): string {
  const formateador = new Intl.DateTimeFormat( "en-CA" , {
    timeZone ,
    year:  "numeric" ,
    month: "2-digit" ,
    day:   "2-digit" ,
  } ) ;
  return( formateador.format( new Date() ) ) ;
}

/**
 * Modal de formulario para registrar un nuevo plan de compras en cuotas.
 */
export function InstallmentPlanFormModal( {
  card ,
  isOpen ,
  onClose ,
  categoryTree ,
  dict ,
  locale ,
  onSuccess ,
}: InstallmentPlanFormModalProps ) {
  const { profile } = useProfileContext() ;
  const timeZone    = ( profile.timezone || "America/Argentina/Buenos_Aires" ) ;

  const hoyCivil = formatearHoyCivil( timeZone ) ;

  const [ description , setDescription ]                   = useState( "" ) ;
  const [ merchantName , setMerchantName ]                 = useState( "" ) ;
  const [ categoryId , setCategoryId ]                     = useState( "" ) ;
  const [ currency , setCurrency ]                         = useState( card.accounts[0]?.currency || "ARS" ) ;
  const [ installmentAmount , setInstallmentAmount ]       = useState( "" ) ;
  const [ totalInstallments , setTotalInstallments ]       = useState( "12" ) ;
  const [ purchasedAtInput , setPurchasedAtInput ]         = useState( hoyCivil ) ;
  const [ primeraCuotaEditada , setPrimeraCuotaEditada ]   = useState( false ) ;

  // Inicializar propuesta de primera cuota
  const calcularPropuestaInicial = ( fechaStr: string ): string => {
    const [ y , m , d ]  = fechaStr.split( "-" ).map( Number ) ;
    const purchasedAtUtc = new Date( Date.UTC( y , ( m - 1 ) , d , 12 , 0 , 0 ) ) ;
    return( proponerPrimeraCuota( card.closingDay , card.dueDay , purchasedAtUtc , timeZone ) ) ;
  } ;

  const [ firstInstallmentDate , setFirstInstallmentDate ] = useState< string >( () => (
    calcularPropuestaInicial( hoyCivil )
  ) ) ;

  const [ formError , setFormError ]   = useState< string | null >( null ) ;
  const [ isPending , startTransition ] = useTransition() ;

  // Divisas disponibles (las de la tarjeta + ARS y USD si faltan)
  const divisasDisponibles = Array.from(
    new Set( [
      ...card.accounts.map( ( ca ) => ca.currency ) ,
      "ARS" ,
      "USD" ,
    ] )
  ) ;

  // Recalcular propuesta de primera cuota al cambiar fecha de compra si no fue editada manualmente
  const handlePurchasedAtChange = ( e: React.ChangeEvent< HTMLInputElement > ) => {
    const nuevoValor = e.target.value ;
    setPurchasedAtInput( nuevoValor ) ;

    if( !primeraCuotaEditada && nuevoValor ) {
      const prop = calcularPropuestaInicial( nuevoValor ) ;
      setFirstInstallmentDate( prop ) ;
    }
  } ;

  const handleFirstInstallmentDateChange = ( e: React.ChangeEvent< HTMLInputElement > ) => {
    setPrimeraCuotaEditada( true ) ;
    setFirstInstallmentDate( e.target.value ) ;
  } ;

  // Cálculo no editable del total de la compra (centavos = cuota en centavos * cuotas)
  const importeNum    = Number( installmentAmount ) || 0 ;
  const cuotasNum     = Number( totalInstallments ) || 0 ;
  const totalCentavos = Math.round( importeNum * 100 ) * cuotasNum ;

  const handleSubmit = ( e: React.FormEvent ) => {
    e.preventDefault() ;
    setFormError( null ) ;

    if( !description.trim() ) {
      setFormError( "Ingresá qué compraste." ) ;
      return ;
    }

    const importe = Number( installmentAmount ) ;
    if( isNaN( importe ) || ( importe <= 0 ) ) {
      setFormError( "Ingresá un importe válido mayor a 0 para la cuota." ) ;
      return ;
    }

    const cantidad = Number( totalInstallments ) ;
    if( !Number.isInteger( cantidad ) || ( cantidad <= 0 ) ) {
      setFormError( "Ingresá una cantidad entera de cuotas mayor a 0." ) ;
      return ;
    }

    if( !purchasedAtInput ) {
      setFormError( "Ingresá la fecha de compra." ) ;
      return ;
    }

    if( !firstInstallmentDate ) {
      setFormError( "Ingresá la fecha de la primera cuota." ) ;
      return ;
    }

    const [ y , m , d ]  = purchasedAtInput.split( "-" ).map( Number ) ;
    const purchasedAtUtc = new Date( Date.UTC( y , ( m - 1 ) , d , 12 , 0 , 0 ) ) ;

    startTransition( async () => {
      const res = await createInstallmentPlanAction( {
        cardId:               card.id ,
        description:          description.trim() ,
        merchantName:         ( merchantName.trim() || null ) ,
        categoryId:           ( categoryId || null ) ,
        installmentAmount:    Math.round( importe * 100 ) ,
        totalInstallments:    cantidad ,
        currency ,
        purchasedAt:          purchasedAtUtc ,
        firstInstallmentDate ,
      } ) ;

      if( res.success ) {
        onSuccess() ;
      } else {
        setFormError( res.error ) ;
      }
    } ) ;
  } ;

  return(
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ dict.cardsPage?.installments?.formTitle || "Nueva compra en cuotas" }
      size="medium"
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        { formError ? (
          <FormError error={formError} />
        ) : null }

        <FormInput
          label={ dict.cardsPage?.installments?.descriptionLabel || "Qué compraste" }
          placeholder={ dict.cardsPage?.installments?.descriptionPlaceholder || "Ej: Heladera Samsung" }
          value={description}
          onChange={ ( e ) => setDescription( e.target.value ) }
          required
        />

        <FormInput
          label={ dict.cardsPage?.installments?.merchantLabel || "Comercio" }
          placeholder={ dict.cardsPage?.installments?.merchantPlaceholder || "Ej: Frávega" }
          value={merchantName}
          onChange={ ( e ) => setMerchantName( e.target.value ) }
        />

        <FormSelect
          label={ dict.cardsPage?.installments?.categoryLabel || "Categoría" }
          value={categoryId}
          onChange={ ( e ) => setCategoryId( e.target.value ) }
        >
          <option value="">
            { dict.cardsPage?.installments?.categoryNone || "Sin categoría" }
          </option>
          { categoryTree.map( ( parent ) => {
            const visibleChildren = ( parent.children || [] ).filter( ( c ) => !c.isSystemLeaf ) ;
            return(
              <optgroup
                key={parent.id}
                label={ `${iconoDeCategoria( parent.icon )} ${parent.name}` }
              >
                { visibleChildren.length > 0 ? (
                  visibleChildren.map( ( child ) => (
                    <option key={child.id} value={child.id}>
                      { iconoDeCategoria( child.icon ) } { child.name }
                    </option>
                  ) )
                ) : (
                  <option value={parent.id}>
                    { iconoDeCategoria( parent.icon ) } { parent.name }
                  </option>
                ) }
              </optgroup>
            ) ;
          } ) }
        </FormSelect>

        <FormSelect
          label={ dict.cardsPage?.installments?.currencyLabel || "Divisa" }
          value={currency}
          onChange={ ( e ) => setCurrency( e.target.value ) }
        >
          { divisasDisponibles.map( ( d ) => (
            <option key={d} value={d}>{ d }</option>
          ) ) }
        </FormSelect>

        <FormInput
          label={ dict.cardsPage?.installments?.installmentAmountLabel || "Importe de cada cuota" }
          helperText={ dict.cardsPage?.installments?.installmentAmountHelper || "Lo que el resumen factura cada mes, tal como figura en el ticket." }
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={installmentAmount}
          onChange={ ( e ) => setInstallmentAmount( e.target.value ) }
          required
        />

        <FormInput
          label={ dict.cardsPage?.installments?.totalInstallmentsLabel || "Cantidad de cuotas" }
          type="number"
          step="1"
          min="1"
          value={totalInstallments}
          onChange={ ( e ) => setTotalInstallments( e.target.value ) }
          required
        />

        <FormInput
          label={ dict.cardsPage?.installments?.purchasedAtLabel || "Fecha de compra" }
          type="date"
          value={purchasedAtInput}
          onChange={handlePurchasedAtChange}
          required
        />

        <FormInput
          label={ dict.cardsPage?.installments?.firstInstallmentLabel || "Primera cuota" }
          helperText={ dict.cardsPage?.installments?.firstInstallmentHelper || "La proponemos según el cierre de la tarjeta. Si la promoción tiene meses de gracia, corregila." }
          type="date"
          value={firstInstallmentDate}
          onChange={handleFirstInstallmentDateChange}
          required
        />

        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>
            { dict.cardsPage?.installments?.totalPurchasePrefix || "Total de la compra" }:
          </span>
          <span className={styles.totalValue}>
            { formatCurrency( totalCentavos , currency , locale ) }
          </span>
        </div>

        <div className={styles.actions}>
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
          >
            { dict.cardsPage?.installments?.cancel || "Cancelar" }
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={isPending}
          >
            { dict.cardsPage?.installments?.save || "Registrar compra" }
          </Button>
        </div>
      </form>
    </Modal>
  ) ;
}
