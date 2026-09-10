/**
 * @file categoryIcons.test.ts
 * Pruebas unitarias para el mapa y resolución de emojis de categorías contables.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Accounting
import { INITIAL_CATEGORIES_CATALOG }                                  from "../constants/initialCatalog" ;
import { iconoDeCategoria , CATEGORY_ICON_MAP , CATEGORY_FALLBACK_ICON } from "./categoryIcons" ;


describe( "iconoDeCategoria" , () => {
  it( "resuelve correctamente todos los íconos definidos en el catálogo inicial" , () => {
    for( const parent of INITIAL_CATEGORIES_CATALOG ) {
      if( parent.icon ) {
        const emoji = iconoDeCategoria( parent.icon ) ;
        expect( emoji ).toBe( CATEGORY_ICON_MAP[parent.icon] ) ;
        expect( emoji ).toBeTruthy() ;
      }

      for( const sub of parent.subcategories ) {
        if( sub.icon ) {
          const emoji = iconoDeCategoria( sub.icon ) ;
          expect( emoji ).toBe( CATEGORY_ICON_MAP[sub.icon] ) ;
          expect( emoji ).toBeTruthy() ;
        }
      }
    }
  } ) ;

  it( "devuelve el ícono de respaldo cuando recibe nombres desconocidos, nulos o vacíos" , () => {
    expect( iconoDeCategoria( null ) ).toBe( CATEGORY_FALLBACK_ICON ) ;
    expect( iconoDeCategoria( undefined ) ).toBe( CATEGORY_FALLBACK_ICON ) ;
    expect( iconoDeCategoria( "" ) ).toBe( CATEGORY_FALLBACK_ICON ) ;
    expect( iconoDeCategoria( "icono_que_no_existe_123" ) ).toBe( CATEGORY_FALLBACK_ICON ) ;
  } ) ;

  it( "devuelve el valor original si ya se trata de un emoji" , () => {
    expect( iconoDeCategoria( "🚀" ) ).toBe( "🚀" ) ;
    expect( iconoDeCategoria( "🍕" ) ).toBe( "🍕" ) ;
  } ) ;
} ) ;
