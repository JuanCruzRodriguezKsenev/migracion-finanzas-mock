/**
 * @file monthlySummaryRepository.ts
 * Repositorio para la gestión de Resúmenes Mensuales Históricos (Capa de Acceso a Datos - DAL).
 * Optimizado con caché en memoria a nivel de registro para evitar consultas de base de datos redundantes.
 */
import { eq , and , asc , or } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Accounting
import { monthlySummaries } from "../schema.db" ;
import { MonthlySummary , InsertMonthlySummary } from "../types" ;

// Caché en memoria para almacenar resúmenes individuales ya consultados
// Clave: `${organizationId}-${year}-${month}` (donde month es 0-indexed de 0 a 11)
const summaryCache = new Map< string , MonthlySummary >() ;

/**
 * Repositorio de Resúmenes Mensuales.
 */
export const monthlySummaryRepository = {
  /**
   * Registra un nuevo resumen mensual histórico.
   */
  async create( data: InsertMonthlySummary , tx: DBOrTx = db ): Promise< MonthlySummary > {
    const [ inserted ] = await tx
      .insert( monthlySummaries )
      .values( data )
      .returning() ;

    // Sincronizar e invalidar caché
    summaryCache.set( `${inserted.organizationId}-${inserted.year}-${inserted.month}` , inserted ) ;

    return( inserted ) ;
  } ,

  /**
   * Registra o actualiza un resumen mensual histórico sobre el índice único (organizationId, year, month).
   */
  async upsert( data: InsertMonthlySummary , tx: DBOrTx = db ): Promise< MonthlySummary > {
    const [ upserted ] = await tx
      .insert( monthlySummaries )
      .values( data )
      .onConflictDoUpdate( {
        target: [ monthlySummaries.organizationId , monthlySummaries.year , monthlySummaries.month ] ,
        set:    {
          totalRevenue:        data.totalRevenue ?? 0 ,
          totalExpense:        data.totalExpense ?? 0 ,
          balanceSnapshot:     data.balanceSnapshot ?? 0 ,
          assetsSnapshot:      data.assetsSnapshot ?? 0 ,
          liabilitiesSnapshot: data.liabilitiesSnapshot ?? 0 ,
        } ,
      } )
      .returning() ;

    // Sincronizar e invalidar caché
    summaryCache.set( `${upserted.organizationId}-${upserted.year}-${upserted.month}` , upserted ) ;

    return( upserted ) ;
  } ,

  /**
   * Consulta los resúmenes mensuales ordenados cronológicamente de forma descendente.
   * Optimizado con caché granular: solo consulta a la base de datos los meses individuales faltantes en memoria.
   */
  async findRecent(
    organizationId: string ,
    limit:          number = 6 ,
    beforeYear?:    number ,
    beforeMonth?:   number
  ): Promise< MonthlySummary[] > {
    // 1. Determinar el rango de los N meses objetivo finalizando en la fecha dada
    let endYear = beforeYear ;
    let endMonth = beforeMonth ; // 1-indexed (1 al 12)

    if( (endYear === undefined) || (endMonth === undefined) ) {
      const ahora = new Date() ;
      endYear  = ahora.getFullYear() ;
      endMonth = ahora.getMonth() + 1 ;
    }

    const targetMonths: { year: number ; month: number }[] = [] ;
    for( let i = 0 ; i < limit ; i++ ) {
      const date = new Date( endYear , endMonth - 1 - i , 1 ) ;
      targetMonths.push( { year: date.getFullYear() , month: date.getMonth() } ) ;
    }

    // 2. Identificar qué meses del rango objetivo no están cargados en la caché en memoria
    const missingTargets = targetMonths.filter( ( t ) => {
      const key = `${organizationId}-${t.year}-${t.month}` ;
      return( !summaryCache.has( key ) ) ;
    } ) ;

    // 3. Consultar a la base de datos únicamente los registros de meses faltantes
    if( missingTargets.length > 0 ) {
      const orConditions = missingTargets.map( ( t ) =>
        and(
          eq( monthlySummaries.year , t.year ) ,
          eq( monthlySummaries.month , t.month )
        )
      ) ;

      const queryCondition = and(
        eq( monthlySummaries.organizationId , organizationId ) ,
        orConditions.length === 1 ? orConditions[0] : or( ...orConditions )
      ) ;

      const fetched = await db
        .select()
        .from( monthlySummaries )
        .where( queryCondition ) ;

      // Almacenar en caché los registros encontrados
      for( const s of fetched ) {
        summaryCache.set( `${organizationId}-${s.year}-${s.month}` , s ) ;
      }
    }

    // 4. Compilar y ordenar la serie temporal final combinando caché y nuevos registros
    const results: MonthlySummary[] = [] ;
    for( const target of targetMonths ) {
      const key = `${organizationId}-${target.year}-${target.month}` ;
      const cached = summaryCache.get( key ) ;
      if( cached ) {
        results.push( cached ) ;
      }
    }

    // Retornar ordenados cronológicamente de forma descendente (del más reciente al más antiguo)
    return( results.sort( ( a , b ) => {
      if( a.year !== b.year ) {
        return( b.year - a.year ) ;
      }
      return( b.month - a.month ) ;
    } ) ) ;
  } ,

  /**
   * Consulta la clave de mes (YYYY-MM) más antigua con registros para la organización.
   */
  async findEarliestMonthKey( organizationId: string , tx: DBOrTx = db ): Promise< string | undefined > {
    const [ earliestSummary ] = await tx
      .select( {
        year:  monthlySummaries.year ,
        month: monthlySummaries.month ,
      } )
      .from( monthlySummaries )
      .where( eq( monthlySummaries.organizationId , organizationId ) )
      .orderBy( asc( monthlySummaries.year ) , asc( monthlySummaries.month ) )
      .limit( 1 ) ;

    if( !earliestSummary ) {
      return( undefined ) ;
    }

    const monthStr = String( earliestSummary.month + 1 ).padStart( 2 , "0" ) ;
    return( `${earliestSummary.year}-${monthStr}` ) ;
  } ,

  /**
   * Elimina todos los resúmenes mensuales de una organización (para limpieza o resiembra).
   */
  async clear( organizationId: string , tx: DBOrTx = db ): Promise< void > {
    await tx
      .delete( monthlySummaries )
      .where( eq(monthlySummaries.organizationId , organizationId) ) ;

    // Limpiar toda la caché en memoria correspondiente a esta organización
    for( const key of Array.from( summaryCache.keys() ) ) {
      if( key.startsWith( `${organizationId}-` ) ) {
        summaryCache.delete( key ) ;
      }
    }
  }
} ;
