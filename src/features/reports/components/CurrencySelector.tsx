/**
 * @file CurrencySelector.tsx
 * Selector de divisa activa para la vista de estadísticas (RN-1, RN-2).
 * Modifica la query param ?currency= preservando el mes seleccionado.
 */
"use client" ;

// Librerías externas
import { useRouter , usePathname , useSearchParams } from "next/navigation" ;
import React                                         from "react" ;

// Estilos
import styles from "./CurrencySelector.module.css" ;

export interface CurrencySelectorProps {
  currencies:      string[] ;
  currentCurrency: string ;
  label?:          string ;
}

export function CurrencySelector( { currencies , currentCurrency , label }: CurrencySelectorProps ) {
  const router       = useRouter() ;
  const pathname     = usePathname() ;
  const searchParams = useSearchParams() ;

  if( !currencies || ( currencies.length <= 1 ) ) {
    return(
      <div className={styles.selectorContainer}>
        { label && <span className={styles.selectorLabel}>{ label }</span> }
        <span className={styles.selectInput}>{ currentCurrency }</span>
      </div>
    ) ;
  }

  const handleChange = ( e: React.ChangeEvent< HTMLSelectElement > ) => {
    const nextCurrency = e.target.value ;
    const params       = new URLSearchParams( searchParams?.toString() || "" ) ;
    params.set( "currency" , nextCurrency ) ;
    router.push( `${pathname}?${params.toString()}` ) ;
  } ;

  return(
    <div className={styles.selectorContainer}>
      { label && <label htmlFor="currency-select" className={styles.selectorLabel}>{ label }</label> }
      <select
        id="currency-select"
        className={styles.selectInput}
        value={currentCurrency}
        onChange={handleChange}
        aria-label={label || "Seleccionar divisa"}
      >
        { currencies.map( ( c ) => {
          return(
            <option key={c} value={c}>
              { c }
            </option>
          ) ;
        } ) }
      </select>
    </div>
  ) ;
}
