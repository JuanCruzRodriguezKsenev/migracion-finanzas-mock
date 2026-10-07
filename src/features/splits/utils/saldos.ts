/**
 * @file saldos.ts
 * Cálculo puro de los saldos de un miembro con cada otro miembro (RN-22, RN-23, RN-24). Sin acceso a datos y sin
 * punto flotante: todo en centavos enteros. Nada se compensa entre divisas.
 */

/** Deuda de un gasto repartido: el acreedor es el titular del movimiento y el deudor, quien debe su parte. */
export interface DeudaParaSaldo {
  acreedorId: string | null ;
  deudorId:   string | null ;
  monto:      number ;
  divisa:     string ;
}

/** Pago registrado: `deId` paga y `aId` recibe. */
export interface PagoParaSaldo {
  deId:   string | null ;
  aId:    string | null ;
  monto:  number ;
  divisa: string ;
}

/** Saldo de un usuario con una contraparte y en una divisa. `contraparteId` nulo agrupa a los ex miembros (S-AE). */
export interface SaldoConContraparte {
  contraparteId:   string | null ;
  divisa:          string ;
  /** Con signo: positivo, la contraparte le debe al usuario; negativo, el usuario le debe a la contraparte. */
  montoEnCentavos: number ;
}

/**
 * Calcula los saldos de `usuarioId` con cada contraparte y divisa (S-AA):
 * `debeC = deudas(U acreedor, C deudor) - deudas(C acreedor, U deudor) - pagos(C a U) + pagos(U a C)`.
 * Todas las contrapartes nulas (ex miembros) se agregan en una sola (S-AE). Los saldos en cero se omiten.
 *
 * @param usuarioId - Quien mira.
 * @param deudas - Deudas ya filtradas (sin las de transacciones reversadas).
 * @param pagos - Pagos de la organización.
 * @returns Saldos con signo, ordenados por divisa y luego por monto absoluto (mayor primero).
 */
export function calcularSaldos( usuarioId: string , deudas: DeudaParaSaldo[] , pagos: PagoParaSaldo[] ): SaldoConContraparte[] {
  const acumulado = new Map< string , SaldoConContraparte >() ;

  const sumar = ( contraparteId: string | null , divisa: string , delta: number ): void => {
    const clave  = `${divisa}|${contraparteId ?? ""}` ;
    const actual = acumulado.get( clave ) ;

    if( actual ) {
      actual.montoEnCentavos += delta ;
      return ;
    }

    acumulado.set( clave , { contraparteId , divisa , montoEnCentavos: delta } ) ;
  } ;

  for( const d of deudas ) {
    if( (d.acreedorId === usuarioId) && (d.deudorId !== usuarioId) ) {
      sumar( d.deudorId , d.divisa , d.monto ) ;
    } else if( (d.deudorId === usuarioId) && (d.acreedorId !== usuarioId) ) {
      sumar( d.acreedorId , d.divisa , -d.monto ) ;
    }
  }

  for( const p of pagos ) {
    if( (p.aId === usuarioId) && (p.deId !== usuarioId) ) {
      sumar( p.deId , p.divisa , -p.monto ) ;
    } else if( (p.deId === usuarioId) && (p.aId !== usuarioId) ) {
      sumar( p.aId , p.divisa , p.monto ) ;
    }
  }

  return(
    [ ...acumulado.values() ]
      .filter( ( s ) => (s.montoEnCentavos !== 0) )
      .sort( ( a , b ) => {
        if( a.divisa !== b.divisa ) {
          return( a.divisa < b.divisa ? -1 : 1 ) ;
        }

        return( Math.abs( b.montoEnCentavos ) - Math.abs( a.montoEnCentavos ) ) ;
      } )
  ) ;
}
