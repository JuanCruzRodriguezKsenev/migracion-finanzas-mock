/**
 * @file installmentPlansRepository.ts
 * Capa de acceso a datos (DAL) para Planes de Cuotas de Tarjeta (RFC 025).
 * Todas las operaciones imponen aislamiento multi-tenant por organizationId.
 */
// Librerías externas
import { eq , and , isNull , desc } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Cards
import { CardInstallmentPlan , InsertCardInstallmentPlan } from "../types" ;
import { cardInstallmentPlans }                            from "../schema.db" ;


export const installmentPlansRepository = {
  /**
   * Registra un nuevo plan de cuotas para una compra con tarjeta.
   *
   * @param data - Datos del plan a insertar.
   * @param tx - Instancia transaccional o cliente de BD.
   * @returns El plan de cuotas persistido.
   */
  async create( data: InsertCardInstallmentPlan , tx: DBOrTx = db ): Promise< CardInstallmentPlan > {
    const [ inserted ] = await tx
      .insert( cardInstallmentPlans )
      .values( data )
      .returning() ;

    return( inserted ) ;
  } ,

  /**
   * Obtiene un plan de cuotas por su ID, validando pertenencia a la organización.
   *
   * @param id - ID del plan.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia transaccional o cliente de BD.
   * @returns El plan encontrado o null.
   */
  async findById( id: string , organizationId: string , tx: DBOrTx = db ): Promise< CardInstallmentPlan | null > {
    const results = await tx
      .select()
      .from( cardInstallmentPlans )
      .where(
        and(
          eq( cardInstallmentPlans.id             , id             ) ,
          eq( cardInstallmentPlans.organizationId , organizationId ) ,
        )
      )
      .limit( 1 ) ;

    return( results[0] || null ) ;
  } ,

  /**
   * Obtiene un plan bloqueando la fila para actualización exclusiva (SELECT FOR UPDATE)
   * dentro de una transacción ACID, evitando condiciones de carrera concurrentes.
   *
   * @param id - ID del plan.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Conexión de transacción activa requerida para el bloqueo pesimista.
   * @returns El plan bloqueado o null.
   */
  async findByIdForUpdate( id: string , organizationId: string , tx: DBOrTx ): Promise< CardInstallmentPlan | null > {
    const results = await tx
      .select()
      .from( cardInstallmentPlans )
      .where(
        and(
          eq( cardInstallmentPlans.id             , id             ) ,
          eq( cardInstallmentPlans.organizationId , organizationId ) ,
        )
      )
      .for( "update" ) ;

    return( results[0] || null ) ;
  } ,

  /**
   * Retorna los planes activos (no archivados) asociados a una tarjeta específica.
   *
   * @param cardId - ID de la tarjeta de crédito.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia transaccional o cliente de BD.
   * @returns Lista de planes activos ordenados cronológicamente por fecha de compra descendente.
   */
  async findByCard( cardId: string , organizationId: string , tx: DBOrTx = db ): Promise< CardInstallmentPlan[] > {
    return( await tx
      .select()
      .from( cardInstallmentPlans )
      .where(
        and(
          eq( cardInstallmentPlans.cardId         , cardId         ) ,
          eq( cardInstallmentPlans.organizationId , organizationId ) ,
          isNull( cardInstallmentPlans.archivedAt ) ,
        )
      )
      .orderBy( desc( cardInstallmentPlans.purchasedAt ) ) ) ;
  } ,

  /**
   * Retorna todos los planes activos (no archivados) de la organización en un único viaje a la BD.
   * Permite resolver las cuotas futuras de todas las tarjetas de crédito sin cascadas N+1.
   *
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia transaccional o cliente de BD.
   * @returns Lista de planes activos de la organización.
   */
  async findActiveByOrganization( organizationId: string , tx: DBOrTx = db ): Promise< CardInstallmentPlan[] > {
    return( await tx
      .select()
      .from( cardInstallmentPlans )
      .where(
        and(
          eq( cardInstallmentPlans.organizationId , organizationId ) ,
          isNull( cardInstallmentPlans.archivedAt ) ,
        )
      )
      .orderBy( desc( cardInstallmentPlans.purchasedAt ) ) ) ;
  } ,

  /**
   * Actualiza los datos de un plan de cuotas existente.
   *
   * @param id - ID del plan.
   * @param organizationId - ID de la organización dueña.
   * @param data - Campos a modificar.
   * @param tx - Instancia transaccional o cliente de BD.
   * @returns El plan actualizado o null si no pertenece a la organización.
   */
  async update(
    id:             string ,
    organizationId: string ,
    data:           Partial< InsertCardInstallmentPlan > ,
    tx:             DBOrTx = db
  ): Promise< CardInstallmentPlan | null > {
    const [ updated ] = await tx
      .update( cardInstallmentPlans )
      .set( { ...data , updatedAt: new Date() } )
      .where(
        and(
          eq( cardInstallmentPlans.id             , id             ) ,
          eq( cardInstallmentPlans.organizationId , organizationId ) ,
        )
      )
      .returning() ;

    return( updated || null ) ;
  } ,

  /**
   * Marca un plan de cuotas como archivado (baja lógica). No elimina registros físicos.
   *
   * @param id - ID del plan.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia transaccional o cliente de BD.
   * @returns El plan archivado o null.
   */
  async archive( id: string , organizationId: string , tx: DBOrTx = db ): Promise< CardInstallmentPlan | null > {
    const [ updated ] = await tx
      .update( cardInstallmentPlans )
      .set( { archivedAt: new Date() , updatedAt: new Date() } )
      .where(
        and(
          eq( cardInstallmentPlans.id             , id             ) ,
          eq( cardInstallmentPlans.organizationId , organizationId ) ,
        )
      )
      .returning() ;

    return( updated || null ) ;
  } ,
} ;
