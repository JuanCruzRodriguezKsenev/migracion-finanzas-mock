/**
 * @file membershipRepository.ts
 * Repositorio para la gestión de membresías de usuarios en organizaciones (Capa DAL).
 */
// Librerías externas
import { eq , and , desc } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Auth
import { memberships , organizations } from "../schema.db" ;


export type Membership = typeof memberships.$inferSelect ;

/**
 * Membresía proyectada junto con los datos esenciales de la organización vinculada.
 */
export interface MembresiaConOrganizacion {
  organizationId:   string ;
  organizationName: string ;
  role:             string ;
  createdAt:        Date ;
}

/**
 * Repositorio de Membresías.
 * Centraliza las consultas de pertenencia y roles de usuarios dentro de organizaciones.
 */
export const membershipRepository = {
  /**
   * Obtiene todas las membresías de un usuario junto con el nombre de cada organización y su rol.
   *
   * @param userId - Identificador del usuario.
   * @param tx - Instancia de transacción opcional.
   * @returns Lista de membresías con metadatos de la organización.
   */
  async findByUser( userId: string , tx: DBOrTx = db ): Promise< MembresiaConOrganizacion[] > {
    return(
      await tx
        .select( {
          organizationId:   memberships.organizationId ,
          organizationName: organizations.name ,
          role:             memberships.role ,
          createdAt:        memberships.createdAt ,
        } )
        .from( memberships )
        .innerJoin( organizations , eq(memberships.organizationId , organizations.id) )
        .where( eq(memberships.userId , userId) )
        .orderBy( desc( memberships.createdAt ) )
    ) ;
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
} ;
