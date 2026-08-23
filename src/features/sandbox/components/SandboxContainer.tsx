/**
 * @file SandboxContainer.tsx
 * Componente principal contenedor de Sandboxes.
 * Provee un menú de pestañas (Tabs) para alternar entre diferentes entornos de pruebas (Dashboard, Cuentas, etc.).
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;

// Shared
import type { getDictionary } from "@/shared/lib/dictionary" ;
import { EmptyState }         from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { Tabs }                from "@/shared/ui/display/Tabs/Tabs" ;

// Feature: Sandbox
import styles               from "./SandboxContainer.module.css" ;
import { DashboardSandbox } from "./DashboardSandbox" ;


interface SandboxContainerProps {
  dict: Awaited< ReturnType< typeof getDictionary > > ;
  lang: string ;
}

/**
 * Contenedor principal con navegación por pestañas para todos los sandboxes del sistema.
 */
export function SandboxContainer( {dict , lang}: SandboxContainerProps ) {
  const [ activeTab , setActiveTab ] = useState< "dashboard" | "cuentas" >( "dashboard" ) ;
  const sandboxDict = dict.sandboxPage ;

  const tabsList = [
    { key: "dashboard" , label: sandboxDict.tabDashboard } ,
    { key: "cuentas"   , label: sandboxDict.tabAccounts }
  ] ;

  return(
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{ sandboxDict.title }</h1>
        <p className={styles.subtitle}>
          { sandboxDict.subtitle }
        </p>
      </div>

      {/* Navegación de Pestañas (Tabs) */}
      <Tabs
        tabs={tabsList}
        activeTab={activeTab}
        onChange={ ( key ) => setActiveTab( key as "dashboard" | "cuentas" ) }
      />

      {/* Contenido de la Pestaña Activa */}
      <div className={styles.tabContent}>
        {activeTab === "dashboard" ? (
          <DashboardSandbox dict={dict} lang={lang} />
        ) : (
          <EmptyState
            title={sandboxDict.accountsPlaceholderTitle}
            description={sandboxDict.accountsPlaceholderDescription}
          />
        )}
      </div>
    </div>
  ) ;
}

