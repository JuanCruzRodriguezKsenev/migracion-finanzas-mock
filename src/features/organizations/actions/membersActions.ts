/**
 * @file membersActions.ts
 * Server Actions para gestionar miembros e invitaciones de la organización activa.
 * Todas exigen rol `owner` (leído de la base) y filtran siempre por la organización de la sesión (RN-16).
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;
import { db }                 from "@/shared/db/client" ;

// Feature: Accounting
import { accountRepository } from "@/features/accounting/repositories/accountRepository" ;

// Feature: Auth
import { habilitacionRepository } from "@/features/auth/repositories/habilitacionRepository" ;
import { organizationRepository }  from "@/features/auth/repositories/organizationRepository" ;
import { membershipRepository }    from "@/features/auth/repositories/membershipRepository" ;
import { invitationRepository }    from "@/features/auth/repositories/invitationRepository" ;
import { userRepository }          from "@/features/auth/repositories/userRepository" ;

// Feature: Notifications
import { notificationRepository } from "@/features/notifications/repositories/notificationRepository" ;

// Feature: Organizations
import { invitarMiembroSchema , cambiarRolSchema , InvitarMiembroInput , CambiarRolInput } from "../schemas/organization.schema" ;
import { exigirOwner }                                                                     from "../services/exigirOwner" ;


/** Rechazo al invitar o ascender a alguien con un rol que escribe en el espacio Personal (RN-3). */
const MENSAJE_SOLO_VISUALIZADOR = "Al espacio Personal sólo se invita como visualizador." ;

/** Vigencia de una invitación: siete días. */
const VIGENCIA_INVITACION_MS = ( 7 * 24 * 60 * 60 * 1000 ) ;

export interface MiembroListado {
  userId: string ;
  nombre: string | null ;
  email:  string ;
  rol:    string ;
}

export interface InvitacionListada {
  id:      string ;
  email:   string ;
  rol:     string ;
  venceEl: string ;
}

export interface ListadoMiembros {
  miembros:     MiembroListado[] ;
  invitaciones: InvitacionListada[] ;
}

/**
 * Lista los miembros y las invitaciones pendientes y vigentes de la organización activa.
 *
 * @returns Result con el listado, o `fail` si quien llama no es `owner`.
 */
export async function listarMiembrosAction(): Promise< Result< ListadoMiembros , string > > {
  const session = await getServerSession( authOptions ) ;
  const owner   = await exigirOwner( session ) ;

  if( !owner.success ) {
    return( fail( owner.error ) ) ;
  }

  const [ miembros , invitaciones ] = await Promise.all( [
    membershipRepository.findByOrganization( owner.value.organizationId ) ,
    invitationRepository.findPendientesVigentes( owner.value.organizationId ) ,
  ] ) ;

  return( ok( {
    miembros ,
    invitaciones: invitaciones.map( ( i ) => ( {
      id:      i.id ,
      email:   i.email ,
      rol:     i.role ,
      venceEl: i.expiresAt.toISOString() ,
    } ) ) ,
  } ) ) ;
}

/**
 * Invita a una persona por correo. No envía ningún correo: el `owner` debe avisarle que entre con Google.
 *
 * @param rawInput - Correo y rol.
 * @returns Result con el id de la invitación creada.
 */
export async function invitarMiembroAction(
  rawInput: InvitarMiembroInput
): Promise< Result< { id: string } , string > > {
  const session = await getServerSession( authOptions ) ;
  const owner   = await exigirOwner( session ) ;

  if( !owner.success ) {
    return( fail( owner.error ) ) ;
  }

  const validation = invitarMiembroSchema.safeParse( rawInput ) ;

  if( !validation.success ) {
    return( fail( validation.error.issues[0]?.message || "Datos de invitación inválidos." ) ) ;
  }

  const { email , rol }             = validation.data ;
  const { organizationId , userId } = owner.value ;

  // RN-3: al espacio Personal sólo se invita como visualizador
  if( (rol !== "viewer") && (await organizationRepository.esPersonal( organizationId )) ) {
    return( fail( MENSAJE_SOLO_VISUALIZADOR ) ) ;
  }

  try {
    return( await db.transaction( async ( tx ) => {
      if( await membershipRepository.existeMiembroPorEmail( organizationId , email , tx ) ) {
        return( fail( "Esa persona ya es miembro de la organización." ) ) ;
      }

      // Un `pending` vencido bloquearía el índice único parcial: se revoca antes de insertar.
      await invitationRepository.revocarVencidasPorEmailYOrganizacion( organizationId , email , tx ) ;

      if( await invitationRepository.existeVigente( organizationId , email , tx ) ) {
        return( fail( "Ya hay una invitación vigente para ese correo." ) ) ;
      }

      const invitacion = await invitationRepository.crearInvitacion( {
        organizationId ,
        email ,
        role:      rol ,
        invitedBy: userId ,
        expiresAt: new Date( Date.now() + VIGENCIA_INVITACION_MS ) ,
      } , tx ) ;

      return( ok( { id: invitacion.id } ) ) ;
    } ) ) ;
  } catch( error ) {
    // Dos invitaciones simultáneas al mismo correo: la segunda choca con el índice único parcial.
    logger.error( "Error al invitar un miembro." , { organizationId , error: String( error ) } ) ;
    return( fail( "No se pudo crear la invitación. Si ya enviaste una a ese correo, recargá la lista." ) ) ;
  }
}

/**
 * Revoca una invitación pendiente de la organización activa.
 *
 * @param id - Identificador de la invitación.
 * @returns Result vacío, o `fail` si no existe, ya no está pendiente o es de otra organización.
 */
export async function revocarInvitacionAction( id: string ): Promise< Result< null , string > > {
  const session = await getServerSession( authOptions ) ;
  const owner   = await exigirOwner( session ) ;

  if( !owner.success ) {
    return( fail( owner.error ) ) ;
  }

  if( (typeof id !== "string") || (id.trim() === "") ) {
    return( fail( "Invitación inválida." ) ) ;
  }

  try {
    const revocada = await invitationRepository.revocar( id , owner.value.organizationId ) ;

    if( !revocada ) {
      return( fail( "La invitación no existe o ya no está pendiente." ) ) ;
    }

    return( ok( null ) ) ;
  } catch( error ) {
    logger.error( "Error al revocar una invitación." , { error: String( error ) } ) ;
    return( fail( "No se pudo revocar la invitación." ) ) ;
  }
}

/**
 * Quita a un miembro de la organización activa. Conserva los movimientos que cargó (RN-11).
 * No permite dejar la organización sin `owner` (RN-12), ni siquiera si el único `owner` se quita a sí mismo.
 * Los `owner` se bloquean con `FOR UPDATE` para que dos quitas simultáneas no dejen cero.
 *
 * @param userId - Identificador del miembro a quitar.
 * @returns Result vacío, o `fail` si no es miembro o es el único `owner`.
 */
export async function quitarMiembroAction( userId: string ): Promise< Result< null , string > > {
  const session = await getServerSession( authOptions ) ;
  const owner   = await exigirOwner( session ) ;

  if( !owner.success ) {
    return( fail( owner.error ) ) ;
  }

  if( (typeof userId !== "string") || (userId.trim() === "") ) {
    return( fail( "Miembro inválido." ) ) ;
  }

  const { organizationId , userId: solicitanteId } = owner.value ;

  try {
    return( await db.transaction( async ( tx ) => {
      const owners = await membershipRepository.bloquearOwners( organizationId , tx ) ;

      // Quien llama pudo perder el rol mientras esperaba el bloqueo (otra quita simultánea): se revalida acá.
      if( !owners.includes( solicitanteId ) ) {
        return( fail( "No autorizado." ) ) ;
      }

      if( owners.includes( userId ) && (owners.length === 1) ) {
        return( fail( "No se puede quitar al único propietario de la organización." ) ) ;
      }

      await habilitacionRepository.eliminarDeUsuario( organizationId , userId , tx ) ;
      await notificationRepository.eliminarDeUsuario( organizationId , userId , tx ) ;
      await accountRepository.quitarComparticionesDe( userId , organizationId , tx ) ;

      const quitado = await membershipRepository.remove( userId , organizationId , tx ) ;

      if( !quitado ) {
        return( fail( "Esa persona no es miembro de la organización." ) ) ;
      }

      await userRepository.limpiarUltimaOrganizacion( userId , organizationId , tx ) ;

      return( ok( null ) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error al quitar un miembro." , { organizationId , error: String( error ) } ) ;
    return( fail( "No se pudo quitar al miembro." ) ) ;
  }
}

/**
 * Cambia el rol de un miembro de la organización activa, incluido el propio (RN-31).
 * No permite dejar la organización sin `owner` (RN-29); los `owner` se bloquean con `FOR UPDATE` (RN-38).
 * No toca `last_organization_id`: la membresía sigue.
 *
 * @param rawInput - Miembro y rol nuevo.
 * @returns Result vacío, o `fail` si no es miembro de esta organización o es el único `owner`.
 */
export async function cambiarRolAction( rawInput: CambiarRolInput ): Promise< Result< null , string > > {
  const session = await getServerSession( authOptions ) ;
  const owner   = await exigirOwner( session ) ;

  if( !owner.success ) {
    return( fail( owner.error ) ) ;
  }

  const validation = cambiarRolSchema.safeParse( rawInput ) ;

  if( !validation.success ) {
    return( fail( validation.error.issues[0]?.message || "Datos inválidos." ) ) ;
  }

  const { userId , rol }                           = validation.data ;
  const { organizationId , userId: solicitanteId } = owner.value ;

  // RN-3: en el espacio Personal el único rol invitable es visualizador (el dueño sigue siendo el único owner)
  if( (rol !== "viewer") && (await organizationRepository.esPersonal( organizationId )) ) {
    return( fail( MENSAJE_SOLO_VISUALIZADOR ) ) ;
  }

  try {
    return( await db.transaction( async ( tx ) => {
      const owners = await membershipRepository.bloquearOwners( organizationId , tx ) ;

      // Quien llama pudo perder el rol mientras esperaba el bloqueo: se revalida acá.
      if( !owners.includes( solicitanteId ) ) {
        return( fail( "No autorizado." ) ) ;
      }

      const objetivo = await membershipRepository.findMembership( userId , organizationId , tx ) ;

      if( !objetivo ) {
        return( fail( "Esa persona no es miembro de la organización." ) ) ;
      }

      if( (objetivo.role === "owner") && (rol !== "owner") && (owners.length === 1) ) {
        return( fail( "Es el único propietario: nombrá a otro antes de cambiarle el rol." ) ) ;
      }

      if( objetivo.role !== rol ) {
        await membershipRepository.cambiarRol( userId , organizationId , rol , tx ) ;

        // Un viewer no puede tener cuentas compartidas en la organización (RN-14).
        if( rol === "viewer" ) {
          await accountRepository.quitarComparticionesDe( userId , organizationId , tx ) ;
        }
      }

      return( ok( null ) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error al cambiar el rol de un miembro." , { organizationId , error: String( error ) } ) ;
    return( fail( "No se pudo cambiar el rol." ) ) ;
  }
}
