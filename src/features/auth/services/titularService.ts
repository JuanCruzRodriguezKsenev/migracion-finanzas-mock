/**
 * @file titularService.ts
 * Reglas de «cargar a nombre de otra persona» (RN-2 a RN-6): quién puede ser titular de un movimiento
 * que carga otro miembro. Todo se lee de la base en cada llamada; nada viene del token ni del cliente.
 */
// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { db , DBOrTx }        from "@/shared/db/client" ;

// Feature: Auth
import { habilitacionRepository } from "../repositories/habilitacionRepository" ;
import { membershipRepository }   from "../repositories/membershipRepository" ;


/**
 * Persona a cuyo nombre se puede cargar un movimiento.
 */
export interface TitularPosible {
  userId: string ;
  nombre: string ;
}

/**
 * Nombre que se muestra de una persona: su nombre, o la parte local del correo si no tiene.
 *
 * @param nombre - `users.name`, posiblemente nulo o vacío.
 * @param email - Correo del usuario.
 * @returns Texto visible, nunca vacío.
 */
export function nombreVisible( nombre: string | null | undefined , email: string ): string {
  const limpio = nombre?.trim() ;

  return( limpio ? limpio : email.split( "@" )[0] ) ;
}

/**
 * Decide si `autorUserId` puede cargar un movimiento a nombre de `holderUserId` en la organización.
 *
 * - Sin titular, o el titular es el propio autor: se permite.
 * - Titular ajeno: tiene que ser **miembro** de la organización (A4) y el rol del autor se lee de la base:
 *   `owner` puede a nombre de cualquiera (RN-5); `member` sólo con una habilitación vigente del titular (RN-6);
 *   cualquier otro rol, no.
 *
 * El rechazo del `viewer` como autor de movimientos propios es del plan 07, no de esta función.
 *
 * @param organizationId - Organización de la sesión.
 * @param autorUserId - Quien carga (la sesión).
 * @param holderUserId - Titular pedido, o nulo/indefinido.
 * @param tx - Instancia de transacción opcional.
 * @returns El titular a guardar (`null` si no hay), o `fail` con el motivo.
 */
export async function autorizarTitular(
  organizationId: string ,
  autorUserId:    string ,
  holderUserId:   string | null | undefined ,
  tx:             DBOrTx = db
): Promise< Result< string | null , string > > {
  if( !holderUserId ) {
    return( ok( null ) ) ;
  }

  if( holderUserId === autorUserId ) {
    return( ok( holderUserId ) ) ;
  }

  const membresiaTitular = await membershipRepository.findMembership( holderUserId , organizationId , tx ) ;

  if( !membresiaTitular ) {
    return( fail( "La persona elegida no es miembro de la organización." ) ) ;
  }

  const membresiaAutor = await membershipRepository.findMembership( autorUserId , organizationId , tx ) ;

  if( !membresiaAutor ) {
    return( fail( "No autorizado." ) ) ;
  }

  if( membresiaAutor.role === "owner" ) {
    return( ok( holderUserId ) ) ;
  }

  if( (membresiaAutor.role === "member") && (await habilitacionRepository.existeVigente( organizationId , holderUserId , autorUserId , tx )) ) {
    return( ok( holderUserId ) ) ;
  }

  return( fail( "No tenés habilitación para cargar a nombre de esa persona." ) ) ;
}

/**
 * Lista las personas a cuyo nombre puede cargar `userId`, con uno mismo primero.
 *
 * - `owner`: todos los miembros (incluidos los `viewer`, RN-5).
 * - `member`: quienes lo habilitaron y siguen siendo miembros.
 * - `viewer`: sólo uno mismo.
 *
 * @param organizationId - Organización de la sesión.
 * @param userId - Quien carga (la sesión).
 * @param tx - Instancia de transacción opcional.
 * @returns Titulares posibles; vacío si `userId` no es miembro.
 */
export async function titularesPosibles(
  organizationId: string ,
  userId:         string ,
  tx:             DBOrTx = db
): Promise< TitularPosible[] > {
  const miembros = await membershipRepository.findByOrganization( organizationId , tx ) ;
  const yo       = miembros.find( ( m ) => (m.userId === userId) ) ;

  if( !yo ) {
    return( [] ) ;
  }

  const propio: TitularPosible = { userId , nombre: nombreVisible( yo.nombre , yo.email ) } ;

  if( yo.rol === "owner" ) {
    const otros = miembros.filter( ( m ) => (m.userId !== userId) ) ;

    return( [ propio , ...otros.map( ( m ) => ( { userId: m.userId , nombre: nombreVisible( m.nombre , m.email ) } ) ) ] ) ;
  }

  if( yo.rol === "member" ) {
    const recibidas = await habilitacionRepository.listarRecibidas( organizationId , userId , tx ) ;
    const vigentes  = new Set( miembros.map( ( m ) => m.userId ) ) ;

    return( [ propio , ...recibidas.filter( ( r ) => vigentes.has( r.userId ) ).map( ( r ) => ( { userId: r.userId , nombre: nombreVisible( r.nombre , r.email ) } ) ) ] ) ;
  }

  return( [ propio ] ) ;
}
