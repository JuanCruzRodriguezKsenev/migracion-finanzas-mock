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
import { Account , Category , LedgerTransaction } from "@/features/accounting/types" ;

// Feature: Transactions
import {
  createTransactionFormSchema ,
  CreateTransactionFormData
} from "../schemas/transactions.schema" ;


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
 * Obtiene —o crea— la cuenta del plan contable que corresponde a un tipo y una moneda.
 *
 * Existe una cuenta por divisa a propósito: el saldo de una cuenta es un entero en su propia
 * moneda, así que "Gastos Generales" en pesos y en dólares no pueden ser la misma fila. El código
 * contable lleva la moneda como sufijo porque `(organization_id, code)` es único.
 *
 * @param params - Cuentas ya cargadas, organización, moneda, tipo contable y código/nombre base.
 * @returns La cuenta existente para esa moneda, o la recién creada.
 */
async function obtenerCuentaPorMoneda( params: {
  allAccounts:    Account[] ;
  organizationId: string ;
  currency:       string ;
  type:           "expense" | "revenue" | "equity" ;
  codigoBase:     string ;
  nombreBase:     string ;
} ): Promise< Account > {
  const { allAccounts , organizationId , currency , type , codigoBase , nombreBase } = params ;

  const existente = allAccounts.find( ( a ) => (a.type === type) && (a.currency === currency) ) ;

  if( existente ) { return( existente ) ; }

  return( await accountRepository.create( {
    organizationId ,
    code:    `${codigoBase}-${currency}` ,
    name:    `${nombreBase} (${currency})` ,
    type ,
    balance: 0 ,
    currency ,
  } ) ) ;
}

/**
 * Crea una transacción contable a partir de los datos del formulario de UI,
 * generando automáticamente las partidas contables balanceadas (Debe = Haber).
 */
export async function createTransactionFromFormAction(
  rawData: CreateTransactionFormData
): Promise< Result<LedgerTransaction , string> > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail("No autorizado para registrar transacciones.") ) ;
  }

  const organizationId = session.user.organizationId ;

  // Validar con Zod
  const validation = createTransactionFormSchema.safeParse( rawData ) ;
  if( !validation.success ) {
    const errorMsg = validation.error.issues[0]?.message || "Datos del formulario inválidos." ;
    return( fail(errorMsg) ) ;
  }

  const data          = validation.data ;
  const amountInCents = Math.round( data.amount * 100 ) ;

  try {
    const allAccounts = await accountRepository.findAll( organizationId ) ;
    const sourceAcc   = allAccounts.find( ( a ) => a.id === data.sourceAccountId ) ;

    if( !sourceAcc ) {
      return( fail("La cuenta de origen no existe o no pertenece a tu organización.") ) ;
    }

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

      // Cuenta de gasto (entra gasto: Débito)
      // La contrapartida tiene que estar en la misma moneda. El fallback anterior tomaba cualquier
      // cuenta de gasto y le estampaba otra divisa, que es la misma mezcla por otra puerta.
      const expenseAccount = await obtenerCuentaPorMoneda( {
        allAccounts ,
        organizationId ,
        currency ,
        type:       "expense" ,
        codigoBase: "5.1.01.99" ,
        nombreBase: "Gastos Generales" ,
      } ) ;

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

      // Cuenta de ingreso (origen: Crédito)
      const revenueAccount = await obtenerCuentaPorMoneda( {
        allAccounts ,
        organizationId ,
        currency ,
        type:       "revenue" ,
        codigoBase: "4.1.01.99" ,
        nombreBase: "Ingresos Varios" ,
      } ) ;

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
      categoryId:     data.categoryId || undefined ,
      merchantName:   data.merchantName || undefined ,
      occurredAt:     data.occurredAt || new Date() ,
      entries ,
    } ) ) ;
  } catch( error ) {
    logger.error( "Error en createTransactionFromFormAction" , { error: String(error) } ) ;
    return( fail("Error al registrar la transacción.") ) ;
  }
}
