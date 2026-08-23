/**
 * @file SubscriptionCard.tsx
 * Tarjeta individual del treemap de suscripciones.
 * Se tematiza con el color oficial de la marca (brand-adaptive-surface) y ajusta
 * su layout mediante container queries según las proporciones reales del tile.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import { formatCurrency } from "@/shared/lib/currencyFormatter" ;

// Feature: Subscriptions
import { SubscriptionWithStats } from "../types" ;
import { SubscriptionBadge }     from "./SubscriptionBadge" ;
import { SubscriptionIcon }      from "./SubscriptionIcon" ;
import { getLogoConfig }         from "../utils/logoMap" ;
import styles                    from "./SubscriptionCard.module.css" ;


interface SubscriptionCardProps {
  subscription:    SubscriptionWithStats ;
  size:            "large" | "medium" | "small" | "tiny" | "micro" ;
  yearlySuffix:    string ; // ej: "/año" — proviene del diccionario
  editTitle:       string ;
  deleteTitle:     string ;
  animationDelay?: number ;
  onEdit?:         ( id: string ) => void ;
  onDelete?:       ( id: string ) => void ;
}

/**
 * Tarjeta de suscripción con acciones de edición/eliminación visibles al hover (CSS puro).
 */
export function SubscriptionCard( {
  subscription ,
  size = "medium" ,
  yearlySuffix ,
  editTitle ,
  deleteTitle ,
  animationDelay = 0 ,
  onEdit ,
  onDelete ,
}: SubscriptionCardProps ) {
  const config = getLogoConfig( subscription.logoKey ) ;

  const monthlyLabel = formatCurrency( subscription.monthlyAmount , subscription.currency , "es-AR" ) ;
  const yearlyLabel  = `~${formatCurrency( subscription.yearlyAmount , subscription.currency , "es-AR" )}${yearlySuffix}` ;

  return(
    <div
      className={ `${styles.card} brand-adaptive-surface` }
      data-size={size}
      data-brand={subscription.logoKey.toLowerCase()}
      style={ {
        animationDelay:       `${animationDelay}ms` ,
        "--user-brand-color": subscription.color ,
      } as React.CSSProperties }
    >
      {/* Cabecera */}
      <div className={styles.cardHeader}>
        <div className={styles.iconWrapper}>
          <SubscriptionIcon logoKey={subscription.logoKey} />
        </div>
        <div className={styles.badgeWrapper}>
          <SubscriptionBadge
            percent={subscription.percentOfTotal}
            textColor={config.textColor}
          />
        </div>
      </div>

      {/* Cuerpo */}
      <div className={styles.cardBody}>
        <p className={styles.serviceName}>{ subscription.name }</p>
        <p className={styles.priceLabel}>{ monthlyLabel }</p>
        <p className={styles.yearlyLabel}>{ yearlyLabel }</p>
      </div>

      {/* Acciones: siempre en el DOM, visibles vía CSS :hover (sin re-renders) */}
      {(onEdit || onDelete) ? (
        <div className={styles.actionGroup}>
          {onEdit ? (
            <button
              onClick={ ( e ) => { e.stopPropagation() ; onEdit( subscription.id ) ; } }
              className={styles.actionButton}
              title={editTitle}
              aria-label={editTitle}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          ) : null}
          {onDelete ? (
            <button
              onClick={ ( e ) => { e.stopPropagation() ; onDelete( subscription.id ) ; } }
              className={ `${styles.actionButton} ${styles.deleteButton}` }
              title={deleteTitle}
              aria-label={deleteTitle}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  ) ;
}
