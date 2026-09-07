/**
 * @file TransactionsControls.tsx
 * Barra de controles y filtros interactivos para el listado de transacciones.
 */
"use client" ;

// Librerías externas
import React , { useState , useRef , useEffect } from "react" ;

// Shared
import { SearchInput }              from "@/shared/ui/forms/SearchInput/SearchInput" ;
import { Column , ColumnSelector }  from "@/shared/ui/display/Toolbar/ColumnSelector" ;
import styles                       from "./Transactions.module.css" ;


export interface TransactionTableColumns {
  occurredAt:  string ;
  description: string ;
  category:    string ;
  account:     string ;
  type:        string ;
  amount:      string ;
  actions:     string ;
}

export type TransactionColumnKey = keyof TransactionTableColumns ;

interface TransactionsControlsProps {
  searchTerm:          string ;
  setSearchTerm:       ( val: string ) => void ;
  selectedAccount:     string ;
  setSelectedAccount:  ( val: string ) => void ;
  selectedCategory:    string ;
  setSelectedCategory: ( val: string ) => void ;
  selectedType:        string ;
  setSelectedType:     ( val: string ) => void ;
  selectedCurrency:    string ;
  setSelectedCurrency: ( val: string ) => void ;
  currencies:          string[] ;
  accounts:            { id: string ; name: string }[] ;
  categories:          { id: string ; name: string }[] ;
  columns:             Column< TransactionTableColumns >[] ;
  visibleColumns:      TransactionColumnKey[] ;
  onToggleColumn:      ( key: TransactionColumnKey ) => void ;
  onShowAllColumns:    () => void ;
  onHideAllColumns:    () => void ;
  onClear:             () => void ;
}

export function TransactionsControls( {
  searchTerm ,
  setSearchTerm ,
  selectedAccount ,
  setSelectedAccount ,
  selectedCategory ,
  setSelectedCategory ,
  selectedType ,
  setSelectedType ,
  selectedCurrency ,
  setSelectedCurrency ,
  currencies ,
  accounts ,
  categories ,
  columns ,
  visibleColumns ,
  onToggleColumn ,
  onShowAllColumns ,
  onHideAllColumns ,
  onClear ,
}: TransactionsControlsProps ) {
  const [ isColSelectorOpen , setIsColSelectorOpen ] = useState( false ) ;
  const colSelectorRef                               = useRef< HTMLDivElement >( null ) ;

  useEffect( () => {
    const handleClickOutside = ( e: MouseEvent ) => {
      if( colSelectorRef.current && !colSelectorRef.current.contains( e.target as Node ) ) {
        setIsColSelectorOpen( false ) ;
      }
    } ;
    const handleEscape = ( e: KeyboardEvent ) => {
      if( e.key === "Escape" ) {
        setIsColSelectorOpen( false ) ;
      }
    } ;
    document.addEventListener( "mousedown" , handleClickOutside ) ;
    document.addEventListener( "keydown" , handleEscape ) ;
    return( () => {
      document.removeEventListener( "mousedown" , handleClickOutside ) ;
      document.removeEventListener( "keydown" , handleEscape ) ;
    } ) ;
  } , [] ) ;

  const hasActiveFilters = Boolean(
    ( searchTerm.trim() !== "" ) ||
    selectedAccount ||
    selectedCategory ||
    selectedType ||
    selectedCurrency
  ) ;

  return(
    <div className={styles.controlsBar}>
      <div className={styles.filtersLeft}>
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar descripción o comercio..."
        />

        <select
          value={selectedAccount}
          onChange={ ( e ) => setSelectedAccount( e.target.value ) }
          className={styles.filterSelect}
          aria-label="Filtrar por cuenta"
        >
          <option value="">Todas las cuentas</option>
          {accounts.map( ( acc ) => (
            <option key={acc.id} value={acc.id}>{acc.name}</option>
          ) )}
        </select>

        <select
          value={selectedCategory}
          onChange={ ( e ) => setSelectedCategory( e.target.value ) }
          className={styles.filterSelect}
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {categories.map( ( cat ) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ) )}
        </select>

        <select
          value={selectedType}
          onChange={ ( e ) => setSelectedType( e.target.value ) }
          className={styles.filterSelect}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos los tipos</option>
          <option value="expense">Gasto</option>
          <option value="income">Ingreso</option>
          <option value="transfer">Transferencia</option>
        </select>

        <select
          value={selectedCurrency}
          onChange={ ( e ) => setSelectedCurrency( e.target.value ) }
          className={styles.filterSelect}
          aria-label="Filtrar por moneda"
        >
          <option value="">Todas las monedas</option>
          {currencies.map( ( cur ) => (
            <option key={cur} value={cur}>{cur}</option>
          ) )}
        </select>
      </div>

      <div className={styles.filtersRight}>
        {hasActiveFilters && (
          <button type="button" onClick={onClear} className={styles.clearBtn}>
            Limpiar filtros
          </button>
        )}

        <div ref={colSelectorRef} className={styles.colSelectorWrapper}>
          <ColumnSelector< TransactionTableColumns >
            columns={columns}
            visible={visibleColumns}
            onToggle={onToggleColumn}
            onShowAll={onShowAllColumns}
            onHideAll={onHideAllColumns}
            isOpen={isColSelectorOpen}
            onOpenToggle={ () => setIsColSelectorOpen( ( prev ) => !prev ) }
          />
        </div>
      </div>
    </div>
  ) ;
}
