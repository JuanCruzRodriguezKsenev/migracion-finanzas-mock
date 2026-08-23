/**
 * @file accountCodes.ts
 * Utilidades para la generación de códigos contables correlativos del plan de cuentas.
 */

// Feature: Accounting
import { Account } from "../types" ;

/**
 * Determina el siguiente código contable libre para un tipo de cuenta determinado.
 *
 * @param type - El tipo de cuenta contable.
 * @param existingAccounts - Listado de cuentas ya existentes.
 * @returns El código contable correlativo disponible.
 */
export function getNextCode( type: string , existingAccounts: Account[] ): string {
  const prefixMap: Record< string , string > = {
    asset:     "1.1.01." ,
    liability: "2.1.01." ,
    equity:    "3.1.01." ,
    revenue:   "4.1.01." ,
    expense:   "5.1.01."
  } ;

  const prefix = ( prefixMap[type] || "9.9.99." ) ;
  const filtered = existingAccounts
    .filter( ( a ) => ( a.type === type ) && a.code.startsWith( prefix ) )
    .map( ( a ) => a.code ) ;

  if( filtered.length === 0 ) {
    return( `${prefix}01` ) ;
  }

  let maxSuffix = 0 ;
  for( const code of filtered ) {
    const parts = code.split( "." ) ;
    const suffix = Number( parts[parts.length - 1] ) ;
    if( !isNaN( suffix ) && ( suffix > maxSuffix ) ) {
      maxSuffix = suffix ;
    }
  }

  const nextSuffix = String( maxSuffix + 1 ).padStart( 2 , "0" ) ;
  return( `${prefix}${nextSuffix}` ) ;
}
