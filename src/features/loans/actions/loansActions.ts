/**
 * @file loansActions.ts
 * Server Actions para el alta de préstamos y el pago/cobro de cuotas (RFC 008).
 * Garantiza integridad contable por partida doble, aislamiento multi-tenant y bloqueo pesimista en pagos.
 */
"use server" ;

// Librerías externas
import { revalidatePath }   from "next/cache" ;
import { getServerSession } from "next-auth" ;

// Shared
import { db }                 from "@/shared/db/client" ;
import { Result , ok , fail } from "@/shared/lib/result" ;
import { logger }             from "@/shared/lib/logger" ;

// Feature: Auth
import { authOptions } from "@/shared/lib/auth" ;

// Feature: Profile
import { profileRepository } from "@/features/profile/repositories/profileRepository" ;

// Feature: Accounting
import { createLedgerTransaction } from "@/features/accounting/services/accountingService" ;
import { categoryRepository }      from "@/features/accounting/repositories/categoryRepository" ;
import { accountRepository }       from "@/features/accounting/repositories/accountRepository" ;
import { getNextCode }             from "@/features/accounting/utils/accountCodes" ;
import type { Account }            from "@/features/accounting/types" ;

// Feature: Contacts
import { contactsRepository } from "@/features/contacts/repositories/contactsRepository" ;

// Feature: Financial Entities
import { financialEntityRepository } from "@/features/accounting/repositories/financialEntityRepository" ;

// Feature: Subscriptions
import { obtenerHoyCivil } from "@/features/subscriptions/services/recurrenceService" ;

// Feature: Loans
import {
  createLoanSchema ,
  payLoanInstallmentSchema ,
  type CreateLoanInput ,
  type PayLoanInstallmentInput
} from "../schemas/loans.schema" ;
import { loansRepository }                 from "../repositories/loansRepository" ;
import { pendientesDeLoan }                from "../services/loanScheduleService" ;
import { resumirLoans }                    from "../services/loanSummaryService" ;
import type { Loan , LoanConResumen }      from "../types" ;


/**
 * Registra un nuevo préstamo en la organización activa.
 * Crea la cuenta contable espejo correspondiente y emite el asiento contable de alta
 * (con desembolso en caja o contra Patrimonio Neto para preexistentes).
 *
 * @param params - Parámetros del préstamo validados por createLoanSchema.
 * @returns Result con el préstamo creado o mensaje de error.
 */
export async function createLoanAction( params: CreateLoanInput ): Promise< Result< Loan , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado para registrar préstamos." ) ) ;
  }

  const organizationId = session.user.organizationId ;

  // 1. Validación de esquema
  const validation = createLoanSchema.safeParse( params ) ;
  if( !validation.success ) {
    const errorMsg = ( validation.error.issues[ 0 ]?.message || "Datos de préstamo inválidos." ) ;
    return( fail( errorMsg ) ) ;
  }

  const data = validation.data ;

  try {
    // 2. Validar existencia de contraparte
    if( data.entityId ) {
      const entity = await financialEntityRepository.findById( data.entityId , organizationId ) ;
      if( !entity ) {
        return( fail( "Entidad financiera no encontrada o no pertenece a la organización." ) ) ;
      }
    }

    if( data.contactId ) {
      const contact = await contactsRepository.findById( data.contactId , organizationId ) ;
      if( !contact ) {
        return( fail( "Contacto no encontrado o no pertenece a la organización." ) ) ;
      }
    }

    // 3. Validar cuenta de desembolso si viene especificada
    let disbursementAccount: Account | null = null ;
    if( data.disbursementAccountId ) {
      disbursementAccount = await accountRepository.findById( data.disbursementAccountId , organizationId ) ;
      if( !disbursementAccount ) {
        return( fail( "Cuenta de desembolso no encontrada o no pertenece a la organización." ) ) ;
      }
      if( disbursementAccount.currency !== data.currency ) {
        return( fail( `La moneda de la cuenta de desembolso (${disbursementAccount.currency}) no coincide con la del préstamo (${data.currency}).` ) ) ;
      }
    }

    const todasLasCuentas = await accountRepository.findAll( organizationId ) ;

    // Si es sin desembolso (§5C preexistente), verificar cuenta de patrimonio neto
    let ctaPatrimonio: Account | undefined ;
    if( !disbursementAccount ) {
      ctaPatrimonio = (
        todasLasCuentas.find( ( c ) => c.code === "3.1.01.01" ) ||
        todasLasCuentas.find( ( c ) => c.type === "equity" )
      ) ;

      if( !ctaPatrimonio ) {
        return( fail( "No se encontró una cuenta de patrimonio neto para registrar el asiento de apertura del préstamo preexistente." ) ) ;
      }
    }

    // 4. Crear la fila en loans
    const loanCreado = await loansRepository.create( {
      organizationId ,
      name:                 data.name ,
      direction:            data.direction ,
      entityId:             data.entityId || null ,
      contactId:            data.contactId || null ,
      principalAmount:      data.principalAmount ,
      currency:             data.currency ,
      interestRateAnnual:   data.interestRateAnnual ,
      totalInstallments:    data.totalInstallments ,
      frequency:            data.frequency ,
      intervalCount:        data.intervalCount ,
      startDate:            data.startDate ,
      firstInstallmentDate: data.firstInstallmentDate ,
      resolvedThrough:      data.resolvedThrough || null
    } ) ;

    // 5. Crear cuenta espejo en el libro mayor
    const accountType    = ( data.direction === "borrowed" ? "liability" : "asset" ) ;
    const ancladas       = await accountRepository.findTodasEnAncla( organizationId ) ;
    const codigoContable = getNextCode( accountType , ancladas ) ;

    const cuentaEspejo = await accountRepository.create( {
      organizationId ,
      code:     codigoContable ,
      name:     `Préstamo ${loanCreado.name}` ,
      type:     accountType ,
      balance:  0 ,
      currency: data.currency ,
      entityId: data.entityId || null
    } ) ;

    // 6. Vincular en loan_accounts
    await loansRepository.addLoanAccount( {
      loanId:    loanCreado.id ,
      accountId: cuentaEspejo.id ,
      currency:  data.currency
    } ) ;

    // 7. Emitir asiento contable de alta
    let entries: { accountId: string ; debit: number ; credit: number ; currency: string }[] ;

    if( disbursementAccount ) {
      if( data.direction === "borrowed" ) {
        // §5A borrowed con desembolso: Debe cuenta destino / Haber préstamo
        entries = [
          { accountId: disbursementAccount.id , debit: data.principalAmount , credit: 0                    , currency: data.currency } ,
          { accountId: cuentaEspejo.id        , debit: 0                    , credit: data.principalAmount , currency: data.currency }
        ] ;
      } else {
        // §5B lent: Debe préstamo / Haber cuenta origen
        entries = [
          { accountId: cuentaEspejo.id        , debit: data.principalAmount , credit: 0                    , currency: data.currency } ,
          { accountId: disbursementAccount.id , debit: 0                    , credit: data.principalAmount , currency: data.currency }
        ] ;
      }
    } else if( ctaPatrimonio ) {
      if( data.direction === "borrowed" ) {
        // §5C preexistente borrowed: Debe Patrimonio Neto / Haber préstamo
        entries = [
          { accountId: ctaPatrimonio.id , debit: data.principalAmount , credit: 0                    , currency: data.currency } ,
          { accountId: cuentaEspejo.id  , debit: 0                    , credit: data.principalAmount , currency: data.currency }
        ] ;
      } else {
        // §5C preexistente lent: Debe préstamo / Haber Patrimonio Neto
        entries = [
          { accountId: cuentaEspejo.id  , debit: data.principalAmount , credit: 0                    , currency: data.currency } ,
          { accountId: ctaPatrimonio.id , debit: 0                    , credit: data.principalAmount , currency: data.currency }
        ] ;
      }
    } else {
      return( fail( "No se pudo determinar la contrapartida contable para el alta del préstamo." ) ) ;
    }

    const txResult = await createLedgerTransaction( {
      organizationId ,
      createdByUserId: session.user.id ?? null ,
      description: `Alta préstamo ${loanCreado.name}` ,
      occurredAt:  data.startDate ,
      entries
    } ) ;

    if( !txResult.success ) {
      logger.error( `[createLoanAction] Falló asiento de alta para préstamo ${loanCreado.id}: ${txResult.error}` ) ;
      return( fail( `El préstamo fue creado, pero falló el asiento contable de alta: ${txResult.error}` ) ) ;
    }

    logger.info( `[createLoanAction] Préstamo creado: ${loanCreado.id} con cuenta contable ${cuentaEspejo.code}` ) ;
    revalidatePath( "/[lang]/(main)/loans" , "page" ) ;

    return( ok( loanCreado ) ) ;
  } catch( error ) {
    const codigo = ( error as { code?: string } )?.code ;

    if( codigo === "23505" ) {
      logger.error( `[createLoanAction] Colisión de código contable: ${error}` ) ;
      return( fail( "Conflicto al generar el código contable del préstamo. Por favor, intentá de nuevo." ) ) ;
    }

    if( codigo === "23503" ) {
      logger.error( `[createLoanAction] Referencia inexistente: ${error}` ) ;
      return( fail( "Tu sesión referencia una organización o entidad inexistente. Cerrá sesión y volvé a ingresar." ) ) ;
    }

    logger.error( `[createLoanAction] Error no controlado: ${error}` ) ;
    return( fail( "Error al registrar el préstamo. Si aparece en el listado sin saldo, quedó sin cuenta contable: dala de baja y volvé a crearla." ) ) ;
  }
}

/**
 * Procesa el pago o cobro de una cuota de préstamo bajo transacción ACID y bloqueo pesimista.
 *
 * @param params - Parámetros con el ID del préstamo, cuenta de pago y número de cuota.
 * @returns Result con el préstamo actualizado y el ID de transacción contable emitida.
 */
export async function payLoanInstallmentAction(
  params: PayLoanInstallmentInput
): Promise< Result< { loan: Loan ; transactionId: string } , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado para registrar pagos de cuotas." ) ) ;
  }

  const organizationId = session.user.organizationId ;

  // 1. Validación de esquema
  const validation = payLoanInstallmentSchema.safeParse( params ) ;
  if( !validation.success ) {
    const errorMsg = ( validation.error.issues[ 0 ]?.message || "Datos de cuota inválidos." ) ;
    return( fail( errorMsg ) ) ;
  }

  const data = validation.data ;

  // 2. Determinar fecha civil actual
  let hoyCivil = data.hoyCivil ;
  if( !hoyCivil ) {
    const profile  = ( session.user.id ? await profileRepository.findByUserId( session.user.id ) : null ) ;
    const timeZone = ( profile?.timezone || "America/Argentina/Buenos_Aires" ) ;
    hoyCivil       = obtenerHoyCivil( timeZone ) ;
  }

  try {
    const outcome = await db.transaction( async ( tx ) => {
      // 3. Releer préstamo bajo bloqueo pesimista para evitar carreras
      const freshLoan = await loansRepository.findByIdForUpdate( data.loanId , organizationId , tx ) ;
      if( !freshLoan ) {
        throw( new Error( "Préstamo no encontrado o no pertenece a la organización." ) ) ;
      }

      // 4. Guarda de orden e idempotencia dentro de la transacción
      const pendientes = pendientesDeLoan( freshLoan , hoyCivil ) ;
      if( pendientes.length === 0 ) {
        throw( new Error( "No hay cuotas pendientes de pago/cobro para este préstamo." ) ) ;
      }

      const cuotaPendiente = pendientes[ 0 ] ;
      if( cuotaPendiente.n !== data.installmentNumber ) {
        throw( new Error( "La cuota solicitada no es la más antigua pendiente a liquidar." ) ) ;
      }

      // 5. Validar cuenta de pago/cobro
      const paymentAccount = await accountRepository.findById( data.paymentAccountId , organizationId , tx ) ;
      if( !paymentAccount ) {
        throw( new Error( "Cuenta de pago/cobro no encontrada." ) ) ;
      }

      if( paymentAccount.currency !== freshLoan.currency ) {
        throw( new Error( `La divisa de la cuenta (${paymentAccount.currency}) no coincide con la del préstamo (${freshLoan.currency}).` ) ) ;
      }

      // 6. Obtener cuenta espejo del préstamo
      const cuentasPrestamo = await loansRepository.findAccountsByLoanId( freshLoan.id , organizationId , tx ) ;
      const mirrorAccount   = cuentasPrestamo.find( ( la ) => la.currency === freshLoan.currency )?.account ;
      if( !mirrorAccount ) {
        throw( new Error( "No se encontró la cuenta contable espejo asociada al préstamo." ) ) ;
      }

      const { capital , interes , cuota , fechaCuota } = cuotaPendiente ;

      // 7. Resolver categoría y cuenta de intereses si interes > 0 (§1.1)
      let interestAccountId: string | undefined ;
      let categoryId: string | undefined ;

      if( interes > 0 ) {
        const todasCats   = await categoryRepository.findAll( organizationId , tx ) ;
        const targetCode  = ( freshLoan.direction === "borrowed" ? "5.1.11.02" : "4.1.04" ) ;
        const targetCat   = todasCats.find( ( c ) => c.accountCode === targetCode ) ;
        const targetType  = ( freshLoan.direction === "borrowed" ? "expense" : "revenue" ) ;

        const leafCat = (
          targetCat
            ? await categoryRepository.resolveToLeaf( targetCat.id , targetType , organizationId , tx )
            : await categoryRepository.findOrCreateTypeGeneralLeaf( targetType , organizationId , tx )
        ) ;

        categoryId = leafCat.id ;

        const interestAccount = await categoryRepository.findOrCreateAccountForCurrency(
          leafCat.id ,
          freshLoan.currency ,
          tx
        ) ;

        interestAccountId = interestAccount.id ;
      }

      // 8. occurredAt nominal de la cuota
      const [ y , m , d ] = fechaCuota.split( "-" ).map( Number ) ;
      const occurredAt    = new Date( Date.UTC( y , m - 1 , d , 12 , 0 , 0 ) ) ;

      // 9. Armar entradas del asiento contable
      let entries: { accountId: string ; debit: number ; credit: number ; currency: string }[] ;

      if( freshLoan.direction === "borrowed" ) {
        // §5D borrowed: Debe préstamo (capital), Debe intereses (interés), Haber cuenta pago (cuota)
        if( (interes > 0) && interestAccountId ) {
          entries = [
            { accountId: mirrorAccount.id  , debit: capital , credit: 0     , currency: freshLoan.currency } ,
            { accountId: interestAccountId , debit: interes , credit: 0     , currency: freshLoan.currency } ,
            { accountId: paymentAccount.id , debit: 0       , credit: cuota , currency: freshLoan.currency }
          ] ;
        } else {
          entries = [
            { accountId: mirrorAccount.id  , debit: capital , credit: 0     , currency: freshLoan.currency } ,
            { accountId: paymentAccount.id , debit: 0       , credit: cuota , currency: freshLoan.currency }
          ] ;
        }
      } else {
        // §5E lent: Debe cuenta cobro (cuota), Haber préstamo (capital), Haber intereses (interés)
        if( (interes > 0) && interestAccountId ) {
          entries = [
            { accountId: paymentAccount.id , debit: cuota , credit: 0       , currency: freshLoan.currency } ,
            { accountId: mirrorAccount.id  , debit: 0     , credit: capital , currency: freshLoan.currency } ,
            { accountId: interestAccountId , debit: 0     , credit: interes , currency: freshLoan.currency }
          ] ;
        } else {
          entries = [
            { accountId: paymentAccount.id , debit: cuota , credit: 0       , currency: freshLoan.currency } ,
            { accountId: mirrorAccount.id  , debit: 0     , credit: capital , currency: freshLoan.currency }
          ] ;
        }
      }

      const txResult = await createLedgerTransaction( {
        organizationId ,
        createdByUserId: session.user.id ?? null ,
        categoryId ,
        description: `Cuota ${cuotaPendiente.n}/${freshLoan.totalInstallments} ${freshLoan.name}` ,
        occurredAt ,
        entries
      } , tx ) ;

      if( !txResult.success ) {
        throw( new Error( txResult.error ) ) ;
      }

      // 10. Avanzar resolvedThrough
      const updatedLoan = await loansRepository.update(
        freshLoan.id ,
        organizationId ,
        { resolvedThrough: fechaCuota } ,
        tx
      ) ;

      if( !updatedLoan ) {
        throw( new Error( "No se pudo actualizar el puntero de resolución del préstamo." ) ) ;
      }

      return( {
        loan:          updatedLoan ,
        transactionId: txResult.value.id
      } ) ;
    } ) ;

    revalidatePath( "/[lang]/(main)/loans" , "page" ) ;

    return( ok( outcome ) ) ;
  } catch( error ) {
    const errorMsg = ( (error as Error).message || "Error al procesar la cuota del préstamo." ) ;
    logger.error( `[payLoanInstallmentAction] ${errorMsg}` ) ;
    return( fail( errorMsg ) ) ;
  }
}

/**
 * Obtiene la lista de préstamos activos de la organización con sus relaciones,
 * métricas de resumen derivadas y cuotas pendientes calculadas según la fecha civil del usuario.
 *
 * @returns Result con la lista de préstamos resumidos o mensaje de error.
 */
export async function getLoansAction(): Promise< Result< LoanConResumen[] , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  try {
    const list = await loansRepository.findAllWithRelations( session.user.organizationId ) ;

    const perfil     = ( session.user.id ? await profileRepository.findByUserId( session.user.id ) : null ) ;
    const timeZone   = ( perfil?.timezone || "America/Argentina/Buenos_Aires" ) ;
    const hoyCivil   = obtenerHoyCivil( timeZone ) ;

    const conResumen = resumirLoans( list , hoyCivil ) ;

    return( ok( conResumen ) ) ;
  } catch( error ) {
    logger.error( `[getLoansAction] Error: ${error}` ) ;
    return( fail( "Error al obtener los préstamos." ) ) ;
  }
}

/**
 * Archiva un préstamo (baja lógica).
 *
 * @param id - ID del préstamo a archivar.
 * @returns Result con el préstamo archivado o mensaje de error.
 */
export async function archiveLoanAction( id: string ): Promise< Result< Loan , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  try {
    const loan = await loansRepository.archive( id , session.user.organizationId ) ;
    if( !loan ) {
      return( fail( "Préstamo no encontrado." ) ) ;
    }

    revalidatePath( "/[lang]/(main)/loans" , "page" ) ;

    return( ok( loan ) ) ;
  } catch( error ) {
    logger.error( `[archiveLoanAction] Error: ${error}` ) ;
    return( fail( "Error al archivar el préstamo." ) ) ;
  }
}

