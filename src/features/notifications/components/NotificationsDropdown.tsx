/**
 * @file NotificationsDropdown.tsx
 * Componente de lista de notificaciones desplegable.
 * Muestra el flujo interactivo de confirmación y liquidación de deudas por eventos.
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;

// Shared
import type { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Notifications
import { formatCents }      from "@/features/accounting/utils/dashboardMetrics" ;
import { useNotifications } from "../context/NotificationsContext" ;
import styles               from "./NotificationsDropdown.module.css" ;


interface NotificationsDropdownProps {
  dict: Awaited< ReturnType< typeof getDictionary > >["notifications"] ;
}

export function NotificationsDropdown( {dict}: NotificationsDropdownProps ) {
  const { notifications , markAsSent , confirmReceipt , rejectReceipt , resetDemo } = useNotifications() ;
  const [ copiedId , setCopiedId ] = useState< string | null >( null ) ;

  const handleCopyAlias = ( id: string , alias: string ) => {
    navigator.clipboard.writeText( alias ) ;
    setCopiedId( id ) ;
    setTimeout( () => setCopiedId( null ) , 2000 ) ;
  } ;

  return(
    <div className={styles.dropdownWrap}>
      <div className={styles.header}>
        <span className={styles.title}>{dict.title}</span>
        <button className={styles.resetBtn} onClick={resetDemo}>
          {dict.resetDemo}
        </button>
      </div>

      <div className={styles.list}>
        {notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            {dict.empty}
          </div>
        ) : (
          notifications.map( ( n ) => {
            const isDebt = ( n.type === "debt" ) ;
            const formattedAmount = formatCents( n.amount ) ;

            return(
              <div key={n.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={ `${styles.cardCategory} ${isDebt ? styles.categoryDebt : styles.categoryReceipt}` }>
                    {isDebt ? `${dict.debtTitle}: ${n.event}` : dict.receiptTitle}
                  </span>
                  {isDebt && (
                    <span className={ `${styles.badge} ${n.status === "pending" ? styles.badgePending : styles.badgeSent}` }>
                      {n.status === "pending" ? dict.debtStatusPending : dict.debtStatusSent}
                    </span>
                  )}
                  {!isDebt && (
                    <span className={ `${styles.badge} ${n.status === "pending" ? styles.badgePending : styles.badgeSent}` }>
                      {n.status === "pending" ? dict.receiptStatusPending : dict.debtStatusSent}
                    </span>
                  )}
                </div>

                <div className={styles.cardBody}>
                  {isDebt ? (
                    <>
                      {dict.owes} <span className={styles.bold}>{formattedAmount}</span> {dict.to} <span className={styles.bold}>{n.name}</span>.
                    </>
                  ) : (
                    <>
                      <span className={styles.bold}>{n.name}</span> {dict.indicates} <span className={styles.bold}>{formattedAmount}</span> {dict.for} <span className={styles.bold}>{n.event}</span>. {dict.receivedQuestion}
                    </>
                  )}
                </div>

                {/* Bloque bancario para tipo DEUDA */}
                {isDebt && n.status === "pending" && n.alias && (
                  <div className={styles.aliasBox}>
                    <div className={styles.aliasWrap}>
                      <span className={styles.aliasLabel}>{dict.aliasLabel}</span>
                      <span className={styles.aliasText}>{n.alias}</span>
                    </div>
                    <button
                      className={styles.copyBtn}
                      onClick={ () => handleCopyAlias( n.id , n.alias! ) }
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      {copiedId === n.id ? dict.copied : dict.copy}
                    </button>
                  </div>
                )}

                {/* Acciones de liquidación */}
                {isDebt && n.status === "pending" && (
                  <button
                    className={styles.primaryBtn}
                    onClick={ () => markAsSent( n.id ) }
                  >
                    {dict.transferred}
                  </button>
                )}

                {!isDebt && n.status === "sent" && (
                  <div className={styles.actionsRow}>
                    <button
                      className={styles.primaryBtn}
                      onClick={ () => confirmReceipt( n.id ) }
                    >
                      {dict.confirm}
                    </button>
                    <button
                      className={styles.dangerBtn}
                      onClick={ () => rejectReceipt( n.id ) }
                    >
                      {dict.reject}
                    </button>
                  </div>
                )}
              </div>
            ) ;
          } )
        )}
      </div>
    </div>
  ) ;
}
