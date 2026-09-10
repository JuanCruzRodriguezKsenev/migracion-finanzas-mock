/**
 * @file subscriptionsActions.ts
 * Acciones de servidor (Server Actions) para la gestión de suscripciones recurrentes.
 * Todas las operaciones exigen sesión activa y se acotan a la organización del usuario.
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;
import { revalidatePath }   from "next/cache" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;

// Feature: Profile
import { profileRepository } from "@/features/profile/repositories/profileRepository" ;

// Feature: Subscriptions
import { createSubscriptionSchema , updateSubscriptionSchema } from "../schemas/subscriptions.schema" ;
import {
  calcularPunteroInicial ,
  proximaOcurrenciaPosteriorA ,
  obtenerHoyCivil
} from "../services/recurrenceService" ;
import { subscriptionRepository }                              from "../repositories/subscriptionRepository" ;
import { Subscription }                                        from "../types" ;

/**
 * Consulta y retorna todas las suscripciones de la organización del usuario autenticado.
 *
 * @returns Un objeto Result con el listado de suscripciones ordenadas por monto.
 */
export async function getSubscriptionsAction(): Promise< Result<Subscription[] , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( fail("No autorizado para consultar las suscripciones.") ) ;
  }

  try {
    const listado = await subscriptionRepository.findAll( session.user.organizationId ) ;

    return( ok(listado) ) ;
  } catch( error ) {
    logger.error( "Error al consultar suscripciones en getSubscriptionsAction." , {error: String(error)} ) ;

    return( fail("Error al consultar las suscripciones en el servidor.") ) ;
  }
}

/**
 * Registra una nueva suscripción para la organización del usuario.
 * Calcula la fecha del próximo cobro a partir de la frecuencia elegida.
 *
 * @param params - Datos del formulario (monto en centavos).
 * @returns Un objeto Result con la suscripción creada.
 */
export async function createSubscriptionAction( params: unknown ): Promise< Result<Subscription , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( fail("No autorizado para crear suscripciones.") ) ;
  }

  const validation = createSubscriptionSchema.safeParse( params ) ;

  if( !validation.success ){
    const errorMsg = validation.error.issues[0]?.message || "Datos de suscripción inválidos." ;
    return( fail(errorMsg) ) ;
  }

  try {
    const startDate       = new Date() ;
    const sessionUserId   = session.user.id ;
    const profile         = ( sessionUserId ? await profileRepository.findByUserId( sessionUserId ) : null ) ;
    const timeZone        = ( profile?.timezone || "America/Argentina/Buenos_Aires" ) ;
    const hoyCivil        = obtenerHoyCivil( timeZone , startDate ) ;
    const resolvedThrough = calcularPunteroInicial( startDate , validation.data.frequency , 1 , hoyCivil ) ;
    const nextPaymentDate = proximaOcurrenciaPosteriorA( startDate , validation.data.frequency , 1 , resolvedThrough ) ;

    const creada = await subscriptionRepository.create( {
      ...validation.data ,
      organizationId:  session.user.organizationId ,
      startDate ,
      nextPaymentDate ,
      resolvedThrough ,
    } ) ;

    revalidatePath( "/[lang]/(main)/subscriptions" , "page" ) ;

    return( ok(creada) ) ;
  } catch( error ) {
    // Violación de FK de organización: la sesión referencia una organización que ya no existe
    // (típico tras re-ejecutar el seed, que recrea la organización con otro ID)
    if( (error as {code?: string})?.code === "23503" ) {
      return( fail("Tu sesión referencia una organización inexistente. Cerrá sesión y volvé a ingresar.") ) ;
    }
    logger.error( "Error al crear suscripción en createSubscriptionAction." , {error: String(error)} ) ;

    return( fail("Error al crear la suscripción en el servidor.") ) ;
  }
}

/**
 * Actualiza una suscripción existente de la organización del usuario.
 *
 * @param id - ID de la suscripción a actualizar.
 * @param params - Campos a modificar (montos en centavos).
 * @returns Un objeto Result con la suscripción actualizada.
 */
export async function updateSubscriptionAction( id: string , params: unknown ): Promise< Result<Subscription , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( fail("No autorizado para actualizar suscripciones.") ) ;
  }

  if( !id || (typeof id !== "string") ){
    return( fail("ID de suscripción inválido.") ) ;
  }

  const validation = updateSubscriptionSchema.safeParse( params ) ;

  if( !validation.success ){
    const errorMsg = validation.error.issues[0]?.message || "Datos de actualización inválidos." ;
    return( fail(errorMsg) ) ;
  }

  try {
    const actualizada = await subscriptionRepository.update(
      id ,
      session.user.organizationId ,
      validation.data
    ) ;

    if( !actualizada ){
      return( fail("La suscripción no existe o no pertenece a la organización.") ) ;
    }

    revalidatePath( "/[lang]/(main)/subscriptions" , "page" ) ;

    return( ok(actualizada) ) ;
  } catch( error ) {
    logger.error( "Error al actualizar suscripción en updateSubscriptionAction." , {error: String(error)} ) ;

    return( fail("Error al actualizar la suscripción en el servidor.") ) ;
  }
}

/**
 * Elimina una suscripción de la organización del usuario.
 *
 * @param id - ID de la suscripción a eliminar.
 * @returns Un objeto Result indicando el resultado de la operación.
 */
export async function deleteSubscriptionAction( id: string ): Promise< Result<boolean , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    return( fail("No autorizado para eliminar suscripciones.") ) ;
  }

  if( !id || (typeof id !== "string") ){
    return( fail("ID de suscripción inválido.") ) ;
  }

  try {
    const eliminada = await subscriptionRepository.remove( id , session.user.organizationId ) ;

    if( !eliminada ){
      return( fail("La suscripción no existe o no pertenece a la organización.") ) ;
    }

    revalidatePath( "/[lang]/(main)/subscriptions" , "page" ) ;

    return( ok(true) ) ;
  } catch( error ) {
    logger.error( "Error al eliminar suscripción en deleteSubscriptionAction." , {error: String(error)} ) ;

    return( fail("Error al eliminar la suscripción en el servidor.") ) ;
  }
}
