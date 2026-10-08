/**
 * @file installmentPlansActions.ts
 * Acciones del servidor (Server Actions) para el ciclo de vida de compras en cuotas con tarjeta (RFC 025).
 * Aislamiento multi-tenant por organización, transacciones ACID con bloqueo pesimista e imputación
 * contable de pasivos contra cuentas de gasto sin movimiento bancario.
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;
import { revalidatePath }   from "next/cache" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
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
import { getNextCode }             from "@/features/accounting/utils/accountCodes" ;

// Feature: Subscriptions
import { obtenerHoyCivil , calcularPunteroInicial } from "@/features/subscriptions/services/recurrenceService" ;

// Feature: Cards
import { createInstallmentPlanSchema , CreateInstallmentPlanInput } from "../schemas/cards.schema" ;
import { installmentPlansRepository }                               from "../repositories/installmentPlansRepository" ;
import { cardsRepository }                                          from "../repositories/cardsRepository" ;
import {
  cuotasImputadasDe ,
  pendientesDeCuotas
} from "../services/installmentService" ;
import {
  CardInstallmentPlanWithDetails ,
  CardInstallmentPlan
} from "../types" ;


/**
 * Acciones posibles al resolver una cuota propuesta en la bandeja.
 */
export type ResolveInstallmentActionType = "confirm" | "confirm_custom_amount" | "skip" ;

/**
 * Parámetros requeridos para resolver una cuota de tarjeta.
 */
export interface ResolveInstallmentParams {
  planId:         string ;
  occurrenceDate: string ; // Fecha civil YYYY-MM-DD
  action:         ResolveInstallmentActionType ;
  customAmount?:  number ; // Centavos enteros para confirm_custom_amount
}

/**
 * Resultado de la resolución de una cuota de tarjeta.
 */
export interface ResolveInstallmentResult {
  plan:           CardInstallmentPlan ;
  transactionId?: string ;
}

/**
 * Registra un nuevo plan de cuotas de tarjeta de crédito (RFC 025 §7.1).
 * Verifica pertenencia a la organización, tipo de tarjeta y crea la cuenta contable
 * por divisa si faltaba. Cero asientos contables emitidos (§5A).
 *
 * @param params - Datos validados del plan a dar de alta.
 * @returns Result con el plan registrado o mensaje de error.
 */
export async function createInstallmentPlanAction(
  params: CreateInstallmentPlanInput
): Promise< Result< CardInstallmentPlan , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const organizationId = sesion.value.organizationId ;

  const validation = createInstallmentPlanSchema.safeParse( params ) ;
  if( !validation.success ) {
    const errorMsg = ( validation.error.issues[0]?.message || "Datos del plan inválidos." ) ;
    return( fail( errorMsg ) ) ;
  }

  const data = validation.data ;

  try {
    // 1. Verificar existencia de la tarjeta y pertenencia a la organización
    const todasLasTarjetas = await cardsRepository.findAll( organizationId , { includeArchived: true } ) ;
    const tarjeta          = todasLasTarjetas.find( ( c ) => c.id === data.cardId ) ;

    if( !tarjeta ) {
      return( fail( "Tarjeta no encontrada." ) ) ;
    }

    if( tarjeta.type !== "credit" ) {
      return( fail( "Solo las tarjetas de crédito admiten planes de cuotas." ) ) ;
    }

    // 2. Si la tarjeta no posee cuenta contable en la divisa del plan, la crea
    const tieneCuentaEnMoneda = tarjeta.accounts.some( ( ca ) => ca.currency === data.currency ) ;
    if( !tieneCuentaEnMoneda ) {
      const todasLasCuentas = await accountRepository.findAll( organizationId ) ;
      const codigoContable  = getNextCode( "liability" , todasLasCuentas ) ;

      const cuentaPasivo = await accountRepository.create( {
        organizationId ,
        code:           codigoContable ,
        name:           `Tarjeta ${tarjeta.label} (${data.currency})` ,
        type:           "liability" ,
        balance:        0 ,
        currency:       data.currency ,
        entityId:       tarjeta.entityId || null ,
      } ) ;

      await cardsRepository.addCardAccount( {
        cardId:    tarjeta.id ,
        accountId: cuentaPasivo.id ,
        currency:  data.currency ,
      } ) ;
    }

    // 3. Determinar puntero inicial resolvedThrough
    const profile   = ( sesion.value.userId ? await profileRepository.findByUserId( sesion.value.userId ) : null ) ;
    const timeZone  = ( profile?.timezone || "America/Argentina/Buenos_Aires" ) ;
    const hoyCivil  = obtenerHoyCivil( timeZone ) ;
    const punteroIn = calcularPunteroInicial( data.firstInstallmentDate , "monthly" , 1 , hoyCivil ) ;

    // 4. Inserción del plan (cero asientos contables)
    const nuevoPlan = await installmentPlansRepository.create( {
      organizationId ,
      cardId:               data.cardId ,
      description:          data.description ,
      merchantName:         data.merchantName ?? null ,
      categoryId:           data.categoryId ?? null ,
      installmentAmount:    data.installmentAmount ,
      totalInstallments:    data.totalInstallments ,
      currency:             data.currency ,
      purchasedAt:          data.purchasedAt ,
      firstInstallmentDate: data.firstInstallmentDate ,
      resolvedThrough:      punteroIn ,
    } ) ;

    revalidatePath( "/[lang]/(main)/cards" , "page" ) ;

    return( ok( nuevoPlan ) ) ;
  } catch( error ) {
    logger.error( "Error crítico al registrar plan de cuotas." , { error: String( error ) } ) ;
    return( fail( ((error as Error).message) || "Error al registrar el plan de cuotas." ) ) ;
  }
}

/**
 * Resuelve una cuota propuesta en el libro mayor y avanza el puntero resolvedThrough (RFC 025 §7.2).
 * Copia el patrón de resolveSubscriptionAction con bloqueo pesimista y repetición de guarda dentro de ACID,
 * pero no mueve dinero bancario: incrementa la deuda de la tarjeta e imputa a la cuenta de gasto.
 *
 * @param params - Parámetros de resolución de la cuota.
 * @returns Result con el plan actualizado y el ID de transacción generado si correspondió.
 */
export async function resolveInstallmentAction(
  params: ResolveInstallmentParams
): Promise< Result< ResolveInstallmentResult , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const organizationId = sesion.value.organizationId ;

  // 1. Obtener plan y validar pertenencia
  const plan = await installmentPlansRepository.findById( params.planId , organizationId ) ;
  if( !plan ) {
    return( fail( "Plan de cuotas no encontrado." ) ) ;
  }

  // 2. Guarda de idempotencia y secuencia previa a la transacción
  const profile    = ( sesion.value.userId ? await profileRepository.findByUserId( sesion.value.userId ) : null ) ;
  const timeZone   = ( profile?.timezone || "America/Argentina/Buenos_Aires" ) ;
  const hoyCivil   = obtenerHoyCivil( timeZone ) ;
  const pendientes = pendientesDeCuotas( plan , hoyCivil ) ;

  if( (pendientes.length === 0) || (pendientes[0].fechaCuota !== params.occurrenceDate) ) {
    return( fail( "La cuota especificada no está pendiente o no es la más antigua a resolver." ) ) ;
  }

  // 3. Validación de montos
  const creaAsiento = ( (params.action === "confirm") || (params.action === "confirm_custom_amount") ) ;
  let amountToCharge = 0 ;

  if( creaAsiento ) {
    if( params.action === "confirm" ) {
      amountToCharge = plan.installmentAmount ;
    } else {
      if( !params.customAmount || (params.customAmount <= 0) || !Number.isInteger( params.customAmount ) ) {
        return( fail( "El monto personalizado debe ser un entero positivo en centavos." ) ) ;
      }
      amountToCharge = params.customAmount ;
    }
  }

  // 4. Ejecución en transacción ACID única con bloqueo pesimista
  try {
    const outcome = await db.transaction( async ( tx ) => {
      // 4.1 Relectura pesimista bajo FOR UPDATE
      const freshPlan = await installmentPlansRepository.findByIdForUpdate( params.planId , organizationId , tx ) ;
      if( !freshPlan ) {
        throw( new Error( "Plan de cuotas no encontrado." ) ) ;
      }

      const freshPendientes = pendientesDeCuotas( freshPlan , hoyCivil ) ;
      if( (freshPendientes.length === 0) || (freshPendientes[0].fechaCuota !== params.occurrenceDate) ) {
        throw( new Error( "Otra confirmación resolvió esta cuota mientras se procesaba." ) ) ;
      }

      const cuotaActual = freshPendientes[0] ;
      let createdTxId: string | undefined ;

      if( creaAsiento ) {
        // 4.2 Resolver la cuenta de pasivo de la tarjeta en la divisa del plan
        const todasLasTarjetas = await cardsRepository.findAll( organizationId , { includeArchived: true } , tx ) ;
        const tarjeta          = todasLasTarjetas.find( ( c ) => c.id === freshPlan.cardId ) ;
        const cuentaTarjeta    = tarjeta?.accounts.find( ( ca ) => ca.currency === freshPlan.currency ) ;

        if( !cuentaTarjeta ) {
          throw( new Error( `La tarjeta no tiene cuenta contable asociada en divisa ${freshPlan.currency}.` ) ) ;
        }

        // 4.3 Resolver categoría a hoja contable y cuenta en esa divisa
        const targetCat = await categoryRepository.resolveToLeaf(
          freshPlan.categoryId ,
          "expense" ,
          organizationId ,
          tx
        ) ;

        const expenseAccount = await categoryRepository.findOrCreateAccountForCurrency(
          targetCat.id ,
          freshPlan.currency ,
          tx
        ) ;

        // 4.4 Construir occurredAt con la fecha civil de la ocurrencia (12:00 UTC)
        const [ y , m , d ] = params.occurrenceDate.split( "-" ).map( Number ) ;
        const occurredAt    = new Date( Date.UTC( y , m - 1 , d , 12 , 0 , 0 ) ) ;
        const actualAmount  = ( params.action === "confirm" ? freshPlan.installmentAmount : amountToCharge ) ;

        const ordinalDescripcion = `${freshPlan.description} (${cuotaActual.numeroCuota}/${freshPlan.totalInstallments})` ;

        const ledgerResult = await createLedgerTransaction( {
          organizationId ,
          createdByUserId: sesion.value.userId ,
          categoryId:     targetCat.id ,
          description:    ordinalDescripcion ,
          occurredAt ,
          merchantName:   freshPlan.merchantName || undefined ,
          entries: [
            {
              accountId: expenseAccount.id ,
              debit:     actualAmount ,
              credit:    0 ,
              currency:  freshPlan.currency ,
            } ,
            {
              accountId: cuentaTarjeta.accountId ,
              debit:     0 ,
              credit:    actualAmount ,
              currency:  freshPlan.currency ,
            } ,
          ] ,
        } , tx ) ;

        if( !ledgerResult.success ) {
          throw( new Error( ledgerResult.error ) ) ;
        }

        createdTxId = ledgerResult.value.id ;
      }

      // 4.5 Avanzar puntero resolvedThrough
      const updated = await installmentPlansRepository.update(
        freshPlan.id ,
        organizationId ,
        { resolvedThrough: params.occurrenceDate } ,
        tx
      ) ;

      if( !updated ) {
        throw( new Error( "No se pudo actualizar el plan de cuotas." ) ) ;
      }

      return( {
        plan:          updated ,
        transactionId: createdTxId ,
      } ) ;
    } ) ;

    revalidatePath( "/[lang]/(main)/cards" , "page" ) ;

    return( ok( outcome ) ) ;
  } catch( error ) {
    logger.error( "Error crítico al resolver cuota de tarjeta." , { error: String( error ) } ) ;
    return( fail( ((error as Error).message) || "Error al resolver la cuota." ) ) ;
  }
}

/**
 * Archiva lógicamente un plan de cuotas de tarjeta (RFC 025 §7.3).
 *
 * @param planId - ID del plan a archivar.
 * @returns Result con el plan archivado o mensaje de error.
 */
export async function archiveInstallmentPlanAction(
  planId: string
): Promise< Result< CardInstallmentPlan , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const organizationId = sesion.value.organizationId ;

  const updated = await installmentPlansRepository.archive( planId , organizationId ) ;
  if( !updated ) {
    return( fail( "Plan de cuotas no encontrado o no pertenece a la organización." ) ) ;
  }

  revalidatePath( "/[lang]/(main)/cards" , "page" ) ;

  return( ok( updated ) ) ;
}

/**
 * Obtiene los planes activos de una tarjeta con cuotas imputadas y pendientes ya calculadas (RFC 025 §7.3).
 *
 * @param cardId - ID de la tarjeta.
 * @returns Result con la lista de planes enriquecidos.
 */
export async function getInstallmentPlansAction(
  cardId: string
): Promise< Result< CardInstallmentPlanWithDetails[] , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado para consultar planes de cuotas." ) ) ;
  }

  const organizationId = session.user.organizationId ;

  const profile  = ( session.user.id ? await profileRepository.findByUserId( session.user.id ) : null ) ;
  const timeZone = ( profile?.timezone || "America/Argentina/Buenos_Aires" ) ;
  const hoyCivil = obtenerHoyCivil( timeZone ) ;

  const planes = await installmentPlansRepository.findByCard( cardId , organizationId ) ;

  const conDetalles: CardInstallmentPlanWithDetails[] = planes.map( ( plan ) => ( {
    ...plan ,
    cuotasImputadas: cuotasImputadasDe( plan ) ,
    pendientes:      pendientesDeCuotas( plan , hoyCivil ) ,
  } ) ) ;

  return( ok( conDetalles ) ) ;
}
