/**
 * @file TransactionDetailModal.tsx
 * Modal de detalle del asiento contable, edición de metadatos y reversión de partida doble.
 */
"use client" ;

// Librerías externas
import React , { useState , useTransition } from "react" ;

// Shared
import { Modal }       from "@/shared/ui/feedback/Modal/Modal" ;
import { FormInput }   from "@/shared/ui/forms/Form/FormInput" ;
import { FormSelect }  from "@/shared/ui/forms/Form/FormSelect" ;
import { FormError }   from "@/shared/ui/forms/Form/FormError" ;
import { FormActions }  from "@/shared/ui/forms/Form/FormActions" ;
import { Button }       from "@/shared/ui/display/Button/Button" ;
import { formatCurrency } from "@/shared/lib/currencyFormatter" ;

// Feature: Accounting
import { TransactionWithEntries } from "@/features/accounting/repositories/ledgerRepository" ;
import { Account , Category }     from "@/features/accounting/types" ;

// Feature: Transactions
import {
  updateLedgerTransactionMetadataAction ,
  reverseLedgerTransactionAction ,
  deleteLedgerTransactionAction
} from "../actions/transactionsActions" ;
import styles from "./Transactions.module.css" ;


interface TransactionDetailModalProps {
  transaction: TransactionWithEntries | null ;
  isOpen:      boolean ;
  onClose:     () => void ;
  onSuccess:   () => void ;
  accounts:    Account[] ;
  categories:  Category[] ;
}

interface TransactionDetailContentProps {
  transaction: TransactionWithEntries ;
  onClose:     () => void ;
  onSuccess:   () => void ;
  accounts:    Account[] ;
  categories:  Category[] ;
}

function TransactionDetailContent( {
  transaction ,
  onClose ,
  onSuccess ,
  accounts ,
  categories ,
}: TransactionDetailContentProps ) {
  const [ isPending , startTransition ] = useTransition() ;

  // Una transacción ya reversada no vuelve a reversarse: el servicio lo rechaza, y ofrecer el botón
  // sólo llevaría al usuario a un error evitable.
  const yaReversada = Boolean( transaction.reversedAt ) ;

  const [ description , setDescription ]       = useState( transaction.description ) ;
  const [ categoryId , setCategoryId ]         = useState( transaction.categoryId || "" ) ;
  const [ merchantName , setMerchantName ]     = useState( transaction.merchantName || "" ) ;
  const [ occurredAt , setOccurredAt ]         = useState( new Date( transaction.occurredAt ).toISOString().slice( 0 , 10 ) ) ;
  const [ reversalReason , setReversalReason ] = useState( "" ) ;
  const [ isReversing , setIsReversing ]       = useState( false ) ;
  const [ errorMessage , setErrorMessage ]     = useState( "" ) ;

  const accountsMap = new Map( accounts.map( ( a ) => [ a.id , a ] ) ) ;

  const handleUpdateMetadata = ( e: React.FormEvent ) => {
    e.preventDefault() ;
    setErrorMessage( "" ) ;

    startTransition( async () => {
      const res = await updateLedgerTransactionMetadataAction( {
        transactionId: transaction.id ,
        description ,
        categoryId:    categoryId || null ,
        merchantName:  merchantName || null ,
        occurredAt:    new Date( occurredAt ) ,
      } ) ;

      if( !res.success ) {
        setErrorMessage( res.error ) ;
        return ;
      }

      onSuccess() ;
      onClose() ;
    } ) ;
  } ;

  const handleReverse = () => {
    setErrorMessage( "" ) ;

    startTransition( async () => {
      const res = await reverseLedgerTransactionAction( {
        transactionId: transaction.id ,
        reason:        reversalReason || undefined ,
      } ) ;

      if( !res.success ) {
        setErrorMessage( res.error ) ;
        return ;
      }

      onSuccess() ;
      onClose() ;
    } ) ;
  } ;

  const handleDelete = () => {
    if( !confirm( "¿Estás seguro de que deseás eliminar este movimiento? Se revertirán los saldos de las cuentas." ) ) {
      return ;
    }

    setErrorMessage( "" ) ;
    startTransition( async () => {
      const res = await deleteLedgerTransactionAction( transaction.id ) ;
      if( !res.success ) {
        setErrorMessage( res.error ) ;
        return ;
      }

      onSuccess() ;
      onClose() ;
    } ) ;
  } ;

  return(
    <form onSubmit={handleUpdateMetadata} className={styles.modalForm}>
      {errorMessage && <FormError error={errorMessage} />}

      <FormInput
        label="Descripción"
        value={description}
        onChange={ ( e ) => setDescription( e.target.value ) }
        required
      />

      <FormInput
        label="Fecha de ocurrencia"
        type="date"
        value={occurredAt}
        onChange={ ( e ) => setOccurredAt( e.target.value ) }
        required
      />

      <FormSelect
        label="Categoría"
        value={categoryId}
        onChange={ ( e ) => setCategoryId( e.target.value ) }
      >
        <option value="">Sin categoría</option>
        {categories.map( ( c ) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ) )}
      </FormSelect>

      <FormInput
        label="Comercio"
        value={merchantName}
        onChange={ ( e ) => setMerchantName( e.target.value ) }
      />

      {/* Tabla del asiento de partida doble */}
      <div className={styles.entriesTableWrapper}>
        <table className={styles.entriesTable}>
          <thead>
            <tr>
              <th>Cuenta</th>
              <th className={styles.alignRight}>Debe</th>
              <th className={styles.alignRight}>Haber</th>
            </tr>
          </thead>
          <tbody>
            {transaction.entries.map( ( entry , index ) => {
              const acc = accountsMap.get( entry.accountId ) ;
              return(
                <tr key={entry.id || `entry-${index}`}>
                  <td>{acc ? `${acc.name} (${acc.type})` : entry.accountId.slice( 0 , 8 )}</td>
                  <td className={styles.alignRight}>
                    {entry.debit > 0 ? formatCurrency( entry.debit , entry.currency || "ARS" , "es-AR" ) : "—"}
                  </td>
                  <td className={styles.alignRight}>
                    {entry.credit > 0 ? formatCurrency( entry.credit , entry.currency || "ARS" , "es-AR" ) : "—"}
                  </td>
                </tr>
              ) ;
            } )}
          </tbody>
        </table>
      </div>

      {isReversing ? (
        <div className={styles.reversalBox}>
          <FormInput
            label="Motivo de la reversión (opcional)"
            placeholder="Ej: Cobro duplicado, error de carga..."
            value={reversalReason}
            onChange={ ( e ) => setReversalReason( e.target.value ) }
          />
          <div className={styles.reversalActions}>
            <Button variant="danger" type="button" onClick={handleReverse} isLoading={isPending}>
              Confirmar Reversión
            </Button>
            <Button variant="secondary" type="button" onClick={ () => setIsReversing( false ) }>
              Cancelar
            </Button>
          </div>
        </div>
      ) : yaReversada ? (
        <div className={styles.dangerActions}>
          <span className={styles.reversedNotice}>
            Asiento reversado el { new Intl.DateTimeFormat( "es-AR" , {dateStyle: "medium" , timeStyle: "short"} ).format( new Date( transaction.reversedAt as Date ) ) }.
            El contra-asiento ya devolvió los importes a sus cuentas.
          </span>
          <Button
            variant="danger"
            type="button"
            onClick={handleDelete}
            disabled={isPending}
          >
            Eliminar
          </Button>
        </div>
      ) : (
        <div className={styles.dangerActions}>
          <Button
            variant="outline"
            type="button"
            onClick={ () => setIsReversing( true ) }
            disabled={isPending}
          >
            Reversar Asiento
          </Button>
          <Button
            variant="danger"
            type="button"
            onClick={handleDelete}
            disabled={isPending}
          >
            Eliminar
          </Button>
        </div>
      )}

      <FormActions
        onCancel={onClose}
        cancelLabel="Cerrar"
        submitLabel="Guardar Cambios"
        submitting={isPending}
      />
    </form>
  ) ;
}

export function TransactionDetailModal( {
  transaction ,
  isOpen ,
  onClose ,
  onSuccess ,
  accounts ,
  categories ,
}: TransactionDetailModalProps ) {
  if( !transaction ) { return( null ) ; }

  return(
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle del Asiento Contable"
      subtitle={`ID: ${transaction.id.slice( 0 , 8 )}...`}
      size="medium"
    >
      <TransactionDetailContent
        key={transaction.id}
        transaction={transaction}
        onClose={onClose}
        onSuccess={onSuccess}
        accounts={accounts}
        categories={categories}
      />
    </Modal>
  ) ;
}
