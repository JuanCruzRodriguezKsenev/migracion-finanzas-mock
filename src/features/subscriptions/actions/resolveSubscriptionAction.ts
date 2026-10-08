/**
 * @file resolveSubscriptionAction.ts
 * Server Action para resolver ocurrencias periódicas propuestas de suscripciones (RFC 023).
 * Aplica guarda estricta de idempotencia sobre la ocurrencia más antigua, valida divisas,
 * y ejecuta el asiento contable de partida doble junto con el avance de puntero en una
 * única transacción ACID.
 */
"use server" ;

// Librerías externas
import { revalidatePath } from "next/cache" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { logger }             from "@/shared/lib/logger" ;
import { db }                 from "@/shared/db/client" ;

// Feature: Auth
import { obtenerSesionDeEscritura } from "@/features/auth/services/authorizationService" ;

// Feature: Profile
import { profileRepository } from "@/features/profile/repositories/profileRepository" ;

// Feature: Accounting
import { categoryRepository }      from "@/features/accounting/repositories/categoryRepository" ;
import { accountRepository }       from "@/features/accounting/repositories/accountRepository" ;
import { createLedgerTransaction } from "@/features/accounting/services/accountingService" ;

// Feature: Subscriptions
import {
  pendientesDe ,
  obtenerHoyCivil ,
  proximaOcurrenciaPosteriorA
} from "../services/recurrenceService" ;
import { subscriptionRepository } from "../repositories/subscriptionRepository" ;
import {
  Subscription ,
  SubscriptionFrequency
} from "../types" ;


/**
 * Acciones posibles al resolver una ocurrencia propuesta en la bandeja.
 */
export type ResolveSubscriptionActionType =
  | "confirm"
  | "confirm_custom_amount"
  | "not_charged"
  | "cancel" ;

/**
 * Parámetros requeridos para resolver una ocurrencia.
 */
export interface ResolveSubscriptionParams {
  subscriptionId:            string ;
  occurrenceDate:            string ; // Fecha civil YYYY-MM-DD
  action:                    ResolveSubscriptionActionType ;
  accountId?:                string | null ; // Cuenta de pago a imputar si no estaba definida
  customAmount?:             number ;        // Monto en centavos enteros para confirm_custom_amount
  updateSubscriptionAmount?: boolean ;       // Si se actualiza el precio base de la suscripción
}

/**
 * Resultado de resolver una ocurrencia.
 */
export interface ResolveSubscriptionResult {
  subscription:   Subscription ;
  transactionId?: string ;
}

/**
 * Resuelve una ocurrencia propuesta de suscripción en el libro diario.
 *
 * @param params - Parámetros de resolución y acción solicitada.
 * @returns Objeto Result con la suscripción actualizada y el ID de transacción si se creó asiento.
 */
export async function resolveSubscriptionAction(
  params: ResolveSubscriptionParams
): Promise< Result< ResolveSubscriptionResult , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const organizationId = sesion.value.organizationId ;

  // 1. Obtener la suscripción y validar pertenencia
  const subscription = await subscriptionRepository.findById( params.subscriptionId , organizationId ) ;
  if( !subscription ) {
    return( fail( "Suscripción no encontrada." ) ) ;
  }

  // 2. Guarda de idempotencia y secuencia: debe ser la más antigua pendiente
  const profile    = ( sesion.value.userId ? await profileRepository.findByUserId( sesion.value.userId ) : null ) ;
  const timeZone   = ( profile?.timezone || "America/Argentina/Buenos_Aires" ) ;
  const hoyCivil   = obtenerHoyCivil( timeZone ) ;
  const pendientes = pendientesDe( subscription , hoyCivil ) ;

  if( (pendientes.length === 0) || (pendientes[0].fechaCobro !== params.occurrenceDate) ) {
    return( fail( "La ocurrencia especificada no está pendiente o no es la más antigua a resolver." ) ) ;
  }

  // 3. Validaciones específicas para acciones que generan asiento contable
  const creaAsiento = ( (params.action === "confirm") || (params.action === "confirm_custom_amount") ) ;
  let paymentAccountId: string | null = null ;
  let amountToCharge = 0 ;

  if( creaAsiento ) {
    paymentAccountId = ( params.accountId || subscription.accountId || null ) ;
    if( !paymentAccountId ) {
      return( fail( "Debe especificar una cuenta de pago para registrar el asiento contable." ) ) ;
    }

    const paymentAccount = await accountRepository.findById( paymentAccountId , organizationId ) ;
    if( !paymentAccount ) {
      return( fail( "La cuenta de pago seleccionada no existe en la organización." ) ) ;
    }

    // RFC §4.3: La divisa de la suscripción y de la cuenta de pago deben coincidir estrictamente
    if( paymentAccount.currency !== subscription.currency ) {
      return( fail( `La divisa de la suscripción (${subscription.currency}) no coincide con la de la cuenta (${paymentAccount.currency}).` ) ) ;
    }

    if( params.action === "confirm" ) {
      amountToCharge = subscription.amount ;
    } else {
      if( !params.customAmount || (params.customAmount <= 0) || !Number.isInteger( params.customAmount ) ) {
        return( fail( "El monto personalizado debe ser un entero positivo en centavos." ) ) ;
      }
      amountToCharge = params.customAmount ;
    }
  }

  // 4. Ejecución en transacción ACID única
  try {
    const outcome = await db.transaction( async ( tx ) => {
      // 4.1 Releer bajo bloqueo para evitar condiciones de carrera concurrentes
      const freshSub = await subscriptionRepository.findByIdForUpdate( params.subscriptionId , organizationId , tx ) ;
      if( !freshSub ) {
        throw( new Error( "Suscripción no encontrada." ) ) ;
      }

      const freshPendientes = pendientesDe( freshSub , hoyCivil ) ;
      if( (freshPendientes.length === 0) || (freshPendientes[0].fechaCobro !== params.occurrenceDate) ) {
        throw( new Error( "Otra confirmación resolvió esta ocurrencia mientras se procesaba." ) ) ;
      }

      let createdTxId: string | undefined ;

      if( creaAsiento && paymentAccountId ) {
        const paymentAccount = ( await accountRepository.findById( paymentAccountId , organizationId , tx ) )! ;

        // Resolver categoría a hoja contable (RFC 022 §5, RFC 023 §6.2)
        const targetCat = await categoryRepository.resolveToLeaf(
          freshSub.categoryId ,
          "expense" ,
          organizationId ,
          tx
        ) ;

        // Resolver o crear la cuenta contable vinculada en esa divisa
        const expenseAccount = await categoryRepository.findOrCreateAccountForCurrency(
          targetCat.id ,
          paymentAccount.currency ,
          tx
        ) ;

        // occurredAt = fecha de la ocurrencia (no hoy)
        const [ y , m , d ] = params.occurrenceDate.split( "-" ).map( Number ) ;
        const occurredAt    = new Date( Date.UTC( y , m - 1 , d , 12 , 0 , 0 ) ) ;
        const actualAmount  = ( params.action === "confirm" ? freshSub.amount : amountToCharge ) ;

        const ledgerResult = await createLedgerTransaction( {
          organizationId ,
          createdByUserId: sesion.value.userId ,
          categoryId:     targetCat.id ,
          description:    freshSub.name ,
          occurredAt ,
          entries: [
            {
              accountId: expenseAccount.id ,
              debit:     actualAmount ,
              credit:    0 ,
              currency:  paymentAccount.currency ,
            } ,
            {
              accountId: paymentAccount.id ,
              debit:     0 ,
              credit:    actualAmount ,
              currency:  paymentAccount.currency ,
            } ,
          ] ,
        } , tx ) ;

        if( !ledgerResult.success ) {
          throw( new Error( ledgerResult.error ) ) ;
        }

        createdTxId = ledgerResult.value.id ;
      }

      // Recalcular nextPaymentDate a partir de la nueva posición del puntero
      const nextPaymentDate = proximaOcurrenciaPosteriorA(
        freshSub.startDate ,
        freshSub.frequency as SubscriptionFrequency ,
        freshSub.intervalCount ,
        params.occurrenceDate
      ) ;

      const updateData: {
        resolvedThrough: string ;
        nextPaymentDate: Date ;
        accountId?:       string ;
        amount?:          number ;
        status?:          string ;
      } = {
        resolvedThrough: params.occurrenceDate ,
        nextPaymentDate ,
      } ;

      if( paymentAccountId && (paymentAccountId !== freshSub.accountId) ) {
        updateData.accountId = paymentAccountId ;
      }

      if( (params.action === "confirm_custom_amount") && params.updateSubscriptionAmount && params.customAmount ) {
        updateData.amount = params.customAmount ;
      }

      if( params.action === "cancel" ) {
        updateData.status = "cancelled" ;
      }

      const updated = await subscriptionRepository.update( freshSub.id , organizationId , updateData , tx ) ;
      if( !updated ) {
        throw( new Error( "No se pudo actualizar la suscripción." ) ) ;
      }

      return( {
        subscription:  updated ,
        transactionId: createdTxId ,
      } ) ;
    } ) ;

    revalidatePath( "/[lang]/(main)/subscriptions" , "page" ) ;

    return( ok( outcome ) ) ;
  } catch( error ) {
    logger.error( "Error crítico al resolver ocurrencia de suscripción." , { error: String(error) } ) ;
    return( fail( ((error as Error).message) || "Error al resolver la ocurrencia." ) ) ;
  }
}
