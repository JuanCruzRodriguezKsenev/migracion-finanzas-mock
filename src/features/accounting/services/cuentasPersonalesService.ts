/**
 * @file cuentasPersonalesService.ts
 * Permiso para asentar un movimiento contra una cuenta personal compartida (RN-6, RN-8, A1, A2).
 * Todo se lee de la base en cada escritura; nada viene del token ni del cliente.
 */
// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { db , DBOrTx }        from "@/shared/db/client" ;

// Feature: Auth
import { membershipRepository } from "@/features/auth/repositories/membershipRepository" ;

// Feature: Accounting
import { Account } from "../types" ;


/** Datos para decidir si el autor puede tocar las cuentas personales de un movimiento. */
export interface ExigirPermisoSobreCuentasInput {
  organizationId: string ;
  autorUserId:    string | null | undefined ;
  holderUserId:   string | null | undefined ;
  cuentas:        Pick< Account , "id" | "ownerUserId" >[] ;
}

/**
 * Exige que el autor pueda usar cada cuenta personal del movimiento (RN-3, RN-9).
 *
 * - Cuenta de la organización (sin titular): no se evalúa nada acá.
 * - Personal propia: pasa si el autor es miembro no `viewer` de la organización.
 * - Personal de otro: pasa si el titular del movimiento es ese dueño (RN-9) y el autor es miembro
 *   no `viewer`. No se pide habilitación: la cuenta ya está compartida con la organización.
 * - Una personal sin autor (cron, outbox, seed) se rechaza.
 *
 * @param input - Organización, autor, titular final del movimiento y cuentas ya resueltas.
 * @param tx - Instancia de transacción opcional.
 * @returns `ok(true)` o `fail` con el motivo.
 */
export async function exigirPermisoSobreCuentas( input: ExigirPermisoSobreCuentasInput , tx: DBOrTx = db ): Promise< Result< true , string > > {
  const { organizationId , autorUserId , holderUserId , cuentas } = input ;
  const personales = cuentas.filter( ( c ) => c.ownerUserId ) ;

  if( personales.length === 0 ) {
    return( ok( true ) ) ;
  }

  if( !autorUserId ) {
    return( fail( "Una cuenta personal sólo se puede usar con un autor identificado." ) ) ;
  }

  const membresiaAutor = await membershipRepository.findMembership( autorUserId , organizationId , tx ) ;

  if( !membresiaAutor || (membresiaAutor.role === "viewer") ) {
    return( fail( "No tenés permiso para operar cuentas personales en esta organización." ) ) ;
  }

  for( const cuenta of personales ) {
    if( cuenta.ownerUserId === autorUserId ) {
      continue ;
    }

    if( holderUserId !== cuenta.ownerUserId ) {
      return( fail( "Una cuenta personal sólo se usa a nombre de su dueño." ) ) ;
    }
  }

  return( ok( true ) ) ;
}

/** Datos para decidir si alguien puede reversar un movimiento que toca cuentas personales. */
export interface ExigirPermisoDeReversaInput {
  organizationId:  string ;
  actorUserId:     string | null | undefined ;
  autorOriginalId: string | null | undefined ;
  cuentas:         Pick< Account , "id" | "ownerUserId" >[] ;
}

/**
 * Exige que el actor pueda reversar un movimiento que toca cuentas personales (A8). Sin esto, la reversa de
 * un movimiento sobre una cuenta que ya no se comparte quedaría sin dueño. Pasa el dueño de la cuenta
 * personal, el autor de la original o un `owner` de la organización (rol leído de la base).
 *
 * Un movimiento que no toca ninguna personal no se evalúa acá.
 *
 * @param input - Organización, actor, autor de la original y cuentas del movimiento.
 * @param tx - Instancia de transacción opcional.
 * @returns `ok(true)` o `fail` con el motivo.
 */
export async function exigirPermisoDeReversa( input: ExigirPermisoDeReversaInput , tx: DBOrTx = db ): Promise< Result< true , string > > {
  const { organizationId , actorUserId , autorOriginalId , cuentas } = input ;
  const personales = cuentas.filter( ( c ) => c.ownerUserId ) ;

  if( personales.length === 0 ) {
    return( ok( true ) ) ;
  }

  if( !actorUserId ) {
    return( fail( "Una cuenta personal sólo se puede reversar con un autor identificado." ) ) ;
  }

  if( actorUserId === autorOriginalId ) {
    return( ok( true ) ) ;
  }

  if( personales.every( ( c ) => (c.ownerUserId === actorUserId) ) ) {
    return( ok( true ) ) ;
  }

  const membresia = await membershipRepository.findMembership( actorUserId , organizationId , tx ) ;

  if( membresia?.role === "owner" ) {
    return( ok( true ) ) ;
  }

  return( fail( "No tenés permiso para reversar un movimiento que usa una cuenta personal de otra persona." ) ) ;
}
