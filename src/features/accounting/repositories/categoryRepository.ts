/**
 * @file categoryRepository.ts
 * Repositorio para la gestión de Categorías Contables (DAL).
 */
// Librerías externas
import { eq , asc } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Accounting
import { Category , InsertCategory } from "../types" ;
import { categories }                from "../schema.db" ;


/**
 * Repositorio de Categorías Contables.
 */
export const categoryRepository = {
  /**
   * Obtiene todas las categorías de una organización ordenadas alfabéticamente.
   * 
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns Listado de categorías.
   */
  async findAll( organizationId: string , tx: DBOrTx = db ): Promise< Category[] > {
    return( await tx
      .select()
      .from( categories )
      .where( eq(categories.organizationId , organizationId) )
      .orderBy( asc(categories.name) ) ) ;
  } ,

  /**
   * Crea una nueva categoría para la organización.
   * 
   * @param data - Datos de la categoría.
   * @param tx - Instancia de transacción opcional.
   * @returns La categoría creada.
   */
  async create( data: InsertCategory , tx: DBOrTx = db ): Promise< Category > {
    const [ inserted ] = await tx
      .insert( categories )
      .values( data )
      .returning() ;
    return( inserted ) ;
  } ,
} ;
