/**
 * @file MetricsVisibilityContext.tsx
 * Contexto de React para gestionar la visibilidad de métricas y saldos sensibles.
 * Persiste la preferencia en localStorage.
 */
"use client" ;

// Librerías externas
import React , { createContext , useContext , useSyncExternalStore } from "react" ;

export interface MetricsVisibilityContextType {
  isContentVisible: boolean ;
  toggleVisibility: () => void ;
}

export const MetricsVisibilityContext = createContext<MetricsVisibilityContextType>( {
  isContentVisible: true ,
  toggleVisibility: () => {}
} ) ;

interface MetricsVisibilityProviderProps {
  children: React.ReactNode ;
}

const STORAGE_KEY = "metrics-balances-visible" ;

// localStorage es un store externo: se lee vía useSyncExternalStore en vez de duplicarlo en useState.
function subscribe( callback: () => void ) {
  window.addEventListener( "storage" , callback ) ;
  return( () => window.removeEventListener( "storage" , callback ) ) ;
}

function getSnapshot(): boolean {
  const stored = localStorage.getItem( STORAGE_KEY ) ;
  return( stored === null ? true : (stored === "true") ) ;
}

function getServerSnapshot(): boolean {
  return( true ) ;
}

/**
 * Proveedor del contexto de visibilidad de métricas.
 */
export function MetricsVisibilityProvider( {children}: MetricsVisibilityProviderProps ) {
  const isContentVisible = useSyncExternalStore( subscribe , getSnapshot , getServerSnapshot ) ;

  function toggleVisibility() {
    localStorage.setItem( STORAGE_KEY , String( !isContentVisible ) ) ;
    // El evento "storage" nativo solo se dispara en otras pestañas: se despacha
    // manualmente para notificar al suscriptor local y forzar la relectura del snapshot.
    window.dispatchEvent( new Event( "storage" ) ) ;
  }

  return(
    <MetricsVisibilityContext.Provider value={ {isContentVisible , toggleVisibility} }>
      {children}
    </MetricsVisibilityContext.Provider>
  ) ;
}

/**
 * Hook para consumir el estado de visibilidad de métricas.
 */
export function useMetricsVisibility() {
  return( useContext( MetricsVisibilityContext ) ) ;
}
