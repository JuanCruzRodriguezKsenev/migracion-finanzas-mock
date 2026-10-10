/**
 * @file transactionsActions.ts
 * Acciones de servidor (Server Actions) de alto nivel para el módulo de transacciones.
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;

// Feature: Auth
import { obtenerSesionDeEscritura } from "@/features/auth/services/authorizationService" ;

// Feature: Accounting
import {
  createLedgerTransactionAction ,
  updateLedgerTransactionMetadataAction ,
  reverseLedgerTransactionAction ,
  deleteLedgerTransactionAction ,
  getTransactionsPageAction
} from "@/features/accounting/actions/accountingActions" ;
import { categoryRepository }        from "@/features/accounting/repositories/categoryRepository" ;
import { accountRepository }         from "@/features/accounting/repositories/accountRepository" ;
import { Category , LedgerTransaction } from "@/features/accounting/types" ;

// Feature: Transactions
import {
  createTransactionFormSchema ,
  CreateTransactionFormData
} from "../schemas/transactions.schema" ;
import { obtenerCuentaPorMoneda } from "../services/accountResolver" ;


export {
  getTransactionsPageAction ,
  updateLedgerTransactionMetadataAction ,
  reverseLedgerTransactionAction ,
  deleteLedgerTransactionAction
} ;

/**
 * Obtiene todas las categorías contables disponibles para la organización del usuario.
 */
export async function getCategoriesAction(): Promise< Result<Category[] , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail("No autorizado para consultar categorías.") ) ;
  }

  try {
    const listado = await categoryRepository.findAll( session.user.organizationId ) ;
    return( ok(listado) ) ;
  } catch( error ) {
    logger.error( "Error en getCategoriesAction" , { error: String(error) } ) ;
    return( fail("Error al consultar las categorías.") ) ;
  }
}

/**
 * Crea una transacción contable a partir de los datos del formulario de UI,
 * generando automáticamente las partidas contables balanceadas (Debe = Haber).
 *
 * @param rawData - Datos del formulario. `occurredAt` debe viajar siempre: si faltara, cada reintento
 * tendría otra fecha (`new Date()`), otra huella, y la idempotencia no detectaría el duplicado.
 * @param claveDeEnvio - UUID del envío (`nuevaClaveDeEnvio()`); sin ella no hay idempotencia.
 */
export async function createTransactionFromFormAction(
  rawData:        CreateTransactionFormData ,
  claveDeEnvio?:  string
): Promise< Result<LedgerTransaction , string> > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const organizationId = sesion.value.organizationId ;

  // Validar con Zod
  const validation = createTransactionFormSchema.safeParse( rawData ) ;
  if( !validation.success ) {
    const errorMsg = validation.error.issues[0]?.message || "Datos del formulario inválidos." ;
    return( fail(errorMsg) ) ;
  }

  const data          = validation.data ;
  const amountInCents = Math.round( data.amount * 100 ) ;
  let resolvedCategoryId: string | undefined = data.categoryId || undefined ;

  try {
    // Las de la organización más las personales del autor compartidas con ella (plan 24). El permiso
    // fino lo aplica el motor en cada escritura.
    const allAccounts = await accountRepository.findUsablesPara( organizationId , sesion.value.userId ) ;
    const sourceAcc   = allAccounts.find( ( a ) => a.id === data.sourceAccountId ) ;

    if( !sourceAcc ) {
      return( fail("La cuenta de origen no existe o no pertenece a tu organización.") ) ;
    }

    // RN-9: un movimiento sobre una personal se carga siempre a nombre de su dueño.
    if( sourceAcc.ownerUserId && data.holderUserId && (data.holderUserId !== sourceAcc.ownerUserId) ) {
      return( fail("Un movimiento sobre una cuenta personal se carga a nombre de su dueño.") ) ;
    }

    const holderUserId = ( sourceAcc.ownerUserId ?? data.holderUserId ) ;

    // La moneda la define la cuenta, nunca el formulario. Antes ganaba `data.currency`, así que
    // elegir USD sobre una caja en pesos le sumaba centavos de dólar a un saldo en pesos.
    const currency = sourceAcc.currency ;

    const entries: {
      accountId: string ;
      debit:     number ;
      credit:    number ;
      currency?: string ;
    } [] = [] ;

    if( data.type === "expense" ) {
      // Cuenta de pago (sale plata: Crédito)
      entries.push( {
        accountId: data.sourceAccountId ,
        debit:     0 ,
        credit:    amountInCents ,
        currency ,
      } ) ;

      // Imputar por categoría contable (RFC 022 §5, RFC 023 §6.2)
      const targetCat    = await categoryRepository.resolveToLeaf( data.categoryId , "expense" , organizationId ) ;
      resolvedCategoryId = targetCat.id ;

      const expenseAccount = await categoryRepository.findOrCreateAccountForCurrency( targetCat.id , currency ) ;

      entries.push( {
        accountId: expenseAccount.id ,
        debit:     amountInCents ,
        credit:    0 ,
        currency ,
      } ) ;
    } else if( data.type === "income" ) {
      // Cuenta de depósito (entra plata: Débito)
      entries.push( {
        accountId: data.sourceAccountId ,
        debit:     amountInCents ,
        credit:    0 ,
        currency ,
      } ) ;

      // Imputar por categoría contable (RFC 022 §5, RFC 023 §6.2)
      const targetCat    = await categoryRepository.resolveToLeaf( data.categoryId , "revenue" , organizationId ) ;
      resolvedCategoryId = targetCat.id ;

      const revenueAccount = await categoryRepository.findOrCreateAccountForCurrency( targetCat.id , currency ) ;

      entries.push( {
        accountId: revenueAccount.id ,
        debit:     0 ,
        credit:    amountInCents ,
        currency ,
      } ) ;
    } else if( data.type === "exchange" ) {
      // Cambio de divisas: dos monedas, dos libros que cierran por separado.
      //
      // No hay un asiento que cruce monedas —eso no existe en partida doble—. Cada lado cierra
      // contra su cuenta de posición de cambio: la de la moneda vendida queda en negativo, la de
      // la comprada en positivo, y el par refleja la posición tomada. La cotización no se guarda:
      // es el cociente entre los dos importes, y un dato duplicado podría contradecir los asientos.
      if( !data.destinationAccountId ) {
        return( fail("Indicá en qué cuenta entra el dinero cambiado.") ) ;
      }

      const destinoAcc = allAccounts.find( ( a ) => a.id === data.destinationAccountId ) ;

      if( !destinoAcc ) {
        return( fail("La cuenta de destino no existe o no pertenece a tu organización.") ) ;
      }

      if( destinoAcc.currency === currency ) {
        return( fail(`Ambas cuentas operan en ${currency}. Para mover dinero entre cuentas de la misma moneda usá una transferencia.`) ) ;
      }

      const destinoEnCentavos = Math.round( (data.destinationAmount || 0) * 100 ) ;

      if( destinoEnCentavos <= 0 ) {
        return( fail("Indicá cuánto recibís en la moneda de destino.") ) ;
      }

      const posicionOrigen = await obtenerCuentaPorMoneda( {
        allAccounts ,
        organizationId ,
        currency ,
        type:       "equity" ,
        codigoBase: "3.3.01" ,
        nombreBase: "Posición de cambio" ,
      } ) ;

      const posicionDestino = await obtenerCuentaPorMoneda( {
        allAccounts:    [ ...allAccounts , posicionOrigen ] ,
        organizationId ,
        currency:       destinoAcc.currency ,
        type:           "equity" ,
        codigoBase:     "3.3.01" ,
        nombreBase:     "Posición de cambio" ,
      } ) ;

      // Libro de la moneda que sale
      entries.push( {accountId: data.sourceAccountId , debit: 0 , credit: amountInCents , currency} ) ;
      entries.push( {accountId: posicionOrigen.id    , debit: amountInCents , credit: 0 , currency} ) ;

      // Libro de la moneda que entra
      entries.push( {accountId: data.destinationAccountId , debit: destinoEnCentavos , credit: 0 , currency: destinoAcc.currency} ) ;
      entries.push( {accountId: posicionDestino.id        , debit: 0 , credit: destinoEnCentavos , currency: destinoAcc.currency} ) ;
    } else {
      // Transferencia entre cuentas de balance
      if( !data.destinationAccountId ) {
        return( fail("Debe especificar la cuenta de destino para una transferencia.") ) ;
      }

      const destinoAcc = allAccounts.find( ( a ) => a.id === data.destinationAccountId ) ;

      if( !destinoAcc ) {
        return( fail("La cuenta de destino no existe o no pertenece a tu organización.") ) ;
      }

      // Una transferencia mueve el mismo importe entre dos cuentas: si las monedas difieren, lo
      // que el usuario quiere es un cambio, no una transferencia.
      if( destinoAcc.currency !== currency ) {
        return( fail(`No se puede transferir de ${currency} a ${destinoAcc.currency}. Usá una transacción de cambio para convertir entre monedas.`) ) ;
      }

      // Cuenta origen (sale plata: Crédito)
      entries.push( {
        accountId: data.sourceAccountId ,
        debit:     0 ,
        credit:    amountInCents ,
        currency ,
      } ) ;

      // Cuenta destino (entra plata: Débito)
      entries.push( {
        accountId: data.destinationAccountId ,
        debit:     amountInCents ,
        credit:    0 ,
        currency ,
      } ) ;
    }

    return( await createLedgerTransactionAction( {
      description:    data.description ,
      categoryId:     resolvedCategoryId ,
      merchantName:   data.merchantName || undefined ,
      occurredAt:     data.occurredAt || new Date() ,
      holderUserId:   holderUserId || undefined ,
      absorbeElDueno: data.absorbeElDueno ,
      entries ,
    } , claveDeEnvio ) ) ;
  } catch( error ) {
    logger.error( "Error en createTransactionFromFormAction" , { error: String(error) } ) ;
    return( fail("Error al registrar la transacción.") ) ;
  }
}
