/**
 * @file CardVisual.tsx
 * Componente visual de tarjeta física digital con soporte de crédito y débito (RFC 007).
 * Recibe todas sus dependencias y locale por props, sin suscripción directa al contexto.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import { InstitutionLogo } from "@/shared/ui/display/InstitutionLogo/InstitutionLogo" ;
import { formatCurrency }  from "@/shared/lib/currencyFormatter" ;

// Feature: Cards
import { CardWithAccountsAndEntity } from "../types" ;
import { deudaDe }                   from "../utils/ciclo" ;
import styles                        from "./CardVisual.module.css" ;


export interface CardVisualProps {
  card:       CardWithAccountsAndEntity ;
  locale:     string ;
  onArchive?: ( id: string ) => void ;
}

/**
 * Renderiza el plástico interactivo de la tarjeta y su desglose financiero.
 */
export function CardVisual( { card , locale , onArchive }: CardVisualProps ) {
  const isCredit = ( card.type === "credit" ) ;

  // Cálculo de deuda contable (la deuda es -balance)
  const deudaTotal = isCredit
    ? card.accounts.reduce( ( sum , ca ) => sum + deudaDe( ca.account ) , 0 )
    : 0 ;

  const monedaPrincipal = card.accounts[0]?.currency || "ARS" ;
  const limite          = ( card.creditLimit || 0 ) ;
  const disponible      = Math.max( 0 , limite - deudaTotal ) ;

  const porcentajeConsumido = ( isCredit && ( limite > 0 ) )
    ? Math.min( 100 , Math.round( ( deudaTotal / limite ) * 100 ) )
    : 0 ;

  const esAlertaLimite = ( porcentajeConsumido >= 80 ) ;

  const brandBgColor = card.entity?.color || "#1e293b" ;

  const expiryFormatted = `${String( card.expiryMonth ).padStart( 2 , "0" )}/${String( card.expiryYear ).slice( -2 )}` ;

  return(
    <div style={ { width: "100%" , maxWidth: "clamp(20rem, 18rem + 10vw, 26rem)" } }>
      { /* Plástico de la tarjeta */ }
      <div
        className={styles.cardContainer}
        style={ { "--card-brand-bg": brandBgColor } as React.CSSProperties }
      >
        <div className={styles.glassOverlay} />

        <div className={styles.topRow}>
          <div className={styles.brandGroup}>
            { card.entity?.brandDomain ? (
              <InstitutionLogo
                institution={card.entity.name}
                brandDomain={card.entity.brandDomain}
                logoUrl={card.entity.logo}
                size={28}
              />
            ) : null }
            <span className={styles.cardTypeBadge}>
              { isCredit ? "Crédito" : "Débito" }
            </span>
          </div>
          <span className={styles.networkBadge}>
            { card.network }
          </span>
        </div>

        <div className={styles.chipArea}>
          <div className={styles.chip} />
        </div>

        <div className={styles.numberRow}>
          •••• •••• •••• { card.lastFour }
        </div>

        <div className={styles.bottomRow}>
          <div className={styles.cardHolder}>
            <span className={styles.holderLabel}>Titular</span>
            <span className={styles.holderName}>{ card.label }</span>
          </div>
          <div className={styles.expiryGroup}>
            <span className={styles.expiryLabel}>Vence</span>
            <span className={styles.expiryValue}>{ expiryFormatted }</span>
          </div>
        </div>
      </div>

      { /* Panel Financiero del instrumento */ }
      <div className={styles.financialDetails}>
        { isCredit ? (
          <>
            { card.ciclo ? (
              <>
                <div className={styles.balanceRow}>
                  <div className={styles.balanceStack}>
                    <span className={styles.balanceLabel}>Saldo facturado</span>
                    <span className={styles.balanceHint}>
                      Vence el { formatearDia( card.ciclo.vencimiento , locale ) }
                    </span>
                  </div>
                  <span className={styles.balanceValue}>
                    { formatCurrency( card.ciclo.facturado , monedaPrincipal , locale ) }
                  </span>
                </div>

                <div className={styles.balanceRow}>
                  <div className={styles.balanceStack}>
                    <span className={styles.balanceLabel}>Saldo en curso</span>
                    <span className={styles.balanceHint}>
                      Desde el cierre del { formatearDia( card.ciclo.cierreActual , locale ) }
                    </span>
                  </div>
                  <span className={styles.balanceValueSoft}>
                    { formatCurrency( card.ciclo.enCurso , monedaPrincipal , locale ) }
                  </span>
                </div>
              </>
            ) : null }

            <div className={styles.balanceRow}>
              <span className={styles.balanceLabel}>Deuda Total</span>
              <span className={styles.balanceValue}>
                { formatCurrency( deudaTotal , monedaPrincipal , locale ) }
              </span>
            </div>

            { limite > 0 ? (
              <div className={styles.progressContainer}>
                <div className={styles.progressTrack}>
                  <div
                    className={ `${styles.progressBar} ${esAlertaLimite ? styles.progressBarAlert : ""}` }
                    style={ { width: `${porcentajeConsumido}%` } }
                  />
                </div>
                <div className={styles.progressMeta}>
                  <span>Disponible: { formatCurrency( disponible , monedaPrincipal , locale ) }</span>
                  <span>Límite: { formatCurrency( limite , monedaPrincipal , locale ) }</span>
                </div>
              </div>
            ) : null }

            <div className={styles.badgeRow}>
              { card.monthlyMaintenanceFee > 0 ? (
                <span className={styles.metaBadge}>
                  Mantenimiento: { formatCurrency( card.monthlyMaintenanceFee , "ARS" , locale ) }
                </span>
              ) : null }

              { card.annualRenewalFee > 0 ? (
                <span className={styles.metaBadge}>
                  Renovación: { formatCurrency( card.annualRenewalFee , "ARS" , locale ) }
                </span>
              ) : null }

              { card.interestRateFinancing ? (
                <span className={styles.metaBadge}>
                  TNA: { ( card.interestRateFinancing / 100 ).toFixed( 1 ) }%
                </span>
              ) : null }
            </div>

            { ( !card.ciclo && (card.closingDay || card.dueDay) ) ? (
              <div className={styles.datesRow}>
                { card.closingDay ? <span>Cierre: día { card.closingDay }</span> : null }
                { card.dueDay ? <span>Vence: día { card.dueDay }</span> : null }
              </div>
            ) : null }
          </>
        ) : (
          <div className={styles.balanceRow}>
            <div style={ { display: "flex" , flexDirection: "column" , gap: "0.2rem" } }>
              <span className={styles.balanceLabel}>Saldo en Cuenta</span>
              <span style={ { fontSize: "var(--fs-xs)" , color: "var(--text-muted)" } }>
                { card.linkedAccount?.name || "Cuenta vinculada" }
              </span>
            </div>
            <span className={styles.balanceValue}>
              { card.linkedAccount
                ? formatCurrency( card.linkedAccount.balance , card.linkedAccount.currency , locale )
                : "-" }
            </span>
          </div>
        ) }

        { onArchive ? (
          <button
            type="button"
            className={styles.archiveButton}
            onClick={ () => onArchive( card.id ) }
          >
            Dar de baja
          </button>
        ) : null }
      </div>
    </div>
  ) ;
}

/**
 * Formatea una fecha ISO como día y mes cortos en el locale del usuario.
 *
 * @param iso - Fecha en ISO 8601, tal como viaja desde el servidor.
 * @param locale - Locale BCP 47 del perfil.
 * @returns La fecha en formato corto (ej: "5 oct").
 */
function formatearDia( iso: string , locale: string ): string {
  return( new Intl.DateTimeFormat( locale , {day: "numeric" , month: "short"} ).format( new Date(iso) ) ) ;
}
