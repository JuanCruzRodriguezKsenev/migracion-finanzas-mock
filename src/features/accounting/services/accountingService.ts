/**
 * @file accountingService.ts
 * Servicio para la gestión contable de partida doble e integridad transaccional.
 */
// Shared
import { Result , ok , fail } from "@/shared/lib/result" ;
import { db , DBOrTx }        from "@/shared/db/client" ;
import { logger }             from "@/shared/lib/logger" ;

// Feature: Transactions
import { calcularResumenTransaccion } from "@/features/transactions/utils/derivarTipo" ;

// Feature: Notifications
import { notificar , destinatariosDeCarga , destinatariosDeReverso } from "@/features/notifications/services/notificationService" ;

// Feature: Splits
import { resolverReparto , MENSAJE_DESACTUALIZADO , type RepartoResuelto } from "@/features/splits/services/acuerdoService" ;
import { repartoRepository }                                                from "@/features/splits/repositories/repartoRepository" ;

// Feature: Accounting
import { CreateTransactionParams , LedgerTransaction , InsertLedgerEntry } from "../types" ;
import { accountRepository } from "../repositories/accountRepository" ;
import { ledgerRepository }  from "../repositories/ledgerRepository" ;
import { outboxEvents }      from "../schema.db" ;


/** Moneda que se asume cuando un asiento no declara la suya y la cuenta tampoco pudo resolverse. */
export const MONEDA_POR_DEFECTO = "ARS" ;


/**
 * Resuelve el reparto de una carga manual: lee las cuentas de los asientos para derivar tipo, monto y divisa
 * y delega en `resolverReparto`. Si alguna cuenta no existe devuelve `null`: el paso de saldos lanza el
 * error descriptivo y la carga se aborta igual.
 */
async function resolverRepartoDeLaCarga(
  datos: {
    organizationId:  string ;
    createdByUserId: string ;
    holderUserId?:   string | null ;
    occurredAt?:     Date | string | null ;
    entries:         CreateTransactionParams["entries"] ;
  } ,
  tx: DBOrTx
): Promise< RepartoResuelto | null > {
  const { organizationId , createdByUserId , holderUserId , occurredAt , entries } = datos ;
  const idsDeCuentas = [ ...new Set( entries.map( ( e ) => e.accountId ) ) ] ;
  const cuentas      = new Map< string , NonNullable< Awaited< ReturnType< typeof accountRepository.findById > > > >() ;

  for( const id of idsDeCuentas ) {
    const cuenta = await accountRepository.findById( id , organizationId , tx ) ;

    if( !cuenta ) {
      return( null ) ;
    }

    cuentas.set( id , cuenta ) ;
  }

  const resumen = calcularResumenTransaccion( entries.map( ( e ) => ( { accountId: e.accountId , debit: e.debit , credit: e.credit , currency: e.currency } ) ) , cuentas ) ;

  return(
    await resolverReparto( {
      orgId:           organizationId ,
      autorId:         createdByUserId ,
      titularId:       holderUserId ,
      tipo:            resumen.type ,
      montoEnCentavos: ( resumen.amountInCents ?? 0 ) ,
      currency:        ( resumen.currency ?? MONEDA_POR_DEFECTO ) ,
      occurredAt ,
      cuentas:         idsDeCuentas ,
      esGastoManual:   true ,
    } , tx )
  ) ;
}

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
  const { organizationId , categoryId , description , merchantName , merchantDomain , occurredAt , createdByUserId , holderUserId , aplicarReparto , titularPorDefecto , entries } = params ;

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

      // A0. Reparto del acuerdo (sólo la carga manual). Se resuelve **antes** de insertar la cabecera: con el
      //     acuerdo desactualizado no se guarda nada (S-S), y si aplica el titular pasa a ser el autor (RN-7).
      let reparto: RepartoResuelto | null = null ;
      let titularFinal                    = holderUserId ;

      if( aplicarReparto && createdByUserId ) {
        reparto = await resolverRepartoDeLaCarga( { organizationId , createdByUserId , holderUserId , occurredAt , entries } , tx ) ;

        if( reparto?.desactualizado ) {
          throw new Error( MENSAJE_DESACTUALIZADO ) ;
        }

        if( reparto?.aplica && !titularFinal ) {
          titularFinal = ( titularPorDefecto ?? createdByUserId ) ;
        }
      }

      // A. Insertar cabecera de la transacción usando el DAL
      const insertedTx = await ledgerRepository.createTransaction( {
        organizationId ,
        categoryId ,
        description ,
        merchantName ,
        merchantDomain ,
        occurredAt: occurredAt ? new Date( occurredAt ) : undefined ,
        createdByUserId ,
        holderUserId: titularFinal ,
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

      // E2. Avisar al titular si otra persona cargó a su nombre (RN-9a, RN-10). Los movimientos
      //     generados por el sistema no traen titular, así que no emiten. Corre en la misma
      //     transacción: si el aviso falla, falla la carga entera.
      const destinatarios = destinatariosDeCarga( { autorId: createdByUserId , titularId: holderUserId } ) ;

      if( destinatarios.length > 0 ) {
        const resumen = calcularResumenTransaccion(
          resueltos.map( ( r ) => ( { accountId: r.entry.accountId , debit: r.entry.debit , credit: r.entry.credit , currency: r.moneda } ) ) ,
          new Map( resueltos.map( ( r ) => [ r.account.id , r.account ] ) )
        ) ;

        await notificar( {
          organizationId ,
          tipo:          "charged_to_holder" ,
          actorId:       createdByUserId ,
          transactionId: insertedTx.id ,
          monto:         resumen.amountInCents ?? null ,
          divisa:        resumen.currency ?? null ,
          destinatarios ,
        } , tx ) ;
      }

      // E3. Deudas del reparto (RN-18, RN-19) y aviso a cada deudor distinto del autor (RN-9b, RN-10). Misma
      //     transacción que el asiento: o se guarda todo o nada (NFR-3). El aviso lleva la parte del deudor.
      if( reparto?.aplica && (reparto.deudas.length > 0) ) {
        const resumen = calcularResumenTransaccion(
          resueltos.map( ( r ) => ( { accountId: r.entry.accountId , debit: r.entry.debit , credit: r.entry.credit , currency: r.moneda } ) ) ,
          new Map( resueltos.map( ( r ) => [ r.account.id , r.account ] ) )
        ) ;
        const divisaGasto = ( resumen.currency ?? MONEDA_POR_DEFECTO ) ;

        await repartoRepository.insertar(
          reparto.deudas.map( ( d ) => ( {
            organizationId ,
            transactionId: insertedTx.id ,
            debtorUserId:  d.userId ,
            amountInCents: d.montoEnCentavos ,
            currency:      divisaGasto ,
          } ) ) ,
          tx
        ) ;

        for( const deuda of reparto.deudas ) {
          if( deuda.userId === createdByUserId ) {
            continue ;
          }

          await notificar( {
            organizationId ,
            tipo:          "debt_created" ,
            actorId:       createdByUserId ,
            transactionId: insertedTx.id ,
            monto:         deuda.montoEnCentavos ,
            divisa:        divisaGasto ,
            destinatarios: [ deuda.userId ] ,
          } , tx ) ;
        }
      }

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
 * @param actorUserId - Quién reversa (autor del contra-asiento). Nulo si no hay sesión.
 * @returns Objeto Result con la transacción compensatoria de reversión creada.
 */
export async function reverseLedgerTransaction(
  transactionId:  string ,
  organizationId: string ,
  reason?:        string ,
  actorUserId?:   string | null
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
      const cuentasPorId = new Map< string , NonNullable< Awaited< ReturnType< typeof accountRepository.findByIdForUpdate > > > >() ;

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
        cuentasPorId.set( account.id , account ) ;
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
        // RN-4: el contra-asiento hereda el titular de la original; el autor es quien reversa.
        holderUserId:          original.holderUserId ,
        createdByUserId:       actorUserId ?? null ,
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

      // 7. Avisar al titular y al autor de la original, no al actor (RN-9f, S-K). Mismo `tx`: atómico.
      const destinatarios = destinatariosDeReverso( {
        actorId:         actorUserId ,
        titularId:       original.holderUserId ,
        autorOriginalId: original.createdByUserId ,
      } ) ;

      if( destinatarios.length > 0 ) {
        const resumen = calcularResumenTransaccion(
          entries.map( ( e ) => ( { accountId: e.accountId , debit: e.debit , credit: e.credit , currency: e.currency } ) ) ,
          cuentasPorId
        ) ;

        await notificar( {
          organizationId ,
          tipo:          "transaction_reversed" ,
          actorId:       actorUserId ?? null ,
          transactionId: original.id ,
          monto:         resumen.amountInCents ?? null ,
          divisa:        resumen.currency ?? null ,
          destinatarios ,
        } , tx ) ;
      }

      return( ok(reversalTx) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error crítico al reversar transacción contable." , { error: String(error) } ) ;
    return( fail(((error as Error).message) || "Error al reversar la transacción contable.") ) ;
  }
}
