/**
 * @file loading.tsx
 * Estado de carga de la página de Metas mientras se resuelven los Server Components.
 */
import React from "react" ;

// Shared
import { Skeleton } from "@/shared/ui/feedback/Skeleton/Skeleton" ;

// Local styles
import styles from "./loading.module.css" ;


export default function GoalsLoading() {
  return(
    <div className={styles.container} aria-busy="true">
      <Skeleton width="40%" height="2rem" />
      <div className={styles.metrics}>
        <Skeleton height="5rem" radius="1rem" />
        <Skeleton height="5rem" radius="1rem" />
        <Skeleton height="5rem" radius="1rem" />
        <Skeleton height="5rem" radius="1rem" />
        <Skeleton height="5rem" radius="1rem" />
      </div>
      <div className={styles.grid}>
        <Skeleton height="12rem" radius="1rem" />
        <Skeleton height="12rem" radius="1rem" />
        <Skeleton height="12rem" radius="1rem" />
      </div>
    </div>
  ) ;
}
