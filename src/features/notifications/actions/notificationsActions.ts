/**
 * @file notificationsActions.ts
 * Acciones de servidor de la campana: listar los avisos propios y marcarlos como leídos.
 * Todas toman usuario y organización de la sesión; ningún identificador llega del cliente.
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;

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

/**
 * Lista los avisos recientes del usuario en su organización activa. Antes de listar borra las
 * leídas de más de 30 días (S-M). El contador cuenta todas las no leídas, no sólo las listadas.
 * Sin sesión responde `fail`, sin lanzar: el proveedor de la campana corre también en el login.
 *
 * @returns Los avisos y el total de no leídas.
 */
export async function listarNotificacionesAction(): Promise< Result< ListadoAvisos , string > > {
  const session = await getServerSession( authOptions ) ;
  const userId  = session?.user?.id ;
  const orgId   = session?.user?.organizationId ;

  if( !userId || !orgId ) {
    return( fail( "No autorizado para consultar los avisos." ) ) ;
  }

  try {
    const corte = new Date( Date.now() - (DIAS_RETENCION_LEIDAS * 24 * 60 * 60 * 1000) ) ;

    await notificationRepository.purgarLeidas( orgId , userId , corte ) ;

    const items    = await notificationRepository.listarRecientes( orgId , userId , LIMITE_AVISOS ) ;
    const noLeidas = await notificationRepository.contarNoLeidas( orgId , userId ) ;

    return( ok( { items , noLeidas } ) ) ;
  } catch( error ) {
    logger.error( "Error en listarNotificacionesAction." , { error: String( error ) } ) ;
    return( fail( "Error al consultar los avisos." ) ) ;
  }
}

/**
 * Marca como leídos todos los avisos del usuario en su organización activa (se leen al abrir la campana).
 *
 * @returns Éxito, o `fail` sin sesión.
 */
export async function marcarLeidasAction(): Promise< Result< boolean , string > > {
  const session = await getServerSession( authOptions ) ;
  const userId  = session?.user?.id ;
  const orgId   = session?.user?.organizationId ;

  if( !userId || !orgId ) {
    return( fail( "No autorizado para marcar los avisos." ) ) ;
  }

  try {
    await notificationRepository.marcarLeidas( orgId , userId ) ;

    return( ok( true ) ) ;
  } catch( error ) {
    logger.error( "Error en marcarLeidasAction." , { error: String( error ) } ) ;
    return( fail( "Error al marcar los avisos como leídos." ) ) ;
  }
}
