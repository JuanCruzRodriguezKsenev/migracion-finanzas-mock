/**
 * @file budgetsRepository.ts
 * Capa de acceso a datos (DAL) para Presupuestos (RFC 028).
 * Todas las operaciones imponen aislamiento multi-tenant por organizationId.
 */
// Librerías externas
import { eq , and , isNull , inArray , sql } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Budgets
import { budgets , budgetLimits }                  from "../schema.db" ;
import type { Budget , BudgetLimit , BudgetConLimites } from "../types" ;


export const budgetsRepository = {
  /**
   * Crea un presupuesto junto con su primer límite, dentro de la transacción recibida.
   * No abre transacción propia: la abre la acción (NFR-4).
   *
   * @param params - Organización, categoría, divisa, mes de vigencia (YYYY-MM) y monto en centavos.
   * @param tx - Transacción que envuelve ambos inserts.
   * @returns El presupuesto creado.
   */
  async create(
    params: { orgId: string ; categoryId: string ; currency: string ; monthKey: string ; amount: number } ,
    tx:     DBOrTx = db
  ): Promise< Budget > {
    const [ presupuesto ] = await tx
      .insert( budgets )
      .values( {
        organizationId: params.orgId ,
        categoryId:     params.categoryId ,
        currency:       params.currency ,
      } )
      .returning() ;

    await this.upsertLimit( presupuesto.id , params.monthKey , params.amount , tx ) ;

    return( presupuesto ) ;
  } ,

  /**
   * Devuelve todos los presupuestos de una divisa con todos sus límites históricos.
   * El filtro por mes lo hacen las funciones puras de budgetEvaluation.
   *
   * @param orgId - ID de la organización.
   * @param currency - Divisa de los presupuestos.
   * @param tx - Transacción opcional.
   * @returns Presupuestos con sus límites.
   */
  async findByOrganization( orgId: string , currency: string , tx: DBOrTx = db ): Promise< BudgetConLimites[] > {
    const presupuestos = await tx
      .select()
      .from( budgets )
      .where( and(
        eq( budgets.organizationId , orgId ) ,
        eq( budgets.currency       , currency )
      ) ) ;

    if( presupuestos.length === 0 ) {
      return( [] ) ;
    }

    const limites = await tx
      .select()
      .from( budgetLimits )
      .where( inArray( budgetLimits.budgetId , presupuestos.map( ( p ) => { return( p.id ) ; } ) ) ) ;

    const porPresupuesto = new Map< string , BudgetLimit[] >() ;
    for( const l of limites ) {
      const lista = porPresupuesto.get( l.budgetId ) || [] ;
      lista.push( l ) ;
      porPresupuesto.set( l.budgetId , lista ) ;
    }

    return( presupuestos.map( ( p ) => {
      return( { ...p , limits: porPresupuesto.get( p.id ) || [] } ) ;
    } ) ) ;
  } ,

  /**
   * Divisas en las que la organización tiene algún presupuesto (vigente o histórico).
   *
   * @param orgId - ID de la organización.
   * @param tx - Transacción opcional.
   * @returns Lista de códigos de divisa distintos.
   */
  async findCurrencies( orgId: string , tx: DBOrTx = db ): Promise< string[] > {
    const rows = await tx
      .selectDistinct( { currency: budgets.currency } )
      .from( budgets )
      .where( eq( budgets.organizationId , orgId ) ) ;

    return( rows.map( ( r ) => { return( r.currency ) ; } ) ) ;
  } ,

  /**
   * Busca el presupuesto vigente (sin fin) de una categoría y divisa.
   *
   * @param orgId - ID de la organización.
   * @param categoryId - ID de la categoría.
   * @param currency - Divisa.
   * @param tx - Transacción opcional.
   * @returns El presupuesto vigente o null.
   */
  async findActiveByCategory( orgId: string , categoryId: string , currency: string , tx: DBOrTx = db ): Promise< Budget | null > {
    const [ presupuesto ] = await tx
      .select()
      .from( budgets )
      .where( and(
        eq( budgets.organizationId , orgId ) ,
        eq( budgets.categoryId     , categoryId ) ,
        eq( budgets.currency       , currency ) ,
        isNull( budgets.endedFrom )
      ) ) ;

    return( presupuesto || null ) ;
  } ,

  /**
   * Busca un presupuesto por ID dentro de la organización.
   *
   * @param id - ID del presupuesto.
   * @param orgId - ID de la organización.
   * @param tx - Transacción opcional.
   * @returns El presupuesto o null si no existe o es de otra organización.
   */
  async findById( id: string , orgId: string , tx: DBOrTx = db ): Promise< Budget | null > {
    const [ presupuesto ] = await tx
      .select()
      .from( budgets )
      .where( and(
        eq( budgets.id             , id ) ,
        eq( budgets.organizationId , orgId )
      ) ) ;

    return( presupuesto || null ) ;
  } ,

  /**
   * Inserta o reemplaza el límite de un mes (RN-7: dos cambios en el mismo mes dejan el último).
   *
   * @param budgetId - ID del presupuesto.
   * @param monthKey - Mes de vigencia (YYYY-MM).
   * @param amount - Monto en centavos.
   * @param tx - Transacción opcional.
   */
  async upsertLimit( budgetId: string , monthKey: string , amount: number , tx: DBOrTx = db ): Promise< void > {
    await tx
      .insert( budgetLimits )
      .values( { budgetId , effectiveFrom: monthKey , amount } )
      .onConflictDoUpdate( {
        target: [ budgetLimits.budgetId , budgetLimits.effectiveFrom ] ,
        set:    { amount: sql`excluded.amount` } ,
      } ) ;
  } ,

  /**
   * Finaliza un presupuesto vigente desde un mes (RN-8). No borra filas.
   *
   * @param budgetId - ID del presupuesto.
   * @param monthKey - Primer mes en que deja de regir (YYYY-MM).
   * @param orgId - ID de la organización.
   * @param tx - Transacción opcional.
   * @returns El presupuesto finalizado, o null si no existía o ya estaba finalizado.
   */
  async end( budgetId: string , monthKey: string , orgId: string , tx: DBOrTx = db ): Promise< Budget | null > {
    const [ finalizado ] = await tx
      .update( budgets )
      .set( { endedFrom: monthKey } )
      .where( and(
        eq( budgets.id             , budgetId ) ,
        eq( budgets.organizationId , orgId ) ,
        isNull( budgets.endedFrom )
      ) )
      .returning() ;

    return( finalizado || null ) ;
  } ,
} ;
