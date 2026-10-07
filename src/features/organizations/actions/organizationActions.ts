/**
 * @file organizationActions.ts
 * Server Actions de organizaciones: listar, crear (RN-17, RN-18, AC-12, AC-13), renombrar, eliminar y abandonar
 * (RN-28 a RN-39). Listar, crear y abandonar no exigen `owner`: basta con tener sesión y membresía.
 * Renombrar y eliminar sí lo exigen, leído de la base. El id de la organización sale siempre de la sesión (RN-16).
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;
import { eq }               from "drizzle-orm" ;
import { revalidatePath }   from "next/cache" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { generarSlug }        from "@/shared/db/bootstrap" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;
import { db , DBOrTx }        from "@/shared/db/client" ;

// Feature: Accounting
import { provisionarOrganizacion } from "@/features/accounting/services/organizationProvisioningService" ;

// Feature: Auth
import { habilitacionRepository } from "@/features/auth/repositories/habilitacionRepository" ;
import { organizationRepository } from "@/features/auth/repositories/organizationRepository" ;
import { membershipRepository }   from "@/features/auth/repositories/membershipRepository" ;
import { userRepository }         from "@/features/auth/repositories/userRepository" ;
import { organizations }          from "@/features/auth/schema.db" ;

// Feature: Organizations
import {
  crearOrganizacionSchema ,
  renombrarSchema ,
  eliminarSchema ,
  type CrearOrganizacionInput ,
  type RenombrarInput ,
  type EliminarInput
} from "../schemas/organization.schema" ;
import { exigirOwner } from "../services/exigirOwner" ;


export interface OrganizacionListada {
  id:     string ;
  nombre: string ;
  rol:    string ;
}

/**
 * Lista las organizaciones a las que pertenece el usuario de la sesión.
 *
 * @returns Result con `{ organizaciones , activaId }`.
 */
export async function listarOrganizacionesAction(): Promise<
  Result< { organizaciones: OrganizacionListada[] ; activaId: string } , string >
> {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.id || !session.user.organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  const membresias = await membershipRepository.findByUser( session.user.id ) ;

  return( ok( {
    organizaciones: membresias.map( ( m ) => ( { id: m.organizationId , nombre: m.organizationName , rol: m.role } ) ) ,
    activaId:       session.user.organizationId ,
  } ) ) ;
}

/**
 * Genera un slug libre: si el derivado del nombre ya existe, agrega un sufijo corto aleatorio.
 */
async function slugLibre( nombre: string , tx: DBOrTx ): Promise< string > {
  const base = ( generarSlug( nombre ) || "organizacion" ) ;

  for( let intento = 0 ; intento < 5 ; intento++ ) {
    const candidato = ( intento === 0 ) ? base : `${base}-${Math.random().toString( 36 ).slice( 2 , 6 )}` ;
    const [ existente ] = await tx
      .select( { id: organizations.id } )
      .from( organizations )
      .where( eq( organizations.slug , candidato ) )
      .limit( 1 ) ;

    if( !existente ) { return( candidato ) ; }
  }

  return( `${base}-${Date.now().toString( 36 )}` ) ;
}

/**
 * Crea una organización con su catálogo y su cuenta de Patrimonio Neto, y deja al usuario como `owner`.
 * Todo ocurre en una transacción: si el aprovisionamiento falla no queda ni la organización ni la membresía.
 *
 * @param rawInput - Nombre de la organización.
 * @returns Result con el id de la organización creada. El cliente debe luego llamar `update( { organizationId } )`.
 */
export async function crearOrganizacionAction(
  rawInput: CrearOrganizacionInput
): Promise< Result< { organizationId: string } , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.id || !session.user.organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  const userId = session.user.id ;

  // RN-17: quien crea debe pertenecer a alguna organización; la sesión por sí sola no basta.
  const actual = await membershipRepository.findMembership( userId , session.user.organizationId ) ;

  if( !actual ) {
    return( fail( "No autorizado." ) ) ;
  }

  const validation = crearOrganizacionSchema.safeParse( rawInput ) ;

  if( !validation.success ) {
    return( fail( validation.error.issues[0]?.message || "Nombre de organización inválido." ) ) ;
  }

  const nombre = validation.data.nombre ;

  try {
    const organizationId = await db.transaction( async ( tx ) => {
      const slug = await slugLibre( nombre , tx ) ;

      const [ org ] = await tx
        .insert( organizations )
        .values( { name: nombre , slug } )
        .returning() ;

      await provisionarOrganizacion( org.id , tx ) ;
      await membershipRepository.add( userId , org.id , "owner" , tx ) ;
      await userRepository.registrarUltimaOrganizacion( userId , org.id , tx ) ;

      return( org.id ) ;
    } ) ;

    return( ok( { organizationId } ) ) ;
  } catch( error ) {
    logger.error( "Error al crear la organización." , { userId , error: String( error ) } ) ;
    return( fail( "No se pudo crear la organización. No se guardó ningún cambio." ) ) ;
  }
}

/** Resultado de abandonar o eliminar: a qué organización pasa el usuario y cómo se llamaba la que dejó. */
export interface CambioDeOrganizacion {
  organizationId: string ;
  nombreAnterior: string ;
}

/**
 * Renombra la organización activa. El `slug` no cambia (RN-33).
 *
 * @param rawInput - Nombre nuevo.
 * @returns Result con el nombre ya recortado, o `fail` si no es `owner` o el nombre es inválido.
 */
export async function renombrarOrganizacionAction(
  rawInput: RenombrarInput
): Promise< Result< { nombre: string } , string > > {
  const session = await getServerSession( authOptions ) ;
  const owner   = await exigirOwner( session ) ;

  if( !owner.success ) {
    return( fail( owner.error ) ) ;
  }

  const validation = renombrarSchema.safeParse( rawInput ) ;

  if( !validation.success ) {
    return( fail( validation.error.issues[0]?.message || "Nombre de organización inválido." ) ) ;
  }

  try {
    const renombrada = await organizationRepository.renombrar( owner.value.organizationId , validation.data.nombre ) ;

    if( !renombrada ) {
      return( fail( "La organización no existe." ) ) ;
    }

    revalidatePath( "/" , "layout" ) ;
    return( ok( { nombre: validation.data.nombre } ) ) ;
  } catch( error ) {
    logger.error( "Error al renombrar la organización." , { organizationId: owner.value.organizationId , error: String( error ) } ) ;
    return( fail( "No se pudo renombrar la organización." ) ) ;
  }
}

/**
 * Abandona la organización activa (RN-28). Los movimientos del usuario se conservan.
 * No deja a la organización sin `owner` (RN-29) ni al usuario sin organización (RN-30).
 * Los `owner` se bloquean con `FOR UPDATE` para que dos salidas simultáneas no dejen cero (RN-38).
 *
 * @returns Result con la organización a la que pasa el usuario; el cliente debe llamar `update( { organizationId } )`.
 */
export async function abandonarOrganizacionAction(): Promise< Result< CambioDeOrganizacion , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.id || !session.user.organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  const userId         = session.user.id ;
  const organizationId = session.user.organizationId ;

  try {
    return( await db.transaction( async ( tx ) => {
      const owners    = await membershipRepository.bloquearOwners( organizationId , tx ) ;
      const membresia = await membershipRepository.findMembership( userId , organizationId , tx ) ;

      if( !membresia ) {
        return( fail( "No autorizado." ) ) ;
      }

      if( (await membershipRepository.contarPorUsuario( userId , tx )) <= 1 ) {
        return( fail( "No podés abandonar tu única organización." ) ) ;
      }

      if( (membresia.role === "owner") && (owners.length === 1) ) {
        return( fail( "Sos el único propietario: nombrá a otro propietario o eliminá la organización antes de abandonarla." ) ) ;
      }

      const nombreAnterior = await organizationRepository.findNombre( organizationId , tx ) ;

      await habilitacionRepository.eliminarDeUsuario( organizationId , userId , tx ) ;
      await membershipRepository.remove( userId , organizationId , tx ) ;
      await userRepository.limpiarUltimaOrganizacion( userId , organizationId , tx ) ;

      const siguiente = await userRepository.findIdentidadVigente( userId , undefined , tx ) ;

      if( !siguiente ) {
        // No debería pasar (se contó más de una membresía): la transacción se revierte.
        throw new Error( "El usuario quedó sin organización." ) ;
      }

      return( ok( { organizationId: siguiente.organizationId , nombreAnterior: nombreAnterior ?? "" } ) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error al abandonar la organización." , { userId , organizationId , error: String( error ) } ) ;
    return( fail( "No se pudo abandonar la organización." ) ) ;
  }
}

/**
 * Elimina la organización activa con todos sus datos (RN-34). Irreversible.
 * Exige `owner` y que `confirmacion` sea idéntica al nombre actual (RN-35, comparación exacta).
 * Los demás miembros no se tocan: les aplica la revalidación de la sesión (RN-36).
 *
 * @param rawInput - Texto de confirmación.
 * @returns Result con la organización a la que pasa el usuario; el cliente debe llamar `update( { organizationId } )`.
 */
export async function eliminarOrganizacionAction(
  rawInput: EliminarInput
): Promise< Result< CambioDeOrganizacion , string > > {
  const session = await getServerSession( authOptions ) ;
  const owner   = await exigirOwner( session ) ;

  if( !owner.success ) {
    return( fail( owner.error ) ) ;
  }

  const validation = eliminarSchema.safeParse( rawInput ) ;

  if( !validation.success ) {
    return( fail( "Confirmación inválida." ) ) ;
  }

  const { userId , organizationId } = owner.value ;

  try {
    return( await db.transaction( async ( tx ) => {
      const nombre = await organizationRepository.findNombre( organizationId , tx ) ;

      if( (nombre === null) || (validation.data.confirmacion !== nombre) ) {
        return( fail( "El texto de confirmación no coincide con el nombre de la organización." ) ) ;
      }

      if( (await membershipRepository.contarPorUsuario( userId , tx )) <= 1 ) {
        return( fail( "No podés eliminar tu única organización." ) ) ;
      }

      await organizationRepository.eliminarCompleta( organizationId , tx ) ;

      const siguiente = await userRepository.findIdentidadVigente( userId , undefined , tx ) ;

      if( !siguiente ) {
        throw new Error( "El usuario quedó sin organización." ) ;
      }

      return( ok( { organizationId: siguiente.organizationId , nombreAnterior: nombre } ) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error al eliminar la organización." , { userId , organizationId , error: String( error ) } ) ;
    return( fail( "No se pudo eliminar la organización. No se borró nada." ) ) ;
  }
}
