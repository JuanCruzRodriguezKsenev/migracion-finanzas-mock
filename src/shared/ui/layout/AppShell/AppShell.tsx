/**
 * @file AppShell.tsx
 * Componente envolvente principal (App Shell) interactivo para el diseño responsivo.
 * Coordina el estado del Drawer lateral en móvil y el Bottom Nav flotante.
 * Utiliza CSS Modules para el encapsulamiento de estilos.
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;

// Shared
import type { getDictionary } from "@/shared/lib/dictionary" ;
import { BottomNav }          from "@/shared/ui/layout/BottomNav/BottomNav" ;
import { Navbar }             from "@/shared/ui/layout/Navbar/Navbar" ;
import styles from "./AppShell.module.css" ;

interface AppShellProps {
  children: React.ReactNode ;
  dict:     Awaited< ReturnType< typeof getDictionary > > ;
  /** Selector de organización ya armado por el layout; si no llega, el Navbar no lo muestra. */
  selector?: React.ReactNode ;
}

/**
 * App Shell unificado para la aplicación.
 * Maneja el estado de visibilidad del sidebar en móvil (Drawer).
 */
export function AppShell( {children , dict , selector}: AppShellProps ) {
  const [ isDrawerOpen , setIsDrawerOpen ] = useState( false ) ;

  const openDrawer  = () => setIsDrawerOpen( true ) ;
  const closeDrawer = () => setIsDrawerOpen( false ) ;

  return(
    <div className={styles.appContainer}>
      {/* Overlay oscuro de fondo en móvil */}
      {isDrawerOpen ? (
        <div className={ `${styles.drawerOverlay} ${styles.open}` } onClick={closeDrawer} />
      ) : null}

      {/* Navbar (Desktop / Mobile Drawer) */}
      <Navbar
        dict={dict.sidebar}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        selector={selector}
      />

      <div className={styles.mainWrapper}>
        <main className={styles.contentContainer}>
          {children}
        </main>
      </div>

      {/* Bottom Nav móvil */}
      <BottomNav
        dict={dict.sidebar}
        onMenuClick={openDrawer}
      />
    </div>
  ) ;
}
