/**
 * @file cardsActions.ts
 * Acciones de servidor (Server Actions) para la gestión del ciclo de vida de tarjetas (RFC 007).
 * Ramifica altas por tipo (crédito emite cuenta de pasivo y asiento invertido; débito espeja activo).
 */
"use server" ;

// Librerías externas
import { revalidatePath }   from "next/cache" ;
import { getServerSession } from "next-auth" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;

// Feature: Accounting
import { financialEntityRepository } from "@/features/accounting/repositories/financialEntityRepository" ;
import { createLedgerTransaction }    from "@/features/accounting/services/accountingService" ;
import { accountRepository }          from "@/features/accounting/repositories/accountRepository" ;
import { getNextCode }                from "@/features/accounting/utils/accountCodes" ;
import { Account }                    from "@/features/accounting/types" ;

// Feature: Cards
import { createCardSchema , CreateCardInput } from "../schemas/cards.schema" ;
import { cardsRepository }                    from "../repositories/cardsRepository" ;
import { Card , CardWithAccountsAndEntity }   from "../types" ;


/**
 * Registra una nueva tarjeta (crédito o débito) en la organización activa.
 * Para crédito, genera la cuenta de pasivo y emite el asiento contable (Debe Patrimonio / Haber Tarjeta) si hay deuda inicial.
 * Para débito, actúa como espejo de la cuenta vinculada sin crear cuentas ni asientos.
 *
 * @param params - Datos validados de la tarjeta.
 * @returns Result con la tarjeta creada o mensaje de error.
 */
export async function createCardAction( params: CreateCardInput ): Promise< Result<Card , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado para registrar tarjetas." ) ) ;
  }

  const organizationId = session.user.organizationId ;

  // 1. Validación estricta con Zod en runtime (defensa PCI)
  const validation = createCardSchema.safeParse( params ) ;
  if( !validation.success ) {
    const errorMsg = validation.error.issues[0]?.message || "Datos de tarjeta inválidos." ;
    return( fail( errorMsg ) ) ;
  }

  const data = validation.data ;

  try {
    // 2. Verificar entidad financiera si viene indicada
    if( data.entityId ) {
      const entidad = await financialEntityRepository.findById( data.entityId , organizationId ) ;
      if( !entidad ) {
        return( fail( "Entidad financiera no encontrada o no pertenece a la organización." ) ) ;
      }
    }

    // 3. Verificar cuenta vinculada si viene indicada
    if( data.linkedAccountId ) {
      const cuentaVinculada = await accountRepository.findById( data.linkedAccountId , organizationId ) ;
      if( !cuentaVinculada ) {
        return( fail( "Cuenta vinculada no encontrada o no pertenece a la organización." ) ) ;
      }
    }

    // 4. Ramificación por tipo de tarjeta
    if( data.type === "debit" ) {
      // Débito: espejo puro sin cuenta de pasivo ni asiento
      const tarjetaCreada = await cardsRepository.create( {
        organizationId ,
        label:                 data.label ,
        type:                  "debit" ,
        network:               data.network ,
        entityId:              data.entityId || null ,
        linkedAccountId:       data.linkedAccountId || null ,
        lastFour:              data.lastFour ,
        expiryMonth:           data.expiryMonth ,
        expiryYear:            data.expiryYear ,
        creditLimit:           null ,
        closingDay:            null ,
        dueDay:                null ,
        interestRateFinancing: null ,
        interestRatePenalty:   null ,
        monthlyMaintenanceFee: 0 ,
        annualRenewalFee:      0 ,
      } ) ;

      logger.info( `[createCardAction] Tarjeta de débito creada: ${tarjetaCreada.id} (${tarjetaCreada.label})` ) ;
      revalidatePath( "/cards" ) ;
      return( ok( tarjetaCreada ) ) ;
    }

    // Crédito: requiere cuenta de pasivo
    const todasLasCuentas = await accountRepository.findAll( organizationId ) ;

    // Si viene deudaInicial > 0, localizar cuenta de patrimonio antes de crear nada
    let ctaPatrimonio: Account | undefined ;
    const deuda = ( data.deudaInicial || 0 ) ;

    if( deuda > 0 ) {
      ctaPatrimonio = todasLasCuentas.find( ( c ) => c.code === "3.1.01.01" ) || todasLasCuentas.find( ( c ) => c.type === "equity" ) ;
      if( !ctaPatrimonio ) {
        return( fail( "No se encontró una cuenta de patrimonio neto para registrar el asiento de apertura de la deuda." ) ) ;
      }
    }

    // A. Crear registro de plástico en cards
    const tarjetaCreada = await cardsRepository.create( {
      organizationId ,
      label:                 data.label ,
      type:                  "credit" ,
      network:               data.network ,
      entityId:              data.entityId || null ,
      linkedAccountId:       data.linkedAccountId || null ,
      lastFour:              data.lastFour ,
      expiryMonth:           data.expiryMonth ,
      expiryYear:            data.expiryYear ,
      creditLimit:           data.creditLimit ?? null ,
      closingDay:            data.closingDay ?? null ,
      dueDay:                data.dueDay ?? null ,
      interestRateFinancing: data.interestRateFinancing ?? null ,
      interestRatePenalty:   data.interestRatePenalty ?? null ,
      monthlyMaintenanceFee: data.monthlyMaintenanceFee ?? 0 ,
      annualRenewalFee:      data.annualRenewalFee ?? 0 ,
    } ) ;

    // B. Crear cuenta de pasivo asociada con balance 0
    const codigoContable = getNextCode( "liability" , todasLasCuentas ) ;
    const moneda         = ( data.currency || "ARS" ) ;

    const cuentaPasivo = await accountRepository.create( {
      organizationId ,
      code:           codigoContable ,
      name:           `Tarjeta ${tarjetaCreada.label}` ,
      type:           "liability" ,
      balance:        0 ,
      currency:       moneda ,
      entityId:       data.entityId || null ,
    } ) ;

    // C. Vincular en card_accounts
    await cardsRepository.addCardAccount( {
      cardId:    tarjetaCreada.id ,
      accountId: cuentaPasivo.id ,
      currency:  moneda ,
    } ) ;

    // D. Asiento de apertura invertido: Debe Patrimonio Neto / Haber Tarjeta
    if( (deuda > 0) && ctaPatrimonio ) {
      const txResult = await createLedgerTransaction( {
        organizationId ,
        description:    `Apertura deuda inicial ${tarjetaCreada.label}` ,
        occurredAt:     new Date() ,
        entries: [
          { accountId: ctaPatrimonio.id , debit: deuda , credit: 0     } ,
          { accountId: cuentaPasivo.id  , debit: 0     , credit: deuda } ,
        ] ,
      } ) ;

      if( !txResult.success ) {
        logger.error( `[createCardAction] Falló asiento de apertura para tarjeta ${tarjetaCreada.id}: ${txResult.error}` ) ;
        return( fail( `La tarjeta fue creada, pero falló el asiento de apertura: ${txResult.error}` ) ) ;
      }
    }

    logger.info( `[createCardAction] Tarjeta de crédito creada: ${tarjetaCreada.id} con cuenta contable ${cuentaPasivo.code}` ) ;
    revalidatePath( "/cards" ) ;
    return( ok( tarjetaCreada ) ) ;
  } catch( error ) {
    logger.error( `[createCardAction] Error no controlado: ${error}` ) ;
    return( fail( "Ocurrió un error inesperado al registrar la tarjeta." ) ) ;
  }
}

/**
 * Obtiene todas las tarjetas activas de la organización del usuario autenticado.
 */
export async function getCardsAction(): Promise< Result<CardWithAccountsAndEntity[] , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  try {
    const list = await cardsRepository.findAll( session.user.organizationId ) ;
    return( ok( list ) ) ;
  } catch( error ) {
    logger.error( `[getCardsAction] Error: ${error}` ) ;
    return( fail( "Error al obtener las tarjetas." ) ) ;
  }
}

/**
 * Archiva una tarjeta (baja lógica).
 *
 * @param id - ID de la tarjeta a archivar.
 */
export async function archiveCardAction( id: string ): Promise< Result<Card , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  try {
    const tarjeta = await cardsRepository.archive( id , session.user.organizationId ) ;
    if( !tarjeta ) {
      return( fail( "Tarjeta no encontrada." ) ) ;
    }
    revalidatePath( "/cards" ) ;
    return( ok( tarjeta ) ) ;
  } catch( error ) {
    logger.error( `[archiveCardAction] Error: ${error}` ) ;
    return( fail( "Error al archivar la tarjeta." ) ) ;
  }
}
