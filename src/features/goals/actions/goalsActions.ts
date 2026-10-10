/**
 * @file goalsActions.ts
 * Server Actions de Metas (RFC 011 §5). El `organizationId` sale siempre de la sesión, nunca del cliente.
 */
"use server" ;

// Librerías externas
import { revalidatePath }   from "next/cache" ;
import { getServerSession } from "next-auth" ;

// Shared
import { armarClaveIdempotencia , conIdempotencia } from "@/shared/services/idempotencyService" ;
import { Result , ok , fail } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;

// Feature: Auth
import { obtenerSesionDeEscritura } from "@/features/auth/services/authorizationService" ;

// Feature: Goals
import { goalsService } from "../services/goalsService" ;
import {
  createGoalSchema ,
  updateGoalSchema ,
  goalMovementSchema ,
  abandonGoalSchema ,
  getGoalsSchema ,
  type CreateGoalInput ,
  type UpdateGoalInput ,
  type GoalMovementInput
} from "../schemas/goal.schema" ;
import type { Goal , GoalStatus , GoalsViewData , ReservedByAccount } from "../types" ;


/** Resultado de un aporte o retiro. */
export interface GoalMovementOutcome {
  status:   GoalStatus ;
  ahorrado: number ;
}

/**
 * Lee la vista de Metas de la organización de la sesión.
 *
 * @param params - Divisa y filtro opcionales.
 * @returns Result con la vista o un mensaje de error.
 */
export async function getGoalsAction(
  params?: { currency?: string ; filter?: "all" | "active" | "completed" }
): Promise< Result< GoalsViewData , string > > {
  const session = await getServerSession( authOptions ) ;
  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado para consultar metas." ) ) ;
  }

  const parsed = getGoalsSchema.safeParse( params || {} ) ;
  if( !parsed.success ) {
    return( fail( parsed.error.issues[ 0 ]?.message || "Parámetros inválidos." ) ) ;
  }

  try {
    const data = await goalsService.vista( {
      orgId:    session.user.organizationId ,
      userId:   session.user.id ,
      currency: parsed.data.currency ,
      filter:   parsed.data.filter ,
    } ) ;
    return( ok( data ) ) ;
  } catch( error ) {
    logger.error( "Error en getGoalsAction." , { error: String( error ) } ) ;
    return( fail( "Error al consultar las metas en el servidor." ) ) ;
  }
}

/**
 * Reservado y libre por cuenta de activo, para `/accounts`.
 *
 * @returns Result con `Record< accountId , { reservado , libre } >`.
 */
export async function getReservedByAccountAction(): Promise< Result< Record< string , ReservedByAccount > , string > > {
  const session = await getServerSession( authOptions ) ;
  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado para consultar reservas." ) ) ;
  }

  try {
    return( ok( await goalsService.reservadoPorCuenta( session.user.organizationId ) ) ) ;
  } catch( error ) {
    logger.error( "Error en getReservedByAccountAction." , { error: String( error ) } ) ;
    return( fail( "Error al consultar las reservas en el servidor." ) ) ;
  }
}

/**
 * Crea una meta.
 *
 * @param params - Datos validados por createGoalSchema.
 */
export async function createGoalAction( params: CreateGoalInput ): Promise< Result< Goal , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const parsed = createGoalSchema.safeParse( params ) ;
  if( !parsed.success ) {
    return( fail( parsed.error.issues[ 0 ]?.message || "Datos de meta inválidos." ) ) ;
  }

  try {
    const result = await goalsService.crear( { orgId: sesion.value.organizationId , ...parsed.data } ) ;
    if( result.success ) {
      revalidatePath( "/[lang]/(main)/goals" , "page" ) ;
    }
    return( result ) ;
  } catch( error ) {
    logger.error( "Error en createGoalAction." , { error: String( error ) } ) ;
    return( fail( "Error al crear la meta en el servidor." ) ) ;
  }
}

/**
 * Edita una meta (nunca su divisa).
 *
 * @param params - Datos validados por updateGoalSchema.
 */
export async function updateGoalAction( params: UpdateGoalInput ): Promise< Result< Goal , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const parsed = updateGoalSchema.safeParse( params ) ;
  if( !parsed.success ) {
    return( fail( parsed.error.issues[ 0 ]?.message || "Datos de meta inválidos." ) ) ;
  }

  try {
    const result = await goalsService.editar( { orgId: sesion.value.organizationId , ...parsed.data } ) ;
    if( result.success ) {
      revalidatePath( "/[lang]/(main)/goals" , "page" ) ;
    }
    return( result ) ;
  } catch( error ) {
    logger.error( "Error en updateGoalAction." , { error: String( error ) } ) ;
    return( fail( "Error al editar la meta en el servidor." ) ) ;
  }
}

/**
 * Aporta a una meta desde una cuenta de activo (sin asiento contable).
 *
 * @param params - Meta, cuenta y monto en centavos.
 */
export async function contributeToGoalAction( params: GoalMovementInput , claveDeEnvio?: string ): Promise< Result< GoalMovementOutcome , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const parsed = goalMovementSchema.safeParse( params ) ;
  if( !parsed.success ) {
    return( fail( parsed.error.issues[ 0 ]?.message || "Datos de aporte inválidos." ) ) ;
  }

  let clave: string | null ;

  try {
    clave = armarClaveIdempotencia( { userId: sesion.value.userId , accion: "aportarAMeta" , claveCliente: claveDeEnvio , datos: parsed.data } ) ;
  } catch {
    return( fail( "Clave de envío inválida." ) ) ;
  }

  return( await conIdempotencia( clave , async () => {
    try {
      const result = await goalsService.aportar( { orgId: sesion.value.organizationId , amount: parsed.data.amount , goalId: parsed.data.goalId , accountId: parsed.data.accountId } ) ;
      if( result.success ) {
        revalidatePath( "/[lang]/(main)/goals" , "page" ) ;
        revalidatePath( "/[lang]/(main)/accounts" , "page" ) ;
      }
      return( result ) ;
    } catch( error ) {
      logger.error( "Error en contributeToGoalAction." , { error: String( error ) } ) ;
      return( fail( "Error al aportar a la meta en el servidor." ) ) ;
    }
  } ) ) ;
}

/**
 * Retira de una meta hacia una cuenta (no más de lo apartado en esa cuenta).
 *
 * @param params - Meta, cuenta y monto en centavos.
 */
export async function withdrawFromGoalAction( params: GoalMovementInput , claveDeEnvio?: string ): Promise< Result< GoalMovementOutcome , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const parsed = goalMovementSchema.safeParse( params ) ;
  if( !parsed.success ) {
    return( fail( parsed.error.issues[ 0 ]?.message || "Datos de retiro inválidos." ) ) ;
  }

  let clave: string | null ;

  try {
    clave = armarClaveIdempotencia( { userId: sesion.value.userId , accion: "retirarDeMeta" , claveCliente: claveDeEnvio , datos: parsed.data } ) ;
  } catch {
    return( fail( "Clave de envío inválida." ) ) ;
  }

  return( await conIdempotencia( clave , async () => {
    try {
      const result = await goalsService.retirar( { orgId: sesion.value.organizationId , amount: parsed.data.amount , goalId: parsed.data.goalId , accountId: parsed.data.accountId } ) ;
      if( result.success ) {
        revalidatePath( "/[lang]/(main)/goals" , "page" ) ;
        revalidatePath( "/[lang]/(main)/accounts" , "page" ) ;
      }
      return( result ) ;
    } catch( error ) {
      logger.error( "Error en withdrawFromGoalAction." , { error: String( error ) } ) ;
      return( fail( "Error al retirar de la meta en el servidor." ) ) ;
    }
  } ) ) ;
}

/**
 * Abandona una meta devolviendo a cada cuenta lo apartado.
 *
 * @param params - ID de la meta.
 */
export async function abandonGoalAction( params: { goalId: string } ): Promise< Result< Goal , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const parsed = abandonGoalSchema.safeParse( params ) ;
  if( !parsed.success ) {
    return( fail( parsed.error.issues[ 0 ]?.message || "ID de meta inválido." ) ) ;
  }

  try {
    const result = await goalsService.abandonar( { orgId: sesion.value.organizationId , goalId: parsed.data.goalId } ) ;
    if( result.success ) {
      revalidatePath( "/[lang]/(main)/goals" , "page" ) ;
      revalidatePath( "/[lang]/(main)/accounts" , "page" ) ;
    }
    return( result ) ;
  } catch( error ) {
    logger.error( "Error en abandonGoalAction." , { error: String( error ) } ) ;
    return( fail( "Error al abandonar la meta en el servidor." ) ) ;
  }
}
