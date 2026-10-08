/**
 * @file PermissionsProvider.tsx
 * Permisos de escritura de la sesión sobre su organización activa (RN-22, RN-27).
 * El layout calcula `puedeEscribir` del rol de la membresía activa y los componentes lo leen con
 * `usePuedeEscribir()` para OCULTAR (no deshabilitar) los controles de alta, edición, reversa y archivado.
 * No es seguridad: la decisión real la toma `obtenerSesionDeEscritura()` en el servidor.
 */
"use client" ;

// Librerías externas
import React , { createContext , useContext } from "react" ;

/** Fail-closed: un componente fuera del provider no muestra acciones de escritura. */
const PermissionsContext = createContext< boolean >( false ) ;

interface PermissionsProviderProps {
  /** `true` si el rol de la membresía activa es `owner` o `member`. */
  puedeEscribir: boolean ;
  children:      React.ReactNode ;
}

/**
 * Provee si la sesión puede escribir en la organización activa.
 */
export function PermissionsProvider( { puedeEscribir , children }: PermissionsProviderProps ) {
  return(
    <PermissionsContext.Provider value={puedeEscribir}>
      {children}
    </PermissionsContext.Provider>
  ) ;
}

/**
 * ¿La sesión puede escribir en la organización activa? `false` fuera del provider.
 */
export function usePuedeEscribir(): boolean {
  return( useContext( PermissionsContext ) ) ;
}

/**
 * Muestra a sus hijos sólo si la sesión puede escribir. Sirve a los Server Components, que no pueden usar el hook.
 */
export function SoloConPermiso( { children }: { children: React.ReactNode } ) {
  return( usePuedeEscribir() ? <>{children}</> : null ) ;
}
