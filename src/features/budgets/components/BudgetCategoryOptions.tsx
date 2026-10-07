/**
 * @file BudgetCategoryOptions.tsx
 * Opciones de categoría presupuestable: un grupo por padre de gasto, con «Todo <padre>» y sus hojas.
 * Excluye hojas de sistema, categorías archivadas, de ingresos y las que ya tienen presupuesto vigente (A3, A4).
 * No consulta la base: recibe el árbol y los ids ocupados.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Feature: Accounting
import { iconoDeCategoria }     from "@/features/accounting/utils/categoryIcons" ;
import type { CategoryTreeNode } from "@/features/accounting/types" ;

// Feature: Budgets
import { plantilla } from "../utils/presentacion" ;


export interface BudgetCategoryOptionsProps {
  tree:           CategoryTreeNode[] ;
  /** Ids de categorías que ya tienen un presupuesto vigente en la divisa elegida. */
  ocupados:       ReadonlySet< string > ;
  /** Plantilla de «Todo <padre>», con el marcador `{parent}`. */
  wholeParentTpl: string ;
}

/**
 * Devuelve los `<optgroup>` para insertar dentro de un `<select>`.
 */
export function BudgetCategoryOptions( { tree , ocupados , wholeParentTpl }: BudgetCategoryOptionsProps ) {
  return(
    <>
      { tree
        .filter( ( padre ) => { return( (padre.type === "expense") && !padre.archivedAt ) ; } )
        .map( ( padre ) => {
          const hojas = padre.children.filter( ( h ) => {
            return( (h.type === "expense") && !h.archivedAt && !h.isSystemLeaf && !ocupados.has( h.id ) ) ;
          } ) ;
          const padreLibre = !ocupados.has( padre.id ) ;

          if( !padreLibre && (hojas.length === 0) ) {
            return( null ) ;
          }

          return(
            <optgroup key={padre.id} label={ `${iconoDeCategoria( padre.icon )} ${padre.name}` }>
              { padreLibre ? (
                <option value={padre.id}>
                  { plantilla( wholeParentTpl , { parent: padre.name } ) }
                </option>
              ) : null }
              { hojas.map( ( hoja ) => {
                return(
                  <option key={hoja.id} value={hoja.id}>
                    { iconoDeCategoria( hoja.icon ) } { hoja.name }
                  </option>
                ) ;
              } ) }
            </optgroup>
          ) ;
        } ) }
    </>
  ) ;
}
