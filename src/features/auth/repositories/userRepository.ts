/**
 * @file userRepository.ts
 * Repositorio para la gestión de usuarios (Capa de Acceso a Datos - DAL).
 */
// Librerías externas
import { eq } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Auth
import { users , organizations } from "../schema.db" ;

export type User = typeof users.$inferSelect ;

/**
 * Identidad vigente de un usuario, resuelta contra la base en un único viaje.
 * La usa el callback `jwt` para revalidar la sesión sin confiar en los claims del token.
 */
export interface IdentidadVigente {
  id:             string ;
  organizationId: string ;
  role:           string ;
}

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
  } ,

  /**
   * Resuelve la identidad vigente de un usuario verificando, en la misma consulta, que su
   * organización siga existiendo.
   *
   * El `INNER JOIN` es la clave: comprobar sólo la organización dejaría viva la sesión de un
   * usuario borrado, y comprobar sólo el usuario no detectaría una organización eliminada.
   * Devolver el `role` desde la base permite además refrescarlo en el token, en vez de arrastrar
   * indefinidamente el que se emitió en el login.
   *
   * @param id - Identificador del usuario tal como viaja en el JWT.
   * @param tx - Instancia de transacción opcional.
   * @returns La identidad vigente, o null si el usuario o su organización ya no existen.
   */
  async findIdentidadVigente( id: string , tx: DBOrTx = db ): Promise< IdentidadVigente | null > {
    const [ fila ] = await tx
      .select( {
        id:             users.id ,
        organizationId: users.organizationId ,
        role:           users.role
      } )
      .from( users )
      .innerJoin( organizations , eq(users.organizationId , organizations.id) )
      .where( eq(users.id , id) )
      .limit( 1 ) ;

    return( fila || null ) ;
  } ,

  /**
   * Reemplaza el hash de contraseña de un usuario junto con el salt y los parámetros de costo
   * usados para derivarlo. La invoca el rehash transparente tras un login exitoso cuyo hash
   * quedó con parámetros más débiles que los vigentes.
   *
   * @param id - Identificador del usuario.
   * @param credenciales - Nuevo hash, salt y parámetros serializados.
   * @param tx - Instancia de transacción opcional.
   */
  async updatePasswordHash(
    id:            string ,
    credenciales:  {hash: string ; salt: string ; params: string} ,
    tx:            DBOrTx = db
  ): Promise< void > {
    await tx
      .update( users )
      .set( {
        passwordHash: credenciales.hash ,
        salt:         credenciales.salt ,
        hashParams:   credenciales.params ,
        updatedAt:    new Date()
      } )
      .where( eq(users.id , id) ) ;
  }
} ;
