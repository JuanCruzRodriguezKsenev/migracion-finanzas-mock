/**
 * @file categoryRepository.ts
 * Repositorio para la gestión de Categorías Contables (DAL).
 */
// Librerías externas
import { eq , and , asc , isNull , sql } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Accounting
import { Category , InsertCategory , Account }                               from "../types" ;
import { categories , accounts , categoryAccounts , ledgerEntries , ledgerTransactions } from "../schema.db" ;


/**
 * Nodo del árbol de categorías contables con sus hijas anidadas.
 */
export interface CategoryTreeNode extends Category {
  children: Category[] ;
}

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
   * Obtiene una categoría por su ID y organización.
   * 
   * @param id - ID de la categoría.
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns La categoría o null si no existe.
   */
  async findById( id: string , organizationId: string , tx: DBOrTx = db ): Promise< Category | null > {
    const [ category ] = await tx
      .select()
      .from( categories )
      .where( and(
        eq( categories.id , id ) ,
        eq( categories.organizationId , organizationId )
      ) ) ;
    return( category || null ) ;
  } ,

  /**
   * Obtiene las categorías hijas directas de un padre en una organización.
   * 
   * @param parentId - ID de la categoría padre.
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns Lista de categorías hijas ordenadas por código contable.
   */
  async findChildren( parentId: string , organizationId: string , tx: DBOrTx = db ): Promise< Category[] > {
    return( await tx
      .select()
      .from( categories )
      .where( and(
        eq( categories.parentId , parentId ) ,
        eq( categories.organizationId , organizationId )
      ) )
      .orderBy( asc(categories.accountCode) ) ) ;
  } ,

  /**
   * Devuelve el árbol jerárquico de categorías (padres con sus hijas anidadas).
   * 
   * @param organizationId - ID de la organización.
   * @param includeArchived - Si incluye categorías archivadas (por defecto false).
   * @param tx - Instancia de transacción opcional.
   * @returns Lista de nodos de categorías raíz con sus hijas.
   */
  async findTree( organizationId: string , includeArchived = false , tx: DBOrTx = db ): Promise< CategoryTreeNode[] > {
    const conditions = [ eq( categories.organizationId , organizationId ) ] ;
    if( !includeArchived ) {
      conditions.push( isNull( categories.archivedAt ) ) ;
    }

    const all = await tx
      .select()
      .from( categories )
      .where( and( ...conditions ) )
      .orderBy( asc(categories.accountCode) ) ;

    const parents:     CategoryTreeNode[]        = [] ;
    const childrenMap: Map< string , Category[] > = new Map() ;

    for( const cat of all ) {
      if( !cat.parentId ) {
        parents.push( { ...cat , children: [] } ) ;
      } else {
        const list = childrenMap.get( cat.parentId ) || [] ;
        list.push( cat ) ;
        childrenMap.set( cat.parentId , list ) ;
      }
    }

    for( const parent of parents ) {
      parent.children = childrenMap.get( parent.id ) || [] ;
    }

    return( parents ) ;
  } ,

  /**
   * Busca o crea la hoja General (.99) del sistema para una categoría padre (R3).
   * 
   * @param parentId - ID de la categoría padre.
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns La categoría hoja General.
   */
  async findOrCreateGeneralLeaf( parentId: string , organizationId: string , tx: DBOrTx = db ): Promise< Category > {
    const [ existing ] = await tx
      .select()
      .from( categories )
      .where( and(
        eq( categories.parentId , parentId ) ,
        eq( categories.organizationId , organizationId ) ,
        eq( categories.isSystemLeaf , true )
      ) ) ;

    if( existing ) {
      return( existing ) ;
    }

    const parent = await this.findById( parentId , organizationId , tx ) ;
    if( !parent ) {
      throw( new Error( `Categoría padre con ID ${parentId} no encontrada.` ) ) ;
    }

    const [ leaf ] = await tx
      .insert( categories )
      .values( {
        organizationId ,
        parentId:     parent.id ,
        name:         "General" ,
        type:         parent.type ,
        accountCode:  `${parent.accountCode}.99` ,
        icon:         parent.icon ,
        color:        parent.color ,
        isSystemLeaf: true ,
      } )
      .returning() ;

    return( leaf ) ;
  } ,

  /**
   * Busca o crea la hoja General raíz del tipo contable (Gastos Generales / Ingresos Varios).
   * 
   * @param type - Tipo contable (expense | revenue).
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns La categoría general raíz.
   */
  async findOrCreateTypeGeneralLeaf( type: "expense" | "revenue" , organizationId: string , tx: DBOrTx = db ): Promise< Category > {
    const code = (type === "expense") ? "5.1.01.99" : "4.1.01.99" ;
    const [ existing ] = await tx
      .select()
      .from( categories )
      .where( and(
        eq( categories.organizationId , organizationId ) ,
        eq( categories.accountCode , code )
      ) ) ;

    if( existing ) {
      return( existing ) ;
    }

    const name = (type === "expense") ? "Gastos Generales" : "Ingresos Varios" ;
    const [ leaf ] = await tx
      .insert( categories )
      .values( {
        organizationId ,
        parentId:     null ,
        name ,
        type ,
        accountCode:  code ,
        isSystemLeaf: true ,
      } )
      .returning() ;

    return( leaf ) ;
  } ,

  /**
   * Busca o crea la cuenta contable y su vínculo en category_accounts para una categoría y divisa (R5).
   * 
   * @param categoryId - ID de la categoría.
   * @param currency - Código de divisa (ej: "ARS", "USD").
   * @param tx - Instancia de transacción opcional.
   * @returns La cuenta contable vinculada.
   */
  async findOrCreateAccountForCurrency( categoryId: string , currency: string , tx: DBOrTx = db ): Promise< Account > {
    const [ link ] = await tx
      .select()
      .from( categoryAccounts )
      .where( and(
        eq( categoryAccounts.categoryId , categoryId ) ,
        eq( categoryAccounts.currency , currency )
      ) ) ;

    if( link ) {
      const [ acc ] = await tx
        .select()
        .from( accounts )
        .where( eq( accounts.id , link.accountId ) ) ;
      if( acc ) {
        return( acc ) ;
      }
    }

    const [ cat ] = await tx
      .select()
      .from( categories )
      .where( eq( categories.id , categoryId ) ) ;

    if( !cat ) {
      throw( new Error( `Categoría con ID ${categoryId} no encontrada.` ) ) ;
    }

    const code = `${cat.accountCode}-${currency}` ;
    const name = `${cat.name} (${currency})` ;

    let [ account ] = await tx
      .select()
      .from( accounts )
      .where( and(
        eq( accounts.organizationId , cat.organizationId ) ,
        eq( accounts.code , code )
      ) ) ;

    if( !account ) {
      const [ createdAcc ] = await tx
        .insert( accounts )
        .values( {
          organizationId: cat.organizationId ,
          code ,
          name ,
          type:           cat.type ,
          balance:        0 ,
          currency ,
        } )
        .returning() ;
      account = createdAcc ;
    }

    await tx
      .insert( categoryAccounts )
      .values( {
        categoryId: cat.id ,
        accountId:  account.id ,
        currency ,
      } )
      .onConflictDoNothing() ;

    return( account ) ;
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

  /**
   * Actualiza el nombre, ícono o color de una categoría.
   * Renombrar la categoría renombra en cascada sus cuentas contables asociadas (RFC 022 §6).
   * 
   * @param id - ID de la categoría.
   * @param organizationId - ID de la organización.
   * @param data - Datos a actualizar (name, icon, color).
   * @param tx - Instancia de transacción opcional.
   * @returns La categoría actualizada o null si no se encontró.
   */
  async update(
    id:             string ,
    organizationId: string ,
    data:           { name?: string ; icon?: string | null ; color?: string | null } ,
    tx:             DBOrTx = db
  ): Promise< Category | null > {
    const existing = await this.findById( id , organizationId , tx ) ;
    if( !existing ) {
      return( null ) ;
    }

    const [ updated ] = await tx
      .update( categories )
      .set( {
        ...(data.name !== undefined && { name: data.name }) ,
        ...(data.icon !== undefined && { icon: data.icon }) ,
        ...(data.color !== undefined && { color: data.color }) ,
      } )
      .where( and(
        eq( categories.id , id ) ,
        eq( categories.organizationId , organizationId )
      ) )
      .returning() ;

    if( data.name && (data.name !== existing.name) ) {
      const links = await tx
        .select()
        .from( categoryAccounts )
        .where( eq( categoryAccounts.categoryId , id ) ) ;

      for( const link of links ) {
        await tx
          .update( accounts )
          .set( { name: `${data.name} (${link.currency})` } )
          .where( eq( accounts.id , link.accountId ) ) ;
      }
    }

    return( updated || null ) ;
  } ,

  /**
   * Archiva lógicamente una categoría y todas sus subcategorías hijas (R4).
   * 
   * @param id - ID de la categoría.
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns La categoría archivada o null.
   */
  async archive( id: string , organizationId: string , tx: DBOrTx = db ): Promise< Category | null > {
    const now = new Date() ;
    const [ archived ] = await tx
      .update( categories )
      .set( { archivedAt: now } )
      .where( and(
        eq( categories.id , id ) ,
        eq( categories.organizationId , organizationId )
      ) )
      .returning() ;

    if( !archived ) {
      return( null ) ;
    }

    await tx
      .update( categories )
      .set( { archivedAt: now } )
      .where( and(
        eq( categories.parentId , id ) ,
        eq( categories.organizationId , organizationId )
      ) ) ;

    return( archived ) ;
  } ,

  /**
   * Desarchiva una categoría contable para devolverla a los selectores.
   * 
   * @param id - ID de la categoría.
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns La categoría desarchivada o null.
   */
  async unarchive( id: string , organizationId: string , tx: DBOrTx = db ): Promise< Category | null > {
    const [ unarchived ] = await tx
      .update( categories )
      .set( { archivedAt: null } )
      .where( and(
        eq( categories.id , id ) ,
        eq( categories.organizationId , organizationId )
      ) )
      .returning() ;

    return( unarchived || null ) ;
  } ,

  /**
   * Mueve los asientos y saldos imputados directamente a una categoría padre hacia su hoja General (R3).
   * 
   * @param parentId - ID de la categoría padre.
   * @param organizationId - ID de la organización.
   * @param tx - Instancia de transacción opcional.
   */
  async moveMovementsToGeneralLeaf( parentId: string , organizationId: string , tx: DBOrTx = db ): Promise< void > {
    const generalLeaf = await this.findOrCreateGeneralLeaf( parentId , organizationId , tx ) ;

    const parentLinks = await tx
      .select()
      .from( categoryAccounts )
      .where( eq( categoryAccounts.categoryId , parentId ) ) ;

    for( const link of parentLinks ) {
      const targetAcc = await this.findOrCreateAccountForCurrency( generalLeaf.id , link.currency , tx ) ;
      if( targetAcc.id === link.accountId ) {
        continue ;
      }

      await tx
        .update( ledgerEntries )
        .set( { accountId: targetAcc.id } )
        .where( eq( ledgerEntries.accountId , link.accountId ) ) ;

      const [ parentAcc ] = await tx
        .select()
        .from( accounts )
        .where( eq( accounts.id , link.accountId ) ) ;

      if( parentAcc && (parentAcc.balance !== 0) ) {
        await tx
          .update( accounts )
          .set( { balance: sql`${accounts.balance} + ${parentAcc.balance}` } )
          .where( eq( accounts.id , targetAcc.id ) ) ;

        await tx
          .update( accounts )
          .set( { balance: 0 } )
          .where( eq( accounts.id , link.accountId ) ) ;
      }
    }

    await tx
      .update( ledgerTransactions )
      .set( { categoryId: generalLeaf.id } )
      .where( and(
        eq( ledgerTransactions.organizationId , organizationId ) ,
        eq( ledgerTransactions.categoryId , parentId )
      ) ) ;
  } ,
} ;
