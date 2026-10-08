/**
 * @file accountRepository.ts
 * Repositorio de Cuentas Financieras (Capa de Acceso a Datos - DAL).
 */
// Librerías externas
import { eq , and , or , isNull , exists , notExists , inArray , sql , SQL } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { accounts , accountShares , financialEntities }                from "../schema.db" ;
import { Account , InsertAccount , EtiquetaCuenta , etiquetaDeCuenta } from "../types" ;


/**
 * Predicado de las cuentas DE la organización: ancladas en ella y sin titular personal.
 * Es el único que deben usar las consultas existentes: una cuenta personal nunca se cuela por olvido.
 *
 * @param orgId - ID de la organización.
 */
export function cuentaDeLaOrg( orgId: string ): SQL {
  return( and( eq(accounts.organizationId , orgId) , isNull(accounts.ownerUserId) ) as SQL ) ;
}

/**
 * Predicado de las cuentas VISIBLES en la organización: las suyas más las personales que el dueño
 * compartió con ella. Sólo lo consume el plan 24 (movimientos con cuentas personales).
 *
 * @param orgId - ID de la organización.
 */
export function cuentaVisibleEn( orgId: string ): SQL {
  return( or(
    cuentaDeLaOrg( orgId ) ,
    exists(
      db.select( {uno: sql`1`} ).from( accountShares ).where( and(
        eq(accountShares.accountId      , accounts.id) ,
        eq(accountShares.organizationId , orgId)
      ) )
    )
  ) as SQL ) ;
}

/** Cuenta con su entidad financiera y su etiqueta (RN-15), lista para el selector de cuentas. */
export type CuentaConEtiqueta = Account & {
  entity?:  { name: string ; logo: string | null ; color: string | null } | null ;
  etiqueta: EtiquetaCuenta ;
} ;

/** Cuenta personal con las organizaciones donde está compartida (vacío = privada). */
export interface CuentaPersonalConShares {
  cuenta:            Account ;
  organizacionesIds: string[] ;
}


/**
 * Lee las cuentas que cumplen un predicado con su entidad y su etiqueta (RN-15): para cada personal trae
 * todas las organizaciones donde está compartida.
 *
 * @param donde - Predicado sobre `accounts`.
 * @param tx - Instancia de transacción opcional.
 */
async function listarConEtiqueta( donde: SQL , tx: DBOrTx ): Promise< CuentaConEtiqueta[] > {
  const filas = await tx
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
    .where( donde )
    .orderBy( accounts.code ) ;

  const personalesIds = filas.filter( ( f ) => f.account.ownerUserId ).map( ( f ) => f.account.id ) ;
  const sharesPorCuenta = new Map< string , { id: string ; nombre: string }[] >() ;

  if( personalesIds.length > 0 ) {
    const shares = await tx
      .select( {accountId: accountShares.accountId , id: organizations.id , nombre: organizations.name} )
      .from( accountShares )
      .innerJoin( organizations , eq(organizations.id , accountShares.organizationId) )
      .where( inArray(accountShares.accountId , personalesIds) ) ;

    for( const share of shares ) {
      const lista = sharesPorCuenta.get( share.accountId ) ?? [] ;
      lista.push( {id: share.id , nombre: share.nombre} ) ;
      sharesPorCuenta.set( share.accountId , lista ) ;
    }
  }

  return( filas.map( ( f ) => ( {
    ...f.account ,
    entity:   f.entity?.name ? f.entity : null ,
    etiqueta: etiquetaDeCuenta( f.account , sharesPorCuenta.get( f.account.id ) ?? [] ) ,
  } ) ) ) ;
}

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
          eq(accounts.id , id) ,
          cuentaDeLaOrg( organizationId ) ,
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
          eq(accounts.id , id) ,
          cuentaDeLaOrg( organizationId ) ,
        )
      )
      .for( "update" ) ;
    return( results[0] || null ) ;
  } ,

  /**
   * Obtiene una cuenta **visible** en la organización: una suya o una personal compartida con ella (plan 24).
   *
   * @param id - ID único de la cuenta.
   * @param organizationId - ID de la organización desde la que se mira.
   * @param tx - Instancia de transacción opcional.
   */
  async findVisibleById( id: string , organizationId: string , tx: DBOrTx = db ): Promise< Account | null > {
    const results = await tx
      .select()
      .from( accounts )
      .where( and( eq(accounts.id , id) , cuentaVisibleEn( organizationId ) ) )
      .limit( 1 ) ;
    return( results[0] || null ) ;
  } ,

  /**
   * Igual que {@link findVisibleById} pero bloqueando la fila (SELECT FOR UPDATE).
   *
   * @param id - ID único de la cuenta.
   * @param organizationId - ID de la organización desde la que se mira.
   * @param tx - Instancia de transacción de base de datos (requerido para bloqueo).
   */
  async findVisibleByIdForUpdate( id: string , organizationId: string , tx: DBOrTx ): Promise< Account | null > {
    const results = await tx
      .select()
      .from( accounts )
      .where( and( eq(accounts.id , id) , cuentaVisibleEn( organizationId ) ) )
      .for( "update" ) ;
    return( results[0] || null ) ;
  } ,

  /**
   * Obtiene una cuenta por id **aunque ya no se comparta** con la organización (RN-13). Sólo para mostrar
   * nombre y etiqueta «Ya no compartida»; no es una verificación de pertenencia.
   *
   * @param id - ID único de la cuenta.
   * @param tx - Instancia de transacción opcional.
   */
  async findHistoricaById( id: string , tx: DBOrTx = db ): Promise< Account | null > {
    const results = await tx.select().from( accounts ).where( eq(accounts.id , id) ).limit( 1 ) ;
    return( results[0] || null ) ;
  } ,

  /**
   * Igual que {@link findHistoricaById} pero bloqueando la fila: la reversa corrige el saldo único de una
   * personal aunque ya no esté compartida (A8).
   *
   * @param id - ID único de la cuenta.
   * @param tx - Instancia de transacción de base de datos (requerido para bloqueo).
   */
  async findHistoricaByIdForUpdate( id: string , tx: DBOrTx ): Promise< Account | null > {
    const results = await tx.select().from( accounts ).where( eq(accounts.id , id) ).for( "update" ) ;
    return( results[0] || null ) ;
  } ,

  /**
   * Cuentas que un usuario puede usar en un movimiento de la organización: las de la organización más sus
   * personales compartidas con ella. Es la lista del selector.
   *
   * @param organizationId - ID de la organización.
   * @param userId - ID del usuario que carga.
   * @param tx - Instancia de transacción opcional.
   */
  async findUsablesPara( organizationId: string , userId: string , tx: DBOrTx = db ): Promise< CuentaConEtiqueta[] > {
    return( await listarConEtiqueta(
      or(
        cuentaDeLaOrg( organizationId ) ,
        and( eq(accounts.ownerUserId , userId) , cuentaVisibleEn( organizationId ) )
      ) as SQL ,
      tx
    ) ) ;
  } ,

  /**
   * Personales del usuario que **aún no** se compartieron con la organización (alimenta «Compartir y usar»).
   *
   * @param organizationId - ID de la organización.
   * @param userId - ID del usuario titular.
   * @param tx - Instancia de transacción opcional.
   */
  async findCompartiblesPara( organizationId: string , userId: string , tx: DBOrTx = db ): Promise< CuentaConEtiqueta[] > {
    return( await listarConEtiqueta(
      and(
        eq(accounts.ownerUserId , userId) ,
        notExists(
          db.select( {uno: sql`1`} ).from( accountShares ).where( and(
            eq(accountShares.accountId      , accounts.id) ,
            eq(accountShares.organizationId , organizationId)
          ) )
        )
      ) as SQL ,
      tx
    ) ) ;
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
      .where( cuentaDeLaOrg( organizationId ) )
      .orderBy( accounts.code ) ;

    return( results.map( ( r ) => ( {
      ...r.account ,
      entity: r.entity?.name ? r.entity : null ,
    } ) ) ) ;
  } ,

  /**
   * Obtiene **todas** las cuentas ancladas en una organización, personales incluidas. Sólo para reservar
   * códigos contables: el índice único `(organization_id, code)` los comparte. No usar para mostrar cuentas.
   *
   * @param organizationId - ID de la organización ancla.
   * @param tx - Instancia de transacción opcional.
   */
  async findTodasEnAncla( organizationId: string , tx: DBOrTx = db ): Promise< Account[] > {
    return( await tx.select().from( accounts ).where( eq(accounts.organizationId , organizationId) ) ) ;
  } ,

  /**
   * Crea una cuenta personal: siempre `asset`, con titular y anclada en la organización indicada.
   * Nace privada (sin filas en `account_shares`).
   *
   * @param data - Datos de la cuenta; `ownerUserId` es obligatorio y `type` se fuerza a `asset`.
   * @param tx - Instancia de transacción opcional.
   * @returns La cuenta creada.
   */
  async crearPersonal( data: Omit< InsertAccount , "type" | "ownerUserId" | "isCommonPot" > & { ownerUserId: string } , tx: DBOrTx = db ): Promise< Account > {
    const [ inserted ] = await tx
      .insert( accounts )
      .values( {...data , type: "asset" , isCommonPot: false} )
      .returning() ;
    return( inserted ) ;
  } ,

  /**
   * Lista las cuentas personales de un usuario con las organizaciones donde están compartidas.
   *
   * @param userId - ID del titular.
   * @param tx - Instancia de transacción opcional.
   */
  async listarPersonales( userId: string , tx: DBOrTx = db ): Promise< CuentaPersonalConShares[] > {
    const filas = await tx
      .select( {cuenta: accounts , organizationId: accountShares.organizationId} )
      .from( accounts )
      .leftJoin( accountShares , eq(accountShares.accountId , accounts.id) )
      .where( eq(accounts.ownerUserId , userId) )
      .orderBy( accounts.code ) ;

    const porCuenta = new Map< string , CuentaPersonalConShares >() ;
    for( const fila of filas ) {
      const actual = porCuenta.get( fila.cuenta.id ) ?? {cuenta: fila.cuenta , organizacionesIds: []} ;
      if( fila.organizationId ) { actual.organizacionesIds.push( fila.organizationId ) ; }
      porCuenta.set( fila.cuenta.id , actual ) ;
    }
    return( [ ...porCuenta.values() ] ) ;
  } ,

  /**
   * Obtiene una cuenta personal por id, sólo si pertenece al usuario indicado.
   *
   * @param id - ID de la cuenta.
   * @param userId - ID del titular.
   * @param tx - Instancia de transacción opcional.
   */
  async findPersonal( id: string , userId: string , tx: DBOrTx = db ): Promise< Account | null > {
    const results = await tx
      .select()
      .from( accounts )
      .where( and( eq(accounts.id , id) , eq(accounts.ownerUserId , userId) ) )
      .limit( 1 ) ;
    return( results[0] || null ) ;
  } ,

  /**
   * Comparte una cuenta personal con una organización. Idempotente.
   *
   * @param accountId - ID de la cuenta personal.
   * @param orgId - ID de la organización destino.
   * @param tx - Instancia de transacción opcional.
   */
  async compartir( accountId: string , orgId: string , tx: DBOrTx = db ): Promise< void > {
    await tx
      .insert( accountShares )
      .values( {accountId , organizationId: orgId} )
      .onConflictDoNothing() ;
  } ,

  /**
   * Deja de compartir una cuenta personal con una organización.
   *
   * @param accountId - ID de la cuenta personal.
   * @param orgId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   */
  async dejarDeCompartir( accountId: string , orgId: string , tx: DBOrTx = db ): Promise< void > {
    await tx
      .delete( accountShares )
      .where( and( eq(accountShares.accountId , accountId) , eq(accountShares.organizationId , orgId) ) ) ;
  } ,

  /**
   * Quita todas las comparticiones que un usuario hizo hacia una organización (RN-14: al salir de ella
   * o quedar como `viewer`). La cuenta y sus datos quedan intactos.
   *
   * @param userId - ID del titular.
   * @param orgId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   */
  async quitarComparticionesDe( userId: string , orgId: string , tx: DBOrTx = db ): Promise< void > {
    const propias = tx.select( {id: accounts.id} ).from( accounts ).where( eq(accounts.ownerUserId , userId) ) ;
    await tx
      .delete( accountShares )
      .where( and( eq(accountShares.organizationId , orgId) , inArray(accountShares.accountId , propias) ) ) ;
  }
} ;
