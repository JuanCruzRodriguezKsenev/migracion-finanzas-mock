/**
 * @file SubscriptionBadge.tsx
 * Badge de porcentaje del gasto total que representa una suscripción en el treemap.
 */
// Librerías externas
import React from "react" ;

// Feature: Subscriptions
import styles from "./SubscriptionCard.module.css" ;


interface SubscriptionBadgeProps {
  percent:    number ;
  textColor?: string ;
}

/**
 * Píldora con el porcentaje del gasto mensual total que ocupa la suscripción.
 * El color de texto es dinámico (color de marca), por eso viaja como style inline.
 */
export function SubscriptionBadge( { percent , textColor = "#6B7280" }: SubscriptionBadgeProps ) {
  return(
    <span
      className={styles.badge}
      style={ {color: textColor} }
    >
      { percent }%
    </span>
  ) ;
}
