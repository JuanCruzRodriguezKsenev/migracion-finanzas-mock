/**
 * @file loading.tsx
 * Estado de carga de la página de Cuentas mientras se resuelven los Server Components.
 */
import React from "react" ;

// Shared
import { Skeleton } from "@/shared/ui/feedback/Skeleton/Skeleton" ;

// Local styles
import styles from "./loading.module.css" ;


export default function AccountsLoading() {
  return(
    <div className={styles.container}>
      <div className={styles.actionBar}>
        <Skeleton width="9rem" height="2.25rem" radius="var(--radius-sm)" />
      </div>
      <div className={styles.grid}>
        <Skeleton height="9rem" radius="1rem" />
        <Skeleton height="9rem" radius="1rem" />
        <Skeleton height="9rem" radius="1rem" />
      </div>
    </div>
  ) ;
}
