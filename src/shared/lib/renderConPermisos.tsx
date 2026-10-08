/**
 * @file renderConPermisos.tsx
 * Helper de pruebas: renderiza un componente cliente dentro del `PermissionsProvider` real.
 * Los contenedores ocultan sus controles de escritura si no hay provider (fail-closed), así que
 * toda prueba que los ejercite necesita uno; por omisión, con permiso de escritura.
 */
// Librerías externas
import React                                  from "react" ;
import { render , type RenderOptions }        from "@testing-library/react" ;

// Shared
import { PermissionsProvider } from "@/shared/providers/PermissionsProvider" ;


/**
 * Igual que `render` de Testing Library, pero con el `PermissionsProvider` alrededor.
 *
 * @param ui - Árbol a renderizar.
 * @param opciones - Opciones de Testing Library más `puedeEscribir` (por omisión `true`).
 */
export function renderConPermisos( ui: React.ReactElement , opciones: Omit< RenderOptions , "wrapper" > & { puedeEscribir?: boolean } = {} ) {
  const { puedeEscribir = true , ...resto } = opciones ;

  return( render(
    <PermissionsProvider puedeEscribir={puedeEscribir}>{ui}</PermissionsProvider> ,
    resto
  ) ) ;
}
