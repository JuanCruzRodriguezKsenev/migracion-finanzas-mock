/**
 * @file reclamosActions.ts
 * Server Actions para el ciclo de vida de los reclamos de pago («Ya pagué»):
 * creación del reclamo por el deudor, confirmación o rechazo por el acreedor, y cancelación por el deudor.
 * La organización se deduce de la fila del aviso o del reclamo (RN-36).
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;
import { eq , and }         from "drizzle-orm" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;
import { db }                 from "@/shared/db/client" ;

// Feature: Auth
import { membershipRepository } from "@/features/auth/repositories/membershipRepository" ;

// Feature: Accounting
import { ledgerTransactions } from "@/features/accounting/schema.db" ;

// Feature: Notifications
import { notificar }     from "@/features/notifications/services/notificationService" ;
import { notifications } from "@/features/notifications/schema.db" ;

// Feature: Splits
import { reclamarPagoSchema , reclamoIdSchema , ReclamarPagoInput , ReclamoIdInput } from "../schemas/reclamos.schema" ;
import { registrarPagoEnTx , saldoCon }                                              from "../services/pagosService" ;
import { saldosRepository }                                                          from "../repositories/saldosRepository" ;
import { paymentClaims }                                                             from "../schema.db" ;


/**
 * Obtiene el ID del usuario autenticado en la sesión actual.
 */
async function obtenerUserIdSesion(): Promise< string | null > {
  const sesion = ( await getServerSession( authOptions ) ) as { user?: { id?: string } } | null ;
  return( sesion?.user?.id ?? null ) ;
}

/**
 * Reclama un pago («Ya pagué») desde un aviso de deuda o solicitud de pago.
 * El llamador es el deudor. Inserta un reclamo en estado `pending` y emite un aviso al acreedor (RN-37).
 *
 * @param datos - Aviso de origen y monto reclamado en centavos.
 * @returns Éxito con `ok( null )`, o `fail` con el motivo.
 */
export async function reclamarPagoAction( datos: ReclamarPagoInput ): Promise< Result< null , string > > {
  const userId = await obtenerUserIdSesion() ;

  if( !userId ) {
    return( fail( "No autorizado." ) ) ;
  }

  const parse = reclamarPagoSchema.safeParse( datos ) ;

  if( !parse.success ) {
    return( fail( parse.error.issues[ 0 ]?.message || "Datos del reclamo inválidos." ) ) ;
  }

  const { avisoId , montoEnCentavos } = parse.data ;

  try {
    return( await db.transaction( async ( tx ) => {
      const [ aviso ] = await tx
        .select( {
          id:              notifications.id ,
          organizationId:  notifications.organizationId ,
          recipientUserId: notifications.recipientUserId ,
          type:            notifications.type ,
          actorUserId:     notifications.actorUserId ,
          currency:        notifications.currency ,
          transactionId:   notifications.transactionId ,
          holderUserId:    ledgerTransactions.holderUserId ,
        } )
        .from( notifications )
        .leftJoin( ledgerTransactions , eq( notifications.transactionId , ledgerTransactions.id ) )
        .where(
          and(
            eq( notifications.id , avisoId ) ,
            eq( notifications.recipientUserId , userId )
          )
        ) ;

      if( !aviso ) {
        return( fail( "Aviso inexistente." ) ) ;
      }

      if( (aviso.type !== "debt_created") && (aviso.type !== "payment_requested") ) {
        return( fail( "Aviso inválido para reclamar pago." ) ) ;
      }

      const acreedorId = (aviso.type === "debt_created") ? aviso.holderUserId : aviso.actorUserId ;

      if( !acreedorId ) {
        return( fail( "La persona ya no está en la organización." ) ) ;
      }

      const divisa = aviso.currency ;

      if( !divisa ) {
        return( fail( "El aviso no especifica divisa." ) ) ;
      }

      const organizationId = aviso.organizationId ;

      await saldosRepository.bloquearPar( organizationId , userId , acreedorId , tx ) ;

      const actorMembresia    = await membershipRepository.findMembership( userId , organizationId , tx ) ;
      const acreedorMembresia = await membershipRepository.findMembership( acreedorId , organizationId , tx ) ;

      if( !actorMembresia || (actorMembresia.role === "viewer") ) {
        return( fail( "No autorizado." ) ) ;
      }

      if( !acreedorMembresia ) {
        return( fail( "La persona ya no está en la organización." ) ) ;
      }

      const saldo = await saldoCon( organizationId , userId , acreedorId , divisa , tx ) ;
      const debe  = -saldo ;

      if( debe <= 0 ) {
        return( fail( "No tenés deuda pendiente con esa persona." ) ) ;
      }

      if( montoEnCentavos > debe ) {
        return( fail( "El monto supera lo que debés." ) ) ;
      }

      const insertados = await tx
        .insert( paymentClaims )
        .values( {
          organizationId ,
          fromUserId:    userId ,
          toUserId:      acreedorId ,
          amountInCents: montoEnCentavos ,
          currency:      divisa ,
          status:        "pending" ,
        } )
        .onConflictDoNothing()
        .returning( { id: paymentClaims.id } ) ;

      if( insertados.length === 0 ) {
        return( fail( "Ya hay un pago pendiente de confirmación con esa persona." ) ) ;
      }

      const claimId = insertados[ 0 ]!.id ;

      await notificar( {
        organizationId ,
        tipo:          "payment_claimed" ,
        actorId:       userId ,
        claimId ,
        monto:         montoEnCentavos ,
        divisa ,
        destinatarios: [ acreedorId ] ,
      } , tx ) ;

      return( ok( null ) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error en reclamarPagoAction." , { error: String( error ) } ) ;
    return( fail( "No se pudo reclamar el pago." ) ) ;
  }
}

/**
 * Confirma un reclamo de pago recibido. Quien llama debe ser el acreedor (`to_user_id`).
 * Registra el pago en la base con `registrarPagoEnTx`, pasa el reclamo a `confirmed` y fecha `resolved_at` (RN-38).
 *
 * @param datos - Identificador del reclamo.
 * @returns Éxito con `ok( null )`, o `fail` con el motivo.
 */
export async function confirmarReclamoAction( datos: ReclamoIdInput ): Promise< Result< null , string > > {
  const userId = await obtenerUserIdSesion() ;

  if( !userId ) {
    return( fail( "No autorizado." ) ) ;
  }

  const parse = reclamoIdSchema.safeParse( datos ) ;

  if( !parse.success ) {
    return( fail( parse.error.issues[ 0 ]?.message || "Reclamo inválido." ) ) ;
  }

  const { reclamoId } = parse.data ;

  try {
    return( await db.transaction( async ( tx ) => {
      const [ reclamo ] = await tx
        .select()
        .from( paymentClaims )
        .where( eq( paymentClaims.id , reclamoId ) )
        .for( "update" ) ;

      if( !reclamo ) {
        return( fail( "Reclamo inexistente." ) ) ;
      }

      if( reclamo.status !== "pending" ) {
        return( fail( "El pago ya fue resuelto." ) ) ;
      }

      if( reclamo.toUserId !== userId ) {
        return( fail( "No autorizado." ) ) ;
      }

      if( !reclamo.fromUserId ) {
        return( fail( "La persona ya no está en la organización." ) ) ;
      }

      const { organizationId , fromUserId , currency , amountInCents } = reclamo ;

      await saldosRepository.bloquearPar( organizationId , userId , fromUserId , tx ) ;

      const actorMembresia = await membershipRepository.findMembership( userId , organizationId , tx ) ;

      if( !actorMembresia || (actorMembresia.role === "viewer") ) {
        return( fail( "No autorizado." ) ) ;
      }

      const resultadoPago = await registrarPagoEnTx( {
        organizationId ,
        acreedorId:      userId ,
        deudorId:        fromUserId ,
        divisa:          currency ,
        montoEnCentavos: amountInCents ,
      } , tx ) ;

      if( !resultadoPago.success ) {
        return( resultadoPago ) ;
      }

      await tx
        .update( paymentClaims )
        .set( {
          status:     "confirmed" ,
          resolvedAt: new Date() ,
        } )
        .where( eq( paymentClaims.id , reclamoId ) ) ;

      return( ok( null ) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error en confirmarReclamoAction." , { error: String( error ) } ) ;
    return( fail( "No se pudo confirmar el pago." ) ) ;
  }
}

/**
 * Rechaza un reclamo de pago recibido. Quien llama debe ser el acreedor (`to_user_id`).
 * Pasa el reclamo a `rejected`, fecha `resolved_at` y avisa al deudor (`payment_claim_rejected`).
 * El saldo de las personas no se modifica.
 *
 * @param datos - Identificador del reclamo.
 * @returns Éxito con `ok( null )`, o `fail` con el motivo.
 */
export async function rechazarReclamoAction( datos: ReclamoIdInput ): Promise< Result< null , string > > {
  const userId = await obtenerUserIdSesion() ;

  if( !userId ) {
    return( fail( "No autorizado." ) ) ;
  }

  const parse = reclamoIdSchema.safeParse( datos ) ;

  if( !parse.success ) {
    return( fail( parse.error.issues[ 0 ]?.message || "Reclamo inválido." ) ) ;
  }

  const { reclamoId } = parse.data ;

  try {
    return( await db.transaction( async ( tx ) => {
      const [ reclamo ] = await tx
        .select()
        .from( paymentClaims )
        .where( eq( paymentClaims.id , reclamoId ) )
        .for( "update" ) ;

      if( !reclamo ) {
        return( fail( "Reclamo inexistente." ) ) ;
      }

      if( reclamo.status !== "pending" ) {
        return( fail( "El pago ya fue resuelto." ) ) ;
      }

      if( reclamo.toUserId !== userId ) {
        return( fail( "No autorizado." ) ) ;
      }

      if( !reclamo.fromUserId ) {
        return( fail( "La persona ya no está en la organización." ) ) ;
      }

      const { organizationId , fromUserId , currency , amountInCents } = reclamo ;

      await saldosRepository.bloquearPar( organizationId , userId , fromUserId , tx ) ;

      const actorMembresia = await membershipRepository.findMembership( userId , organizationId , tx ) ;

      if( !actorMembresia || (actorMembresia.role === "viewer") ) {
        return( fail( "No autorizado." ) ) ;
      }

      await tx
        .update( paymentClaims )
        .set( {
          status:     "rejected" ,
          resolvedAt: new Date() ,
        } )
        .where( eq( paymentClaims.id , reclamoId ) ) ;

      await notificar( {
        organizationId ,
        tipo:          "payment_claim_rejected" ,
        actorId:       userId ,
        claimId:       reclamo.id ,
        monto:         amountInCents ,
        divisa:        currency ,
        destinatarios: [ fromUserId ] ,
      } , tx ) ;

      return( ok( null ) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error en rechazarReclamoAction." , { error: String( error ) } ) ;
    return( fail( "No se pudo rechazar el pago." ) ) ;
  }
}

/**
 * Cancela un reclamo de pago emitido por quien llama (`from_user_id = userId`).
 * Pasa el reclamo a `cancelled` y fecha `resolved_at`. No emite avisos (RN-39).
 *
 * @param datos - Identificador del reclamo.
 * @returns Éxito con `ok( null )`, o `fail` con el motivo.
 */
export async function cancelarReclamoAction( datos: ReclamoIdInput ): Promise< Result< null , string > > {
  const userId = await obtenerUserIdSesion() ;

  if( !userId ) {
    return( fail( "No autorizado." ) ) ;
  }

  const parse = reclamoIdSchema.safeParse( datos ) ;

  if( !parse.success ) {
    return( fail( parse.error.issues[ 0 ]?.message || "Reclamo inválido." ) ) ;
  }

  const { reclamoId } = parse.data ;

  try {
    return( await db.transaction( async ( tx ) => {
      const [ reclamo ] = await tx
        .select()
        .from( paymentClaims )
        .where( eq( paymentClaims.id , reclamoId ) )
        .for( "update" ) ;

      if( !reclamo ) {
        return( fail( "Reclamo inexistente." ) ) ;
      }

      if( reclamo.status !== "pending" ) {
        return( fail( "El pago ya fue resuelto." ) ) ;
      }

      if( reclamo.fromUserId !== userId ) {
        return( fail( "No autorizado." ) ) ;
      }

      const { organizationId , toUserId } = reclamo ;

      if( toUserId ) {
        await saldosRepository.bloquearPar( organizationId , userId , toUserId , tx ) ;
      }

      const actorMembresia = await membershipRepository.findMembership( userId , organizationId , tx ) ;

      if( !actorMembresia || (actorMembresia.role === "viewer") ) {
        return( fail( "No autorizado." ) ) ;
      }

      await tx
        .update( paymentClaims )
        .set( {
          status:     "cancelled" ,
          resolvedAt: new Date() ,
        } )
        .where( eq( paymentClaims.id , reclamoId ) ) ;

      return( ok( null ) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error en cancelarReclamoAction." , { error: String( error ) } ) ;
    return( fail( "No se pudo cancelar el pago." ) ) ;
  }
}
