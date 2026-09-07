/**
 * @file accountingService.ts
 * Servicio para la gestión contable de partida doble e integridad transaccional.
 */
// Shared
import { Result , ok , fail } from "@/shared/lib/result" ;
import { logger } from "@/shared/lib/logger" ;
import { db } from "@/shared/db/client" ;

// Feature: Accounting
import { CreateTransactionParams , LedgerTransaction , InsertLedgerEntry } from "../types" ;
import { accountRepository } from "../repositories/accountRepository" ;
import { ledgerRepository } from "../repositories/ledgerRepository" ;
import { outboxEvents } from "../schema.db" ;


/**
 * Crea una transacción contable de partida doble de manera transaccional.
 * Valida que los débitos y créditos sumen cero (balance cero) y pertenezcan al inquilino.
 * Registra un evento outbox para su propagación.
 * 
 * @param params - Parámetros de creación (cabecera y líneas del diario).
 * @returns Objeto Result con la transacción creada o error descriptivo.
 */
export async function createLedgerTransaction(
  params: CreateTransactionParams
): Promise< Result<LedgerTransaction , string> > {
  const { organizationId , categoryId , description , merchantName , merchantDomain , occurredAt , entries } = params ;

  // 1. Validar que la transacción no esté vacía
  if( !entries || (entries.length < 2) ){
    return( fail("Una transacción de partida doble requiere al menos dos entradas contables.") ) ;
  }

  // 2. Validar regla de Balance Cero (Débitos = Créditos)
  let totalDebit  = 0 ;
  let totalCredit = 0 ;

  for( const entry of entries ){
    totalDebit  += entry.debit ;
    totalCredit += entry.credit ;
  }

  if( totalDebit !== totalCredit ){
    return( fail(`La transacción contable está desbalanceada. Débitos: ${totalDebit}, Créditos: ${totalCredit}. La diferencia debe ser cero.`) ) ;
  }

  try {
    // 3. Ejecutar operaciones dentro de una transacción ACID de base de datos
    return( await db.transaction( async (tx) => {
      
      // A. Insertar cabecera de la transacción usando el DAL
      const insertedTx = await ledgerRepository.createTransaction( {
        organizationId ,
        categoryId ,
        description ,
        merchantName ,
        merchantDomain ,
        occurredAt: occurredAt ? new Date( occurredAt ) : undefined ,
      } , tx ) ;

      const entriesToInsert: InsertLedgerEntry[] = [] ;

      // B. Procesar cada asiento y actualizar el saldo acumulado en su cuenta respectiva
      for( const entry of entries ){
        // Bloquear la fila de la cuenta para evitar colisiones de concurrencia (SELECT FOR UPDATE)
        const account = await accountRepository.findByIdForUpdate( entry.accountId , organizationId , tx ) ;

        if( !account ){
          // Lanza excepción para forzar rollback de la transacción Drizzle
          throw new Error( `La cuenta con ID ${entry.accountId} no existe o no pertenece a la organización solicitante.` ) ;
        }

        if( account.organizationId !== organizationId ){
          throw new Error( `Acceso no autorizado: la cuenta ${account.name} no pertenece a la organización solicitante.` ) ;
        }

        // Calcular el nuevo saldo según el tipo de cuenta financiera
        let nuevoSaldo = account.balance ;
        const tipo     = account.type ;

        if( (tipo === "asset") || (tipo === "expense") || (tipo === "liability") ){
          // Aumentan con el Débito, disminuyen con el Crédito
          nuevoSaldo = account.balance + entry.debit - entry.credit ;
        } else if( (tipo === "equity") || (tipo === "revenue") ){
          // Disminuyen con el Débito, aumentan con el Crédito
          nuevoSaldo = account.balance - entry.debit + entry.credit ;
        } else {
          throw new Error( `Tipo de cuenta contable no reconocido: ${tipo}.` ) ;
        }


        // Actualizar el saldo acumulado de la cuenta en base de datos usando el DAL
        await accountRepository.updateBalance( account.id , nuevoSaldo , tx ) ;

        // Preparar el movimiento individual del diario
        entriesToInsert.push( {
          transactionId:  insertedTx.id ,
          accountId:      entry.accountId ,
          debit:          entry.debit ,
          credit:         entry.credit ,
          currency:       entry.currency || "ARS" ,
        } ) ;
      }

      // C. Insertar asientos en lote
      await ledgerRepository.createEntries( entriesToInsert , tx ) ;

      // D. Registrar evento en la tabla Outbox para webhooks
      await tx.insert( outboxEvents ).values( {
        organizationId ,
        eventType: "TRANSACTION_CREATED" ,
        payload: {
          transactionId: insertedTx.id ,
          description ,
          totalAmount: totalDebit ,
        } ,
      } ) ;

      return( ok(insertedTx) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error crítico al registrar transacción contable." , { error: String(error) } ) ;
    return( fail(((error as Error).message) || "Error al procesar la transacción contable.") ) ;
  }
}

/**
 * Elimina una transacción contable y revierte los saldos de todas las cuentas involucradas.
 * Se ejecuta dentro de una transacción ACID de base de datos.
 * 
 * @param transactionId - ID de la transacción a eliminar.
 * @param organizationId - ID de la organización.
 * @returns Objeto Result indicando éxito o error.
 */
export async function deleteLedgerTransaction(
  transactionId: string ,
  organizationId: string
): Promise< Result<boolean , string> > {
  try {
    return( await db.transaction( async (tx) => {
      // 1. Obtener la transacción para verificar pertenencia
      const transaction = await ledgerRepository.findById( transactionId , organizationId , tx ) ;

      if( !transaction ){
        return( fail("La transacción contable no existe o no pertenece a la organización.") ) ;
      }

      // 2. Obtener los movimientos de la transacción
      const entries = await ledgerRepository.findEntriesByTransactionId( transactionId , tx ) ;

      // 3. Revertir saldos para cada cuenta involucrada
      for( const entry of entries ){
        const account = await accountRepository.findByIdForUpdate( entry.accountId , organizationId , tx ) ;

        if( !account ){
          throw new Error( `La cuenta con ID ${entry.accountId} asociada a la entrada no existe.` ) ;
        }

        let nuevoSaldo = account.balance ;
        const tipo     = account.type ;

        // Operación inversa a la de creación
        if( (tipo === "asset") || (tipo === "expense") || (tipo === "liability") ){
          nuevoSaldo = account.balance - entry.debit + entry.credit ;
        } else if( (tipo === "equity") || (tipo === "revenue") ){
          nuevoSaldo = account.balance + entry.debit - entry.credit ;
        } else {
          throw new Error( `Tipo de cuenta contable no reconocido: ${tipo}.` ) ;
        }


        // Actualizar el saldo acumulado en la base de datos
        await accountRepository.updateBalance( account.id , nuevoSaldo , tx ) ;
      }

      // 4. Eliminar la cabecera (por cascade FK, borra los entries correspondientes)
      await ledgerRepository.deleteTransaction( transactionId , tx ) ;

      // 5. Registrar evento TRANSACTION_DELETED en Outbox
      await tx.insert( outboxEvents ).values( {
        organizationId ,
        eventType: "TRANSACTION_DELETED" ,
        payload: {
          transactionId ,
          description: transaction.description ,
        } ,
      } ) ;

      return( ok(true) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error crítico al eliminar transacción contable." , { error: String(error) } ) ;
    return( fail(((error as Error).message) || "Error al eliminar la transacción contable.") ) ;
  }
}

/**
 * Actualiza los metadatos editables de una transacción contable sin alterar los asientos de partida doble.
 * 
 * @param params - Parámetros de actualización de metadatos.
 * @returns Objeto Result con la transacción actualizada o error descriptivo.
 */
export async function updateLedgerTransactionMetadata( params: {
  transactionId:   string ;
  organizationId:  string ;
  description?:    string ;
  categoryId?:     string | null ;
  merchantName?:   string | null ;
  merchantDomain?: string | null ;
  occurredAt?:     Date | string ;
} ): Promise< Result<LedgerTransaction , string> > {
  const { transactionId , organizationId , description , categoryId , merchantName , merchantDomain , occurredAt } = params ;

  try {
    return( await db.transaction( async ( tx ) => {
      const existing = await ledgerRepository.findById( transactionId , organizationId , tx ) ;
      if( !existing ) {
        return( fail("La transacción contable no existe o no pertenece a la organización.") ) ;
      }

      const updateData: {
        description?:    string ;
        categoryId?:     string | null ;
        merchantName?:   string | null ;
        merchantDomain?: string | null ;
        occurredAt?:     Date ;
      } = {} ;

      if( description !== undefined ) {
        if( description.trim().length < 3 ) {
          return( fail("La descripción debe tener al menos 3 caracteres.") ) ;
        }
        updateData.description = description.trim() ;
      }
      if( categoryId !== undefined ) {
        updateData.categoryId = categoryId ;
      }
      if( merchantName !== undefined ) {
        updateData.merchantName = merchantName ;
      }
      if( merchantDomain !== undefined ) {
        updateData.merchantDomain = merchantDomain ;
      }
      if( occurredAt !== undefined ) {
        updateData.occurredAt = new Date( occurredAt ) ;
      }

      const updated = await ledgerRepository.updateTransactionMetadata( transactionId , organizationId , updateData , tx ) ;
      if( !updated ) {
        return( fail("No se pudo actualizar la transacción contable.") ) ;
      }

      await tx.insert( outboxEvents ).values( {
        organizationId ,
        eventType: "TRANSACTION_METADATA_UPDATED" ,
        payload: {
          transactionId ,
          updatedFields: Object.keys( updateData ) ,
        } ,
      } ) ;

      return( ok(updated) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error al actualizar metadatos de la transacción contable." , { error: String(error) } ) ;
    return( fail(((error as Error).message) || "Error al actualizar la transacción contable.") ) ;
  }
}

/**
 * Reversa una transacción contable mediante la creación de un asiento espejo inverso en la misma transacción ACID.
 * No borra la transacción original, preservando la trazabilidad de auditoría contable.
 * 
 * @param transactionId - ID de la transacción a reversar.
 * @param organizationId - ID de la organización.
 * @param reason - Motivo opcional de la reversión.
 * @returns Objeto Result con la transacción compensatoria de reversión creada.
 */
export async function reverseLedgerTransaction(
  transactionId:  string ,
  organizationId: string ,
  reason?:        string
): Promise< Result<LedgerTransaction , string> > {
  try {
    return( await db.transaction( async ( tx ) => {
      // 1. Obtener transacción original y verificar pertenencia
      const original = await ledgerRepository.findById( transactionId , organizationId , tx ) ;
      if( !original ) {
        return( fail("La transacción contable no existe o no pertenece a la organización.") ) ;
      }

      // 2. Obtener los asientos contables originales
      const entries = await ledgerRepository.findEntriesByTransactionId( transactionId , tx ) ;
      if( entries.length === 0 ) {
        return( fail("La transacción contable no tiene asientos asociados para reversar.") ) ;
      }

      // 3. Revertir saldos en las cuentas (operación inversa)
      for( const entry of entries ){
        const account = await accountRepository.findByIdForUpdate( entry.accountId , organizationId , tx ) ;
        if( !account ){
          throw new Error( `La cuenta con ID ${entry.accountId} asociada a la entrada no existe.` ) ;
        }

        let nuevoSaldo = account.balance ;
        const tipo     = account.type ;

        if( (tipo === "asset") || (tipo === "expense") || (tipo === "liability") ){
          nuevoSaldo = account.balance - entry.debit + entry.credit ;
        } else if( (tipo === "equity") || (tipo === "revenue") ){
          nuevoSaldo = account.balance + entry.debit - entry.credit ;
        } else {
          throw new Error( `Tipo de cuenta contable no reconocido: ${tipo}.` ) ;
        }

        await accountRepository.updateBalance( account.id , nuevoSaldo , tx ) ;
      }

      // 4. Crear la transacción espejo de reversión
      const reversalDescription = reason
        ? `Reversión: ${original.description} (${reason})`
        : `Reversión: ${original.description}` ;

      const reversalTx = await ledgerRepository.createTransaction( {
        organizationId ,
        categoryId:     original.categoryId ,
        description:    reversalDescription.slice( 0 , 255 ) ,
        merchantName:   original.merchantName ,
        merchantDomain: original.merchantDomain ,
        occurredAt:     new Date() ,
      } , tx ) ;

      // 5. Invertir las entradas (débito pasa a crédito y crédito pasa a débito)
      const reversalEntries: InsertLedgerEntry[] = entries.map( ( e ) => ( {
        transactionId: reversalTx.id ,
        accountId:     e.accountId ,
        debit:         e.credit ,
        credit:        e.debit ,
        currency:      e.currency ,
      } ) ) ;

      await ledgerRepository.createEntries( reversalEntries , tx ) ;

      // 6. Registrar evento TRANSACTION_REVERSED en Outbox
      await tx.insert( outboxEvents ).values( {
        organizationId ,
        eventType: "TRANSACTION_REVERSED" ,
        payload: {
          originalTransactionId: original.id ,
          reversalTransactionId: reversalTx.id ,
          reason:                 reason || null ,
        } ,
      } ) ;

      return( ok(reversalTx) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error crítico al reversar transacción contable." , { error: String(error) } ) ;
    return( fail(((error as Error).message) || "Error al reversar la transacción contable.") ) ;
  }
}
