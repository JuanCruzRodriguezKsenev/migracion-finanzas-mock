/**
 * @file LedgerAuditPanel.tsx
 * Panel de auditoría de sólo lectura para el plan de cuentas completo (RFC 024).
 * Renderiza el libro mayor en tabla con código, nombre, tipo, divisa y saldo crudo.
 */
"use client" ;

// Librerías externas
import React , { useState , useMemo } from "react" ;

// Shared
import { DataTable , DataTableColumn } from "@/shared/ui/display/DataTable/DataTable" ;
import { SearchInput }                 from "@/shared/ui/forms/SearchInput/SearchInput" ;
import type { getDictionary }          from "@/shared/lib/dictionary" ;

// Feature: Accounting
import { formatCents } from "../../utils/dashboardMetrics" ;
import styles          from "./LedgerAuditPanel.module.css" ;
import { Account }     from "../../types" ;


export interface LedgerAuditPanelProps {
  accounts: Account[] ;
  dict:     Awaited< ReturnType< typeof getDictionary > > ;
}

/**
 * Panel de auditoría contable para visualizar el catálogo de cuentas completo.
 */
export function LedgerAuditPanel( {
  accounts ,
  dict ,
}: LedgerAuditPanelProps ) {
  const [ query , setQuery ] = useState( "" ) ;

  // No consulta MetricsVisibilityContext: en /settings no existe el interruptor de visibilidad de /accounts y la auditoría exige saldos siempre visibles.
  const typeLabels: Record< string , string > = {
    asset:     dict.settingsPage.typeAsset ,
    liability: dict.settingsPage.typeLiability ,
    equity:    dict.settingsPage.typeEquity ,
    revenue:   dict.settingsPage.typeRevenue ,
    expense:   dict.settingsPage.typeExpense ,
  } ;

  const filteredAccounts = useMemo( () => {
    const q = query.toLowerCase().trim() ;
    if( !q ) {
      return( accounts ) ;
    }
    return( accounts.filter( ( a ) => (
      a.code.toLowerCase().includes( q ) || a.name.toLowerCase().includes( q )
    ) ) ) ;
  } , [ accounts , query ] ) ;

  const columns: DataTableColumn< Account >[] = [
    {
      key:    "code" ,
      header: dict.settingsPage.colCode ,
      align:  "left" ,
      render: ( a ) => <span className={styles.code}>{a.code}</span> ,
    } ,
    {
      key:    "name" ,
      header: dict.settingsPage.colName ,
      align:  "left" ,
      render: ( a ) => a.name ,
    } ,
    {
      key:    "type" ,
      header: dict.settingsPage.colType ,
      align:  "left" ,
      render: ( a ) => ( typeLabels[a.type] || a.type ) ,
    } ,
    {
      key:    "currency" ,
      header: dict.settingsPage.colCurrency ,
      align:  "left" ,
      render: ( a ) => a.currency ,
    } ,
    {
      key:    "balance" ,
      header: dict.settingsPage.colBalance ,
      align:  "right" ,
      render: ( a ) => (
        <span className={ (a.balance < 0) ? styles.negative : undefined }>
          {formatCents( a.balance )}
        </span>
      ) ,
    } ,
  ] ;

  return(
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={dict.settingsPage.ledgerSearch}
            ariaLabel={dict.settingsPage.ledgerSearch}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredAccounts}
        keyExtractor={ ( a ) => a.id }
        emptyMessage={dict.settingsPage.ledgerEmpty}
      />
    </div>
  ) ;
}
