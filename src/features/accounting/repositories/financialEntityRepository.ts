/**
 * @file financialEntityRepository.ts
 * Repositorio para la gestión de Entidades Financieras (Capa de Acceso a Datos - DAL).
 */
// Librerías externas
import { eq , and } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Accounting
import { FinancialEntity , InsertFinancialEntity } from "../types" ;
import { financialEntities } from "../schema.db" ;


/**
 * Repositorio de Entidades Financieras.
 * Centraliza las consultas y escrituras sobre la tabla de entidades financieras.
 */
export const financialEntityRepository = {
  /**
   * Crea una nueva entidad financiera.
   * 
   * @param data - Datos de la nueva entidad.
   * @param tx - Instancia de transacción opcional.
   * @returns La entidad financiera creada.
   */
  async create( data: InsertFinancialEntity , tx: DBOrTx = db ): Promise< FinancialEntity > {
    const [ inserted ] = await tx
      .insert( financialEntities )
      .values( data )
      .returning() ;
    return( inserted ) ;
  } ,

  /**
   * Obtiene todas las entidades financieras asociadas a una organización.
   * 
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns Lista de entidades financieras ordenadas por nombre.
   */
  async findAll( organizationId: string , tx: DBOrTx = db ): Promise< FinancialEntity[] > {
    return( await tx
      .select()
      .from( financialEntities )
      .where( eq(financialEntities.organizationId , organizationId) )
      .orderBy( financialEntities.name ) ) ;
  } ,

  /**
   * Obtiene una entidad financiera específica por ID.
   * 
   * @param id - ID único de la entidad.
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns La entidad financiera encontrada o null.
   */
  async findById( id: string , organizationId: string , tx: DBOrTx = db ): Promise< FinancialEntity | null > {
    const results = await tx
      .select()
      .from( financialEntities )
      .where(
        and(
          eq(financialEntities.id             , id) ,
          eq(financialEntities.organizationId , organizationId) ,
        )
      )
      .limit( 1 ) ;
    return( results[0] || null ) ;
  }
} ;
