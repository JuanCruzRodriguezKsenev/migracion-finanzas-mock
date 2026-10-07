/**
 * @file cardsRepository.ts
 * Capa de acceso a datos (DAL) para Tarjetas y Cuentas de Tarjeta (RFC 007).
 * Todas las operaciones imponen aislamiento multi-tenant por organizationId.
 */
// Librerías externas
import { eq , and , isNull , desc , inArray } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Accounting
import { cuentaDeLaOrg } from "@/features/accounting/repositories/accountRepository" ;
import { accounts , financialEntities } from "@/features/accounting/schema.db" ;

// Feature: Cards
import {
  Card ,
  InsertCard ,
  CardAccount ,
  InsertCardAccount ,
  CardWithAccountsAndEntity
} from "../types" ;
import { cards , cardAccounts } from "../schema.db" ;


export interface FindCardsOptions {
  includeArchived?: boolean ;
}

export const cardsRepository = {
  /**
   * Obtiene todas las tarjetas de una organización con su entidad, cuenta vinculada y cuentas contables.
   *
   * @param organizationId - ID de la organización dueña.
   * @param options - Filtro opcional para incluir tarjetas archivadas.
   * @param tx - Instancia de transacción o cliente de BD.
   * @returns Lista completa de tarjetas con sus relaciones.
   */
  async findAll(
    organizationId: string ,
    options:        FindCardsOptions = {} ,
    tx:             DBOrTx = db
  ): Promise< CardWithAccountsAndEntity[] > {
    const { includeArchived = false } = options ;
    const conditions = [ eq( cards.organizationId , organizationId ) ] ;

    if( !includeArchived ) {
      conditions.push( isNull( cards.archivedAt ) ) ;
    }

    const cardRows = await tx
      .select( {
        card:          cards ,
        entity:        financialEntities ,
        linkedAccount: accounts ,
      } )
      .from( cards )
      .leftJoin( financialEntities , eq( cards.entityId        , financialEntities.id ) )
      .leftJoin( accounts          , eq( cards.linkedAccountId , accounts.id          ) )
      .where( and( ...conditions ) )
      .orderBy( desc( cards.createdAt ) ) ;

    if( cardRows.length === 0 ) {
      return( [] ) ;
    }

    const cardIds = cardRows.map( ( r ) => r.card.id ) ;

    // Obtener cuentas de tarjeta con su cuenta contable asociada
    const accountRows = await tx
      .select( {
        cardAccount: cardAccounts ,
        account:     accounts ,
      } )
      .from( cardAccounts )
      .innerJoin( accounts , eq( cardAccounts.accountId , accounts.id ) )
      .where(
        and(
          inArray( cardAccounts.cardId , cardIds ) ,
          cuentaDeLaOrg( organizationId )
        )
      ) ;

    return( cardRows.map( ( r ) => {
      const relatedAccounts = accountRows
        .filter( ( ar ) => ar.cardAccount.cardId === r.card.id )
        .map( ( ar ) => ( {
          ...ar.cardAccount ,
          account: ar.account ,
        } ) ) ;

      return( {
        ...r.card ,
        entity:        r.entity?.id ? r.entity : null ,
        linkedAccount: r.linkedAccount?.id ? r.linkedAccount : null ,
        accounts:      relatedAccounts ,
      } ) ;
    } ) ) ;
  } ,

  /**
   * Busca una tarjeta por ID verificando pertenencia a la organización.
   *
   * @param id - ID de la tarjeta.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia de transacción opcional.
   * @returns La tarjeta con sus relaciones o null.
   */
  async findById(
    id:             string ,
    organizationId: string ,
    tx:             DBOrTx = db
  ): Promise< CardWithAccountsAndEntity | null > {
    const [ row ] = await tx
      .select( {
        card:          cards ,
        entity:        financialEntities ,
        linkedAccount: accounts ,
      } )
      .from( cards )
      .leftJoin( financialEntities , eq( cards.entityId        , financialEntities.id ) )
      .leftJoin( accounts          , eq( cards.linkedAccountId , accounts.id          ) )
      .where(
        and(
          eq( cards.id             , id             ) ,
          eq( cards.organizationId , organizationId ) ,
        )
      )
      .limit( 1 ) ;

    if( !row ) {
      return( null ) ;
    }

    const accountRows = await tx
      .select( {
        cardAccount: cardAccounts ,
        account:     accounts ,
      } )
      .from( cardAccounts )
      .innerJoin( accounts , eq( cardAccounts.accountId , accounts.id ) )
      .where(
        and(
          eq( cardAccounts.cardId   , id             ) ,
          cuentaDeLaOrg( organizationId ) ,
        )
      ) ;

    return( {
      ...row.card ,
      entity:        row.entity?.id ? row.entity : null ,
      linkedAccount: row.linkedAccount?.id ? row.linkedAccount : null ,
      accounts:      accountRows.map( ( ar ) => ( { ...ar.cardAccount , account: ar.account } ) ) ,
    } ) ;
  } ,

  /**
   * Inserta un nuevo registro de tarjeta.
   *
   * @param data - Datos de inserción.
   * @param tx - Instancia de transacción opcional.
   * @returns La tarjeta creada.
   */
  async create( data: InsertCard , tx: DBOrTx = db ): Promise< Card > {
    const [ inserted ] = await tx
      .insert( cards )
      .values( data )
      .returning() ;

    return( inserted ) ;
  } ,

  /**
   * Asocia una cuenta contable a una tarjeta existente.
   *
   * @param data - Vínculo tarjeta-cuenta.
   * @param tx - Instancia de transacción opcional.
   * @returns El registro de vínculo creado.
   */
  async addCardAccount( data: InsertCardAccount , tx: DBOrTx = db ): Promise< CardAccount > {
    const [ inserted ] = await tx
      .insert( cardAccounts )
      .values( data )
      .returning() ;

    return( inserted ) ;
  } ,

  /**
   * Marca una tarjeta como archivada (baja lógica).
   *
   * @param id - ID de la tarjeta.
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns La tarjeta actualizada o null.
   */
  async archive( id: string , organizationId: string , tx: DBOrTx = db ): Promise< Card | null > {
    const [ updated ] = await tx
      .update( cards )
      .set( { archivedAt: new Date() , updatedAt: new Date() } )
      .where(
        and(
          eq( cards.id             , id             ) ,
          eq( cards.organizationId , organizationId ) ,
        )
      )
      .returning() ;

    return( updated || null ) ;
  } ,
} ;
