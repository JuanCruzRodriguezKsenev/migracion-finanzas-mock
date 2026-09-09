/**
 * @file categoryCodes.ts
 * Utilidades para la generación y validación de códigos contables jerárquicos
 * del árbol de categorías (RFC 022).
 */

export interface GetNextCategoryCodeParams {
  type:          "expense" | "revenue" ;
  parentCode?:   string | null ;
  siblings:      ( { accountCode: string } | string )[] ;
  isSystemLeaf?: boolean ;
}

/**
 * Determina el siguiente código contable libre para una categoría o subcategoría.
 *
 * Estructura del árbol:
 * - Raíz contable: 5 (expense), 4 (revenue)
 * - Padres (nivel 1): <raíz>.1.<NN> (ej: 5.1.01 a 5.1.98)
 * - Hojas (nivel 2): <código del padre>.<NN> (ej: 5.1.01.01 a 5.1.01.98)
 * - Hoja General: sufijo .99 reservado en cada nivel.
 *
 * @param params - Tipo contable, código del padre (opcional), lista de hermanos y si es hoja general.
 * @returns El código contable correlativo disponible.
 * @throws Error si se supera el límite de 98 hermanos o el tipo es inválido.
 */
export function getNextCategoryCode( params: GetNextCategoryCodeParams ): string {
  const { type , parentCode , siblings , isSystemLeaf } = params ;

  if( (type !== "expense") && (type !== "revenue") ) {
    throw new Error( `Tipo de categoría inválido: ${type}. Sólo se admiten 'expense' y 'revenue'.` ) ;
  }

  const root   = (type === "expense") ? "5" : "4" ;
  const prefix = parentCode ? `${parentCode}.` : `${root}.1.` ;

  if( isSystemLeaf ) {
    return( `${prefix}99` ) ;
  }

  const expectedPartsCount = prefix.split( "." ).length ;

  const siblingCodes = siblings.map( ( s ) => (typeof s === "string" ? s : s.accountCode) ) ;

  let maxSuffix = 0 ;

  for( const code of siblingCodes ) {
    if( !code.startsWith( prefix ) ) {
      continue ;
    }

    const parts = code.split( "." ) ;
    if( parts.length !== expectedPartsCount ) {
      continue ;
    }

    const suffix = Number( parts[parts.length - 1] ) ;
    // El sufijo 99 está reservado para la hoja General; no cuenta para el correlativo ordinario
    if( !isNaN( suffix ) && (suffix < 99) && (suffix > maxSuffix) ) {
      maxSuffix = suffix ;
    }
  }

  const nextSuffix = maxSuffix + 1 ;

  if( nextSuffix > 98 ) {
    throw new Error( "Se alcanzó el límite máximo de 98 categorías en este nivel." ) ;
  }

  return( `${prefix}${String( nextSuffix ).padStart( 2 , "0" )}` ) ;
}
