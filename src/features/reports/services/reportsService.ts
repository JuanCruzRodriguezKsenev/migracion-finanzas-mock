/**
 * @file reportsService.ts
 * Servicio de negocio para la composición y cálculo de estadísticas agregadas (RFC 027 §5).
 */
// Feature: Profile
import { profileRepository } from "@/features/profile/repositories/profileRepository" ;

// Feature: Cards & Installments
import { cuotasFuturasPorDivisa }        from "@/features/cards/services/installmentService" ;
import { installmentPlansRepository }    from "@/features/cards/repositories/installmentPlansRepository" ;

// Feature: Accounting
import { categoryRepository } from "@/features/accounting/repositories/categoryRepository" ;
import { Category }           from "@/features/accounting/types" ;

// Shared
import { claveDeMes , claveDeMesActual } from "@/shared/lib/monthKey" ;

// Feature: Reports
import { reportsRepository } from "../repositories/reportsRepository" ;
import {
  ReportData ,
  ReportCategoryGroup ,
  ReportCategoryParent ,
  GastoPorHojaItem ,
  ReportNetWorth ,
  ReportTrendPoint ,
} from "../types" ;

/**
 * Calcula la clave del mes inmediato anterior ("YYYY-MM").
 */
export function obtenerMesAnterior( monthKey: string ): string {
  const [ yStr , mStr ] = monthKey.split( "-" ) ;
  const año             = parseInt( yStr , 10 ) ;
  const mes             = parseInt( mStr , 10 ) ;

  if( mes === 1 ) {
    return( `${año - 1}-12` ) ;
  }

  const mesAntPadded = String( mes - 1 ).padStart( 2 , "0" ) ;
  return( `${año}-${mesAntPadded}` ) ;
}

/**
 * Genera la secuencia cronológica de los últimos 12 meses finalizando en monthKey.
 */
export function obtenerUltimos12Meses( monthKey: string ): string[] {
  const [ yStr , mStr ]     = monthKey.split( "-" ) ;
  const año                 = parseInt( yStr , 10 ) ;
  const mes                 = parseInt( mStr , 10 ) ;
  const resultado: string[] = [] ;

  for( let i = 11 ; i >= 0 ; i-- ) {
    let a = año ;
    let m = mes - i ;
    while( m <= 0 ) {
      m += 12 ;
      a -= 1 ;
    }
    const mPadded = String( m ).padStart( 2 , "0" ) ;
    resultado.push( `${a}-${mPadded}` ) ;
  }

  return( resultado ) ;
}

/**
 * Calcula la variación porcentual entre el valor actual y el anterior.
 * Devuelve null si el período anterior no tiene base (anterior <= 0). (RN-8)
 */
export function calcularVariacionPct( actual: number , anterior: number ): number | null {
  if( anterior <= 0 ) {
    return( null ) ;
  }

  return( ( ( actual - anterior ) / anterior ) * 100 ) ;
}

/**
 * Agrupa las filas de hojas del mes en categorías padre respetando reglas de jerarquía contable (RN-10, RN-11, RN-12).
 * - Hojas con isSystemLeaf bajo un padre se rotulan como «General».
 * - Hojas de tipo o cuentas sin categoría suman a «Sin categoría» a nivel padre.
 * - Categorías archivadas siguen contando (no se filtran).
 * - Si hay más de 7 padres, se muestran los 6 mayores y el resto se agrupa en «Otras».
 */
export function agruparCategorias(
  todasLasCategorias: Category[] ,
  hojas: GastoPorHojaItem[] ,
  tipo: "expense" | "revenue"
): ReportCategoryGroup {
  const catById = new Map< string , Category >() ;
  for( const c of todasLasCategorias ) {
    catById.set( c.id , c ) ;
  }

  interface ParentAccumulator {
    id:       string ;
    nombre:   string ;
    color:    string ;
    total:    number ;
    hojasMap: Map< string , { id: string ; nombre: string ; total: number } > ;
  }

  const parentsMap   = new Map< string , ParentAccumulator >() ;
  const sinCategoria: ParentAccumulator = {
    id:       "sin-categoria" ,
    nombre:   "Sin categoría" ,
    color:    "#94A3B8" ,
    total:    0 ,
    hojasMap: new Map() ,
  } ;

  for( const item of hojas ) {
    const amount = item.total ;
    if( amount <= 0 ) {
      continue ;
    }

    if( !item.categoryId ) {
      sinCategoria.total += amount ;
      const prev = sinCategoria.hojasMap.get( item.accountId )?.total ?? 0 ;
      sinCategoria.hojasMap.set( item.accountId , {
        id:     item.accountId ,
        nombre: "Sin categoría" ,
        total:  prev + amount ,
      } ) ;
      continue ;
    }

    const cat = catById.get( item.categoryId ) ;
    if( !cat ) {
      sinCategoria.total += amount ;
      continue ;
    }

    // Hoja General raíz de tipo contable (ej. Gastos Generales / 5.1.01.99)
    if( ( cat.parentId === null ) && ( cat.isSystemLeaf || cat.accountCode.endsWith( ".99" ) ) ) {
      sinCategoria.total += amount ;
      const prev = sinCategoria.hojasMap.get( cat.id )?.total ?? 0 ;
      sinCategoria.hojasMap.set( cat.id , {
        id:     cat.id ,
        nombre: "Sin categoría" ,
        total:  prev + amount ,
      } ) ;
      continue ;
    }

    // Hoja subordinada a un padre
    if( cat.parentId !== null ) {
      const padre       = catById.get( cat.parentId ) ;
      const parentId    = padre ? padre.id : "sin-categoria" ;
      const parentName  = padre ? padre.name : "Sin categoría" ;
      const parentColor = ( padre && padre.color ) ? padre.color : "#94A3B8" ;

      let target = parentsMap.get( parentId ) ;
      if( !target ) {
        target = {
          id:       parentId ,
          nombre:   parentName ,
          color:    parentColor ,
          total:    0 ,
          hojasMap: new Map() ,
        } ;
        parentsMap.set( parentId , target ) ;
      }

      target.total += amount ;
      const leafName = cat.isSystemLeaf ? "General" : cat.name ;
      const prev     = target.hojasMap.get( cat.id )?.total ?? 0 ;
      target.hojasMap.set( cat.id , {
        id:     cat.id ,
        nombre: leafName ,
        total:  prev + amount ,
      } ) ;
      continue ;
    }

    // Categoría padre con imputación directa
    let target = parentsMap.get( cat.id ) ;
    if( !target ) {
      target = {
        id:       cat.id ,
        nombre:   cat.name ,
        color:    cat.color || "#94A3B8" ,
        total:    0 ,
        hojasMap: new Map() ,
      } ;
      parentsMap.set( cat.id , target ) ;
    }

    target.total += amount ;
    const prev = target.hojasMap.get( cat.id )?.total ?? 0 ;
    target.hojasMap.set( cat.id , {
      id:     cat.id ,
      nombre: "General" ,
      total:  prev + amount ,
    } ) ;
  }

  if( sinCategoria.total > 0 ) {
    parentsMap.set( "sin-categoria" , sinCategoria ) ;
  }

  const listaPadres: ReportCategoryParent[] = [] ;
  for( const p of parentsMap.values() ) {
    if( p.total > 0 ) {
      const hojasSorted = Array.from( p.hojasMap.values() ).sort( ( a , b ) => { return( b.total - a.total ) ; } ) ;
      listaPadres.push( {
        id:     p.id ,
        nombre: p.nombre ,
        color:  p.color ,
        total:  p.total ,
        hojas:  hojasSorted ,
      } ) ;
    }
  }

  listaPadres.sort( ( a , b ) => { return( b.total - a.total ) ; } ) ;

  let padresFinales: ReportCategoryParent[] = listaPadres ;

  // RN-10: 6 mayores por separado y el resto en «Otras». Si hay 7 o menos, no hay «Otras».
  if( listaPadres.length > 7 ) {
    const top6       = listaPadres.slice( 0 , 6 ) ;
    const resto      = listaPadres.slice( 6 ) ;
    const totalOtras = resto.reduce( ( sum , p ) => { return( sum + p.total ) ; } , 0 ) ;
    const hojasOtras = resto.map( ( p ) => {
      return( { id: p.id , nombre: p.nombre , total: p.total } ) ;
    } ) ;

    const padreOtras: ReportCategoryParent = {
      id:     "otras" ,
      nombre: "Otras" ,
      color:  "#94A3B8" ,
      total:  totalOtras ,
      hojas:  hojasOtras ,
    } ;

    padresFinales = [ ...top6 , padreOtras ] ;
  }

  const totalGrupo = padresFinales.reduce( ( sum , p ) => { return( sum + p.total ) ; } , 0 ) ;

  return( {
    tipo ,
    total:  totalGrupo ,
    padres: padresFinales ,
  } ) ;
}

/**
 * Servicio principal de generación de estadísticas agregadas.
 */
export const reportsService = {
  /**
   * Genera el reporte completo del período para la organización y divisa seleccionada.
   */
  async armarReporte( params: {
    orgId:     string ;
    userId?:   string ;
    monthKey?: string ;
    currency?: string ;
  } ): Promise< ReportData > {
    const { orgId , userId } = params ;

    // 1. Cargar perfil para timezone y currency (RFC 027 §0)
    let timezone = "America/Argentina/Buenos_Aires" ;
    let prefCurrency = "ARS" ;

    if( userId ) {
      const perfil = await profileRepository.findByUserId( userId ) ;
      if( perfil?.timezone ) {
        timezone = perfil.timezone ;
      }
      if( perfil?.currency ) {
        prefCurrency = perfil.currency ;
      }
    }

    // 2. Divisa activa según reglas RN-2
    const divisasDisponibles = await reportsRepository.divisasConCuentas( orgId ) ;
    let activeCurrency = prefCurrency ;

    if( params.currency && divisasDisponibles.includes( params.currency ) ) {
      activeCurrency = params.currency ;
    } else if( divisasDisponibles.includes( prefCurrency ) ) {
      activeCurrency = prefCurrency ;
    } else if( divisasDisponibles.length > 0 ) {
      const masMovimientos = await reportsRepository.divisaConMasMovimientos( orgId ) ;
      if( masMovimientos && divisasDisponibles.includes( masMovimientos ) ) {
        activeCurrency = masMovimientos ;
      } else {
        activeCurrency = divisasDisponibles[ 0 ] ;
      }
    }

    // 3. Mes activo
    const selectedMonthKey = params.monthKey || claveDeMesActual( timezone ) ;

    // 4. Primer mes con movimientos y existencia de movimientos (Q5, RN-23, AC-12)
    const primerMovimiento = await reportsRepository.primerMesConMovimientos( orgId ) ;
    const hayMovimientos   = primerMovimiento !== null ;
    const minKey           = primerMovimiento ? claveDeMes( primerMovimiento , timezone ) : undefined ;

    // 5. Flujos por mes (Q1: 13 meses)
    const flujos = await reportsRepository.flujosPorMes( {
      orgId ,
      monthKey: selectedMonthKey ,
      zona:     timezone ,
      currency: activeCurrency ,
    } ) ;

    const flujosMap = new Map< string , { ingresos: number ; gastos: number ; transacciones: number } >() ;
    for( const f of flujos ) {
      flujosMap.set( f.monthKey , f ) ;
    }

    const flujoActual          = flujosMap.get( selectedMonthKey ) ;
    const ingresosActual       = flujoActual?.ingresos ?? 0 ;
    const gastosActual         = flujoActual?.gastos ?? 0 ;
    const transaccionesActual  = flujoActual?.transacciones ?? 0 ;
    const ahorroNetoActual     = ingresosActual - gastosActual ;

    const mesAnteriorKey       = obtenerMesAnterior( selectedMonthKey ) ;
    const flujoAnterior        = flujosMap.get( mesAnteriorKey ) ;
    const ingresosAnt          = flujoAnterior?.ingresos ?? 0 ;
    const gastosAnt            = flujoAnterior?.gastos ?? 0 ;
    const ahorroNetoAnt        = ingresosAnt - gastosAnt ;

    const varIngresos = calcularVariacionPct( ingresosActual , ingresosAnt ) ;
    const varGastos   = calcularVariacionPct( gastosActual , gastosAnt ) ;
    const varAhorro   = calcularVariacionPct( ahorroNetoActual , ahorroNetoAnt ) ;

    const tasaAhorroActual = ( ingresosActual > 0 ) ? ( ( ahorroNetoActual / ingresosActual ) * 100 ) : null ;
    const tasaAhorroAnt    = ( ingresosAnt > 0 ) ? ( ( ahorroNetoAnt / ingresosAnt ) * 100 ) : null ;
    const deltaPP          = ( ( tasaAhorroActual !== null ) && ( tasaAhorroAnt !== null ) )
      ? ( tasaAhorroActual - tasaAhorroAnt )
      : null ;

    // 6. Tendencia histórica (12 puntos) y Patrimonio según libro (Q2, RN-9, RN-16)
    const meses12 = obtenerUltimos12Meses( selectedMonthKey ) ;
    const mesesFiltrados = minKey
      ? meses12.filter( ( m ) => { return( m >= minKey ) ; } )
      : meses12 ;

    const saldosLibro = await reportsRepository.patrimonioPorMes( {
      orgId ,
      monthKeyMax: selectedMonthKey ,
      zona:        timezone ,
      currency:    activeCurrency ,
    } ) ;

    const tendencia: ReportTrendPoint[] = mesesFiltrados.map( ( m ) => {
      const f = flujosMap.get( m ) ;
      const ing = f?.ingresos ?? 0 ;
      const gas = f?.gastos ?? 0 ;
      const ah  = ing - gas ;

      // Acumulado cronológico hasta el cierre del mes m
      const patLibro = saldosLibro
        .filter( ( s ) => { return( s.monthKey <= m ) ; } )
        .reduce( ( sum , s ) => { return( sum + s.delta ) ; } , 0 ) ;

      return( {
        monthKey:        m ,
        ingresos:        ing ,
        gastos:          gas ,
        ahorroNeto:      ah ,
        patrimonioLibro: patLibro ,
      } ) ;
    } ) ;

    // 7. Categorías (Q3)
    const [ todasCategorias , hojasGastos , hojasIngresos ] = await Promise.all( [
      categoryRepository.findAll( orgId ) ,
      reportsRepository.gastoPorHojaDelMes( {
        orgId ,
        monthKey: selectedMonthKey ,
        zona:     timezone ,
        currency: activeCurrency ,
        tipo:     "expense" ,
      } ) ,
      reportsRepository.gastoPorHojaDelMes( {
        orgId ,
        monthKey: selectedMonthKey ,
        zona:     timezone ,
        currency: activeCurrency ,
        tipo:     "revenue" ,
      } ) ,
    ] ) ;

    const grupoGastos   = agruparCategorias( todasCategorias , hojasGastos , "expense" ) ;
    const grupoIngresos = agruparCategorias( todasCategorias , hojasIngresos , "revenue" ) ;

    // 8. Top gastos (Q4, RN-13)
    const topGastos = await reportsRepository.topGastosDelMes( {
      orgId ,
      monthKey: selectedMonthKey ,
      zona:     timezone ,
      currency: activeCurrency ,
    } ) ;

    // 9. Patrimonio Neto de hoy (RN-15, patterns.md §8)
    const { activos , pasivos } = await reportsRepository.saldosDeHoy( orgId , activeCurrency ) ;
    const planesActivos         = await installmentPlansRepository.findActiveByOrganization( orgId ) ;
    const cuotasPorDivisa       = cuotasFuturasPorDivisa( planesActivos ) ;
    const cuotasPorPagar        = cuotasPorDivisa[ activeCurrency ] ?? 0 ;

    // patterns.md §8: el motor contable almacena los pasivos con saldo negativo.
    // Por lo tanto, el neto patrimonial es una suma directa: activos + pasivos - cuotasPorPagar.
    const neto = activos + pasivos - cuotasPorPagar ;

    const patrimonio: ReportNetWorth = {
      activos ,
      pasivos ,
      cuotasPorPagar ,
      neto ,
    } ;

    return( {
      currency:       activeCurrency ,
      monthKey:       selectedMonthKey ,
      metrics:        {
        ingresos:      { value: ingresosActual , variacionPct: varIngresos } ,
        gastos:        { value: gastosActual ,   variacionPct: varGastos } ,
        ahorroNeto:    { value: ahorroNetoActual , variacionPct: varAhorro } ,
        tasaAhorro:    { value: tasaAhorroActual , deltaPP } ,
        transacciones: transaccionesActual ,
      } ,
      tendencia ,
      categorias:     [ grupoGastos , grupoIngresos ] ,
      topGastos ,
      patrimonio ,
      divisas:        divisasDisponibles ,
      minKey ,
      hayMovimientos ,
    } ) ;
  } ,
} ;
