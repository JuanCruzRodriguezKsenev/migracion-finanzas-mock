/**
 * @file saldosRepository.ts
 * Repositorio de los saldos entre miembros: lectura de deudas y pagos, alta de pagos y de solicitudes de pago
 * (Capa DAL). Toda consulta filtra por `organizationId`.
 */
// Librerías externas
import { eq , and , or , isNull , sql } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Accounting
import { ledgerTransactions } from "@/features/accounting/schema.db" ;

// Feature: Splits
import { expenseSplits , memberPayments , paymentRequests } from "../schema.db" ;
import type { DeudaParaSaldo , PagoParaSaldo }               from "../utils/saldos" ;


/** Pago a insertar: `fromUserId` paga y `toUserId` recibe y registra. */
export type NuevoPago = typeof memberPayments.$inferInsert ;

/** Solicitud de pago a insertar. */
export type NuevaSolicitud = typeof paymentRequests.$inferInsert ;

/**
 * Repositorio de saldos, pagos y solicitudes de pago.
 */
export const saldosRepository = {
  /**
   * Serializa los pagos y solicitudes de un par de miembros dentro de la transacción (candado de aviso
   * de Postgres, liberado al terminar). El par se ordena: `(a, b)` y `(b, a)` toman el mismo candado.
   *
   * @param organizationId - Organización.
   * @param a - Un miembro del par.
   * @param b - El otro miembro.
   * @param tx - Transacción activa.
   */
  async bloquearPar( organizationId: string , a: string , b: string , tx: DBOrTx ): Promise< void > {
    await tx.execute( sql`select pg_advisory_xact_lock( hashtext( ${"saldo:" + organizationId + ":" + [ a , b ].sort().join( ":" )} ) )` ) ;
  } ,

  /**
   * Deudas en las que interviene el usuario, sin las de transacciones reversadas. Incluye las filas donde el otro
   * extremo es nulo (ex miembro).
   *
   * @param organizationId - Organización (se filtra en ambas tablas).
   * @param usuarioId - Usuario que mira.
   * @param tx - Instancia de transacción opcional.
   * @returns Deudas con acreedor (titular del movimiento), deudor, monto y divisa.
   */
  async deudasDe( organizationId: string , usuarioId: string , tx: DBOrTx = db ): Promise< DeudaParaSaldo[] > {
    const filas = await tx
      .select( {
        acreedorId: ledgerTransactions.holderUserId ,
        deudorId:   expenseSplits.debtorUserId ,
        monto:      expenseSplits.amountInCents ,
        divisa:     expenseSplits.currency ,
      } )
      .from( expenseSplits )
      .innerJoin( ledgerTransactions , eq( expenseSplits.transactionId , ledgerTransactions.id ) )
      .where(
        and(
          eq( expenseSplits.organizationId      , organizationId ) ,
          eq( ledgerTransactions.organizationId , organizationId ) ,
          isNull( ledgerTransactions.reversedAt ) ,
          // Incluye las filas donde el otro extremo es nulo (S-AE): basta con que el usuario sea acreedor o deudor
          or( eq( ledgerTransactions.holderUserId , usuarioId ) , eq( expenseSplits.debtorUserId , usuarioId ) )
        )
      ) ;

    return( filas ) ;
  } ,

  /**
   * Pagos en los que interviene el usuario, incluidos los de extremo nulo (ex miembro).
   *
   * @param organizationId - Organización.
   * @param usuarioId - Usuario que mira.
   * @param tx - Instancia de transacción opcional.
   * @returns Pagos con quien paga, quien recibe, monto y divisa.
   */
  async pagosDe( organizationId: string , usuarioId: string , tx: DBOrTx = db ): Promise< PagoParaSaldo[] > {
    return(
      await tx
        .select( {
          deId:   memberPayments.fromUserId ,
          aId:    memberPayments.toUserId ,
          monto:  memberPayments.amountInCents ,
          divisa: memberPayments.currency ,
        } )
        .from( memberPayments )
        .where(
          and(
            eq( memberPayments.organizationId , organizationId ) ,
            or( eq( memberPayments.fromUserId , usuarioId ) , eq( memberPayments.toUserId , usuarioId ) )
          )
        )
    ) ;
  } ,

  /**
   * Inserta un pago.
   *
   * @param fila - Pago a crear.
   * @param tx - Transacción activa.
   */
  async insertarPago( fila: NuevoPago , tx: DBOrTx ): Promise< void > {
    await tx.insert( memberPayments ).values( fila ) ;
  } ,

  /**
   * Registra una solicitud de pago. La restricción única `(org, de, a, divisa, día)` decide si ya existía.
   *
   * @param fila - Solicitud a crear.
   * @param tx - Transacción activa.
   * @returns `true` si insertó; `false` si ya había una solicitud ese día.
   */
  async registrarSolicitud( fila: NuevaSolicitud , tx: DBOrTx ): Promise< boolean > {
    const insertadas = await tx.insert( paymentRequests ).values( fila ).onConflictDoNothing().returning( { id: paymentRequests.id } ) ;

    return( insertadas.length > 0 ) ;
  } ,

  /**
   * ¿La organización tiene alguna deuda o pago? Decide si la pestaña Saldos existe aunque el modo sea «sin reparto» (S-X).
   *
   * @param organizationId - Organización.
   * @param tx - Instancia de transacción opcional.
   * @returns `true` si hay al menos una fila en `expense_splits` o `member_payments`.
   */
  async hayActividad( organizationId: string , tx: DBOrTx = db ): Promise< boolean > {
    const [ deuda ] = await tx.select( { id: expenseSplits.id } ).from( expenseSplits ).where( eq( expenseSplits.organizationId , organizationId ) ).limit( 1 ) ;

    if( deuda ) {
      return( true ) ;
    }

    const [ pago ] = await tx.select( { id: memberPayments.id } ).from( memberPayments ).where( eq( memberPayments.organizationId , organizationId ) ).limit( 1 ) ;

    return( !!pago ) ;
  } ,
} ;
