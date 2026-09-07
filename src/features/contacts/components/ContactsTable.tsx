/**
 * @file ContactsTable.tsx
 * Presentación tabular de la agenda de contactos con DataTable.
 * Muestra información del contacto, insignias de cuentas de cobro e interacciones rápidas.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import { DataTable , DataTableColumn } from "@/shared/ui/display/DataTable/DataTable" ;
import { InstitutionLogo }             from "@/shared/ui/display/InstitutionLogo/InstitutionLogo" ;

// Feature: Contacts
import { ContactWithPaymentMethods } from "../types" ;
import styles                        from "./Contacts.module.css" ;


interface ContactsTableProps {
  contacts:         ContactWithPaymentMethods[] ;
  loading?:         boolean ;
  onSelectContact:  ( contact: ContactWithPaymentMethods ) => void ;
  onEditContact:    ( contact: ContactWithPaymentMethods ) => void ;
  onArchiveContact: ( contact: ContactWithPaymentMethods ) => void ;
  dict?: {
    tableHeaderName?:     string ;
    tableHeaderEmail?:    string ;
    tableHeaderPhone?:    string ;
    tableHeaderAccounts?: string ;
    tableHeaderActions?:  string ;
    btnViewAccounts?:     string ;
    btnEdit?:             string ;
    btnArchive?:          string ;
    emptyState?:          string ;
  } ;
}

export function ContactsTable( {
  contacts ,
  loading = false ,
  onSelectContact ,
  onEditContact ,
  onArchiveContact ,
  dict ,
}: ContactsTableProps ) {
  const columns: DataTableColumn< ContactWithPaymentMethods >[] = [
    {
      key:    "name" ,
      header: dict?.tableHeaderName || "Contacto" ,
      render: ( row ) => {
        const inicial = ( row.name ? row.name.charAt( 0 ).toUpperCase() : "?" ) ;
        return(
          <div className={styles.contactCell}>
            <div className={styles.avatar}>{inicial}</div>
            <div className={styles.contactInfo}>
              <span className={styles.contactName}>{row.name}</span>
              {row.notes && (
                <span className={styles.contactNotes} title={row.notes}>
                  {row.notes}
                </span>
              )}
            </div>
          </div>
        ) ;
      } ,
    } ,
    {
      key:    "email" ,
      header: dict?.tableHeaderEmail || "Email" ,
      render: ( row ) => (
        <span className={ row.email ? styles.textCell : `${styles.textCell} ${styles.textMuted}` }>
          {row.email || "—"}
        </span>
      ) ,
    } ,
    {
      key:    "phone" ,
      header: dict?.tableHeaderPhone || "Teléfono" ,
      render: ( row ) => (
        <span className={ row.phone ? styles.textCell : `${styles.textCell} ${styles.textMuted}` }>
          {row.phone || "—"}
        </span>
      ) ,
    } ,
    {
      key:    "accounts" ,
      header: dict?.tableHeaderAccounts || "Cuentas de Cobro" ,
      render: ( row ) => {
        if( !row.paymentMethods || ( row.paymentMethods.length === 0 ) ) {
          return( <span className={styles.emptyBadge}>Sin cuentas</span> ) ;
        }

        return(
          <div className={styles.methodsBadges}>
            {row.paymentMethods.map( ( pm ) => (
              <span
                key={pm.id}
                className={ pm.isDefault ? `${styles.methodBadge} ${styles.methodBadgeDefault}` : styles.methodBadge }
                title={ `${pm.financialEntity?.name || "Entidad"}: ${pm.alias || pm.cbuCvu || ""}` }
              >
                <InstitutionLogo
                  institution={pm.financialEntity?.name || "Entidad"}
                  brandDomain={pm.financialEntity?.brandDomain}
                  size={14}
                />
                <span>{pm.alias || ( pm.cbuCvu ? `CBU ...${pm.cbuCvu.slice( -4 )}` : pm.financialEntity?.name )}</span>
                {pm.isDefault && <span className={styles.defaultTag}>★</span>}
              </span>
            ) )}
          </div>
        ) ;
      } ,
    } ,
    {
      key:    "actions" ,
      header: dict?.tableHeaderActions || "Acciones" ,
      align:  "right" ,
      render: ( row ) => (
        <div className={styles.actionsCell} onClick={ ( e ) => e.stopPropagation() }>
          <button
            type="button"
            className={ `${styles.actionBtn} ${styles.actionBtnPrimary}` }
            onClick={ () => onSelectContact( row ) }
          >
            {dict?.btnViewAccounts || "Cuentas"}
            {row.paymentMethods && ( row.paymentMethods.length > 0 ) && ` (${row.paymentMethods.length})`}
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={ () => onEditContact( row ) }
          >
            {dict?.btnEdit || "Editar"}
          </button>
          <button
            type="button"
            className={ `${styles.actionBtn} ${styles.actionBtnDanger}` }
            onClick={ () => onArchiveContact( row ) }
          >
            {dict?.btnArchive || "Archivar"}
          </button>
        </div>
      ) ,
    } ,
  ] ;

  return(
    <DataTable
      columns={columns}
      data={contacts}
      loading={loading}
      emptyMessage={dict?.emptyState || "No se encontraron contactos en tu agenda."}
      onRowClick={onSelectContact}
      keyExtractor={ ( row ) => row.id }
    />
  ) ;
}
