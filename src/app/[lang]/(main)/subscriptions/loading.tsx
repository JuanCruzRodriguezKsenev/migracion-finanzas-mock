/**
 * @file loading.tsx
 * Estado de carga de la página de Suscripciones mientras se resuelven los Server Components.
 */
import React from "react" ;

// Shared
import { Skeleton } from "@/shared/ui/feedback/Skeleton/Skeleton" ;

// Local styles
import styles from "./loading.module.css" ;


export default function SubscriptionsLoading() {
  return(
    <div className={styles.container}>
      <div className={styles.actionBar}>
        <Skeleton width="10rem" height="1.25rem" radius="var(--radius-sm)" />
        <Skeleton width="7rem" height="2.25rem" radius="var(--radius-sm)" />
      </div>
      <Skeleton height="clamp(24rem, 60vh, 44rem)" radius="1.5rem" />
      <Skeleton height="4.5rem" radius="1.25rem" />
    </div>
  ) ;
}
