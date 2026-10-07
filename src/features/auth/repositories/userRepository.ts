/**
 * @file userRepository.ts
 * Repositorio para la gestión de usuarios (Capa de Acceso a Datos - DAL).
 */
// Librerías externas
import { eq , and , desc , sql } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Auth
import { users , organizations , memberships } from "../schema.db" ;

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
 * Normaliza una dirección de correo electrónico a minúsculas y sin espacios laterales.
 *
 * @param email - Correo a normalizar.
 * @returns El correo limpio en minúsculas.
 */
export function normalizarEmail( email: string ): string {
  return( email.trim().toLowerCase() ) ;
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
    const emailNormalizado = normalizarEmail( email ) ;

    const [ usuario ] = await tx
      .select()
      .from( users )
      .where( eq(users.email , emailNormalizado) )
      .limit( 1 ) ;

    return( usuario || null ) ;
  } ,

  /**
   * Busca un usuario por su identificador único de cuenta en Google (sub claim).
   *
   * @param googleSub - Identificador único de Google.
   * @param tx - Instancia de transacción opcional.
   * @returns El usuario encontrado o null si no existe.
   */
  async findByGoogleSub( googleSub: string , tx: DBOrTx = db ): Promise< User | null > {
    const [ usuario ] = await tx
      .select()
      .from( users )
      .where( eq(users.googleSub , googleSub) )
      .limit( 1 ) ;

    return( usuario || null ) ;
  } ,

  /**
   * Da de alta un nuevo usuario autenticado exclusivamente vía Google (sin credenciales de contraseña).
   *
   * @param datos - Parámetros de identidad recibidos de Google.
   * @param tx - Instancia de transacción opcional.
   * @returns El registro de usuario recién creado.
   */
  async createFromGoogle(
    datos: {
      googleSub: string ;
      email:     string ;
      name?:     string | null ;
      image?:    string | null ;
    } ,
    tx: DBOrTx = db
  ): Promise< User > {
    const emailNormalizado = normalizarEmail( datos.email ) ;

    const [ usuario ] = await tx
      .insert( users )
      .values( {
        email:     emailNormalizado ,
        googleSub: datos.googleSub ,
        name:      datos.name ?? null ,
        image:     datos.image ?? null ,
      } )
      .returning() ;

    return( usuario ) ;
  } ,

  /**
   * Vincula una cuenta de Google a un usuario existente mediante su `googleSub`.
   *
   * @param id - Identificador único del usuario local.
   * @param googleSub - Identificador único del usuario en Google.
   * @param tx - Instancia de transacción opcional.
   */
  async linkGoogle(
    id:        string ,
    googleSub: string ,
    tx:        DBOrTx = db
  ): Promise< void > {
    await tx
      .update( users )
      .set( {
        googleSub ,
        updatedAt: new Date() ,
      } )
      .where( eq(users.id , id) ) ;
  } ,

  /**
   * Actualiza los datos de perfil (nombre e imagen) sincronizados desde Google (RN-8).
   *
   * @param id - Identificador único del usuario local.
   * @param datos - Nombre e imagen actualizados desde el proveedor.
   * @param tx - Instancia de transacción opcional.
   */
  async updateProfileFromGoogle(
    id:    string ,
    datos: {name?: string | null ; image?: string | null} ,
    tx:    DBOrTx = db
  ): Promise< void > {
    const setValues: {name?: string | null ; image?: string | null ; updatedAt: Date} = {
      updatedAt: new Date() ,
    } ;

    if( datos.name !== undefined ){
      setValues.name = datos.name ;
    }

    if( datos.image !== undefined ){
      setValues.image = datos.image ;
    }

    await tx
      .update( users )
      .set( setValues )
      .where( eq(users.id , id) ) ;
  } ,

  /**
   * Resuelve la identidad vigente de un usuario en una sola consulta.
   *
   * Une `memberships` con `organizations` (el INNER JOIN comprueba que la organización
   * siga existiendo) y con `users`, y elige una fila según este orden de preferencia:
   * 1. La membresía de la organización `preferida` si existe;
   * 2. La de `users.lastOrganizationId`;
   * 3. La más reciente (`memberships.createdAt` descendente).
   *
   * @param id - Identificador del usuario tal como viaja en el JWT.
   * @param preferida - Identificador opcional de organización preferida a priorizar.
   * @param tx - Instancia de transacción opcional.
   * @returns La identidad vigente con el rol de esa membresía, o null si el usuario no existe o no tiene ninguna.
   */
  async findIdentidadVigente(
    id:         string ,
    preferida?: string ,
    tx:         DBOrTx = db
  ): Promise< IdentidadVigente | null > {
    const orden = [] ;

    if( preferida ) {
      orden.push(
        sql`CASE WHEN ${memberships.organizationId} = ${preferida} THEN 0 ELSE 1 END`
      ) ;
    }

    orden.push(
      sql`CASE WHEN ${memberships.organizationId} = ${users.lastOrganizationId} THEN 0 ELSE 1 END`
    ) ;

    orden.push( desc( memberships.createdAt ) ) ;

    const [ fila ] = await tx
      .select( {
        id:             users.id ,
        organizationId: memberships.organizationId ,
        role:           memberships.role ,
      } )
      .from( users )
      .innerJoin( memberships   , eq(users.id                 , memberships.userId) )
      .innerJoin( organizations , eq(memberships.organizationId , organizations.id) )
      .where( eq(users.id , id) )
      .orderBy( ...orden )
      .limit( 1 ) ;

    return( fila || null ) ;
  } ,

  /**
   * Registra la última organización activa utilizada por el usuario.
   * Se invoca únicamente cuando el cambio o acceso a dicha organización fue verificado.
   *
   * @param userId - Identificador del usuario.
   * @param organizationId - Identificador de la organización activa verificada.
   * @param tx - Instancia de transacción opcional.
   */
  async registrarUltimaOrganizacion(
    userId:         string ,
    organizationId: string ,
    tx:             DBOrTx = db
  ): Promise< void > {
    await tx
      .update( users )
      .set( {
        lastOrganizationId: organizationId ,
        updatedAt:          new Date() ,
      } )
      .where( eq(users.id , userId) ) ;
  } ,

  /**
   * Limpia `last_organization_id` de un usuario sólo si apunta a la organización indicada.
   * Se usa al quitarle la membresía: el `ON DELETE SET NULL` cubre borrar la organización, no la membresía.
   *
   * @param userId - Identificador del usuario.
   * @param organizationId - Organización de la que se lo quitó.
   * @param tx - Instancia de transacción opcional.
   */
  async limpiarUltimaOrganizacion(
    userId:         string ,
    organizationId: string ,
    tx:             DBOrTx = db
  ): Promise< void > {
    await tx
      .update( users )
      .set( { lastOrganizationId: null , updatedAt: new Date() } )
      .where(
        and(
          eq( users.id                 , userId ) ,
          eq( users.lastOrganizationId , organizationId )
        )
      ) ;
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
