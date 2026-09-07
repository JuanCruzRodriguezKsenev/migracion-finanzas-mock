/**
 * @file TransactionsTable.tsx
 * Presentación tabular del libro diario conectada a DataTable y al diseño tokenizado.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import { DataTable , DataTableColumn } from "@/shared/ui/display/DataTable/DataTable" ;
import { formatCents }                 from "@/features/accounting/utils/dashboardMetrics" ;

// Feature: Accounting
import { TransactionWithEntries } from "@/features/accounting/repositories/ledgerRepository" ;
import { Account , Category }     from "@/features/accounting/types" ;

// Feature: Transactions
import { calcularResumenTransaccion } from "../utils/derivarTipo" ;
import styles                         from "./Transactions.module.css" ;


interface TransactionsTableProps {
  transactions:        TransactionWithEntries[] ;
  accounts:            Account[] ;
  categories:          Category[] ;
  loading?:            boolean ;
  onSelectTransaction: ( tx: TransactionWithEntries ) => void ;
}

export function TransactionsTable( {
  transactions ,
  accounts ,
  categories ,
  loading = false ,
  onSelectTransaction ,
}: TransactionsTableProps ) {
  const accountsMap = new Map( accounts.map( ( a ) => [ a.id , a ] ) ) ;
  const categoriesMap = new Map( categories.map( ( c ) => [ c.id , c ] ) ) ;

  const formatDate = ( date: Date | string ) => {
    const d = new Date( date ) ;
    return( d.toLocaleDateString( "es-AR" , {
      day:   "2-digit" ,
      month: "short" ,
      year:  "numeric" ,
    } ) ) ;
  } ;

  const columns: DataTableColumn< TransactionWithEntries >[] = [
    {
      key:    "occurredAt" ,
      header: "Fecha" ,
      render: ( tx ) => (
        <span className={styles.dateCell}>
          {formatDate( tx.occurredAt )}
        </span>
      ) ,
    } ,
    {
      key:    "description" ,
      header: "Descripción" ,
      render: ( tx ) => (
        <div className={styles.descCell}>
          <span className={styles.descTitle}>{tx.description}</span>
          {tx.merchantName && (
            <span className={styles.descMerchant}>{tx.merchantName}</span>
          )}
        </div>
      ) ,
    } ,
    {
      key:    "category" ,
      header: "Categoría" ,
      render: ( tx ) => {
        const cat = tx.categoryId ? categoriesMap.get( tx.categoryId ) : null ;
        return( <span>{cat ? cat.name : "General"}</span> ) ;
      } ,
    } ,
    {
      key:    "account" ,
      header: "Cuenta" ,
      render: ( tx ) => {
        const resumen = calcularResumenTransaccion( tx.entries , accountsMap ) ;
        const acc = resumen.primaryAccountId ? accountsMap.get( resumen.primaryAccountId ) : null ;
        return( <span>{acc ? acc.name : "—"}</span> ) ;
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
          : styles.badgeTransfer ;

        const label = ( resumen.type === "income" )
          ? "Ingreso"
          : ( resumen.type === "expense" )
          ? "Gasto"
          : "Transferencia" ;

        return( <span className={ `${styles.badge} ${badgeClass}` }>{label}</span> ) ;
      } ,
    } ,
    {
      key:    "amount" ,
      header: "Monto" ,
      align:  "right" ,
      render: ( tx ) => {
        const resumen = calcularResumenTransaccion( tx.entries , accountsMap ) ;
        const formatted = formatCents( resumen.amountInCents ) ;

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

  return(
    <DataTable
      columns={columns}
      data={transactions}
      loading={loading}
      onRowClick={onSelectTransaction}
      emptyMessage="No se encontraron transacciones para los filtros seleccionados."
    />
  ) ;
}
