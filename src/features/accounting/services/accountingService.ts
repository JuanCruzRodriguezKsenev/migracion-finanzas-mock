/**
 * @file accountingService.ts
 * Servicio para la gestión contable de partida doble e integridad transaccional.
 */
// Shared
import { Result , ok , fail } from "@/shared/lib/result" ;
import { db , DBOrTx }        from "@/shared/db/client" ;
import { logger }             from "@/shared/lib/logger" ;

// Feature: Accounting
import { CreateTransactionParams , LedgerTransaction , InsertLedgerEntry } from "../types" ;
import { accountRepository } from "../repositories/accountRepository" ;
import { ledgerRepository }  from "../repositories/ledgerRepository" ;
import { outboxEvents }      from "../schema.db" ;


/** Moneda que se asume cuando un asiento no declara la suya y la cuenta tampoco pudo resolverse. */
export const MONEDA_POR_DEFECTO = "ARS" ;


/**
 * Crea una transacción contable de partida doble de manera transaccional.
 * Valida que los débitos y créditos sumen cero (balance cero) y pertenezcan al inquilino.
 * Registra un evento outbox para su propagación.
 * 
 * @param params - Parámetros de creación (cabecera y líneas del diario).
 * @param tx - Transacción externa opcional para composición ACID.
 * @returns Objeto Result con la transacción creada o error descriptivo.
 */
export async function createLedgerTransaction(
  params:     CreateTransactionParams ,
  externalTx?: DBOrTx
): Promise< Result<LedgerTransaction , string> > {
  const { organizationId , categoryId , description , merchantName , merchantDomain , occurredAt , entries } = params ;

  // 1. Validar que la transacción no esté vacía
  if( !entries || (entries.length < 2) ){
    return( fail("Una transacción de partida doble requiere al menos dos entradas contables.") ) ;
  }

  // La regla de Balance Cero se valida **por moneda** y **dentro** de la transacción, en el paso B:
  // la divisa de un asiento la define la cuenta a la que impacta, así que no se puede comprobar
  // antes de leer las cuentas. Validarlo acá afuera obligaría a asumir una moneda y a repetir la
  // regla en dos lugares, que es precisamente lo que este repositorio cobra caro.
  try {
    const execute = async ( tx: DBOrTx ) => {
      
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
      const balancePorMoneda = new Map< string , number >() ;

      // B. Resolver la cuenta de cada asiento, fijar su moneda y acumular el balance por divisa.
      //    Se bloquean todas las filas antes de tocar un solo saldo: si la transacción está
      //    desbalanceada, no se escribió nada todavía.
      const resueltos: { entry: typeof entries[number] ; account: NonNullable< Awaited< ReturnType< typeof accountRepository.findByIdForUpdate > > > ; moneda: string }[] = [] ;

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

        // La moneda del asiento la manda la cuenta, no quien llama.
        //
        // El saldo de una cuenta es un entero en su propia divisa: aceptar un asiento en otra
        // moneda le sumaría centavos de dólar a un saldo en pesos, y el saldo dejaría de significar
        // nada. Se rechaza acá, en el motor, y no en el formulario, para que ninguna vía de entrada
        // —acción, seed, script o importador futuro— pueda saltearlo.
        const monedaAsiento = ( entry.currency || account.currency ) ;

        if( monedaAsiento !== account.currency ){
          throw new Error( `La cuenta ${account.name} opera en ${account.currency} y el asiento vino en ${monedaAsiento}. Para mover valor entre monedas usá una transacción de cambio.` ) ;
        }

        balancePorMoneda.set(
          monedaAsiento ,
          (balancePorMoneda.get( monedaAsiento ) || 0) + entry.debit - entry.credit
        ) ;

        resueltos.push( {entry , account , moneda: monedaAsiento} ) ;
      }

      // C. Regla de Balance Cero, una moneda por vez.
      //
      //    Sumar todos los asientos sin mirar la divisa daba por balanceada una transacción con
      //    100.000 centavos de peso contra 100.000 de dólar. Cada moneda es un libro propio y
      //    tiene que cerrar por separado; es además lo que hace válido un cambio de divisas como
      //    una sola transacción: dos grupos de moneda, cada uno neteando a cero contra su cuenta
      //    de posición.
      for( const [ moneda , diferencia ] of balancePorMoneda ){
        if( diferencia !== 0 ){
          throw new Error( `La transacción contable está desbalanceada en ${moneda}: la diferencia entre débitos y créditos es de ${diferencia} centavos. Cada moneda debe cerrar en cero por separado.` ) ;
        }
      }

      // D. Aplicar los saldos, ya con la certeza de que la transacción cierra.
      for( const { entry , account , moneda: monedaAsiento } of resueltos ){
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
          currency:       monedaAsiento ,
        } ) ;
      }

      // E. Insertar asientos en lote
      await ledgerRepository.createEntries( entriesToInsert , tx ) ;

      // F. Registrar evento en la tabla Outbox para webhooks
      await tx.insert( outboxEvents ).values( {
        organizationId ,
        eventType: "TRANSACTION_CREATED" ,
        payload: {
          transactionId: insertedTx.id ,
          description ,
          // Un total por moneda: con divisas mezcladas, un único número no significaría nada.
          totalsPorMoneda: Object.fromEntries(
            entriesToInsert.reduce( ( acc , e ) => {
              const moneda = ( e.currency || MONEDA_POR_DEFECTO ) ;
              acc.set( moneda , (acc.get( moneda ) || 0) + (e.debit || 0) ) ;
              return( acc ) ;
            } , new Map< string , number >() )
          ) ,
        } ,
      } ) ;

      return( ok(insertedTx) ) ;
    } ;

    if( externalTx ) {
      return( await execute( externalTx ) ) ;
    }

    return( await db.transaction( execute ) ) ;
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
      // 1. Obtener transacción original con su fila bloqueada y verificar pertenencia.
      //    El bloqueo es lo que hace fiable la guarda del paso 2 ante dos reversiones simultáneas.
      const original = await ledgerRepository.findByIdForUpdate( transactionId , organizationId , tx ) ;
      if( !original ) {
        return( fail("La transacción contable no existe o no pertenece a la organización.") ) ;
      }

      // 2. Una transacción se reversa una sola vez. Sin esta guarda, reversar dos veces devolvía
      //    el importe dos veces a las cuentas: dinero creado de la nada.
      if( original.reversedAt ) {
        return( fail("Esta transacción ya fue reversada; no puede reversarse otra vez.") ) ;
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

      const momentoReversion = new Date() ;

      const reversalTx = await ledgerRepository.createTransaction( {
        organizationId ,
        categoryId:            original.categoryId ,
        description:           reversalDescription.slice( 0 , 255 ) ,
        merchantName:          original.merchantName ,
        merchantDomain:        original.merchantDomain ,
        occurredAt:            momentoReversion ,
        reversesTransactionId: original.id ,
      } , tx ) ;

      // Dejar el vínculo en los dos sentidos: la interfaz necesita poder marcar la original como
      // reversada sin recorrer el outbox, y la guarda del paso 2 se apoya en esta marca.
      await ledgerRepository.markAsReversed( original.id , momentoReversion , tx ) ;

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
