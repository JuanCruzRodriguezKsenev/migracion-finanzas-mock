/**
 * @file loading.tsx
 * Estado de carga simple de la página de Sandbox.
 */
import React from "react" ;

// Shared
import { Skeleton } from "@/shared/ui/feedback/Skeleton/Skeleton" ;


export default function SandboxLoading() {
  return( <Skeleton height="20rem" radius="var(--radius-lg)" /> ) ;
}
