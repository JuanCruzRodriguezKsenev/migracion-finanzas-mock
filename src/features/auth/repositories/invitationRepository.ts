/**
 * @file invitationRepository.ts
 * Repositorio para la gestión de invitaciones a organizaciones (Capa DAL).
 */
// Librerías externas
import { eq , and , gt , lte , desc } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Auth
import { normalizarEmail } from "./userRepository" ;
import { invitations }     from "../schema.db" ;


export type Invitation = typeof invitations.$inferSelect ;
export type NewInvitation = typeof invitations.$inferInsert ;

export interface CrearInvitacionParams {
  organizationId: string ;
  email:          string ;
  role:           string ;
  invitedBy?:     string | null ;
  expiresAt:      Date ;
}

/**
 * Repositorio de Invitaciones.
 * Centraliza las consultas y actualizaciones sobre la tabla de invitaciones.
 */
export const invitationRepository = {
  /**
   * Busca todas las invitaciones pendientes y aún no vencidas para un correo electrónico dado.
   *
   * @param email - Correo del invitado.
   * @param tx - Instancia de transacción opcional.
   * @returns Lista de invitaciones vigentes ordenadas por fecha de creación descendente.
   */
  async findVigentesPorEmail( email: string , tx: DBOrTx = db ): Promise< Invitation[] > {
    const emailNormalizado = normalizarEmail( email ) ;
    const ahora            = new Date() ;

    return(
      await tx
        .select()
        .from( invitations )
        .where(
          and(
            eq( invitations.email  , emailNormalizado ) ,
            eq( invitations.status , "pending" ) ,
            gt( invitations.expiresAt , ahora )
          )
        )
        .orderBy( desc( invitations.createdAt ) )
    ) ;
  } ,

  /**
   * Marca una invitación como aceptada registrando la fecha y hora actual.
   *
   * @param id - Identificador único de la invitación.
   * @param tx - Instancia de transacción opcional.
   */
  async marcarAceptada( id: string , tx: DBOrTx = db ): Promise< void > {
    await tx
      .update( invitations )
      .set( {
        status:     "accepted" ,
        acceptedAt: new Date()
      } )
      .where( eq( invitations.id , id ) ) ;
  } ,

  /**
   * Crea una nueva invitación a una organización.
   *
   * @param params - Parámetros de la invitación a generar.
   * @param tx - Instancia de transacción opcional.
   * @returns El registro de invitación insertado.
   */
  async crearInvitacion(
    params: CrearInvitacionParams ,
    tx:     DBOrTx = db
  ): Promise< Invitation > {
    const emailNormalizado = normalizarEmail( params.email ) ;

    const [ invitacion ] = await tx
      .insert( invitations )
      .values( {
        organizationId: params.organizationId ,
        email:          emailNormalizado ,
        role:           params.role ,
        invitedBy:      params.invitedBy ?? null ,
        expiresAt:      params.expiresAt ,
        status:         "pending"
      } )
      .returning() ;

    return( invitacion ) ;
  } ,

  /**
   * Marca como revocadas las invitaciones pendientes que hayan vencido para un par (organización, email).
   *
   * @param organizationId - Identificador de la organización.
   * @param email - Correo electrónico de la invitación.
   * @param tx - Instancia de transacción opcional.
   */
  async revocarVencidasPorEmailYOrganizacion(
    organizationId: string ,
    email:          string ,
    tx:             DBOrTx = db
  ): Promise< void > {
    const emailNormalizado = normalizarEmail( email ) ;
    const ahora            = new Date() ;

    await tx
      .update( invitations )
      .set( { status: "revoked" } )
      .where(
        and(
          eq( invitations.organizationId , organizationId ) ,
          eq( invitations.email          , emailNormalizado ) ,
          eq( invitations.status         , "pending" ) ,
          lte( invitations.expiresAt     , ahora )
        )
      ) ;
  }
} ;
