/**
 * @file PendingLoanSettlementsInbox.tsx
 * Bandeja global de liquidación de cuotas de préstamos (RFC 008).
 * Agrupa cuotas por préstamo mostrando únicamente la más antigua pendiente por cobrar o pagar.
 */
"use client" ;

// Librerías externas
import { useState , useTransition , useMemo } from "react" ;
import { useRouter }                         from "next/navigation" ;

// Shared
import { formatCurrency }   from "@/shared/lib/currencyFormatter" ;
import type { getDictionary } from "@/shared/lib/dictionary" ;
import { usePuedeEscribir }   from "@/shared/providers/PermissionsProvider" ;
import { FormSelect }       from "@/shared/ui/forms/Form/FormSelect" ;
import { FormError }        from "@/shared/ui/forms/Form/FormError" ;
import { Button }           from "@/shared/ui/display/Button/Button" ;
import { Modal }            from "@/shared/ui/feedback/Modal/Modal" ;
import styles               from "./PendingLoanSettlementsInbox.module.css" ;

// Feature: Accounting
import type { Account } from "@/features/accounting/types" ;

// Feature: Loans
import { payLoanInstallmentAction } from "../actions/loansActions" ;
import type { PendienteCuota }       from "../types" ;


/**
 * Formatea una fecha civil YYYY-MM-DD en texto legible a mediodía UTC.
 *
 * @param fechaCivil - Fecha civil YYYY-MM-DD.
 * @param locale - Configuración regional de fecha (ej: "es-AR").
 * @returns Cadena de fecha formateada.
 */
export function formatearFechaCivil( fechaCivil: string , locale: string ): string {
  const [ y , m , d ] = fechaCivil.split( "-" ).map( Number ) ;
  const date          = new Date( Date.UTC( y , ( m - 1 ) , d , 12 , 0 , 0 ) ) ;

  return( new Intl.DateTimeFormat( locale , {
    year:     "numeric" ,
    month:    "short" ,
    day:      "numeric" ,
    timeZone: "UTC"
  } ).format( date ) ) ;
}

export interface PendingLoanSettlementsInboxProps {
  initialPending: PendienteCuota[] ;
  accounts:       Account[] ;
  dict:           Awaited< ReturnType< typeof getDictionary > > ;
  locale?:        string ;
}

/**
 * Componente de bandeja de liquidaciones pendientes para préstamos.
 */
export function PendingLoanSettlementsInbox( {
  initialPending ,
  accounts ,
  dict ,
  locale = "es-AR"
}: PendingLoanSettlementsInboxProps ) {
  const router        = useRouter() ;
  const puedeEscribir = usePuedeEscribir() ;

  const [ pendingItems , setPendingItems ] = useState< PendienteCuota[] >( initialPending ) ;
  const [ selectedItem , setSelectedItem ] = useState< PendienteCuota | null >( null ) ;
  const [ selectedAccountId , setSelectedAccountId ] = useState< string >( "" ) ;
  const [ actionError , setActionError ]   = useState< string | null >( null ) ;
  const [ isPending , startTransition ]    = useTransition() ;

  // Una fila por préstamo, la cuota más antigua (trampa §3.4)
  const uniquePendingGroups = useMemo( () => {
    const map = new Map< string , PendienteCuota[] >() ;
    for( const item of pendingItems ) {
      const list = ( map.get( item.loanId ) || [] ) ;
      list.push( item ) ;
      map.set( item.loanId , list ) ;
    }

    return( Array.from( map.values() ).map( ( group ) => ( {
      firstItem: group[ 0 ] ,
      extraCount: ( group.length - 1 )
    } ) ) ) ;
  } , [ pendingItems ] ) ;

  if( pendingItems.length === 0 ) {
    return( null ) ;
  }

  // Cuentas de activo elegibles para la divisa del préstamo seleccionado
  const eligibleAccounts = (
    selectedItem
      ? accounts.filter( ( a ) => ( a.type === "asset" ) && ( a.currency === selectedItem.loan.currency ) )
      : []
  ) ;

  const handleOpenModal = ( item: PendienteCuota ) => {
    setSelectedItem( item ) ;
    setActionError( null ) ;
    const matchingAccounts = accounts.filter( ( a ) => ( a.type === "asset" ) && ( a.currency === item.loan.currency ) ) ;
    setSelectedAccountId( matchingAccounts[ 0 ]?.id || "" ) ;
  } ;

  const handleConfirmSettlement = () => {
    if( !selectedItem || !selectedAccountId ) {
      return ;
    }

    setActionError( null ) ;
    startTransition( async () => {
      const res = await payLoanInstallmentAction( {
        loanId:            selectedItem.loanId ,
        paymentAccountId:  selectedAccountId ,
        installmentNumber: selectedItem.n
      } ) ;

      if( res.success ) {
        setPendingItems( ( prev ) => prev.filter(
          ( p ) => !( ( p.loanId === selectedItem.loanId ) && ( p.n === selectedItem.n ) )
        ) ) ;
        setSelectedItem( null ) ;
        router.refresh() ;
      } else {
        setActionError( res.error ) ;
      }
    } ) ;
  } ;

  return(
    <section className={styles.inboxWrapper} aria-label={dict.loansPage.settlement.inboxTitle}>
      <div className={styles.inboxHeader}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>{dict.loansPage.settlement.inboxTitle}</h3>
          <span className={styles.badge}>{pendingItems.length}</span>
        </div>
        <p className={styles.description}>{dict.loansPage.settlement.inboxSubtitle}</p>
      </div>

      <div className={styles.itemsList}>
        {uniquePendingGroups.map( ( {firstItem , extraCount} ) => {
          return(
            <div key={firstItem.loanId} className={styles.itemCard}>
              <div className={styles.itemInfo}>
                <div className={styles.itemDetails}>
                  <div className={styles.itemNameRow}>
                    <span className={styles.itemName}>{firstItem.loan.name}</span>
                    { extraCount > 0 ? (
                      <span className={styles.moreOverdueBadge}>
                        {dict.loansPage.settlement.moreOverdue.replace( "{count}" , String( extraCount ) )}
                      </span>
                    ) : null }
                  </div>
                  <span className={styles.itemMeta}>
                    { `${firstItem.n} ${dict.loansPage.installmentsSeparator} ${firstItem.loan.totalInstallments} • ${formatearFechaCivil( firstItem.fechaCuota , locale )}` }
                  </span>
                </div>
              </div>

              <div className={styles.itemAmountActions}>
                <div className={styles.amountGroup}>
                  <span className={styles.itemAmount}>
                    {formatCurrency( firstItem.cuota , firstItem.loan.currency , locale )}
                  </span>
                  { firstItem.interes > 0 ? (
                    <span className={styles.amountBreakdown}>
                      { `${dict.loansPage.settlement.capital}: ${formatCurrency( firstItem.capital , firstItem.loan.currency , locale )} | ${dict.loansPage.settlement.interest}: ${formatCurrency( firstItem.interes , firstItem.loan.currency , locale )}` }
                    </span>
                  ) : null }
                </div>

                {puedeEscribir && (
                  <Button
                    variant="secondary"
                    onClick={ () => handleOpenModal( firstItem ) }
                  >
                    {dict.loansPage.settlement.settle}
                  </Button>
                )}
              </div>
            </div>
          ) ;
        } )}
      </div>

      { selectedItem ? (
        <Modal
          isOpen={true}
          onClose={ () => setSelectedItem( null ) }
          title={dict.loansPage.settlement.modalTitle}
          subtitle={selectedItem.loan.name}
          size="medium"
        >
          <div className={styles.modalContent}>
            <div className={styles.breakdownBox}>
              <div className={styles.breakdownRow}>
                <span>{dict.loansPage.settlement.capital}</span>
                <span>{formatCurrency( selectedItem.capital , selectedItem.loan.currency , locale )}</span>
              </div>
              <div className={styles.breakdownRow}>
                <span>{dict.loansPage.settlement.interest}</span>
                <span>{formatCurrency( selectedItem.interes , selectedItem.loan.currency , locale )}</span>
              </div>
              <div className={styles.breakdownTotal}>
                <span>{dict.loansPage.settlement.total}</span>
                <span>{formatCurrency( selectedItem.cuota , selectedItem.loan.currency , locale )}</span>
              </div>
            </div>

            { eligibleAccounts.length === 0 ? (
              <div className={styles.noAccountWarning}>
                {dict.loansPage.settlement.noAccountForCurrency}
              </div>
            ) : (
              <FormSelect
                label={
                  selectedItem.loan.direction === "borrowed"
                    ? dict.loansPage.settlement.payFrom
                    : dict.loansPage.settlement.collectInto
                }
                value={selectedAccountId}
                onChange={ ( e ) => setSelectedAccountId( e.target.value ) }
              >
                {eligibleAccounts.map( ( acc ) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.code}) - {formatCurrency( acc.balance , acc.currency , locale )}
                  </option>
                ) )}
              </FormSelect>
            ) }

            { actionError ? <FormError error={actionError} /> : null }

            <div className={styles.modalActions}>
              <Button
                variant="outline"
                onClick={ () => setSelectedItem( null ) }
                disabled={isPending}
              >
                {dict.loansPage.settlement.cancel}
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmSettlement}
                isLoading={isPending}
                disabled={ (eligibleAccounts.length === 0) || !selectedAccountId }
              >
                {
                  selectedItem.loan.direction === "borrowed"
                    ? dict.loansPage.settlement.confirmPayment
                    : dict.loansPage.settlement.confirmCollection
                }
              </Button>
            </div>
          </div>
        </Modal>
      ) : null }
    </section>
  ) ;
}
