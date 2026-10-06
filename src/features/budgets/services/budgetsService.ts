/**
 * @file budgetsService.ts
 * Servicio de presupuestos: compone repositorio, gasto del libro y árbol de categorías (RFC 028 §3).
 * La regla de "qué es gasto" vive en reportsRepository.gastoPorHojaDelMes y no se reimplementa acá.
 */
// Shared
import { claveDeMes , claveDeMesActual } from "@/shared/lib/monthKey" ;

// Feature: Profile
import { profileRepository } from "@/features/profile/repositories/profileRepository" ;

// Feature: Accounting
import { categoryRepository } from "@/features/accounting/repositories/categoryRepository" ;
import type { Category }      from "@/features/accounting/types" ;

// Feature: Reports
import { reportsRepository } from "@/features/reports/repositories/reportsRepository" ;

// Feature: Budgets
import { budgetsRepository }                                                          from "../repositories/budgetsRepository" ;
import { limiteVigente , presupuestoActivoEn , estadoDe , porcentajeDe , raicesYSublimites , resumen } from "./budgetEvaluation" ;
import type { EvaluacionMes , PresupuestoEvaluado }                                   from "../types" ;


const ZONA_POR_DEFECTO   = "America/Argentina/Buenos_Aires" ;
const DIVISA_POR_DEFECTO = "ARS" ;

/**
 * Días que quedan del mes en curso, del día de hoy al último inclusive, en la zona dada (RN-17).
 *
 * @param zona - Zona horaria IANA del usuario.
 * @returns Cantidad de días, contando hoy.
 */
function diasRestantesDelMes( zona: string ): number {
  const partes = new Intl.DateTimeFormat( "en-US" , { timeZone: zona , year: "numeric" , month: "2-digit" , day: "2-digit" } )
                   .formatToParts( new Date() ) ;
  const valor  = ( tipo: string ) => { return( Number( partes.find( ( p ) => { return( p.type === tipo ) ; } )?.value ) ) ; } ;

  const anio = valor( "year" ) ;
  const mes  = valor( "month" ) ;
  const dia  = valor( "day" ) ;
  const diasDelMes = new Date( Date.UTC( anio , mes , 0 ) ).getUTCDate() ;

  return( diasDelMes - dia + 1 ) ;
}

export const budgetsService = {
  /**
   * Zona horaria y divisa preferidas del usuario; sin perfil, los defaults de Estadísticas.
   *
   * @param userId - ID del usuario (opcional).
   * @returns Zona IANA y divisa.
   */
  async preferenciasDe( userId?: string ): Promise< { zona: string ; currency: string } > {
    const perfil = userId ? await profileRepository.findByUserId( userId ) : null ;

    return( {
      zona:     perfil?.timezone || ZONA_POR_DEFECTO ,
      currency: perfil?.currency || DIVISA_POR_DEFECTO ,
    } ) ;
  } ,

  /**
   * Evalúa los presupuestos activos de un mes contra el gasto real del libro.
   *
   * @param params - Organización, usuario (para zona y divisa), mes y divisa opcionales.
   * @returns Presupuestos evaluados, resumen, divisas disponibles, mes y días restantes.
   */
  async evaluarMes( params: { orgId: string ; userId?: string ; monthKey?: string ; currency?: string } ): Promise< EvaluacionMes > {
    const { orgId } = params ;

    // 1. Perfil: zona y divisa
    const prefs    = await this.preferenciasDe( params.userId ) ;
    const zona     = prefs.zona ;
    const currency = params.currency || prefs.currency ;
    const monthKey = params.monthKey || claveDeMesActual( zona ) ;

    // 2. Presupuestos, árbol (con archivadas: RN-9) y una sola consulta de gasto
    const [ presupuestos , arbol , gasto , divisasCuentas , divisasPresupuestos ] = await Promise.all( [
      budgetsRepository.findByOrganization( orgId , currency ) ,
      categoryRepository.findTree( orgId , true ) ,
      reportsRepository.gastoPorHojaDelMes( { orgId , monthKey , zona , currency , tipo: "expense" } ) ,
      reportsRepository.divisasConCuentas( orgId ) ,
      budgetsRepository.findCurrencies( orgId ) ,
    ] ) ;

    // 3. Gasto agrupado por hoja
    const gastoPorCategoria = new Map< string , number >() ;
    for( const g of gasto ) {
      if( g.categoryId ) {
        gastoPorCategoria.set( g.categoryId , ( gastoPorCategoria.get( g.categoryId ) || 0 ) + g.total ) ;
      }
    }

    // 4. Índices del árbol
    const infoDe   = new Map< string , { cat: Category ; esPadre: boolean ; hojas: string[] } >() ;
    for( const padre of arbol ) {
      const { children , ...resto } = padre ;
      infoDe.set( padre.id , { cat: resto as Category , esPadre: true , hojas: children.map( ( h ) => { return( h.id ) ; } ) } ) ;
      for( const hoja of children ) {
        infoDe.set( hoja.id , { cat: hoja , esPadre: false , hojas: [] } ) ;
      }
    }

    // 5. Activos del mes con límite vigente
    const activos = presupuestos
      .filter( ( p ) => { return( presupuestoActivoEn( p , monthKey ) ) ; } )
      .map( ( p ) => { return( { presupuesto: p , limite: limiteVigente( p.limits , monthKey ) , info: infoDe.get( p.categoryId ) } ) ; } )
      .filter( ( x ) => { return( x.limite && x.info ) ; } ) ;

    const sublimites = raicesYSublimites(
      activos.map( ( x ) => { return( { budgetId: x.presupuesto.id , categoryId: x.presupuesto.categoryId , currency: x.presupuesto.currency } ) ; } ) ,
      arbol
    ) ;

    // 6. Evaluación. Un padre suma sus hojas (la General incluida) y, si no tiene hojas, su propio gasto.
    const evaluados: PresupuestoEvaluado[] = activos.map( ( { presupuesto , limite , info } ) => {
      const ids     = info!.esPadre ? [ presupuesto.categoryId , ...info!.hojas ] : [ presupuesto.categoryId ] ;
      const gastado = ids.reduce( ( acc , id ) => { return( acc + ( gastoPorCategoria.get( id ) || 0 ) ) ; } , 0 ) ;
      const monto   = limite!.amount ;

      return( {
        budgetId:     presupuesto.id ,
        categoryId:   presupuesto.categoryId ,
        categoryName: info!.cat.name ,
        parentId:     info!.cat.parentId ,
        esPadre:      info!.esPadre ,
        archivada:    info!.cat.archivedAt !== null ,
        currency:     presupuesto.currency ,
        limite:       monto ,
        gastado ,
        restante:     monto - gastado ,
        porcentaje:   porcentajeDe( gastado , monto ) ,
        estado:       estadoDe( gastado , monto ) ,
        esSublimite:  sublimites.has( presupuesto.id ) ,
      } ) ;
    } ) ;

    const divisas = Array.from( new Set( [ ...divisasCuentas , ...divisasPresupuestos , currency ] ) ).sort() ;

    return( {
      presupuestos:  evaluados ,
      resumen:       resumen( evaluados ) ,
      divisas ,
      monthKey ,
      diasRestantes: ( monthKey === claveDeMes( new Date() , zona ) ) ? diasRestantesDelMes( zona ) : null ,
    } ) ;
  } ,
} ;
