/**
 * @file goalsRepository.ts
 * Capa de acceso a datos (DAL) para Metas (RFC 011 §2 y §4).
 * Todas las operaciones imponen aislamiento multi-tenant por organizationId.
 */
// Librerías externas
import { eq , and , ne , inArray } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Goals
import { goals }                                         from "../schema.db" ;
import type { Goal , InsertGoal , GoalStatus }           from "../types" ;


export const goalsRepository = {
  /**
   * Crea una meta.
   *
   * @param data - Datos de la meta.
   * @param tx - Instancia transaccional opcional.
   * @returns La meta creada.
   */
  async create( data: InsertGoal , tx: DBOrTx = db ): Promise< Goal > {
    const [ inserted ] = await tx
      .insert( goals )
      .values( data )
      .returning() ;
    return( inserted ) ;
  } ,

  /**
   * Obtiene una meta de una organización.
   *
   * @param id - ID de la meta.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia transaccional opcional.
   * @returns La meta o null si no existe.
   */
  async findById( id: string , organizationId: string , tx: DBOrTx = db ): Promise< Goal | null > {
    const results = await tx
      .select()
      .from( goals )
      .where(
        and(
          eq( goals.id             , id ) ,
          eq( goals.organizationId , organizationId )
        )
      )
      .limit( 1 ) ;
    return( results[ 0 ] || null ) ;
  } ,

  /**
   * Obtiene una meta bloqueando la fila (SELECT FOR UPDATE). Primer bloqueo del orden meta → cuenta.
   *
   * @param id - ID de la meta.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia de transacción (requerida para el bloqueo).
   * @returns La meta o null si no existe.
   */
  async findByIdForUpdate( id: string , organizationId: string , tx: DBOrTx ): Promise< Goal | null > {
    const results = await tx
      .select()
      .from( goals )
      .where(
        and(
          eq( goals.id             , id ) ,
          eq( goals.organizationId , organizationId )
        )
      )
      .for( "update" ) ;
    return( results[ 0 ] || null ) ;
  } ,

  /**
   * Actualiza los datos editables de una meta (nunca la divisa). Siempre refresca `updatedAt`.
   *
   * @param id - ID de la meta.
   * @param organizationId - ID de la organización dueña.
   * @param data - Campos a actualizar.
   * @param tx - Instancia transaccional opcional.
   * @returns La meta actualizada o null si no existe.
   */
  async update(
    id:             string ,
    organizationId: string ,
    data:           Partial< Pick< InsertGoal , "name" | "targetAmount" | "targetDate" | "priority" > > ,
    tx:             DBOrTx = db
  ): Promise< Goal | null > {
    const [ updated ] = await tx
      .update( goals )
      .set( { ...data , updatedAt: new Date() } )
      .where(
        and(
          eq( goals.id             , id ) ,
          eq( goals.organizationId , organizationId )
        )
      )
      .returning() ;
    return( updated || null ) ;
  } ,

  /**
   * Cambia el estado de una meta y su fecha de completado.
   *
   * @param id - ID de la meta.
   * @param organizationId - ID de la organización dueña.
   * @param status - Estado nuevo.
   * @param completedAt - Fecha de completado (null si deja de estar completada).
   * @param tx - Instancia transaccional opcional.
   */
  async setStatus(
    id:             string ,
    organizationId: string ,
    status:         GoalStatus ,
    completedAt:    Date | null ,
    tx:             DBOrTx = db
  ): Promise< void > {
    await tx
      .update( goals )
      .set( { status , completedAt , updatedAt: new Date() } )
      .where(
        and(
          eq( goals.id             , id ) ,
          eq( goals.organizationId , organizationId )
        )
      ) ;
  } ,

  /**
   * Metas visibles de una organización en una divisa (excluye las abandonadas).
   *
   * @param organizationId - ID de la organización.
   * @param currency - Divisa de las metas.
   * @param tx - Instancia transaccional opcional.
   * @returns Lista de metas sin ordenar.
   */
  async findVisibleByOrganization( organizationId: string , currency: string , tx: DBOrTx = db ): Promise< Goal[] > {
    return( await tx
      .select()
      .from( goals )
      .where(
        and(
          eq( goals.organizationId , organizationId ) ,
          eq( goals.currency       , currency ) ,
          ne( goals.status         , "abandoned" )
        )
      )
    ) ;
  } ,

  /**
   * Divisas en las que la organización tiene metas visibles.
   *
   * @param organizationId - ID de la organización.
   * @param tx - Instancia transaccional opcional.
   * @returns Códigos de divisa distintos.
   */
  async currenciesByOrganization( organizationId: string , tx: DBOrTx = db ): Promise< string[] > {
    const rows = await tx
      .selectDistinct( { currency: goals.currency } )
      .from( goals )
      .where(
        and(
          eq( goals.organizationId , organizationId ) ,
          ne( goals.status         , "abandoned" )
        )
      ) ;
    return( rows.map( ( r ) => { return( r.currency ) ; } ) ) ;
  } ,

  /**
   * Metas por ids (de la organización).
   *
   * @param ids - IDs de metas.
   * @param organizationId - ID de la organización.
   * @param tx - Instancia transaccional opcional.
   */
  async findManyByIds( ids: string[] , organizationId: string , tx: DBOrTx = db ): Promise< Goal[] > {
    if( ids.length === 0 ) {
      return( [] ) ;
    }
    return( await tx
      .select()
      .from( goals )
      .where(
        and(
          inArray( goals.id , ids ) ,
          eq( goals.organizationId , organizationId )
        )
      )
    ) ;
  }
} ;
