/**
 * @file notificationsActions.ts
 * Acciones de servidor de la campana: listar los avisos propios de todas las organizaciones y marcarlos como leídos.
 * Todas toman el usuario de la sesión; el filtro opcional por organización se valida contra sus membresías.
 */
"use server" ;

// Librerías externas
import { getServerSession }   from "next-auth" ;
import { inArray , eq , and } from "drizzle-orm" ;
import { z }                  from "zod" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;
import { db }                 from "@/shared/db/client" ;

// Feature: Splits
import { saldoCon }      from "@/features/splits/services/pagosService" ;
import { paymentClaims } from "@/features/splits/schema.db" ;

// Feature: Notifications
import { notificationRepository }         from "../repositories/notificationRepository" ;
import type { ListadoAvisos , AvisoVista } from "../types" ;


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

    const filas    = await notificationRepository.listarRecientes( userId , LIMITE_AVISOS , filtroId ) ;
    const noLeidas = await notificationRepository.contarNoLeidas( userId ) ;

    const claimIds = filas
      .filter( ( f ) => (f.tipo === "payment_claimed") && Boolean( f.claimId ) )
      .map( ( f ) => f.claimId! ) ;

    const reclamosMap = new Map< string , "pending" | "confirmed" | "rejected" | "cancelled" >() ;
    if( claimIds.length > 0 ) {
      const reclamos = await db
        .select( { id: paymentClaims.id , status: paymentClaims.status } )
        .from( paymentClaims )
        .where( inArray( paymentClaims.id , claimIds ) ) ;

      for( const r of reclamos ) {
        reclamosMap.set( r.id , r.status as "pending" | "confirmed" | "rejected" | "cancelled" ) ;
      }
    }

    const reclamosPendientes = await db
      .select( {
        id:             paymentClaims.id ,
        organizationId: paymentClaims.organizationId ,
        toUserId:       paymentClaims.toUserId ,
        currency:       paymentClaims.currency ,
      } )
      .from( paymentClaims )
      .where(
        and(
          eq( paymentClaims.fromUserId , userId ) ,
          eq( paymentClaims.status , "pending" )
        )
      ) ;

    const pendientesMap = new Map< string , string >() ;
    for( const r of reclamosPendientes ) {
      if( r.toUserId ) {
        pendientesMap.set( `${r.organizationId}:${r.toUserId}:${r.currency}` , r.id ) ;
      }
    }

    const deudasCache = new Map< string , number >() ;

    const items: AvisoVista[] = [] ;
    for( const f of filas ) {
      let accion: AvisoVista["accion"] = undefined ;

      if( ((f.tipo === "debt_created") || (f.tipo === "payment_requested")) && (f.rol !== "viewer") ) {
        const acreedorId = (f.tipo === "debt_created") ? f.holderUserId : f.actorUserId ;
        if( acreedorId && f.divisa ) {
          const cacheKey = `${f.organizacionId}:${acreedorId}:${f.divisa}` ;
          let debe = deudasCache.get( cacheKey ) ;
          if( debe === undefined ) {
            const saldo = await saldoCon( f.organizacionId , userId , acreedorId , f.divisa , db ) ;
            debe = -saldo ;
            deudasCache.set( cacheKey , debe ) ;
          }

          if( debe > 0 ) {
            const reclamoPendienteId = pendientesMap.get( cacheKey ) ;
            accion = {
              tipo:            "ya_pague" ,
              saldoEnCentavos: debe ,
              ...(reclamoPendienteId ? { reclamoPendienteId } : {}) ,
            } ;
          }
        }
      } else if( f.tipo === "payment_claimed" ) {
        if( f.claimId ) {
          const estado = reclamosMap.get( f.claimId ) ;
          if( estado ) {
            accion = {
              tipo:      "responder_reclamo" ,
              reclamoId: f.claimId ,
              estado ,
            } ;
          }
        }
      }

      items.push( {
        id:                     f.id ,
        tipo:                   f.tipo ,
        actor:                  f.actor ,
        titular:                f.titular ,
        descripcion:            f.descripcion ,
        montoEnCentavos:        f.montoEnCentavos ,
        divisa:                 f.divisa ,
        leida:                  f.leida ,
        creadaEn:               f.creadaEn ,
        organizacionId:         f.organizacionId ,
        organizacionNombre:     f.organizacionNombre ,
        organizacionEsPersonal: f.organizacionEsPersonal ,
        accion ,
      } ) ;
    }

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
