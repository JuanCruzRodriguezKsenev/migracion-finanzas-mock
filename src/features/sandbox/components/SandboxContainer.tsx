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
import { PageHeader }         from "@/shared/ui/layout/PageHeader/PageHeader" ;
import { EmptyState }         from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { Tabs }                from "@/shared/ui/display/Tabs/Tabs" ;

// Feature: Sandbox
import { LaboratorioMarcas } from "./LaboratorioMarcas" ;
import { DashboardSandbox }  from "./DashboardSandbox" ;
import styles                from "./SandboxContainer.module.css" ;


interface SandboxContainerProps {
  dict: Awaited< ReturnType< typeof getDictionary > > ;
  lang: string ;
}

/**
 * Contenedor principal con navegación por pestañas para todos los sandboxes del sistema.
 */
export function SandboxContainer( {dict , lang}: SandboxContainerProps ) {
  const [ activeTab , setActiveTab ] = useState< "dashboard" | "cuentas" | "marcas" >( "dashboard" ) ;
  const sandboxDict = dict.sandboxPage ;

  const tabsList = [
    { key: "dashboard" , label: sandboxDict.tabDashboard } ,
    { key: "cuentas"   , label: sandboxDict.tabAccounts } ,
    { key: "marcas"    , label: sandboxDict.tabBrands }
  ] ;

  return(
    <div className={styles.container}>
      <PageHeader
        title={sandboxDict.title}
        subtitle={sandboxDict.subtitle}
        showMonthSelector={false}
        dict={dict}
        lang={lang}
      />

      {/* Navegación de Pestañas (Tabs) */}
      <Tabs
        tabs={tabsList}
        activeTab={activeTab}
        onChange={ ( key ) => setActiveTab( key as "dashboard" | "cuentas" | "marcas" ) }
      />

      {/* Contenido de la Pestaña Activa */}
      <div className={styles.tabContent}>
        {activeTab === "dashboard" && (
          <DashboardSandbox dict={dict} lang={lang} />
        )}
        {activeTab === "cuentas" && (
          <EmptyState
            title={sandboxDict.accountsPlaceholderTitle}
            description={sandboxDict.accountsPlaceholderDescription}
          />
        )}
        {activeTab === "marcas" && (
          <LaboratorioMarcas dict={dict} lang={lang} />
        )}
      </div>
    </div>
  ) ;
}

