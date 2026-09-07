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
import { Category , LedgerTransaction } from "@/features/accounting/types" ;

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
        currency:  "ARS" ,
      } ) ;

      // Cuenta de gasto (entra gasto: Débito)
      let expenseAccount = allAccounts.find( ( a ) => a.type === "expense" ) ;
      if( !expenseAccount ) {
        expenseAccount = await accountRepository.create( {
          organizationId ,
          code:     "5.1.01.99" ,
          name:     "Gastos Generales" ,
          type:     "expense" ,
          balance:  0 ,
          currency: "ARS" ,
        } ) ;
      }

      entries.push( {
        accountId: expenseAccount.id ,
        debit:     amountInCents ,
        credit:    0 ,
        currency:  "ARS" ,
      } ) ;
    } else if( data.type === "income" ) {
      // Cuenta de depósito (entra plata: Débito)
      entries.push( {
        accountId: data.sourceAccountId ,
        debit:     amountInCents ,
        credit:    0 ,
        currency:  "ARS" ,
      } ) ;

      // Cuenta de ingreso (origen: Crédito)
      let revenueAccount = allAccounts.find( ( a ) => a.type === "revenue" ) ;
      if( !revenueAccount ) {
        revenueAccount = await accountRepository.create( {
          organizationId ,
          code:     "4.1.01.99" ,
          name:     "Ingresos Varios" ,
          type:     "revenue" ,
          balance:  0 ,
          currency: "ARS" ,
        } ) ;
      }

      entries.push( {
        accountId: revenueAccount.id ,
        debit:     0 ,
        credit:    amountInCents ,
        currency:  "ARS" ,
      } ) ;
    } else {
      // Transferencia entre cuentas de balance
      if( !data.destinationAccountId ) {
        return( fail("Debe especificar la cuenta de destino para una transferencia.") ) ;
      }

      // Cuenta origen (sale plata: Crédito)
      entries.push( {
        accountId: data.sourceAccountId ,
        debit:     0 ,
        credit:    amountInCents ,
        currency:  "ARS" ,
      } ) ;

      // Cuenta destino (entra plata: Débito)
      entries.push( {
        accountId: data.destinationAccountId ,
        debit:     amountInCents ,
        credit:    0 ,
        currency:  "ARS" ,
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
