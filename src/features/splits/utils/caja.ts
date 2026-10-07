/**
 * @file caja.ts
 * Cálculo puro de la participación de cada miembro en la caja común (RN-27). Sin acceso a datos y sin punto
 * flotante: los netos van en centavos enteros y la participación en puntos básicos (`10000` = 100 %), calculada
 * con `BigInt`. Nada se compensa entre divisas. La participación es informativa: no se guarda.
 */

/** Aporte (monto positivo) o retiro (monto negativo) de un miembro. `userId` nulo es un ex miembro. */
export interface AporteParaCaja {
  userId: string | null ;
  monto:  number ;
  divisa: string ;
}

/** Fila de la participación: el neto de un miembro y su parte del total (`null` si no hay total positivo). */
export interface FilaParticipacion {
  /** `null` agrupa a los ex miembros («Miembro anterior»). */
  userId: string | null ;
  neto:   number ;
  bp:     number | null ;
}

/** Participaciones de una divisa. */
export interface ParticipacionPorDivisa {
  divisa: string ;
  total:  number ;
  filas:  FilaParticipacion[] ;
}

/**
 * Calcula la participación de cada miembro, por divisa (S-AL): `floor( neto × 10000 / total )` con `BigInt`.
 * Sólo cuentan los miembros con neto distinto de cero; los ex miembros se agregan en una sola fila. Si el total
 * es menor o igual a cero no hay porcentajes.
 *
 * @param aportes - Aportes y retiros de la organización.
 * @returns Una entrada por divisa (ordenadas por código); las filas, de mayor a menor neto y los ex miembros al final.
 */
export function calcularParticipaciones( aportes: AporteParaCaja[] ): ParticipacionPorDivisa[] {
  const porDivisa = new Map< string , Map< string , FilaParticipacion > >() ;

  for( const a of aportes ) {
    const filas = porDivisa.get( a.divisa ) ?? new Map< string , FilaParticipacion >() ;
    const clave = a.userId ?? "" ;
    const fila  = filas.get( clave ) ?? { userId: a.userId , neto: 0 , bp: null } ;

    fila.neto += a.monto ;
    filas.set( clave , fila ) ;
    porDivisa.set( a.divisa , filas ) ;
  }

  const resultado: ParticipacionPorDivisa[] = [] ;

  for( const [ divisa , filas ] of porDivisa ) {
    const conNeto = [ ...filas.values() ].filter( ( f ) => (f.neto !== 0) ) ;
    const total   = conNeto.reduce( ( suma , f ) => ( suma + f.neto ) , 0 ) ;

    if( conNeto.length === 0 ) {
      continue ;
    }

    for( const f of conNeto ) {
      f.bp = ( total > 0 ) ? Number( (BigInt( f.neto ) * BigInt( 10000 )) / BigInt( total ) ) : null ;
    }

    conNeto.sort( ( a , b ) => {
      if( (a.userId === null) !== (b.userId === null) ) {
        return( a.userId === null ? 1 : -1 ) ;
      }

      return( b.neto - a.neto ) ;
    } ) ;

    resultado.push( { divisa , total , filas: conNeto } ) ;
  }

  return( resultado.sort( ( a , b ) => ( a.divisa < b.divisa ? -1 : 1 ) ) ) ;
}
