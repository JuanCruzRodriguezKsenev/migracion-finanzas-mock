/**
 * @file TransactionsTable.tsx
 * Presentación tabular del libro diario conectada a DataTable y al diseño tokenizado.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import { DataTable , DataTableColumn } from "@/shared/ui/display/DataTable/DataTable" ;
import { InstitutionLogo }             from "@/shared/ui/display/InstitutionLogo/InstitutionLogo" ;
import { formatCurrency }              from "@/shared/lib/currencyFormatter" ;

// Feature: Accounting
import { TransactionWithEntries }                       from "@/features/accounting/repositories/ledgerRepository" ;
import { CuentaReferenciada , Category , FinancialEntity } from "@/features/accounting/types" ;
import { AccountLabel , AccountLabelDict }              from "@/features/accounting/components/AccountLabel" ;

// Feature: Profile
import { useProfileContext } from "@/features/profile/context/ProfileContext" ;

// Feature: Transactions
import { calcularResumenTransaccion } from "../utils/derivarTipo" ;
import styles                         from "./Transactions.module.css" ;


interface TransactionsTableProps {
  transactions:        TransactionWithEntries[] ;
  /** Cuentas de la organización más las personales que nombran los asientos (sin saldo). */
  accounts:            CuentaReferenciada[] ;
  categories:          Category[] ;
  financialEntities?:  FinancialEntity[] ;
  visibleColumns?:     string[] ;
  loading?:            boolean ;
  holderDict?:         { holderChipLabel: string } ;
  /** Textos de la etiqueta «Ya no compartida» (RN-13). Sin ellos la fila no la muestra. */
  cuentasDict?:        AccountLabelDict ;
  onSelectTransaction: ( tx: TransactionWithEntries ) => void ;
}

function getBrandLogo( description: string , merchantName?: string | null ) {
  const text = `${description} ${merchantName || ""}`.toLowerCase() ;

  if( text.includes( "netflix" ) ) {
    return(
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-label="Netflix">
        <rect width="24" height="24" rx="4" fill="#141414" />
        <path d="M7 3h3l4 9.5V3h3v18h-3l-4-9.5V21H7V3z" fill="#E50914" />
      </svg>
    ) ;
  }
  if( text.includes( "shell" ) ) {
    return(
      <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-label="Shell">
        <circle cx="14" cy="14" r="14" fill="#FFF200" />
        <path d="M14 5C8 5 5 10 5 14C5 19 9 23 14 23C19 23 23 19 23 14C23 10 20 5 14 5Z" fill="#DD1D21" />
        <path d="M14 7L16 12L21 12L17 15.5L18.5 21L14 17.5L9.5 21L11 15.5L7 12L12 12Z" fill="#FFF200" />
      </svg>
    ) ;
  }
  if( text.includes( "spotify" ) ) {
    return(
      <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-label="Spotify">
        <circle cx="14" cy="14" r="14" fill="#1DB954" />
        <path d="M9 18.5c3.5-1.5 7.5-1.5 10 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7.5 15c4.5-2 9.5-2 13 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6 11.5c5.5-2.5 11.5-2.5 16 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ) ;
  }
  if( text.includes( "airbnb" ) ) {
    return(
      <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-label="Airbnb">
        <circle cx="14" cy="14" r="14" fill="#FF5A5F" />
        <path d="M14 8C11.2 8 9 10.2 9 13c0 4 5 9 5 9s5-5 5-9c0-2.8-2.2-5-5-5zm0 6.5c-0.8 0-1.5-0.7-1.5-1.5s0.7-1.5 1.5-1.5 1.5 0.7 1.5 1.5-0.7 1.5-1.5 1.5z" fill="white" />
      </svg>
    ) ;
  }
  if( text.includes( "amazon" ) ) {
    return(
      <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-label="Amazon">
        <circle cx="14" cy="14" r="14" fill="#232F3E" />
        <path d="M8 14h12M14 9l5 5-5 5" stroke="#FF9900" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) ;
  }
  if( text.includes( "uber" ) ) {
    return(
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-label="Uber">
        <circle cx="12" cy="12" r="12" fill="#000" />
        <text x="12" y="15.5" fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">UBER</text>
      </svg>
    ) ;
  }
  return( null ) ;
}

function getCategoryEmoji( categoryName?: string | null ): string {
  if( !categoryName ) { return( "💸" ) ; }
  const cat = categoryName.toLowerCase() ;
  if( cat.includes( "aliment" ) || cat.includes( "supermercad" ) || cat.includes( "comida" ) ) { return( "🛒" ) ; }
  if( cat.includes( "sueldo" ) || cat.includes( "honorario" ) || cat.includes( "ingreso" ) ) { return( "💼" ) ; }
  if( cat.includes( "entretenimient" ) || cat.includes( "ocio" ) || cat.includes( "suscrip" ) ) { return( "🎬" ) ; }
  if( cat.includes( "transport" ) || cat.includes( "combustib" ) || cat.includes( "auto" ) ) { return( "⛽" ) ; }
  if( cat.includes( "vivienda" ) || cat.includes( "alquiler" ) || cat.includes( "hogar" ) ) { return( "🏠" ) ; }
  if( cat.includes( "ahorro" ) || cat.includes( "invers" ) || cat.includes( "banco" ) ) { return( "🏦" ) ; }
  if( cat.includes( "compra" ) || cat.includes( "shopping" ) ) { return( "🛍️" ) ; }
  if( cat.includes( "salud" ) || cat.includes( "farmacia" ) ) { return( "💊" ) ; }
  return( "💸" ) ;
}

export function TransactionsTable( {
  transactions ,
  accounts ,
  categories ,
  financialEntities = [] ,
  visibleColumns ,
  loading = false ,
  holderDict ,
  cuentasDict ,
  onSelectTransaction ,
}: TransactionsTableProps ) {
  const { profile }   = useProfileContext() ;
  const locale        = ( profile?.numberFormat || "es-AR" ) ;
  const accountsMap   = new Map( accounts.map( ( a ) => [ a.id , a ] ) ) ;
  const categoriesMap = new Map( categories.map( ( c ) => [ c.id , c ] ) ) ;
  const entitiesMap   = new Map( financialEntities.map( ( e ) => [ e.id , e ] ) ) ;

  const formatCompactDate = ( date: Date | string ) => {
    const d      = new Date( date ) ;
    const day    = String( d.getDate() ).padStart( 2 , "0" ) ;
    const months = [ "ene" , "feb" , "mar" , "abr" , "may" , "jun" , "jul" , "ago" , "sep" , "oct" , "nov" , "dic" ] ;
    const month  = months[d.getMonth()] ;
    const year   = d.getFullYear() ;
    return( `${day} ${month} ${year}` ) ;
  } ;

  const allColumns: DataTableColumn< TransactionWithEntries >[] = [
    {
      key:    "occurredAt" ,
      header: "Fecha" ,
      render: ( tx ) => (
        <span className={styles.dateCell}>
          {formatCompactDate( tx.occurredAt )}
        </span>
      ) ,
    } ,
    {
      key:    "description" ,
      header: "Descripción" ,
      render: ( tx ) => {
        const cat = tx.categoryId ? categoriesMap.get( tx.categoryId ) : null ;
        const brandLogo = getBrandLogo( tx.description , tx.merchantName ) ;

        return(
          <div className={styles.descCell}>
            <div className={styles.txnLogoCircle}>
              {brandLogo || (
                tx.merchantName ? (
                  <InstitutionLogo institution={tx.merchantName} logoUrl={tx.merchantDomain} size={22} />
                ) : (
                  <span>{getCategoryEmoji( cat?.name )}</span>
                )
              )}
            </div>
            <div className={styles.txnTextGroup}>
              <span className={styles.descTitle}>{tx.description}</span>
              {tx.merchantName && (
                <span className={styles.descMerchant}>{tx.merchantName}</span>
              )}
              {tx.holder && (
                <span
                  className={styles.holderChip}
                  title={holderDict?.holderChipLabel.replace( "{nombre}" , tx.holder.nombre )}
                >
                  {tx.holder.nombre}
                </span>
              )}
            </div>
          </div>
        ) ;
      } ,
    } ,
    {
      key:    "category" ,
      header: "Categoría" ,
      render: ( tx ) => {
        const cat = tx.categoryId ? categoriesMap.get( tx.categoryId ) : null ;
        return(
          <span className={styles.categoryBadge}>
            <span>{getCategoryEmoji( cat?.name )}</span>
            <span>{cat ? cat.name : "General"}</span>
          </span>
        ) ;
      } ,
    } ,
    {
      key:    "account" ,
      header: "Cuenta" ,
      render: ( tx ) => {
        const resumen = calcularResumenTransaccion( tx.entries , accountsMap ) ;
        const acc     = resumen.primaryAccountId ? accountsMap.get( resumen.primaryAccountId ) : null ;
        const entity  = acc?.entityId ? entitiesMap.get( acc.entityId ) : null ;

        return(
          <div className={styles.accountCell}>
            <InstitutionLogo
              institution={entity?.name || acc?.name || "Banco"}
              logoUrl={entity?.logo}
              brandDomain={entity?.brandDomain}
              size={20}
            />
            <div className={styles.accountTextGroup}>
              <span className={styles.accountName}>{acc ? acc.name : "—"}</span>
              {( cuentasDict && (acc?.compartida === false) ) && (
                <AccountLabel etiqueta={ {tipo: "yaNoCompartida"} } dict={cuentasDict} />
              )}
            </div>
          </div>
        ) ;
      } ,
    } ,
    {
      key:    "type" ,
      header: "Tipo" ,
      render: ( tx ) => {
        const resumen = calcularResumenTransaccion( tx.entries , accountsMap ) ;
        const badgeClass = ( resumen.type === "income" )
          ? styles.badgeIncome
          : ( resumen.type === "expense" )
          ? styles.badgeExpense
          : ( resumen.type === "exchange" )
          ? styles.badgeExchange
          : styles.badgeTransfer ;

        const label = ( resumen.type === "income" )
          ? "Ingreso"
          : ( resumen.type === "expense" )
          ? "Gasto"
          : ( resumen.type === "exchange" )
          ? "Cambio"
          : "Transferencia" ;

        return(
          <span className={styles.tipoCell}>
            <span className={ `${styles.badge} ${badgeClass}` }>{label}</span>
            {tx.reversedAt && (
              <span className={ `${styles.badge} ${styles.badgeReversed}` } title="Anulada mediante contra-asiento">
                Reversada
              </span>
            )}
          </span>
        ) ;
      } ,
    } ,
    {
      key:    "amount" ,
      header: "Monto" ,
      align:  "right" ,
      render: ( tx ) => {
        const resumen  = calcularResumenTransaccion( tx.entries , accountsMap ) ;
        const currency = resumen.currency || "ARS" ;
        const formatted = formatCurrency( Math.abs( resumen.amountInCents ) , currency , locale ) ;

        // Un cambio tiene dos importes en dos monedas: mostrar uno solo escondería la operación.
        if( resumen.type === "exchange" ) {
          const recibido = formatCurrency(
            Math.abs( resumen.destinationAmountInCents || 0 ) ,
            resumen.destinationCurrency || currency ,
            locale
          ) ;

          return(
            <span className={ `${styles.amountCell} ${styles.amountTransfer}` }>
              {formatted} → {recibido}
            </span>
          ) ;
        }

        const amountClass = ( resumen.type === "income" )
          ? styles.amountIncome
          : ( resumen.type === "expense" )
          ? styles.amountExpense
          : styles.amountTransfer ;

        const sign = ( resumen.type === "income" )
          ? "+"
          : ( resumen.type === "expense" )
          ? "-"
          : "" ;

        return(
          <span className={ `${styles.amountCell} ${amountClass}` }>
            {sign}{formatted}
            {currency !== "ARS" && (
              <span className={styles.currencyBadge}>{currency}</span>
            )}
          </span>
        ) ;
      } ,
    } ,
    {
      key:    "actions" ,
      header: "" ,
      align:  "right" ,
      render: ( tx ) => (
        <button
          type="button"
          className={styles.btnAction}
          onClick={ ( e ) => {
            e.stopPropagation() ;
            onSelectTransaction( tx ) ;
          } }
        >
          Detalle
        </button>
      ) ,
    } ,
  ] ;

  const renderedColumns = visibleColumns
    ? allColumns.filter( ( col ) => visibleColumns.includes( col.key ) )
    : allColumns ;

  return(
    <DataTable
      columns={renderedColumns}
      data={transactions}
      loading={loading}
      onRowClick={onSelectTransaction}
      emptyMessage="No se encontraron transacciones para los filtros seleccionados."
    />
  ) ;
}
