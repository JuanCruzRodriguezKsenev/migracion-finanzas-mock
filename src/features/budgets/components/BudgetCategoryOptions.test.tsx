// @vitest-environment jsdom
/**
 * @file BudgetCategoryOptions.test.tsx
 * Tests del selector de categorías presupuestables (A3, A4).
 */
// Librerías externas
import { render , screen , within } from "@testing-library/react" ;
import { describe , it , expect }   from "vitest" ;
import React                        from "react" ;

// Feature: Accounting
import type { Category , CategoryTreeNode } from "@/features/accounting/types" ;

// Feature: Budgets
import { BudgetCategoryOptions } from "./BudgetCategoryOptions" ;


function cat( id: string , name: string , extra: Partial< Category > = {} ): Category {
  return( {
    id ,
    organizationId: "org-1" ,
    parentId:       null ,
    name ,
    icon:           null ,
    color:          null ,
    type:           "expense" ,
    accountCode:    id ,
    archivedAt:     null ,
    isSystemLeaf:   false ,
    createdAt:      new Date() ,
    ...extra ,
  } ) ;
}

const arbol: CategoryTreeNode[] = [
  { ...cat( "p-hogar" , "Hogar" ) , children: [
    cat( "h-alquiler" , "Alquiler" , { parentId: "p-hogar" } ) ,
    cat( "h-general" , "General" , { parentId: "p-hogar" , isSystemLeaf: true } ) ,
    cat( "h-vieja" , "Vieja" , { parentId: "p-hogar" , archivedAt: new Date() } ) ,
  ] } ,
  { ...cat( "p-ocio" , "Ocio" ) , children: [ cat( "h-cine" , "Cine" , { parentId: "p-ocio" } ) ] } ,
  { ...cat( "p-sueldo" , "Sueldo" , { type: "revenue" } ) , children: [ cat( "h-neto" , "Neto" , { type: "revenue" , parentId: "p-sueldo" } ) ] } ,
  { ...cat( "p-archivado" , "Archivado" , { archivedAt: new Date() } ) , children: [] } ,
] ;

function renderOpciones( ocupados: string[] = [] ) {
  return( render(
    <select aria-label="categoria">
      <BudgetCategoryOptions tree={arbol} ocupados={new Set( ocupados )} wholeParentTpl="Todo {parent}" />
    </select>
  ) ) ;
}

describe( "BudgetCategoryOptions" , () => {
  it( "ofrece «Todo <padre>» y las hojas visibles de cada padre de gasto" , () => {
    renderOpciones() ;

    const hogar = screen.getByRole( "group" , { name: /Hogar/ } ) ;
    expect( within( hogar ).getByRole( "option" , { name: "Todo Hogar" } ) ).toBeDefined() ;
    expect( within( hogar ).getByRole( "option" , { name: /Alquiler/ } ) ).toBeDefined() ;
    expect( screen.getByRole( "option" , { name: "Todo Ocio" } ) ).toBeDefined() ;
    expect( screen.getByRole( "option" , { name: /Cine/ } ) ).toBeDefined() ;
  } ) ;

  it( "excluye hojas de sistema, archivadas e ingresos" , () => {
    renderOpciones() ;

    expect( screen.queryByRole( "option" , { name: /General/ } ) ).toBeNull() ;
    expect( screen.queryByRole( "option" , { name: /Vieja/ } ) ).toBeNull() ;
    expect( screen.queryByText( /Sueldo/ ) ).toBeNull() ;
    expect( screen.queryByRole( "option" , { name: /Neto/ } ) ).toBeNull() ;
    expect( screen.queryByRole( "option" , { name: "Todo Archivado" } ) ).toBeNull() ;
  } ) ;

  it( "excluye las categorías que ya tienen un presupuesto vigente" , () => {
    renderOpciones( [ "h-alquiler" , "p-ocio" ] ) ;

    expect( screen.queryByRole( "option" , { name: /Alquiler/ } ) ).toBeNull() ;
    expect( screen.getByRole( "option" , { name: "Todo Hogar" } ) ).toBeDefined() ;
    expect( screen.queryByRole( "option" , { name: "Todo Ocio" } ) ).toBeNull() ;
    expect( screen.getByRole( "option" , { name: /Cine/ } ) ).toBeDefined() ;
  } ) ;

  it( "omite el grupo entero si el padre y todas sus hojas están ocupadas" , () => {
    renderOpciones( [ "p-ocio" , "h-cine" ] ) ;

    expect( screen.queryByRole( "group" , { name: /Ocio/ } ) ).toBeNull() ;
  } ) ;
} ) ;
