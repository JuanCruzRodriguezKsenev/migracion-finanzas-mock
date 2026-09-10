/**
 * @file Tabs.tsx
 * Componente de navegación por pestañas (Tabs) interactivo y accesible.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Local styles
import styles from "./Tabs.module.css" ;


export interface TabItem {
  key:       string ;
  label:     string ;
  disabled?: boolean ;
  badge?:    string ;
}

export interface TabsProps {
  tabs:       TabItem[] ;
  activeTab:  string ;
  onChange:   ( key: string ) => void ;
  className?: string ;
}

/**
 * Componente de pestañas reutilizable.
 */
export function Tabs( {
  tabs ,
  activeTab ,
  onChange ,
  className = ""
}: TabsProps ) {
  return(
    <div className={ `${styles.tabsContainer} ${className}` }>
      <div className={styles.tabsList} role="tablist">
        {tabs.map( ( tab ) => {
          const isActive = ( tab.key === activeTab ) ;
          return(
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              aria-disabled={tab.disabled}
              disabled={tab.disabled}
              className={ `${styles.tabButton} ${isActive ? styles.active : ""} ${tab.disabled ? styles.disabled : ""}` }
              onClick={ () => {
                if( !tab.disabled ) {
                  onChange( tab.key ) ;
                }
              } }
            >
              {tab.label}
              {tab.badge && <span className={styles.badge}>{tab.badge}</span>}
            </button>
          ) ;
        } )}
      </div>
    </div>
  ) ;
}
