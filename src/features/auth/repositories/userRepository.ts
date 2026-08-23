/**
 * @file userRepository.ts
 * Repositorio para la gestión de usuarios (Capa de Acceso a Datos - DAL).
 */
// Librerías externas
import { eq } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Auth
import { users } from "../schema.db" ;

export type User = typeof users.$inferSelect ;

/**
 * Repositorio de Usuarios.
 * Centraliza las consultas y mutaciones asociadas a la tabla de usuarios.
 */
export const userRepository = {
  /**
   * Busca un usuario por su dirección de correo electrónico.
   * 
   * @param email - Correo electrónico del usuario.
   * @param tx - Instancia de transacción opcional.
   * @returns El usuario encontrado o null si no existe.
   */
  async findByEmail( email: string , tx: DBOrTx = db ): Promise< User | null > {
    // Normalizar a minúsculas: los emails son case-insensitive en la práctica,
    // y la columna tiene unicidad case-sensitive en Postgres.
    const emailNormalizado = email.trim().toLowerCase() ;

    const [ usuario ] = await tx
      .select()
      .from( users )
      .where( eq(users.email , emailNormalizado) )
      .limit( 1 ) ;

    return( usuario || null ) ;
  }
} ;
