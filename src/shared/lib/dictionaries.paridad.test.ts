/**
 * @file paridad.test.ts
 * NFR-2: los tres diccionarios (es, en, br) tienen exactamente las mismas claves.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Diccionarios
import es from "@/dictionaries/es.json" ;
import en from "@/dictionaries/en.json" ;
import br from "@/dictionaries/br.json" ;


/** Aplana un objeto anidado a la lista ordenada de sus rutas de claves (`a.b.c`). */
function claves( objeto: unknown , prefijo = "" ): string[] {
  if( (typeof objeto !== "object") || (objeto === null) ) {
    return( [ prefijo ] ) ;
  }

  return( Object.entries( objeto ).flatMap( ( [ clave , valor ] ) => claves( valor , prefijo ? `${prefijo}.${clave}` : clave ) ).sort() ) ;
}

describe( "paridad de diccionarios (NFR-2)" , () => {
  const deEs = claves( es ) ;

  it( "en tiene las mismas claves que es" , () => {
    expect( claves( en ) ).toEqual( deEs ) ;
  } ) ;

  it( "br tiene las mismas claves que es" , () => {
    expect( claves( br ) ).toEqual( deEs ) ;
  } ) ;

  it( "las claves nuevas del plan 29 existen en los tres idiomas" , () => {
    for( const dic of [ es , en , br ] ) {
      expect( dic.accountsPage.createEntityOption ).toBeTruthy() ;
      expect( dic.accountsPage.titleCreateEntityModal ).toBeTruthy() ;
      expect( dic.organizations.switcher.personalLabel ).toBeTruthy() ;
      expect( dic.organizations.members.personalOnlyViewer ).toBeTruthy() ;
    }
  } ) ;
} ) ;
