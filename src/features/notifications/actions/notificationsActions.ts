/**
 * @file notificationsActions.ts
 * Acciones de servidor de la campana: listar los avisos propios de todas las organizaciones y marcarlos como leídos.
 * Todas toman el usuario de la sesión; el filtro opcional por organización se valida contra sus membresías.
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;
import { z }                from "zod" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;

// Feature: Notifications
import { notificationRepository } from "../repositories/notificationRepository" ;
import type { ListadoAvisos }     from "../types" ;


/** Cuántos avisos trae la campana (S-O). */
const LIMITE_AVISOS = 30 ;

/** Días que se conserva un aviso leído antes de borrarse (RN-10, S-M). */
const DIAS_RETENCION_LEIDAS = 30 ;

/** Esquema de validación del filtro opcional de la campana. */
const filtroListadoSchema = z.object( {
  organizacionId: z.string().uuid().optional() ,
} ).strict() ;

/**
 * Lista los avisos recientes del usuario en las organizaciones donde conserva membresía activa.
 * Antes de listar borra las leídas de más de 30 días en todas sus organizaciones (RN-10).
 * El contador cuenta todas las no leídas globales, no sólo las listadas (RN-34).
 * Sin sesión responde `fail`, sin lanzar: el proveedor de la campana corre también en el login.
 *
 * @param filtro - Filtro opcional por organización.
 * @returns Los avisos, el total de no leídas y las organizaciones del usuario.
 */
export async function listarNotificacionesAction(
  filtro?: { organizacionId?: string }
): Promise< Result< ListadoAvisos , string > > {
  const session = await getServerSession( authOptions ) ;
  const userId  = session?.user?.id ;

  if( !userId ) {
    return( fail( "No autorizado para consultar los avisos." ) ) ;
  }

  if( filtro !== undefined ) {
    const parse = filtroListadoSchema.safeParse( filtro ) ;
    if( !parse.success ) {
      return( fail( "Organización inválida." ) ) ;
    }
  }

  const filtroId = filtro?.organizacionId ;

  try {
    const organizaciones = await notificationRepository.organizacionesDe( userId ) ;

    if( filtroId && !organizaciones.some( ( org ) => org.id === filtroId ) ) {
      return( fail( "Organización inválida." ) ) ;
    }

    const corte = new Date( Date.now() - (DIAS_RETENCION_LEIDAS * 24 * 60 * 60 * 1000) ) ;

    await notificationRepository.purgarLeidas( userId , corte ) ;

    const items    = await notificationRepository.listarRecientes( userId , LIMITE_AVISOS , filtroId ) ;
    const noLeidas = await notificationRepository.contarNoLeidas( userId ) ;

    return( ok( { items , noLeidas , organizaciones } ) ) ;
  } catch( error ) {
    logger.error( "Error en listarNotificacionesAction." , { error: String( error ) } ) ;
    return( fail( "Error al consultar los avisos." ) ) ;
  }
}

/**
 * Marca como leídos todos los avisos del usuario en todas sus organizaciones (RN-35).
 *
 * @returns Éxito, o `fail` sin sesión.
 */
export async function marcarLeidasAction(): Promise< Result< boolean , string > > {
  const session = await getServerSession( authOptions ) ;
  const userId  = session?.user?.id ;

  if( !userId ) {
    return( fail( "No autorizado para marcar los avisos." ) ) ;
  }

  try {
    await notificationRepository.marcarLeidas( userId ) ;

    return( ok( true ) ) ;
  } catch( error ) {
    logger.error( "Error en marcarLeidasAction." , { error: String( error ) } ) ;
    return( fail( "Error al marcar los avisos como leídos." ) ) ;
  }
}
