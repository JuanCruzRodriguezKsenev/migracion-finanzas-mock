/**
 * @file TransactionsControls.tsx
 * Barra de controles y filtros interactivos para el listado de transacciones.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import { SearchInput } from "@/shared/ui/forms/SearchInput/SearchInput" ;
import styles          from "./Transactions.module.css" ;


interface TransactionsControlsProps {
  searchTerm:          string ;
  setSearchTerm:       ( val: string ) => void ;
  selectedAccount:     string ;
  setSelectedAccount:  ( val: string ) => void ;
  selectedCategory:    string ;
  setSelectedCategory: ( val: string ) => void ;
  selectedType:        string ;
  setSelectedType:     ( val: string ) => void ;
  accounts:            { id: string ; name: string }[] ;
  categories:          { id: string ; name: string }[] ;
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
  accounts ,
  categories ,
  onClear ,
}: TransactionsControlsProps ) {
  const hasActiveFilters = Boolean(
    ( searchTerm.trim() !== "" ) ||
    selectedAccount ||
    selectedCategory ||
    selectedType
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
      </div>

      <div className={styles.filtersRight}>
        {hasActiveFilters && (
          <button type="button" onClick={onClear} className={styles.clearBtn}>
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  ) ;
}
