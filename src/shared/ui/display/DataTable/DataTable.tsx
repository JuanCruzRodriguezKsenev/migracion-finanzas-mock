/**
 * @file DataTable.tsx
 * Tabla de datos genérica, tipada y accesible.
 * Diseñada para soportar renderizado de celdas personalizadas, estados de carga y empty state.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import { Skeleton } from "@/shared/ui/feedback/Skeleton/Skeleton" ;
import styles       from "./DataTable.module.css" ;


export interface DataTableColumn< T > {
  key:     string ;
  header:  React.ReactNode ;
  align?:  "left" | "center" | "right" ;
  render?: ( row: T , index: number ) => React.ReactNode ;
}

export interface DataTableProps< T > {
  columns:       DataTableColumn< T >[] ;
  data:          T[] ;
  loading?:      boolean ;
  loadingRows?:  number ;
  emptyMessage?: string ;
  onRowClick?:   ( row: T ) => void ;
  keyExtractor?: ( row: T , index: number ) => string ;
  className?:    string ;
  footer?:       React.ReactNode ;
}

/**
 * Componente DataTable reutilizable para listas tabulares de datos.
 */
export function DataTable< T extends object >( {
  columns ,
  data ,
  loading = false ,
  loadingRows = 5 ,
  emptyMessage = "No hay registros disponibles." ,
  onRowClick ,
  keyExtractor ,
  className = "" ,
  footer ,
}: DataTableProps< T > ) {
  const getAlignClass = ( align?: "left" | "center" | "right" ) => {
    if( align === "center" ) { return( styles.alignCenter ) ; }
    if( align === "right"  ) { return( styles.alignRight  ) ; }
    return( styles.alignLeft ) ;
  } ;

  return(
    <div className={ `${styles.container} ${className}`.trim() }>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            {columns.map( ( col ) => (
              <th key={col.key} className={ `${styles.th} ${getAlignClass(col.align)}` }>
                {col.header}
              </th>
            ) )}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from( {length: loadingRows} ).map( ( _ , rowIndex ) => (
              <tr key={`loading-row-${rowIndex}`} className={styles.tr}>
                {columns.map( ( col , colIndex ) => (
                  <td key={`loading-col-${colIndex}`} className={ `${styles.td} ${getAlignClass(col.align)}` }>
                    <Skeleton width="80%" height="1.125rem" />
                  </td>
                ) )}
              </tr>
            ) )
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.emptyCell}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map( ( row , rowIndex ) => {
              const rowKey = keyExtractor
                ? keyExtractor( row , rowIndex )
                : ( (row as {id?: string}).id || String(rowIndex) ) ;

              const isClickable = Boolean( onRowClick ) ;

              return(
                <tr
                  key={rowKey}
                  className={ `${styles.tr} ${isClickable ? styles.clickable : ""}` }
                  onClick={ () => onRowClick?.( row ) }
                >
                  {columns.map( ( col ) => {
                    const content = col.render
                      ? col.render( row , rowIndex )
                      : String( (row as Record<string , unknown>)[col.key] ?? "" ) ;

                    return(
                      <td key={col.key} className={ `${styles.td} ${getAlignClass(col.align)}` }>
                        {content}
                      </td>
                    ) ;
                  } )}
                </tr>
              ) ;
            } )
          )}
        </tbody>
      </table>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  ) ;
}
