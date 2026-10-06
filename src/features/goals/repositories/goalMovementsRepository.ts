/**
 * @file goalMovementsRepository.ts
 * Capa de acceso a datos (DAL) del registro de movimientos de metas (RFC 011 §2).
 * El registro es sólo de inserción: este repositorio NO expone `update` ni `delete`.
 */
// Librerías externas
import { eq , and , sql , inArray , desc } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Accounting
import { accounts } from "@/features/accounting/schema.db" ;

// Feature: Goals
import { goalMovements }                          from "../schema.db" ;
import type { GoalMovement , InsertGoalMovement , GoalHistoryItem , GoalKind } from "../types" ;


/** Suma con signo: aporte suma, retiro resta. */
const signed = sql< string >`COALESCE( SUM( CASE ${goalMovements.kind} WHEN 'contribution' THEN ${goalMovements.amount} ELSE -${goalMovements.amount} END ) , 0 )` ;

export const goalMovementsRepository = {
  /**
   * Inserta un movimiento (aporte o retiro).
   *
   * @param data - Datos del movimiento.
   * @param tx - Instancia transaccional opcional.
   * @returns El movimiento insertado.
   */
  async insert( data: InsertGoalMovement , tx: DBOrTx = db ): Promise< GoalMovement > {
    const [ inserted ] = await tx
      .insert( goalMovements )
      .values( data )
      .returning() ;
    return( inserted ) ;
  } ,

  /**
   * Ahorrado (suma con signo) por meta.
   *
   * @param goalIds - IDs de metas.
   * @param organizationId - ID de la organización.
   * @param tx - Instancia transaccional opcional.
   * @returns Mapa goalId → ahorrado (0 si no tiene movimientos).
   */
  async sumSignedByGoal( goalIds: string[] , organizationId: string , tx: DBOrTx = db ): Promise< Record< string , number > > {
    const result: Record< string , number > = {} ;
    if( goalIds.length === 0 ) {
      return( result ) ;
    }

    const rows = await tx
      .select( { goalId: goalMovements.goalId , total: signed } )
      .from( goalMovements )
      .where(
        and(
          inArray( goalMovements.goalId , goalIds ) ,
          eq( goalMovements.organizationId , organizationId )
        )
      )
      .groupBy( goalMovements.goalId ) ;

    for( const id of goalIds ) {
      result[ id ] = 0 ;
    }
    for( const r of rows ) {
      result[ r.goalId ] = Number( r.total ) ;
    }
    return( result ) ;
  } ,

  /**
   * Neto de una meta por cada cuenta (un renglón por cuenta).
   *
   * @param goalId - ID de la meta.
   * @param organizationId - ID de la organización.
   * @param tx - Instancia transaccional opcional.
   */
  async sumSignedByGoalAndAccount(
    goalId:         string ,
    organizationId: string ,
    tx:             DBOrTx = db
  ): Promise< { accountId: string ; total: number }[] > {
    const rows = await tx
      .select( { accountId: goalMovements.accountId , total: signed } )
      .from( goalMovements )
      .where(
        and(
          eq( goalMovements.goalId , goalId ) ,
          eq( goalMovements.organizationId , organizationId )
        )
      )
      .groupBy( goalMovements.accountId ) ;

    return( rows.map( ( r ) => { return( { accountId: r.accountId , total: Number( r.total ) } ) ; } ) ) ;
  } ,

  /**
   * Reservado por cuenta (suma con signo de todas las metas).
   *
   * @param organizationId - ID de la organización.
   * @param accountIds - Restricción opcional a ciertas cuentas.
   * @param tx - Instancia transaccional opcional.
   * @returns Mapa accountId → reservado (sólo cuentas con movimientos).
   */
  async sumReservedByAccount(
    organizationId: string ,
    accountIds?:    string[] ,
    tx:             DBOrTx = db
  ): Promise< Record< string , number > > {
    const result: Record< string , number > = {} ;
    if( accountIds && (accountIds.length === 0) ) {
      return( result ) ;
    }

    const rows = await tx
      .select( { accountId: goalMovements.accountId , total: signed } )
      .from( goalMovements )
      .where(
        accountIds
          ? and( eq( goalMovements.organizationId , organizationId ) , inArray( goalMovements.accountId , accountIds ) )
          : eq( goalMovements.organizationId , organizationId )
      )
      .groupBy( goalMovements.accountId ) ;

    for( const r of rows ) {
      result[ r.accountId ] = Number( r.total ) ;
    }
    return( result ) ;
  } ,

  /**
   * Últimos movimientos de las metas indicadas, con el nombre de la cuenta.
   *
   * @param goalIds - IDs de metas.
   * @param organizationId - ID de la organización.
   * @param limit - Máximo de movimientos por meta.
   * @param tx - Instancia transaccional opcional.
   * @returns Mapa goalId → historial (más reciente primero).
   */
  async history(
    goalIds:        string[] ,
    organizationId: string ,
    limit:          number ,
    tx:             DBOrTx = db
  ): Promise< Record< string , GoalHistoryItem[] > > {
    const result: Record< string , GoalHistoryItem[] > = {} ;
    if( goalIds.length === 0 ) {
      return( result ) ;
    }

    const rows = await tx
      .select( {
        id:          goalMovements.id ,
        goalId:      goalMovements.goalId ,
        accountId:   goalMovements.accountId ,
        accountName: accounts.name ,
        kind:        goalMovements.kind ,
        amount:      goalMovements.amount ,
        occurredAt:  goalMovements.occurredAt ,
      } )
      .from( goalMovements )
      .innerJoin( accounts , eq( accounts.id , goalMovements.accountId ) )
      .where(
        and(
          inArray( goalMovements.goalId , goalIds ) ,
          eq( goalMovements.organizationId , organizationId )
        )
      )
      .orderBy( desc( goalMovements.occurredAt ) , desc( goalMovements.createdAt ) ) ;

    for( const id of goalIds ) {
      result[ id ] = [] ;
    }
    for( const r of rows ) {
      if( result[ r.goalId ].length < limit ) {
        result[ r.goalId ].push( { ...r , kind: r.kind as GoalKind } ) ;
      }
    }
    return( result ) ;
  }
} ;
