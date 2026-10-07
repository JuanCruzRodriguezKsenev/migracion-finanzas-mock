/**
 * @file habilitacionRepository.ts
 * Repositorio de habilitaciones: quién puede cargar movimientos a nombre de quién (Capa DAL).
 */
// Librerías externas
import { eq , and , or , isNull , asc } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Auth
import { holderAuthorizations , users } from "../schema.db" ;


/**
 * Usuario visible en una habilitación (la otra punta del par).
 */
export interface UsuarioHabilitacion {
  userId: string ;
  nombre: string | null ;
  email:  string ;
}

/**
 * Repositorio de Habilitaciones.
 * Toda consulta filtra por `organizationId`: una habilitación sólo vale dentro de su organización.
 */
export const habilitacionRepository = {
  /**
   * Otorga una habilitación vigente. Si ya existe una vigente para el par, no duplica.
   *
   * @param organizationId - Organización donde rige.
   * @param grantorUserId - Quien permite que carguen a su nombre (el titular).
   * @param granteeUserId - Quien queda habilitado para cargar.
   * @param tx - Instancia de transacción opcional.
   */
  async otorgar( organizationId: string , grantorUserId: string , granteeUserId: string , tx: DBOrTx = db ): Promise< void > {
    await tx
      .insert( holderAuthorizations )
      .values( { organizationId , grantorUserId , granteeUserId } )
      .onConflictDoNothing() ;
  } ,

  /**
   * Revoca la habilitación vigente del par (`revoked_at = now()`).
   *
   * @param organizationId - Organización donde rige.
   * @param grantorUserId - Titular que otorgó.
   * @param granteeUserId - Habilitado.
   * @param tx - Instancia de transacción opcional.
   * @returns `true` si había una vigente y se revocó; `false` si no había nada que revocar.
   */
  async revocar( organizationId: string , grantorUserId: string , granteeUserId: string , tx: DBOrTx = db ): Promise< boolean > {
    const filas = await tx
      .update( holderAuthorizations )
      .set( { revokedAt: new Date() } )
      .where(
        and(
          eq( holderAuthorizations.organizationId , organizationId ) ,
          eq( holderAuthorizations.grantorUserId  , grantorUserId ) ,
          eq( holderAuthorizations.granteeUserId  , granteeUserId ) ,
          isNull( holderAuthorizations.revokedAt )
        )
      )
      .returning( { id: holderAuthorizations.id } ) ;

    return( filas.length > 0 ) ;
  } ,

  /**
   * Indica si hay una habilitación vigente del par. Se lee de la base en cada llamada: no se cachea.
   *
   * @param organizationId - Organización donde rige.
   * @param grantorUserId - Titular que otorgó.
   * @param granteeUserId - Habilitado.
   * @param tx - Instancia de transacción opcional.
   * @returns `true` si el habilitado puede cargar a nombre del titular.
   */
  async existeVigente( organizationId: string , grantorUserId: string , granteeUserId: string , tx: DBOrTx = db ): Promise< boolean > {
    const [ fila ] = await tx
      .select( { id: holderAuthorizations.id } )
      .from( holderAuthorizations )
      .where(
        and(
          eq( holderAuthorizations.organizationId , organizationId ) ,
          eq( holderAuthorizations.grantorUserId  , grantorUserId ) ,
          eq( holderAuthorizations.granteeUserId  , granteeUserId ) ,
          isNull( holderAuthorizations.revokedAt )
        )
      )
      .limit( 1 ) ;

    return( !!fila ) ;
  } ,

  /**
   * Lista las habilitaciones vigentes que otorgó un usuario (a quiénes dejó cargar por él).
   *
   * @param organizationId - Organización donde rigen.
   * @param grantorUserId - Titular.
   * @param tx - Instancia de transacción opcional.
   * @returns Los habilitados, por antigüedad de la habilitación.
   */
  async listarOtorgadas( organizationId: string , grantorUserId: string , tx: DBOrTx = db ): Promise< UsuarioHabilitacion[] > {
    return(
      await tx
        .select( { userId: users.id , nombre: users.name , email: users.email } )
        .from( holderAuthorizations )
        .innerJoin( users , eq(holderAuthorizations.granteeUserId , users.id) )
        .where(
          and(
            eq( holderAuthorizations.organizationId , organizationId ) ,
            eq( holderAuthorizations.grantorUserId  , grantorUserId ) ,
            isNull( holderAuthorizations.revokedAt )
          )
        )
        .orderBy( asc( holderAuthorizations.createdAt ) )
    ) ;
  } ,

  /**
   * Lista las habilitaciones vigentes que recibió un usuario (a nombre de quiénes puede cargar).
   *
   * @param organizationId - Organización donde rigen.
   * @param granteeUserId - Habilitado.
   * @param tx - Instancia de transacción opcional.
   * @returns Los titulares, por antigüedad de la habilitación.
   */
  async listarRecibidas( organizationId: string , granteeUserId: string , tx: DBOrTx = db ): Promise< UsuarioHabilitacion[] > {
    return(
      await tx
        .select( { userId: users.id , nombre: users.name , email: users.email } )
        .from( holderAuthorizations )
        .innerJoin( users , eq(holderAuthorizations.grantorUserId , users.id) )
        .where(
          and(
            eq( holderAuthorizations.organizationId , organizationId ) ,
            eq( holderAuthorizations.granteeUserId  , granteeUserId ) ,
            isNull( holderAuthorizations.revokedAt )
          )
        )
        .orderBy( asc( holderAuthorizations.createdAt ) )
    ) ;
  } ,

  /**
   * Borra todas las habilitaciones (vigentes y revocadas) donde el usuario sea otorgante o habilitado,
   * sólo en esa organización. Se llama al quitar o al abandonar una membresía, en su misma transacción.
   *
   * @param organizationId - Organización de la que sale el usuario.
   * @param userId - Usuario que deja de ser miembro.
   * @param tx - Transacción activa.
   */
  async eliminarDeUsuario( organizationId: string , userId: string , tx: DBOrTx ): Promise< void > {
    await tx
      .delete( holderAuthorizations )
      .where(
        and(
          eq( holderAuthorizations.organizationId , organizationId ) ,
          or(
            eq( holderAuthorizations.grantorUserId , userId ) ,
            eq( holderAuthorizations.granteeUserId , userId )
          )
        )
      ) ;
  } ,
} ;
