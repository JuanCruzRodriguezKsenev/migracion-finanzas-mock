/**
 * @file CardVisual.tsx
 * Componente visual de tarjeta física digital con soporte de crédito y débito (RFC 007, RFC 025).
 * Recibe todas sus dependencias y locale por props, sin suscripción directa al contexto.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import { InstitutionLogo }    from "@/shared/ui/display/InstitutionLogo/InstitutionLogo" ;
import { formatCurrency }     from "@/shared/lib/currencyFormatter" ;
import type { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Cards
import styles                        from "./CardVisual.module.css" ;
import { CardWithAccountsAndEntity } from "../types" ;
import { deudaDe }                   from "../utils/ciclo" ;


export interface CardVisualProps {
  card:         CardWithAccountsAndEntity ;
  locale:       string ;
  dict?:        Awaited< ReturnType< typeof getDictionary > > ;
  onArchive?:   ( id: string ) => void ;
  onViewPlans?: ( card: CardWithAccountsAndEntity ) => void ;
}

/**
 * Renderiza el plástico interactivo de la tarjeta y su desglose financiero.
 */
export function CardVisual( {
  card ,
  locale ,
  dict ,
  onArchive ,
  onViewPlans ,
}: CardVisualProps ) {
  const isCredit = ( card.type === "credit" ) ;

  // Cálculo de deuda contable (la deuda es -balance)
  const deudaTotal = isCredit
    ? card.accounts.reduce( ( sum , ca ) => sum + deudaDe( ca.account ) , 0 )
    : 0 ;

  const monedaPrincipal = card.accounts[0]?.currency || "ARS" ;
  const limite          = ( card.creditLimit || 0 ) ;

  const cuotasFuturasPrincipal = ( card.ciclo?.cuotasFuturas?.[monedaPrincipal] ?? 0 ) ;
  const disponible             = Math.max( 0 , ( limite - deudaTotal - cuotasFuturasPrincipal ) ) ;

  const porcentajeConsumido = ( isCredit && ( limite > 0 ) )
    ? Math.min( 100 , Math.round( ( ( deudaTotal + cuotasFuturasPrincipal ) / limite ) * 100 ) )
    : 0 ;

  const esAlertaLimite = ( porcentajeConsumido >= 80 ) ;

  const planesActivosPrincipal = ( card.planes || [] ).filter(
    ( p ) => ( p.currency === monedaPrincipal ) && !p.archivedAt
  ) ;
  const cuotasPendientes = planesActivosPrincipal.reduce(
    ( sum , p ) => sum + Math.max( 0 , ( p.totalInstallments - p.cuotasImputadas ) ) , 0
  ) ;
  const mostrarFilaCuotasFuturas = Boolean(
    card.planes && ( card.planes.length > 0 ) && ( ( cuotasPendientes > 0 ) || ( cuotasFuturasPrincipal > 0 ) )
  ) ;

  const otrasCuotasFuturas = Object.entries( card.ciclo?.cuotasFuturas ?? {} )
    .filter( ( [ divisa , monto ] ) => ( divisa !== monedaPrincipal ) && ( monto > 0 ) ) ;

  const tieneCiclo = Boolean( card.ciclo?.cierreActual && card.ciclo?.vencimiento ) ;

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
              { isCredit ? ( dict?.cardsPage?.typeCredit || "Crédito" ) : ( dict?.cardsPage?.typeDebit || "Débito" ) }
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
            <span className={styles.holderLabel}>
              { dict?.cardsPage?.holder || "Titular" }
            </span>
            <span className={styles.holderName}>{ card.label }</span>
          </div>
          <div className={styles.expiryGroup}>
            <span className={styles.expiryLabel}>
              { dict?.cardsPage?.expiresShort || "Vence" }
            </span>
            <span className={styles.expiryValue}>{ expiryFormatted }</span>
          </div>
        </div>
      </div>

      { /* Panel Financiero del instrumento */ }
      <div className={styles.financialDetails}>
        { isCredit ? (
          <>
            { tieneCiclo ? (
              <>
                <div className={styles.balanceRow}>
                  <div className={styles.balanceStack}>
                    <span className={styles.balanceLabel}>
                      { dict?.cardsPage?.billedBalance || "Saldo facturado" }
                    </span>
                    <span className={styles.balanceHint}>
                      { dict?.cardsPage?.dueOnPrefix || "Vence el" } { formatearDia( card.ciclo!.vencimiento! , locale ) }
                    </span>
                  </div>
                  <span className={styles.balanceValue}>
                    { formatCurrency( card.ciclo!.facturado , monedaPrincipal , locale ) }
                  </span>
                </div>

                <div className={styles.balanceRow}>
                  <div className={styles.balanceStack}>
                    <span className={styles.balanceLabel}>
                      { dict?.cardsPage?.currentBalance || "Saldo en curso" }
                    </span>
                    <span className={styles.balanceHint}>
                      { dict?.cardsPage?.sinceClosingPrefix || "Desde el cierre del" } { formatearDia( card.ciclo!.cierreActual! , locale ) }
                    </span>
                  </div>
                  <span className={styles.balanceValueSoft}>
                    { formatCurrency( card.ciclo!.enCurso , monedaPrincipal , locale ) }
                  </span>
                </div>
              </>
            ) : null }

            { mostrarFilaCuotasFuturas ? (
              <div className={styles.balanceRow}>
                <div className={styles.balanceStack}>
                  <span className={styles.balanceLabel}>
                    { dict?.cardsPage?.futureInstallments || "Cuotas futuras" }
                  </span>
                  <span className={styles.balanceHint}>
                    { cuotasPendientes } { dict?.cardsPage?.installmentsPendingSuffix || "cuotas pendientes" }
                  </span>
                </div>
                <span className={styles.balanceValueSoft}>
                  { formatCurrency( cuotasFuturasPrincipal , monedaPrincipal , locale ) }
                </span>
              </div>
            ) : null }

            <div className={styles.balanceRow}>
              <span className={styles.balanceLabel}>
                { dict?.cardsPage?.totalDebt || "Deuda total" }
              </span>
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
                  <span>
                    { dict?.cardsPage?.available || "Disponible" }: { formatCurrency( disponible , monedaPrincipal , locale ) }
                  </span>
                  <span>
                    { dict?.cardsPage?.limit || "Límite" }: { formatCurrency( limite , monedaPrincipal , locale ) }
                  </span>
                </div>
              </div>
            ) : null }

            <div className={styles.badgeRow}>
              { card.monthlyMaintenanceFee > 0 ? (
                <span className={styles.metaBadge}>
                  { dict?.cardsPage?.maintenance || "Mantenimiento" }: { formatCurrency( card.monthlyMaintenanceFee , "ARS" , locale ) }
                </span>
              ) : null }

              { card.annualRenewalFee > 0 ? (
                <span className={styles.metaBadge}>
                  { dict?.cardsPage?.renewal || "Renovación" }: { formatCurrency( card.annualRenewalFee , "ARS" , locale ) }
                </span>
              ) : null }

              { card.interestRateFinancing ? (
                <span className={styles.metaBadge}>
                  TNA: { ( card.interestRateFinancing / 100 ).toFixed( 1 ) }%
                </span>
              ) : null }

              { otrasCuotasFuturas.map( ( [ divisa , monto ] ) => (
                <span key={divisa} className={styles.metaBadge}>
                  { dict?.cardsPage?.futureInstallments || "Cuotas futuras" } ({ divisa }): { formatCurrency( monto , divisa , locale ) }
                </span>
              ) ) }
            </div>

            { ( !tieneCiclo && ( card.closingDay || card.dueDay ) ) ? (
              <div className={styles.datesRow}>
                { card.closingDay ? (
                  <span>{ dict?.cardsPage?.closingDayPrefix || "Cierre: día" } { card.closingDay }</span>
                ) : null }
                { card.dueDay ? (
                  <span>{ dict?.cardsPage?.dueDayPrefix || "Vence: día" } { card.dueDay }</span>
                ) : null }
              </div>
            ) : null }
          </>
        ) : (
          <div className={styles.balanceRow}>
            <div className={styles.debitAccountStack}>
              <span className={styles.balanceLabel}>
                { dict?.cardsPage?.accountBalance || "Saldo en cuenta" }
              </span>
              <span className={styles.debitAccountName}>
                { card.linkedAccount?.name || ( dict?.cardsPage?.linkedAccountFallback || "Cuenta vinculada" ) }
              </span>
            </div>
            <span className={styles.balanceValue}>
              { card.linkedAccount
                ? formatCurrency( card.linkedAccount.balance , card.linkedAccount.currency , locale )
                : "-" }
            </span>
          </div>
        ) }

        { ( ( isCredit && onViewPlans ) || onArchive ) ? (
          <div className={styles.cardActionsRow}>
            { ( isCredit && onViewPlans ) ? (
              <button
                type="button"
                className={styles.viewPlansButton}
                onClick={ () => onViewPlans( card ) }
              >
                { dict?.cardsPage?.viewPlans || "Ver planes" }
              </button>
            ) : null }

            { onArchive ? (
              <button
                type="button"
                className={styles.archiveButton}
                onClick={ () => onArchive( card.id ) }
              >
                { dict?.cardsPage?.archiveCard || "Dar de baja" }
              </button>
            ) : null }
          </div>
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
  return( new Intl.DateTimeFormat( locale , { day: "numeric" , month: "short" } ).format( new Date( iso ) ) ) ;
}
