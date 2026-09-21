/**
 * @file SettingsContainer.tsx
 * Contenedor orquestador cliente para la pantalla de configuración de la organización (RFC 024).
 * Administra la cabecera unificada y la navegación entre Categorías y el Plan contable.
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;

// Shared
import { PageHeader }          from "@/shared/ui/layout/PageHeader/PageHeader" ;
import type { getDictionary } from "@/shared/lib/dictionary" ;
import { Tabs }                from "@/shared/ui/display/Tabs/Tabs" ;

// Feature: Accounting
import { CategoriesSettingsContainer } from "@/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer" ;
import { LedgerAuditPanel }            from "@/features/accounting/components/LedgerAudit/LedgerAuditPanel" ;
import styles                          from "./SettingsContainer.module.css" ;
import { Account , CategoryTreeNode }  from "@/features/accounting/types" ;


export interface SettingsContainerProps {
  initialTree: CategoryTreeNode[] ;
  accounts:    Account[] ;
  dict:        Awaited< ReturnType< typeof getDictionary > > ;
  lang:        string ;
}

/**
 * Shell principal de la pantalla de configuración.
 */
export function SettingsContainer( {
  initialTree ,
  accounts ,
  dict ,
  lang ,
}: SettingsContainerProps ) {
  const [ activeTab , setActiveTab ] = useState< "categories" | "ledger" >( "categories" ) ;

  const settingsTabs = [
    { key: "categories"  , label: dict.settingsPage.tabCategories } ,
    { key: "ledger"      , label: dict.settingsPage.tabLedger } ,
    { key: "profile"     , label: dict.settingsPage.tabProfile     , disabled: true , badge: dict.settingsPage.tabBadgeSoon } ,
    { key: "preferences" , label: dict.settingsPage.tabPreferences , disabled: true , badge: dict.settingsPage.tabBadgeSoon } ,
    { key: "security"    , label: dict.settingsPage.tabSecurity    , disabled: true , badge: dict.settingsPage.tabBadgeSoon } ,
  ] ;

  return(
    <div className={styles.container}>
      <PageHeader
        title={dict.settingsPage.title}
        subtitle={dict.settingsPage.subtitle}
        showMonthSelector={false}
        dict={dict}
        lang={lang}
      />

      <Tabs
        tabs={settingsTabs}
        activeTab={activeTab}
        onChange={ ( key ) => setActiveTab( key as "categories" | "ledger" ) }
      />

      {activeTab === "categories" ? (
        <CategoriesSettingsContainer initialTree={initialTree} dict={dict} />
      ) : (
        <LedgerAuditPanel accounts={accounts} dict={dict} />
      )}
    </div>
  ) ;
}
