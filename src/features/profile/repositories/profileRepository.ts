/**
 * @file profileRepository.ts
 * Repositorio para la gestión de perfiles de usuario (Capa de Acceso a Datos - DAL).
 */
// Librerías externas
import { eq } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Profile
import { ProfileData } from "../types" ;
import { profiles }    from "../schema.db" ;

/**
 * Repositorio de Perfiles.
 * Encapsula el acceso a datos y modificaciones sobre la tabla de perfiles.
 */
export const profileRepository = {
  /**
   * Busca un perfil de usuario por el ID del usuario.
   * 
   * @param userId - ID único del usuario.
   * @param tx - Instancia de transacción opcional.
   * @returns El perfil encontrado o null si no existe.
   */
  async findByUserId( userId: string , tx: DBOrTx = db ): Promise< ProfileData | null > {
    const [ perfil ] = await tx
      .select()
      .from( profiles )
      .where( eq(profiles.userId , userId) )
      .limit( 1 ) ;
    
    return( perfil || null ) ;
  } ,

  /**
   * Actualiza el perfil de un usuario.
   * 
   * @param userId - ID único del usuario a actualizar.
   * @param data - Datos parciales a actualizar.
   * @param tx - Instancia de transacción opcional.
   * @returns El perfil actualizado.
   */
  async update( userId: string , data: Partial< ProfileData > , tx: DBOrTx = db ): Promise< ProfileData > {
    const [ actualizado ] = await tx
      .update( profiles )
      .set( data )
      .where( eq(profiles.userId , userId) )
      .returning() ;
    
    return( actualizado ) ;
  }
} ;
