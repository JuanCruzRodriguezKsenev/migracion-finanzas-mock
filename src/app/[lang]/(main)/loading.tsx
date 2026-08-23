/**
 * @file loading.tsx
 * Estado de carga del Dashboard mientras se resuelven los Server Components.
 */
import React from "react" ;

// Shared
import { Skeleton } from "@/shared/ui/feedback/Skeleton/Skeleton" ;

// Local styles
import styles from "./loading.module.css" ;


export default function DashboardLoading() {
  return(
    <div className={styles.container}>
      <Skeleton height="11.25rem" radius="var(--radius-lg)" />
      <div className={styles.grid}>
        <Skeleton height="7.1875rem" radius="var(--radius-md)" />
        <Skeleton height="7.1875rem" radius="var(--radius-md)" />
        <Skeleton height="7.1875rem" radius="var(--radius-md)" />
      </div>
    </div>
  ) ;
}
