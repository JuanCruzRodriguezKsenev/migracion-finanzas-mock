/**
 * @file notificationRepository.ts
 * Repositorio de avisos (Capa DAL). Toda consulta filtra por `organizationId` y por destinatario.
 */
// Librerías externas
import { eq , and , desc , isNull , isNotNull , lt , count } from "drizzle-orm" ;
import { alias }                                             from "drizzle-orm/pg-core" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Auth
import { nombreVisible } from "@/features/auth/utils/nombreVisible" ;
import { users }         from "@/features/auth/schema.db" ;

// Feature: Accounting
import { ledgerTransactions } from "@/features/accounting/schema.db" ;

// Feature: Notifications
import { notifications } from "../schema.db" ;
import type { AvisoVista } from "../types" ;


/** Fila a insertar: una por destinatario. */
export type NuevoAviso = typeof notifications.$inferInsert ;

/**
 * Repositorio de Avisos.
 */
export const notificationRepository = {
  /**
   * Inserta avisos (una fila por destinatario). Sin filas no toca la base.
   *
   * @param filas - Avisos a crear.
   * @param tx - Instancia de transacción opcional.
   */
  async insertar( filas: NuevoAviso[] , tx: DBOrTx = db ): Promise< void > {
    if( filas.length === 0 ) {
      return ;
    }

    await tx.insert( notifications ).values( filas ) ;
  } ,

  /**
   * Los avisos más recientes de un destinatario en una organización, con la descripción del
   * movimiento y los nombres del actor y del titular ya resueltos.
   *
   * @param organizationId - Organización activa.
   * @param userId - Destinatario.
   * @param limite - Cantidad máxima de avisos.
   * @param tx - Instancia de transacción opcional.
   * @returns Avisos de más nuevo a más viejo.
   */
  async listarRecientes( organizationId: string , userId: string , limite: number , tx: DBOrTx = db ): Promise< AvisoVista[] > {
    const actor   = alias( users , "actor" ) ;
    const titular = alias( users , "titular" ) ;

    const filas = await tx
      .select( {
        aviso:        notifications ,
        descripcion:  ledgerTransactions.description ,
        actorName:    actor.name ,
        actorEmail:   actor.email ,
        titularName:  titular.name ,
        titularEmail: titular.email ,
      } )
      .from( notifications )
      .leftJoin( ledgerTransactions , eq( notifications.transactionId , ledgerTransactions.id ) )
      .leftJoin( actor   , eq( notifications.actorUserId , actor.id ) )
      .leftJoin( titular , eq( ledgerTransactions.holderUserId , titular.id ) )
      .where(
        and(
          eq( notifications.organizationId  , organizationId ) ,
          eq( notifications.recipientUserId , userId )
        )
      )
      .orderBy( desc( notifications.createdAt ) , desc( notifications.id ) )
      .limit( limite ) ;

    return(
      filas.map( ( f ) => ( {
        id:              f.aviso.id ,
        tipo:            f.aviso.type ,
        actor:           f.actorEmail   ? nombreVisible( f.actorName   , f.actorEmail   ) : null ,
        titular:         f.titularEmail ? nombreVisible( f.titularName , f.titularEmail ) : null ,
        descripcion:     ( f.descripcion ?? "" ) ,
        montoEnCentavos: f.aviso.amountInCents ,
        divisa:          f.aviso.currency ,
        leida:           f.aviso.readAt !== null ,
        creadaEn:        f.aviso.createdAt.toISOString() ,
      } ) )
    ) ;
  } ,

  /**
   * Cuenta **todas** las no leídas de un destinatario en una organización.
   *
   * @param organizationId - Organización activa.
   * @param userId - Destinatario.
   * @param tx - Instancia de transacción opcional.
   */
  async contarNoLeidas( organizationId: string , userId: string , tx: DBOrTx = db ): Promise< number > {
    const [ fila ] = await tx
      .select( { total: count() } )
      .from( notifications )
      .where(
        and(
          eq( notifications.organizationId  , organizationId ) ,
          eq( notifications.recipientUserId , userId ) ,
          isNull( notifications.readAt )
        )
      ) ;

    return( Number( fila?.total ?? 0 ) ) ;
  } ,

  /**
   * Marca como leídas todas las no leídas del destinatario en esa organización.
   *
   * @param organizationId - Organización activa.
   * @param userId - Destinatario.
   * @param tx - Instancia de transacción opcional.
   */
  async marcarLeidas( organizationId: string , userId: string , tx: DBOrTx = db ): Promise< void > {
    await tx
      .update( notifications )
      .set( { readAt: new Date() } )
      .where(
        and(
          eq( notifications.organizationId  , organizationId ) ,
          eq( notifications.recipientUserId , userId ) ,
          isNull( notifications.readAt )
        )
      ) ;
  } ,

  /**
   * Borra las leídas de ese destinatario y esa organización cuya lectura es anterior a `antesDe` (RN-10).
   *
   * @param organizationId - Organización activa.
   * @param userId - Destinatario.
   * @param antesDe - Corte: se borran las leídas antes de este momento.
   * @param tx - Instancia de transacción opcional.
   */
  async purgarLeidas( organizationId: string , userId: string , antesDe: Date , tx: DBOrTx = db ): Promise< void > {
    await tx
      .delete( notifications )
      .where(
        and(
          eq( notifications.organizationId  , organizationId ) ,
          eq( notifications.recipientUserId , userId ) ,
          isNotNull( notifications.readAt ) ,
          lt( notifications.readAt , antesDe )
        )
      ) ;
  } ,

  /**
   * Borra los avisos que recibe una persona en una organización. Se llama al quitar o al abandonar
   * una membresía, en su misma transacción.
   *
   * @param organizationId - Organización de la que sale el usuario.
   * @param userId - Usuario que deja de ser miembro.
   * @param tx - Transacción activa.
   */
  async eliminarDeUsuario( organizationId: string , userId: string , tx: DBOrTx ): Promise< void > {
    await tx
      .delete( notifications )
      .where(
        and(
          eq( notifications.organizationId  , organizationId ) ,
          eq( notifications.recipientUserId , userId )
        )
      ) ;
  } ,
} ;
