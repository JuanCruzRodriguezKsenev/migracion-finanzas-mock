/**
 * @file cuentasDeMovimientos.ts
 * Utilidades puras para armar el mapa de cuentas de la lista de movimientos (RN-13): las de la organización
 * más las personales que nombran los asientos, aunque el dueño ya no las comparta.
 */
// Feature: Accounting
import type { CuentaPersonalReferenciada } from "@/features/accounting/repositories/ledgerRepository" ;
import type { CuentaReferenciada }         from "@/features/accounting/types" ;


/**
 * Suma las personales de una página nueva a las ya conocidas sin duplicar por id. Si una cuenta vuelve a
 * llegar, gana la versión nueva: es la que sabe si hoy sigue compartida.
 *
 * @param actuales - Personales ya conocidas (la primera página y las anteriores).
 * @param nuevas - Personales que trae la página recién cargada.
 * @returns Las personales fusionadas.
 */
export function fusionarPersonales(
  actuales: CuentaPersonalReferenciada[] ,
  nuevas:   CuentaPersonalReferenciada[]
): CuentaPersonalReferenciada[] {
  const porId = new Map( actuales.map( ( c ) => [ c.id , c ] ) ) ;

  for( const cuenta of nuevas ) {
    porId.set( cuenta.id , cuenta ) ;
  }

  return( [ ...porId.values() ] ) ;
}

/**
 * Arma la lista de cuentas con la que se nombra y clasifica cada movimiento. Las personales entran como
 * {@link CuentaReferenciada} (sin saldo); si una id ya está entre las de la organización, esa gana.
 *
 * @param cuentasDeLaOrg - Cuentas de la organización (y las personales usables, si el llamador las suma).
 * @param personales - Personales que nombran los asientos de las páginas cargadas.
 * @returns La lista sin ids repetidas.
 */
export function cuentasParaMovimientos(
  cuentasDeLaOrg: CuentaReferenciada[] ,
  personales:     CuentaPersonalReferenciada[]
): CuentaReferenciada[] {
  const porId = new Map< string , CuentaReferenciada >() ;

  for( const cuenta of personales ) {
    porId.set( cuenta.id , {
      id:         cuenta.id ,
      code:       cuenta.code ,
      name:       cuenta.name ,
      type:       cuenta.type as CuentaReferenciada["type"] ,
      currency:   cuenta.currency ,
      compartida: cuenta.compartida ,
    } ) ;
  }

  for( const cuenta of cuentasDeLaOrg ) {
    porId.set( cuenta.id , cuenta ) ;
  }

  return( [ ...porId.values() ] ) ;
}
