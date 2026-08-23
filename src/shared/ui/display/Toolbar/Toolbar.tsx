/**
 * @file Toolbar.tsx
 * Contenedor principal de la barra de herramientas genérica (Toolbar).
 * Coordina la búsqueda, filtrado interactivo, ordenamiento y visibilidad de columnas.
 * @remarks Componente de catálogo — aún sin consumidores en producción.
 */
"use client" ;

// Librerías externas
import React , { useEffect , useRef , useState } from "react" ;

// Local Components
import { SortConfig , SortOptionDef , SortControl } from "./SortControl" ;
import { Column , ColumnSelector }                 from "./ColumnSelector" ;
import { FilterBtn , FilterFieldDef }               from "./FilterBtn" ;
import { SearchBar }                                 from "./SearchBar" ;
import styles                                        from "./Toolbar.module.css" ;


interface SearchProps {
  query:        string ;
  setQuery:     ( val: string ) => void ;
  placeholder?: string ;
}

interface FilterProps< T > {
  fields:          FilterFieldDef< T >[] ;
  filters:         Partial< Record< keyof T , string[] > > ;
  setFilter:       ( key: keyof T , val: string[] ) => void ;
  getUniqueValues: ( key: keyof T ) => string[] ;
  clearFilters:    () => void ;
}

interface SortProps< T > {
  options:    SortOptionDef< T >[] ;
  config:     SortConfig< T > | null ;
  setConfig:  ( conf: SortConfig< T > | null ) => void ;
}

interface ColumnProps< T > {
  columns:  Column< T >[] ;
  visible:  ( keyof T )[] ;
  onToggle: ( key: keyof T ) => void ;
  onShowAll: () => void ;
  onHideAll: () => void ;
}

interface ToolbarProps< T > {
  search?:  SearchProps ;
  filter?:  FilterProps< T > ;
  sort?:    SortProps< T > ;
  columns?: ColumnProps< T > ;
}

export function Toolbar< T >( {search , filter , sort , columns}: ToolbarProps< T > ) {
  const [ filterOpen , setFilterOpen ] = useState( false ) ;
  const [ colOpen , setColOpen ]       = useState( false ) ;
  const ref                            = useRef< HTMLDivElement >( null ) ;

  useEffect( () => {
    function handle( e: MouseEvent ) {
      setColOpen( false ) ;
      if( ref.current && !ref.current.contains( e.target as Node ) ) {
        setFilterOpen( false ) ;
      }
    }
    document.addEventListener( "mousedown" , handle , true ) ;
    return( () => document.removeEventListener( "mousedown" , handle , true ) ) ;
  } , [] ) ;

  useEffect( () => {
    function handle( e: KeyboardEvent ) {
      if( e.key === "Escape" ) {
        setFilterOpen( false ) ;
        setColOpen( false ) ;
      }
    }
    document.addEventListener( "keydown" , handle ) ;
    return( () => document.removeEventListener( "keydown" , handle ) ) ;
  } , [] ) ;

  const showDividerAfterSearch   = ( search && ( filter || sort || columns ) ) ;
  const showDividerBeforeColumns = ( columns && ( filter || sort ) ) ;

  return(
    <div className={styles.toolbar} ref={ref}>
      {search && <SearchBar {...search} />}
      {showDividerAfterSearch && <div className={styles.divider} />}
      {filter && (
        <FilterBtn< T >
          filters={filter.filters}
          setFilter={filter.setFilter}
          getUniqueValues={filter.getUniqueValues}
          clearFilters={filter.clearFilters}
          filterFields={filter.fields}
          searchQuery={search?.query}
          isOpen={filterOpen}
          onToggle={ () => {
            setFilterOpen( ( p ) => !p ) ;
            setColOpen( false ) ;
          } }
        />
      )}
      {sort && (
        <SortControl< T >
          options={sort.options}
          config={sort.config}
          setConfig={sort.setConfig}
        />
      )}
      {showDividerBeforeColumns && <div className={styles.divider} />}
      {columns && (
        <ColumnSelector< T >
          columns={columns.columns}
          visible={columns.visible}
          onToggle={columns.onToggle}
          onShowAll={columns.onShowAll}
          onHideAll={columns.onHideAll}
          isOpen={colOpen}
          onOpenToggle={ () => {
            setColOpen( ( p ) => !p ) ;
            setFilterOpen( false ) ;
          } }
        />
      )}
    </div>
  ) ;
}
