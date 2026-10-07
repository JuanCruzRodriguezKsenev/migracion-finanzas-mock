/**
 * @file parametrosPagina.ts
 * Resolución pura de los parámetros de la ruta /budgets (?month= y ?currency=) (RFC 028 §5).
 */

const MES_VALIDO    = /^[0-9]{4}-(0[1-9]|1[0-2])$/ ;
const DIVISA_VALIDA = /^[A-Z]{3}$/ ;

export interface EntradaParametros {
  month?:                 string ;
  currency?:              string ;
  /** Mes en curso (YYYY-MM) en la zona del usuario. */
  mesActual:              string ;
  divisaPerfil:           string ;
  divisasConPresupuesto:  string[] ;
}

/**
 * Valida el mes (inválido o futuro: el mes en curso) y elige la divisa.
 * Sin `?currency=`: la del perfil si tiene presupuestos; si no, la primera con presupuestos; si no hay ninguno, la del perfil.
 *
 * @param entrada - Parámetros crudos y contexto del usuario.
 * @returns Mes y divisa a consultar.
 */
export function resolverParametros( entrada: EntradaParametros ): { monthKey: string ; currency: string } {
  const { month , currency , mesActual , divisaPerfil , divisasConPresupuesto } = entrada ;

  const monthKey = ( month && MES_VALIDO.test( month ) && (month <= mesActual) ) ? month : mesActual ;

  if( currency && DIVISA_VALIDA.test( currency ) ) {
    return( { monthKey , currency } ) ;
  }

  if( divisasConPresupuesto.includes( divisaPerfil ) ) {
    return( { monthKey , currency: divisaPerfil } ) ;
  }

  const primera = [ ...divisasConPresupuesto ].sort()[ 0 ] ;

  return( { monthKey , currency: primera ?? divisaPerfil } ) ;
}
