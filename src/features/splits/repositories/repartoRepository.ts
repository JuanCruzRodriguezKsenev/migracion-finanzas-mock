/**
 * @file repartoRepository.ts
 * Repositorio de las deudas de un gasto repartido (Capa DAL). El acreedor no se guarda: es el titular del movimiento.
 */
// Librerías externas
import { eq , and } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Splits
import { expenseSplits } from "../schema.db" ;


/** Fila de deuda a insertar. */
export type NuevaDeuda = typeof expenseSplits.$inferInsert ;

/** Deuda guardada. */
export type DeudaGuardada = typeof expenseSplits.$inferSelect ;

/**
 * Repositorio del reparto de gastos.
 */
export const repartoRepository = {
  /**
   * Inserta las deudas de un gasto. Sin filas no toca la base.
   *
   * @param filas - Deudas a crear.
   * @param tx - Transacción activa.
   */
  async insertar( filas: NuevaDeuda[] , tx: DBOrTx ): Promise< void > {
    if( filas.length === 0 ) {
      return ;
    }

    await tx.insert( expenseSplits ).values( filas ) ;
  } ,

  /**
   * Las deudas de una transacción.
   *
   * @param organizationId - Organización de la transacción.
   * @param transactionId - Transacción.
   * @param tx - Instancia de transacción opcional.
   * @returns Deudas guardadas.
   */
  async deUnaTransaccion( organizationId: string , transactionId: string , tx: DBOrTx = db ): Promise< DeudaGuardada[] > {
    return(
      await tx
        .select()
        .from( expenseSplits )
        .where(
          and(
            eq( expenseSplits.organizationId , organizationId ) ,
            eq( expenseSplits.transactionId  , transactionId )
          )
        )
    ) ;
  } ,
} ;
