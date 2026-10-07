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

// Feature: Organizations
import type { HabilitacionesListadas } from "@/features/organizations/actions/habilitacionesActions" ;
import type { ListadoMiembros }         from "@/features/organizations/actions/membersActions" ;
import { HabilitacionesPanel }          from "@/features/organizations/components/HabilitacionesPanel" ;
import { OrganizationPanel }            from "@/features/organizations/components/OrganizationPanel" ;
import { MembersPanel }                 from "@/features/organizations/components/MembersPanel" ;

// Feature: Splits
import type { VistaAcuerdo } from "@/features/splits/actions/acuerdoActions" ;
import { AcuerdoPanel }      from "@/features/splits/components/AcuerdoPanel" ;

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
  /** Sólo un `owner` ve la pestaña Miembros (por defecto, no). */
  esOwner?:       boolean ;
  /** Miembros e invitaciones de la organización; `null` si quien mira no es `owner`. */
  miembros?:      ListadoMiembros | null ;
  currentUserId?: string ;
  /** Datos de la organización activa para la pestaña Organización (sólo `owner`). */
  organizacion?:  { nombre: string ; cantidadOrganizaciones: number } | null ;
  /** Rol de quien mira, leído de la base. La pestaña Habilitaciones es para `owner` y `member`, no para `viewer`. */
  rol?:            string ;
  /** Habilitaciones de quien mira; `null` si no corresponde mostrarlas. */
  habilitaciones?: HabilitacionesListadas | null ;
  /** Acuerdo de reparto según el rol de quien mira; `null` si no corresponde mostrarlo (`viewer`, S-W). */
  acuerdo?:        VistaAcuerdo | null ;
}

type PestanaConfiguracion = "categories" | "ledger" | "members" | "organization" | "habilitaciones" | "acuerdo" ;

/**
 * Shell principal de la pantalla de configuración.
 */
export function SettingsContainer( {
  initialTree ,
  accounts ,
  dict ,
  lang ,
  esOwner = false ,
  miembros = null ,
  currentUserId = "" ,
  organizacion = null ,
  rol = "" ,
  habilitaciones = null ,
  acuerdo = null ,
}: SettingsContainerProps ) {
  const [ activeTab , setActiveTab ] = useState< PestanaConfiguracion >( "categories" ) ;

  const mostrarMiembros       = ( esOwner && !!miembros ) ;
  const mostrarOrganizacion   = ( esOwner && !!organizacion ) ;
  const mostrarHabilitaciones = ( ((rol === "owner") || (rol === "member")) && !!habilitaciones ) ;
  const mostrarAcuerdo        = ( ((rol === "owner") || (rol === "member")) && !!acuerdo ) ;

  const settingsTabs = [
    { key: "categories"  , label: dict.settingsPage.tabCategories } ,
    { key: "ledger"      , label: dict.settingsPage.tabLedger } ,
    ...( mostrarMiembros ? [ { key: "members" , label: dict.settingsPage.tabMembers } ] : [] ) ,
    ...( mostrarOrganizacion ? [ { key: "organization" , label: dict.settingsPage.tabOrganization } ] : [] ) ,
    ...( mostrarHabilitaciones ? [ { key: "habilitaciones" , label: dict.settingsPage.tabHabilitaciones } ] : [] ) ,
    ...( mostrarAcuerdo ? [ { key: "acuerdo" , label: dict.settingsPage.tabAcuerdo } ] : [] ) ,
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
        onChange={ ( key ) => setActiveTab( key as PestanaConfiguracion ) }
      />

      {activeTab === "categories" ? (
        <CategoriesSettingsContainer initialTree={initialTree} dict={dict} />
      ) : ( (activeTab === "members") && mostrarMiembros ) ? (
        <MembersPanel
          initialData={miembros}
          currentUserId={currentUserId}
          lang={lang}
          dict={dict.organizations.members}
        />
      ) : ( (activeTab === "organization") && mostrarOrganizacion ) ? (
        <OrganizationPanel
          nombre={organizacion.nombre}
          cantidadOrganizaciones={organizacion.cantidadOrganizaciones}
          dict={dict.organizations.panel}
        />
      ) : ( (activeTab === "habilitaciones") && mostrarHabilitaciones ) ? (
        <HabilitacionesPanel
          initialData={habilitaciones}
          dict={dict.habilitaciones}
        />
      ) : ( (activeTab === "acuerdo") && mostrarAcuerdo ) ? (
        <AcuerdoPanel
          initialData={acuerdo}
          dict={dict.splits}
        />
      ) : (
        <LedgerAuditPanel accounts={accounts} dict={dict} />
      )}
    </div>
  ) ;
}
