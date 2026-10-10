/**
 * @file notificationRepository.ts
 * Repositorio de avisos (Capa DAL). Las consultas leen los avisos de la persona sobre las
 * organizaciones donde conserva membresía activa.
 */
// Librerías externas
import { alias }                                             from "drizzle-orm/pg-core" ;
import { eq , and , desc , isNull , isNotNull , lt , count } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Auth
import { organizations , memberships , users } from "@/features/auth/schema.db" ;
import { nombreVisible }                       from "@/features/auth/utils/nombreVisible" ;

// Feature: Accounting
import { ledgerTransactions } from "@/features/accounting/schema.db" ;

// Feature: Notifications
import type { AvisoVista , OrganizacionDeAvisos } from "../types" ;
import { notifications }                          from "../schema.db" ;


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
   * Los avisos más recientes de un destinatario en las organizaciones de las que sigue siendo
   * miembro, con la descripción del movimiento, nombres resueltos y datos de la organización.
   *
   * @param userId - Destinatario.
   * @param limite - Cantidad máxima de avisos.
   * @param filtroOrganizacionId - Filtro opcional por organización.
   * @param tx - Instancia de transacción opcional.
   * @returns Avisos de más nuevo a más viejo.
   */
  async listarRecientes( userId: string , limite: number , filtroOrganizacionId?: string , tx: DBOrTx = db ): Promise< AvisoVista[] > {
    const actor   = alias( users , "actor" ) ;
    const titular = alias( users , "titular" ) ;

    const condiciones = [
      eq( notifications.recipientUserId , userId ) ,
    ] ;

    if( filtroOrganizacionId ) {
      condiciones.push( eq( notifications.organizationId , filtroOrganizacionId ) ) ;
    }

    const filas = await tx
      .select( {
        aviso:                       notifications ,
        descripcion:                 ledgerTransactions.description ,
        actorName:                   actor.name ,
        actorEmail:                  actor.email ,
        titularName:                 titular.name ,
        titularEmail:                titular.email ,
        organizationName:            organizations.name ,
        organizationPersonalOwnerId: organizations.personalOwnerUserId ,
      } )
      .from( notifications )
      .innerJoin(
        memberships ,
        and(
          eq( memberships.organizationId  , notifications.organizationId ) ,
          eq( memberships.userId          , userId )
        )
      )
      .leftJoin( organizations      , eq( notifications.organizationId    , organizations.id ) )
      .leftJoin( ledgerTransactions , eq( notifications.transactionId     , ledgerTransactions.id ) )
      .leftJoin( actor              , eq( notifications.actorUserId       , actor.id ) )
      .leftJoin( titular            , eq( ledgerTransactions.holderUserId , titular.id ) )
      .where( and( ...condiciones ) )
      .orderBy( desc( notifications.createdAt ) , desc( notifications.id ) )
      .limit( limite ) ;

    return(
      filas.map( ( f ) => ( {
        id:                     f.aviso.id ,
        tipo:                   f.aviso.type ,
        actor:                  f.actorEmail   ? nombreVisible( f.actorName   , f.actorEmail   ) : null ,
        titular:                f.titularEmail ? nombreVisible( f.titularName , f.titularEmail ) : null ,
        descripcion:            ( f.descripcion ?? "" ) ,
        montoEnCentavos:        f.aviso.amountInCents ,
        divisa:                 f.aviso.currency ,
        leida:                  f.aviso.readAt !== null ,
        creadaEn:               f.aviso.createdAt.toISOString() ,
        organizacionId:         f.aviso.organizationId ,
        organizacionNombre:     ( f.organizationName ?? "" ) ,
        organizacionEsPersonal: f.organizationPersonalOwnerId !== null ,
      } ) )
    ) ;
  } ,

  /**
   * Cuenta todas las no leídas de un destinatario en las organizaciones donde sigue siendo miembro.
   * Sin filtro por organización (RN-34).
   *
   * @param userId - Destinatario.
   * @param tx - Instancia de transacción opcional.
   */
  async contarNoLeidas( userId: string , tx: DBOrTx = db ): Promise< number > {
    const [ fila ] = await tx
      .select( { total: count() } )
      .from( notifications )
      .innerJoin(
        memberships ,
        and(
          eq( memberships.organizationId  , notifications.organizationId ) ,
          eq( memberships.userId          , userId )
        )
      )
      .where(
        and(
          eq( notifications.recipientUserId , userId ) ,
          isNull( notifications.readAt )
        )
      ) ;

    return( Number( fila?.total ?? 0 ) ) ;
  } ,

  /**
   * Marca como leídas todas las no leídas del destinatario en cualquier organización (RN-35).
   *
   * @param userId - Destinatario.
   * @param tx - Instancia de transacción opcional.
   */
  async marcarLeidas( userId: string , tx: DBOrTx = db ): Promise< void > {
    await tx
      .update( notifications )
      .set( { readAt: new Date() } )
      .where(
        and(
          eq( notifications.recipientUserId , userId ) ,
          isNull( notifications.readAt )
        )
      ) ;
  } ,

  /**
   * Borra las leídas del destinatario anteriores a `antesDe`, de cualquier organización (RN-10).
   *
   * @param userId - Destinatario.
   * @param antesDe - Corte: se borran las leídas antes de este momento.
   * @param tx - Instancia de transacción opcional.
   */
  async purgarLeidas( userId: string , antesDe: Date , tx: DBOrTx = db ): Promise< void > {
    await tx
      .delete( notifications )
      .where(
        and(
          eq( notifications.recipientUserId , userId ) ,
          isNotNull( notifications.readAt ) ,
          lt( notifications.readAt , antesDe )
        )
      ) ;
  } ,

  /**
   * Obtiene las organizaciones de las que el usuario es miembro hoy, con el Personal primero
   * y luego ordenadas alfabéticamente por nombre.
   *
   * @param userId - Usuario.
   * @param tx - Instancia de transacción opcional.
   */
  async organizacionesDe( userId: string , tx: DBOrTx = db ): Promise< OrganizacionDeAvisos[] > {
    const filas = await tx
      .select( {
        id:                  organizations.id ,
        nombre:              organizations.name ,
        personalOwnerUserId: organizations.personalOwnerUserId ,
      } )
      .from( memberships )
      .innerJoin( organizations , eq( memberships.organizationId , organizations.id ) )
      .where( eq( memberships.userId , userId ) ) ;

    const resultado: OrganizacionDeAvisos[] = filas.map( ( f ) => ( {
      id:         f.id ,
      nombre:     f.nombre ,
      esPersonal: f.personalOwnerUserId !== null ,
    } ) ) ;

    resultado.sort( ( a , b ) => {
      if( a.esPersonal && !b.esPersonal ) { return( -1 ) ; }
      if( !a.esPersonal && b.esPersonal ) { return( 1 ) ; }
      return( a.nombre.localeCompare( b.nombre ) ) ;
    } ) ;

    return( resultado ) ;
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
