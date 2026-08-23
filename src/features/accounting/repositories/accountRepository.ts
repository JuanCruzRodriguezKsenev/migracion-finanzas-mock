/**
 * @file accountRepository.ts
 * Repositorio de Cuentas Financieras (Capa de Acceso a Datos - DAL).
 */
// Librerías externas
import { eq , and } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Accounting
import { accounts , financialEntities } from "../schema.db" ;
import { Account , InsertAccount }      from "../types" ;


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
  async findById( id: string , organizationId: string , tx: DBOrTx = db ): Promise< Account | null > {
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
    
    return( results[0] || null ) ;
  } ,

  /**
   * Obtiene una cuenta específica bloqueando la fila para evitar condiciones de carrera (SELECT FOR UPDATE).
   * 
   * @param id - ID único de la cuenta.
   * @param organizationId - ID de la organización dueña de la cuenta.
   * @param tx - Instancia de transacción de base de datos (requerido para bloqueo).
   * @returns La cuenta encontrada o null si no existe.
   */
  async findByIdForUpdate( id: string , organizationId: string , tx: DBOrTx ): Promise< Account | null > {
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
    return( results[0] || null ) ;
  } ,

  /**
   * Actualiza el saldo (balance) de una cuenta dentro de una transacción.
   * 
   * @param id - ID único de la cuenta.
   * @param newBalance - El nuevo saldo en centavos.
   * @param tx - Instancia de transacción de base de datos.
   */
  async updateBalance( id: string , newBalance: number , tx: DBOrTx = db ): Promise< void > {
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
  async create( data: InsertAccount , tx: DBOrTx = db ): Promise< Account > {
    const [ inserted ] = await tx
      .insert( accounts )
      .values( data )
      .returning() ;
    return( inserted ) ;
  } ,

  /**
   * Obtiene todas las cuentas asociadas a una organización con su entidad financiera.
   * 
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns Lista de cuentas asociadas con sus entidades correspondientes ordenadas por código contable.
   */
  async findAll(
    organizationId: string ,
    tx: DBOrTx = db
  ): Promise< (Account & { entity?: { name: string ; logo: string | null ; color: string | null } | null })[] > {
    const results = await tx
      .select( {
        account: accounts ,
        entity: {
          name:  financialEntities.name ,
          logo:  financialEntities.logo ,
          color: financialEntities.color ,
        } ,
      } )
      .from( accounts )
      .leftJoin( financialEntities , eq(accounts.entityId , financialEntities.id) )
      .where( eq(accounts.organizationId , organizationId) )
      .orderBy( accounts.code ) ;

    return( results.map( ( r ) => ( {
      ...r.account ,
      entity: r.entity?.name ? r.entity : null ,
    } ) ) ) ;
  }
} ;
