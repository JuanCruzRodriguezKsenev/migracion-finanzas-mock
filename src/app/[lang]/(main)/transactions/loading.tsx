/**
 * @file loading.tsx
 * Estado de carga de la página de Transacciones (Libro Diario).
 */
import React from "react" ;

// Shared
import { Skeleton } from "@/shared/ui/feedback/Skeleton/Skeleton" ;
import styles       from "./loading.module.css" ;


export default function TransactionsLoading() {
  return(
    <div className={styles.container}>
      <div className={styles.headerBar}>
        <Skeleton width="14rem" height="2.5rem" radius="var(--radius-sm)" />
        <Skeleton width="10rem" height="2.5rem" radius="var(--radius-sm)" />
      </div>
      <Skeleton width="100%" height="3.5rem" radius="var(--radius-md)" />
      <div className={styles.tableSkeleton}>
        <Skeleton width="100%" height="20rem" radius="var(--radius-md)" />
      </div>
    </div>
  ) ;
}
