/**
 * @file subscriptionRepository.ts
 * Repositorio de Suscripciones Recurrentes (Capa de Acceso a Datos - DAL).
 * Todas las operaciones se acotan a la organización dueña (multi-tenant).
 */
// Librerías externas
import { eq , and , desc } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Subscriptions
import { Subscription , InsertSubscription } from "../types" ;
import { subscriptions }                     from "../schema.db" ;


/**
 * Repositorio de Suscripciones.
 * Centraliza el acceso y las operaciones sobre la tabla de suscripciones.
 */
export const subscriptionRepository = {
  /**
   * Obtiene todas las suscripciones de una organización ordenadas por monto descendente.
   *
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia de transacción opcional.
   * @returns Listado de suscripciones de la organización.
   */
  async findAll( organizationId: string , tx: DBOrTx = db ): Promise< Subscription[] > {
    return( await tx
      .select()
      .from( subscriptions )
      .where( eq(subscriptions.organizationId , organizationId) )
      .orderBy( desc(subscriptions.amount) ) ) ;
  } ,

  /**
   * Obtiene una suscripción específica validando su pertenencia a la organización.
   *
   * @param id - ID único de la suscripción.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia de transacción opcional.
   * @returns La suscripción encontrada o null si no existe.
   */
  async findById( id: string , organizationId: string , tx: DBOrTx = db ): Promise< Subscription | null > {
    const results = await tx
      .select()
      .from( subscriptions )
      .where(
        and(
          eq(subscriptions.id             , id) ,
          eq(subscriptions.organizationId , organizationId) ,
        )
      )
      .limit( 1 ) ;

    return( results[0] || null ) ;
  } ,

  /**
   * Registra una nueva suscripción.
   *
   * @param data - Datos de la nueva suscripción (monto en centavos).
   * @param tx - Instancia de transacción opcional.
   * @returns La suscripción creada.
   */
  async create( data: InsertSubscription , tx: DBOrTx = db ): Promise< Subscription > {
    const [ inserted ] = await tx
      .insert( subscriptions )
      .values( data )
      .returning() ;

    return( inserted ) ;
  } ,

  /**
   * Actualiza una suscripción existente de la organización.
   *
   * @param id - ID único de la suscripción.
   * @param organizationId - ID de la organización dueña.
   * @param data - Campos a actualizar.
   * @param tx - Instancia de transacción opcional.
   * @returns La suscripción actualizada o null si no pertenece a la organización.
   */
  async update(
    id:             string ,
    organizationId: string ,
    data:           Partial< InsertSubscription > ,
    tx:             DBOrTx = db
  ): Promise< Subscription | null > {
    const [ updated ] = await tx
      .update( subscriptions )
      .set( { ...data , updatedAt: new Date() } )
      .where(
        and(
          eq(subscriptions.id             , id) ,
          eq(subscriptions.organizationId , organizationId) ,
        )
      )
      .returning() ;

    return( updated || null ) ;
  } ,

  /**
   * Elimina una suscripción de la organización.
   *
   * @param id - ID único de la suscripción.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia de transacción opcional.
   * @returns true si se eliminó una fila, false si no existía o no pertenecía a la organización.
   */
  async remove( id: string , organizationId: string , tx: DBOrTx = db ): Promise< boolean > {
    const deleted = await tx
      .delete( subscriptions )
      .where(
        and(
          eq(subscriptions.id             , id) ,
          eq(subscriptions.organizationId , organizationId) ,
        )
      )
      .returning( {id: subscriptions.id} ) ;

    return( deleted.length > 0 ) ;
  }
} ;
