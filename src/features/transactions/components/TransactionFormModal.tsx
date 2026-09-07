/**
 * @file TransactionFormModal.tsx
 * Modal interactivo para el registro de transacciones con soporte de doble partida asistida.
 */
"use client" ;

// Librerías externas
import React , { useState , useTransition } from "react" ;

// Shared
import { Modal }       from "@/shared/ui/feedback/Modal/Modal" ;
import { FormInput }   from "@/shared/ui/forms/Form/FormInput" ;
import { FormSelect }  from "@/shared/ui/forms/Form/FormSelect" ;
import { FormError }   from "@/shared/ui/forms/Form/FormError" ;
import { FormActions } from "@/shared/ui/forms/Form/FormActions" ;

// Feature: Accounting
import { Account , Category } from "@/features/accounting/types" ;

// Feature: Transactions
import { createTransactionFromFormAction } from "../actions/transactionsActions" ;
import { TransactionType }                 from "../utils/derivarTipo" ;
import styles                              from "./Transactions.module.css" ;


interface TransactionFormModalProps {
  isOpen:     boolean ;
  onClose:    () => void ;
  onSuccess:  () => void ;
  accounts:   Account[] ;
  categories: Category[] ;
}

export function TransactionFormModal( {
  isOpen ,
  onClose ,
  onSuccess ,
  accounts ,
  categories ,
}: TransactionFormModalProps ) {
  const [ isPending , startTransition ] = useTransition() ;

  const todayStr = new Date().toISOString().slice( 0 , 10 ) ;

  const [ type , setType ]                                 = useState< TransactionType >( "expense" ) ;
  const [ description , setDescription ]                   = useState( "" ) ;
  const [ amount , setAmount ]                             = useState( "" ) ;
  const [ currency , setCurrency ]                         = useState( "ARS" ) ;
  const [ sourceAccountId , setSourceAccountId ]           = useState( "" ) ;
  const [ destinationAccountId , setDestinationAccountId ] = useState( "" ) ;
  const [ destinationAmount , setDestinationAmount ]       = useState( "" ) ;
  const [ categoryId , setCategoryId ]                     = useState( "" ) ;
  const [ merchantName , setMerchantName ]                 = useState( "" ) ;
  const [ occurredAt , setOccurredAt ]                     = useState( todayStr ) ;
  const [ errorMessage , setErrorMessage ]                 = useState( "" ) ;

  // Filtrar cuentas de pago/cobro (Activos y Pasivos como tarjetas)
  const liquidityAccounts = accounts.filter( ( a ) => ( (a.type === "asset") || (a.type === "liability") ) ) ;

  // La moneda no se elige: es la de la cuenta. Un selector libre permitía cargar un movimiento en
  // dólares contra una caja en pesos, y el saldo terminaba mezclando centavos de dos divisas.
  const monedaDestino = ( accounts.find( ( a ) => a.id === destinationAccountId )?.currency || "" ) ;

  const handleReset = () => {
    setDescription( "" ) ;
    setAmount( "" ) ;
    setCurrency( "ARS" ) ;
    setSourceAccountId( "" ) ;
    setDestinationAccountId( "" ) ;
    setDestinationAmount( "" ) ;
    setCategoryId( "" ) ;
    setMerchantName( "" ) ;
    setOccurredAt( todayStr ) ;
    setErrorMessage( "" ) ;
    setType( "expense" ) ;
  } ;

  const handleSourceAccountChange = ( id: string ) => {
    setSourceAccountId( id ) ;
    const acc = accounts.find( ( a ) => a.id === id ) ;
    if( acc?.currency ) {
      setCurrency( acc.currency ) ;
    }
  } ;

  const handleSubmit = ( e: React.FormEvent ) => {
    e.preventDefault() ;
    setErrorMessage( "" ) ;

    const parsedAmount = parseFloat( amount ) ;
    if( isNaN( parsedAmount ) || (parsedAmount <= 0) ) {
      setErrorMessage( "Ingresá un monto válido mayor a 0." ) ;
      return ;
    }

    if( !sourceAccountId ) {
      setErrorMessage( "Seleccioná una cuenta." ) ;
      return ;
    }

    const necesitaDestino = ( (type === "transfer") || (type === "exchange") ) ;

    if( necesitaDestino && !destinationAccountId ) {
      setErrorMessage( "Seleccioná la cuenta de destino." ) ;
      return ;
    }

    if( necesitaDestino && (sourceAccountId === destinationAccountId) ) {
      setErrorMessage( "La cuenta de origen y destino deben ser distintas." ) ;
      return ;
    }

    const parsedDestino = parseFloat( destinationAmount ) ;

    if( type === "exchange" ) {
      if( isNaN( parsedDestino ) || (parsedDestino <= 0) ) {
        setErrorMessage( "Ingresá cuánto recibís en la moneda de destino." ) ;
        return ;
      }

      if( monedaDestino === currency ) {
        setErrorMessage( `Ambas cuentas operan en ${currency}. Para mover dinero entre cuentas de la misma moneda usá una transferencia.` ) ;
        return ;
      }
    }

    if( (type === "transfer") && monedaDestino && (monedaDestino !== currency) ) {
      setErrorMessage( `No se puede transferir de ${currency} a ${monedaDestino}. Usá un cambio de moneda.` ) ;
      return ;
    }

    startTransition( async () => {
      const res = await createTransactionFromFormAction( {
        description ,
        type ,
        amount:               parsedAmount ,
        currency ,
        sourceAccountId ,
        destinationAccountId: necesitaDestino ? destinationAccountId : undefined ,
        destinationAmount:    (type === "exchange") ? parsedDestino : undefined ,
        categoryId:           categoryId || null ,
        merchantName:         merchantName || null ,
        occurredAt:           new Date( occurredAt ) ,
      } ) ;

      if( !res.success ) {
        setErrorMessage( res.error ) ;
        return ;
      }

      handleReset() ;
      onSuccess() ;
      onClose() ;
    } ) ;
  } ;

  return(
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva Transacción"
      subtitle="Registrá un movimiento contable en el libro diario"
      size="medium"
    >
      <form onSubmit={handleSubmit} className={styles.modalForm}>
        {/* Selector de tipo */}
        <div className={styles.typeTabs}>
          <button
            type="button"
            className={ `${styles.typeTabBtn} ${type === "expense" ? styles.typeTabBtnActive : ""}` }
            onClick={ () => setType("expense") }
          >
            Gasto
          </button>
          <button
            type="button"
            className={ `${styles.typeTabBtn} ${type === "income" ? styles.typeTabBtnActive : ""}` }
            onClick={ () => setType("income") }
          >
            Ingreso
          </button>
          <button
            type="button"
            className={ `${styles.typeTabBtn} ${type === "transfer" ? styles.typeTabBtnActive : ""}` }
            onClick={ () => setType("transfer") }
          >
            Transferencia
          </button>
          <button
            type="button"
            className={ `${styles.typeTabBtn} ${type === "exchange" ? styles.typeTabBtnActive : ""}` }
            onClick={ () => setType("exchange") }
          >
            Cambio
          </button>
        </div>

        {errorMessage && <FormError error={errorMessage} />}

        <div className={styles.amountCurrencyRow}>
          <FormInput
            label="Monto"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={ ( e ) => setAmount( e.target.value ) }
            required
          />
          <FormInput
            label="Moneda"
            value={currency}
            readOnly
            title="La moneda la determina la cuenta de origen"
            onChange={ () => {} }
          />
        </div>

        <FormInput
          label="Descripción"
          placeholder="Ej: Compra supermercado, Sueldo mensual..."
          value={description}
          onChange={ ( e ) => setDescription( e.target.value ) }
          required
        />

        <FormInput
          label="Fecha del movimiento"
          type="date"
          value={occurredAt}
          onChange={ ( e ) => setOccurredAt( e.target.value ) }
          required
        />

        <FormSelect
          label={ (type === "income") ? "Cuenta de depósito" : "Cuenta de pago / origen" }
          value={sourceAccountId}
          onChange={ ( e ) => handleSourceAccountChange( e.target.value ) }
          required
        >
          <option value="">Seleccionar cuenta...</option>
          {liquidityAccounts.map( ( a ) => (
            <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
          ) )}
        </FormSelect>

        {( (type === "transfer") || (type === "exchange") ) && (
          <FormSelect
            label={ (type === "exchange") ? "Cuenta de destino (otra moneda)" : "Cuenta de destino" }
            value={destinationAccountId}
            onChange={ ( e ) => setDestinationAccountId( e.target.value ) }
            required
          >
            <option value="">Seleccionar cuenta de destino...</option>
            {liquidityAccounts
              .filter( ( a ) => ( (type !== "exchange") || !currency || (a.currency !== currency) ) )
              .map( ( a ) => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ) )}
          </FormSelect>
        )}

        {type === "exchange" && (
          <FormInput
            label={ monedaDestino ? `Importe recibido en ${monedaDestino}` : "Importe recibido" }
            type="number"
            step="0.01"
            placeholder="0.00"
            value={destinationAmount}
            onChange={ ( e ) => setDestinationAmount( e.target.value ) }
            required
          />
        )}

        {( (type !== "transfer") && (type !== "exchange") ) && (
          <>
            <FormSelect
              label="Categoría"
              value={categoryId}
              onChange={ ( e ) => setCategoryId( e.target.value ) }
            >
              <option value="">Sin categoría / General</option>
              {categories.map( ( c ) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ) )}
            </FormSelect>

            <FormInput
              label="Comercio o Entidad (opcional)"
              placeholder="Ej: Coto, Netflix, Spotify..."
              value={merchantName}
              onChange={ ( e ) => setMerchantName( e.target.value ) }
            />
          </>
        )}

        <FormActions
          onCancel={onClose}
          cancelLabel="Cancelar"
          submitLabel="Guardar Transacción"
          submitting={isPending}
        />
      </form>
    </Modal>
  ) ;
}
