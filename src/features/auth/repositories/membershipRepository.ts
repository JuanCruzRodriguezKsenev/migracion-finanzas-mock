/**
 * @file membershipRepository.ts
 * Repositorio para la gestión de membresías de usuarios en organizaciones (Capa DAL).
 */
// Librerías externas
import { eq , and , asc , desc , count , sql } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Auth
import { nombreVisible }                      from "../utils/nombreVisible" ;
import { memberships , organizations , users } from "../schema.db" ;
import { normalizarEmail }                      from "./userRepository" ;


export type Membership = typeof memberships.$inferSelect ;

/**
 * Membresía proyectada junto con los datos esenciales de la organización vinculada.
 */
export interface MembresiaConOrganizacion {
  organizationId:   string ;
  organizationName: string ;
  role:             string ;
  createdAt:        Date ;
  /** `true` si la organización es el espacio Personal de alguien (el propio o uno al que se fue invitado). */
  esPersonal:       boolean ;
  /** Nombre visible del dueño del espacio Personal; `null` si la organización no es un espacio Personal. */
  duenoNombre:      string | null ;
}

/**
 * Miembro de una organización proyectado junto con los datos visibles del usuario.
 */
export interface MiembroDeOrganizacion {
  userId: string ;
  nombre: string | null ;
  email:  string ;
  rol:    string ;
}

/**
 * Repositorio de Membresías.
 * Centraliza las consultas de pertenencia y roles de usuarios dentro de organizaciones.
 */
export const membershipRepository = {
  /**
   * Obtiene todas las membresías de un usuario junto con el nombre de cada organización y su rol.
   * Los espacios Personal van primero (RN-15); el resto, de la membresía más reciente a la más antigua.
   *
   * @param userId - Identificador del usuario.
   * @param tx - Instancia de transacción opcional.
   * @returns Lista de membresías con metadatos de la organización.
   */
  async findByUser( userId: string , tx: DBOrTx = db ): Promise< MembresiaConOrganizacion[] > {
    const filas = await tx
      .select( {
        organizationId:   memberships.organizationId ,
        organizationName: organizations.name ,
        role:             memberships.role ,
        createdAt:        memberships.createdAt ,
        esPersonal:       sql< boolean >`(${organizations.personalOwnerUserId} IS NOT NULL)` ,
        duenoNombre:      users.name ,
        duenoEmail:       users.email ,
      } )
      .from( memberships )
      .innerJoin( organizations , eq(memberships.organizationId , organizations.id) )
      .leftJoin( users , eq(users.id , organizations.personalOwnerUserId) )
      .where( eq(memberships.userId , userId) )
      .orderBy(
        sql`CASE WHEN ${organizations.personalOwnerUserId} IS NULL THEN 1 ELSE 0 END` ,
        desc( memberships.createdAt )
      ) ;

    return( filas.map( ( { duenoNombre , duenoEmail , ...membresia } ) => ( {
      ...membresia ,
      duenoNombre: ( duenoEmail ? nombreVisible( duenoNombre , duenoEmail ) : null ) ,
    } ) ) ) ;
  } ,

  /**
   * Busca la membresía específica de un usuario en una organización.
   *
   * @param userId - Identificador del usuario.
   * @param organizationId - Identificador de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns La membresía encontrada o null si no pertenece a la organización.
   */
  async findMembership(
    userId:         string ,
    organizationId: string ,
    tx:             DBOrTx = db
  ): Promise< Membership | null > {
    const [ fila ] = await tx
      .select()
      .from( memberships )
      .where(
        and(
          eq( memberships.userId         , userId ) ,
          eq( memberships.organizationId , organizationId )
        )
      )
      .limit( 1 ) ;

    return( fila || null ) ;
  } ,
  /**
   * Lista los miembros de una organización con el nombre y el correo de cada uno.
   *
   * @param organizationId - Identificador de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns Miembros ordenados por antigüedad de la membresía.
   */
  async findByOrganization( organizationId: string , tx: DBOrTx = db ): Promise< MiembroDeOrganizacion[] > {
    return(
      await tx
        .select( {
          userId: users.id ,
          nombre: users.name ,
          email:  users.email ,
          rol:    memberships.role ,
        } )
        .from( memberships )
        .innerJoin( users , eq(memberships.userId , users.id) )
        .where( eq(memberships.organizationId , organizationId) )
        .orderBy( asc( memberships.createdAt ) )
    ) ;
  } ,

  /**
   * Indica si un correo ya pertenece a la organización como miembro.
   *
   * @param organizationId - Identificador de la organización.
   * @param email - Correo a consultar (se normaliza).
   * @param tx - Instancia de transacción opcional.
   * @returns `true` si existe un usuario con ese correo y membresía en la organización.
   */
  async existeMiembroPorEmail( organizationId: string , email: string , tx: DBOrTx = db ): Promise< boolean > {
    const [ fila ] = await tx
      .select( { userId: memberships.userId } )
      .from( memberships )
      .innerJoin( users , eq(memberships.userId , users.id) )
      .where(
        and(
          eq( memberships.organizationId , organizationId ) ,
          eq( users.email                , normalizarEmail( email ) )
        )
      )
      .limit( 1 ) ;

    return( !!fila ) ;
  } ,

  /**
   * Bloquea (`SELECT … FOR UPDATE`) las filas de los `owner` de la organización y devuelve sus ids.
   * Serializa a quienes quieran quitar owners a la vez: el segundo espera al primero y ve su resultado (RN-12).
   *
   * @param organizationId - Identificador de la organización.
   * @param tx - Transacción activa: el bloqueo vive hasta que termina.
   * @returns Ids de usuario de los `owner` actuales.
   */
  async bloquearOwners( organizationId: string , tx: DBOrTx ): Promise< string[] > {
    const filas = await tx
      .select( { userId: memberships.userId } )
      .from( memberships )
      .where(
        and(
          eq( memberships.organizationId , organizationId ) ,
          eq( memberships.role           , "owner" )
        )
      )
      .for( "update" ) ;

    return( filas.map( ( f ) => f.userId ) ) ;
  } ,

  /**
   * Crea una membresía.
   *
   * @param userId - Identificador del usuario.
   * @param organizationId - Identificador de la organización.
   * @param role - Rol inicial (`owner` | `member` | `viewer`).
   * @param tx - Instancia de transacción opcional.
   */
  async add( userId: string , organizationId: string , role: string , tx: DBOrTx = db ): Promise< void > {
    await tx.insert( memberships ).values( { userId , organizationId , role } ) ;
  } ,

  /**
   * Elimina la membresía de un usuario en una organización.
   *
   * @param userId - Identificador del usuario.
   * @param organizationId - Identificador de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns `true` si había una membresía y se borró.
   */
  async remove( userId: string , organizationId: string , tx: DBOrTx = db ): Promise< boolean > {
    const borradas = await tx
      .delete( memberships )
      .where(
        and(
          eq( memberships.userId         , userId ) ,
          eq( memberships.organizationId , organizationId )
        )
      )
      .returning( { userId: memberships.userId } ) ;

    return( borradas.length > 0 ) ;
  } ,

  /**
   * Cambia el rol de un miembro dentro de una organización.
   *
   * @param userId - Identificador del usuario.
   * @param organizationId - Identificador de la organización.
   * @param rol - Rol nuevo (`owner` | `member` | `viewer`).
   * @param tx - Instancia de transacción opcional.
   * @returns Cantidad de filas afectadas (0 si no es miembro).
   */
  async cambiarRol(
    userId:         string ,
    organizationId: string ,
    rol:            string ,
    tx:             DBOrTx = db
  ): Promise< number > {
    const filas = await tx
      .update( memberships )
      .set( { role: rol } )
      .where(
        and(
          eq( memberships.userId         , userId ) ,
          eq( memberships.organizationId , organizationId )
        )
      )
      .returning( { userId: memberships.userId } ) ;

    return( filas.length ) ;
  } ,

  /**
   * Cuenta las organizaciones a las que pertenece un usuario (RN-30: nadie se queda sin organización).
   *
   * @param userId - Identificador del usuario.
   * @param tx - Instancia de transacción opcional.
   * @returns Cantidad de membresías del usuario.
   */
  async contarPorUsuario( userId: string , tx: DBOrTx = db ): Promise< number > {
    const [ fila ] = await tx
      .select( { total: count() } )
      .from( memberships )
      .where( eq( memberships.userId , userId ) ) ;

    return( Number( fila?.total ?? 0 ) ) ;
  } ,

  /**
   * Cuenta los `owner` de una organización (lectura sin bloqueo, para la interfaz).
   *
   * @param organizationId - Identificador de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns Cantidad de `owner`.
   */
  async contarOwners( organizationId: string , tx: DBOrTx = db ): Promise< number > {
    const [ fila ] = await tx
      .select( { total: count() } )
      .from( memberships )
      .where(
        and(
          eq( memberships.organizationId , organizationId ) ,
          eq( memberships.role           , "owner" )
        )
      ) ;

    return( Number( fila?.total ?? 0 ) ) ;
  } ,
} ;
