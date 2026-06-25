/**
 * @file accountRepository.ts
 * Repositorio de Cuentas Financieras (Capa de Acceso a Datos - DAL).
 */
import { db } from "@/shared/db/client" ;
import { accounts } from "../schema.db" ;
import { eq , and } from "drizzle-orm" ;
import { Account , InsertAccount } from "../types" ;

/**
 * Repositorio de Cuentas Financieras.
 * Centraliza el acceso y operaciones sobre la tabla de cuentas contables.
 */
export const accountRepository = {
  /**
   * Obtiene una cuenta específica de una organización.
   * 
   * @param id - ID único de la cuenta.
   * @param organizationId - ID de la organización dueña de la cuenta.
   * @param tx - Instancia de transacción opcional.
   * @returns La cuenta encontrada o null si no existe.
   */
  async findById( id: string , organizationId: string , tx = db ): Promise< Account | null > {
    const results = await tx
      .select()
      .from( accounts )
      .where(
        and(
          eq(accounts.id             , id) ,
          eq(accounts.organizationId , organizationId) ,
        )
      )
      .limit( 1 ) ;
    
    return( (results[0]) || null ) ;
  } ,

  /**
   * Obtiene una cuenta específica bloqueando la fila para evitar condiciones de carrera (SELECT FOR UPDATE).
   * 
   * @param id - ID único de la cuenta.
   * @param organizationId - ID de la organización dueña de la cuenta.
   * @param tx - Instancia de transacción de base de datos (requerido para bloqueo).
   * @returns La cuenta encontrada o null si no existe.
   */
  async findByIdForUpdate( id: string , organizationId: string , tx: typeof db ): Promise< Account | null > {
    const results = await tx
      .select()
      .from( accounts )
      .where(
        and(
          eq(accounts.id             , id) ,
          eq(accounts.organizationId , organizationId) ,
        )
      )
      .for( "update" ) ;
    return( (results[0]) || null ) ;
  } ,

  /**
   * Actualiza el saldo (balance) de una cuenta dentro de una transacción.
   * 
   * @param id - ID único de la cuenta.
   * @param newBalance - El nuevo saldo en centavos.
   * @param tx - Instancia de transacción de base de datos.
   */
  async updateBalance( id: string , newBalance: number , tx = db ): Promise< void > {
    await tx
      .update( accounts )
      .set( {balance: newBalance} )
      .where( eq(accounts.id , id) ) ;
  } ,

  /**
   * Crea una nueva cuenta financiera.
   * 
   * @param data - Datos de la nueva cuenta.
   * @param tx - Instancia de transacción opcional.
   * @returns La cuenta creada.
   */
  async create( data: InsertAccount , tx = db ): Promise< Account > {
    const [ inserted ] = await tx
      .insert( accounts )
      .values( data )
      .returning() ;
    return( inserted ) ;
  } ,

  /**
   * Obtiene todas las cuentas asociadas a una organización.
   * 
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns Lista de cuentas asociadas ordenadas por código contable.
   */
  async findAll( organizationId: string , tx = db ): Promise< Account[] > {
    return( await tx
      .select()
      .from( accounts )
      .where( eq(accounts.organizationId , organizationId) )
      .orderBy( accounts.code ) ) ;
  }
} ;
