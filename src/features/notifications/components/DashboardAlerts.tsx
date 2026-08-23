/**
 * @file DashboardAlerts.tsx
 * Banners de alertas destacados en la parte superior del Dashboard.
 * Permite a los usuarios reaccionar inmediatamente a deudas pendientes y confirmaciones de pago.
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;

// Feature: Notifications
import { formatCents }      from "@/features/accounting/utils/dashboardMetrics" ;
import { useNotifications } from "../context/NotificationsContext" ;
import styles               from "./DashboardAlerts.module.css" ;


interface DashboardAlertsProps {
  lang?: string ;
}

const t = {
  es: {
    debtTitle:        "Pendiente de Liquidación" ,
    receiptTitle:     "Confirmar Recepción de Pago" ,
    owes:             "Le debes" ,
    to:               "a" ,
    for:              "por el evento" ,
    copied:           "¡Copiado!" ,
    copy:             "Copiar Alias" ,
    transferred:      "Ya transferí" ,
    indicates:        "indicó que te transfirió" ,
    receivedQuestion: "¿Recibiste el dinero?" ,
    confirm:          "Confirmar Recibido" ,
    reject:           "Rechazar" ,
    alias:            "Alias:" ,
  } ,
  en: {
    debtTitle:        "Pending Liquidation" ,
    receiptTitle:     "Confirm Payment Receipt" ,
    owes:             "You owe" ,
    to:               "to" ,
    for:              "for event" ,
    copied:           "Copied!" ,
    copy:             "Copy Alias" ,
    transferred:      "I Transferred" ,
    indicates:        "indicated they transferred" ,
    receivedQuestion: "Did you receive the money?" ,
    confirm:          "Confirm Received" ,
    reject:           "Reject" ,
    alias:            "Alias:" ,
  } ,
  br: {
    debtTitle:        "Liquidação Pendente" ,
    receiptTitle:     "Confirmar Recebimento de Pagamento" ,
    owes:             "Você deve" ,
    to:               "para" ,
    for:              "pelo evento" ,
    copied:           "Copiado!" ,
    copy:             "Copiar Alias" ,
    transferred:      "Já transferi" ,
    indicates:        "indicou que transferiu" ,
    receivedQuestion: "Você recebeu o dinheiro?" ,
    confirm:          "Confirmar Recebido" ,
    reject:           "Rejeitar" ,
    alias:            "Alias:" ,
  }
} ;

export function DashboardAlerts( {lang = "es"}: DashboardAlertsProps ) {
  const { notifications , markAsSent , confirmReceipt , rejectReceipt } = useNotifications() ;
  const [ copiedId , setCopiedId ] = useState< string | null >( null ) ;

  const currentLang = ( lang === "en" || lang === "br" ) ? lang : "es" ;
  const dict = t[currentLang] ;

  // Mostrar solo notificaciones que requieran acción del usuario logueado:
  // 1. Deudas propias pendientes (status === "pending")
  // 2. Cobros informados por otros esperando confirmación (status === "sent")
  const activeAlerts = notifications.filter(
    ( n ) => ( n.type === "debt" && n.status === "pending" ) || ( n.type === "receipt" && n.status === "sent" )
  ) ;

  if( activeAlerts.length === 0 ) { return( null ) ; }

  const handleCopyAlias = ( id: string , alias: string ) => {
    navigator.clipboard.writeText( alias ) ;
    setCopiedId( id ) ;
    setTimeout( () => setCopiedId( null ) , 2000 ) ;
  } ;

  return(
    <div className={styles.alertsContainer}>
      {activeAlerts.map( ( n ) => {
        const isDebt = ( n.type === "debt" ) ;
        const formattedAmount = formatCents( n.amount ) ;

        return(
          <div
            key={n.id}
            className={ `${styles.alertBanner} ${isDebt ? styles.alertDebt : styles.alertReceipt}` }
          >
            <div className={styles.alertLeft}>
              <div className={ `${styles.alertIcon} ${isDebt ? styles.iconDebt : styles.iconReceipt}` }>
                {isDebt ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                )}
              </div>

              <div className={styles.alertMeta}>
                <span className={styles.alertTitle}>
                  {isDebt ? `${dict.debtTitle}: ${n.event}` : dict.receiptTitle}
                </span>
                <span className={styles.alertDesc}>
                  {isDebt ? (
                    <>
                      {dict.owes} <span className={styles.bold}>{formattedAmount}</span> {dict.to} <span className={styles.bold}>{n.name}</span> {dict.for} <span className={styles.bold}>{n.event}</span>.
                      {n.alias && (
                        <>
                          <span className={styles.aliasLabel}>{dict.alias}</span>
                          <span className={styles.bankDetail}>{n.alias}</span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <span className={styles.bold}>{n.name}</span> {dict.indicates} <span className={styles.bold}>{formattedAmount}</span> {dict.for} <span className={styles.bold}>{n.event}</span>. {dict.receivedQuestion}
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className={styles.actions}>
              {isDebt ? (
                <>
                  {n.alias && (
                    <button
                      className={styles.btnSecondary}
                      onClick={ () => handleCopyAlias( n.id , n.alias! ) }
                    >
                      {copiedId === n.id ? dict.copied : dict.copy}
                    </button>
                  )}
                  <button
                    className={styles.btnAction}
                    onClick={ () => markAsSent( n.id ) }
                  >
                    {dict.transferred}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={styles.btnAction}
                    onClick={ () => confirmReceipt( n.id ) }
                  >
                    {dict.confirm}
                  </button>
                  <button
                    className={styles.btnDanger}
                    onClick={ () => rejectReceipt( n.id ) }
                  >
                    {dict.reject}
                  </button>
                </>
              )}
            </div>
          </div>
        ) ;
      } )}
    </div>
  ) ;
}
