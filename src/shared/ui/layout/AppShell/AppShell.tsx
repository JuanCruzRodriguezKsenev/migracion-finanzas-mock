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
import { Header }             from "@/shared/ui/layout/Header/Header" ;
import styles from "./AppShell.module.css" ;

interface AppShellProps {
  children:         React.ReactNode ;
  lang:             string ;
  dict:             Awaited< ReturnType< typeof getDictionary > > ;
  currentMonthKey?: string ;
}

/**
 * App Shell unificado para la aplicación.
 * Maneja el estado de visibilidad del sidebar en móvil (Drawer).
 */
export function AppShell( {children , lang , dict , currentMonthKey}: AppShellProps ) {
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
      />

      <div className={styles.mainWrapper}>
        <Header
          dict={dict}
          onMenuClick={openDrawer}
          lang={lang}
          currentMonthKey={currentMonthKey}
        />
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
