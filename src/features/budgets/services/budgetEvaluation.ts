/**
 * @file budgetEvaluation.ts
 * Funciones puras de evaluación de presupuestos (RFC 028 §3). No acceden a la base de datos.
 * Todo importe es un entero en centavos; los estados se deciden con aritmética entera (AC-3).
 */
// Feature: Accounting
import type { CategoryTreeNode } from "@/features/accounting/types" ;

// Feature: Budgets
import type { EstadoPresupuesto , PresupuestoEvaluado , ResumenPresupuestos } from "../types" ;


/**
 * Límite con vigencia, tal como se guarda en `budget_limits`.
 */
export interface LimiteConVigencia {
  effectiveFrom: string ;
  amount:        number ;
}

/**
 * Datos mínimos de un presupuesto para decidir su vigencia.
 */
export interface PresupuestoConVigencia {
  endedFrom: string | null ;
  limits:    LimiteConVigencia[] ;
}

/**
 * Devuelve el límite de mayor `effectiveFrom` menor o igual al mes dado, o null si no hay (AC-4, RN-7).
 * La comparación lexicográfica de "YYYY-MM" es correcta.
 *
 * @param limites - Todos los límites del presupuesto.
 * @param monthKey - Mes a evaluar (YYYY-MM).
 * @returns El límite vigente o null.
 */
export function limiteVigente< T extends LimiteConVigencia >( limites: T[] , monthKey: string ): T | null {
  let elegido: T | null = null ;

  for( const l of limites ) {
    if( (l.effectiveFrom <= monthKey) && (!elegido || (l.effectiveFrom > elegido.effectiveFrom)) ) {
      elegido = l ;
    }
  }

  return( elegido ) ;
}

/**
 * Indica si el presupuesto rige en el mes: desde su primer límite y hasta antes de `endedFrom` (AC-5, AC-6).
 *
 * @param presupuesto - Presupuesto con sus límites y su mes de fin.
 * @param monthKey - Mes a evaluar (YYYY-MM).
 * @returns true si está activo en ese mes.
 */
export function presupuestoActivoEn( presupuesto: PresupuestoConVigencia , monthKey: string ): boolean {
  if( presupuesto.limits.length === 0 ) {
    return( false ) ;
  }

  const primero = presupuesto.limits.reduce( ( min , l ) => {
    return( (l.effectiveFrom < min) ? l.effectiveFrom : min ) ;
  } , presupuesto.limits[ 0 ].effectiveFrom ) ;

  if( monthKey < primero ) {
    return( false ) ;
  }

  return( (presupuesto.endedFrom === null) || (monthKey < presupuesto.endedFrom) ) ;
}

/**
 * Decide el estado con aritmética entera, sin dividir (AC-3):
 * en orden si gastado < 85 % del límite; en alerta hasta el 100 % inclusive; excedido por encima.
 * Un límite no positivo nunca debería llegar (lo frenan Zod y el CHECK); para no dividir ni
 * dar un estado engañoso, con límite <= 0 devuelve `excedido` si hay gasto y `en_orden` si no.
 *
 * @param gastado - Gasto del mes en centavos.
 * @param limite - Límite vigente en centavos.
 * @returns El estado del presupuesto.
 */
export function estadoDe( gastado: number , limite: number ): EstadoPresupuesto {
  if( limite <= 0 ) {
    return( (gastado > 0) ? "excedido" : "en_orden" ) ;
  }

  if( (gastado * 100) < (limite * 85) ) {
    return( "en_orden" ) ;
  }

  if( (gastado * 100) <= (limite * 100) ) {
    return( "en_alerta" ) ;
  }

  return( "excedido" ) ;
}

/**
 * Porcentaje redondeado para mostrar. No se usa para decidir el estado.
 *
 * @param gastado - Gasto en centavos.
 * @param limite - Límite en centavos.
 * @returns Porcentaje entero (0 si el límite no es positivo).
 */
export function porcentajeDe( gastado: number , limite: number ): number {
  return( (limite > 0) ? Math.round( (gastado * 100) / limite ) : 0 ) ;
}

/**
 * Marca los sub-límites: presupuestos de una hoja cuyo padre también está presupuestado
 * en la misma divisa (RN-13, RN-14). El resto son raíces.
 *
 * @param presupuestos - Presupuestos a clasificar (los activos del mes).
 * @param arbol - Árbol de categorías de dos niveles.
 * @returns Conjunto con los `budgetId` que son sub-límites.
 */
export function raicesYSublimites(
  presupuestos: { budgetId: string ; categoryId: string ; currency: string }[] ,
  arbol:        CategoryTreeNode[]
): Set< string > {
  const padreDeHoja = new Map< string , string >() ;
  for( const padre of arbol ) {
    for( const hoja of padre.children ) {
      padreDeHoja.set( hoja.id , padre.id ) ;
    }
  }

  const presupuestados = new Set< string >( presupuestos.map( ( p ) => { return( `${p.currency}|${p.categoryId}` ) ; } ) ) ;
  const sublimites     = new Set< string >() ;

  for( const p of presupuestos ) {
    const padreId = padreDeHoja.get( p.categoryId ) ;
    if( padreId && presupuestados.has( `${p.currency}|${padreId}` ) ) {
      sublimites.add( p.budgetId ) ;
    }
  }

  return( sublimites ) ;
}

/**
 * Resume el mes: límites y gasto totales sólo de las raíces (el gasto de una hoja con padre
 * presupuestado ya está dentro del padre: no se cuenta dos veces, AC-8). Los contadores
 * incluyen todos los presupuestos, son categorías y no dinero.
 *
 * @param evaluados - Presupuestos ya evaluados del mes.
 * @returns El resumen del mes.
 */
export function resumen( evaluados: PresupuestoEvaluado[] ): ResumenPresupuestos {
  let limiteTotal  = 0 ;
  let gastadoTotal = 0 ;
  let excedidas    = 0 ;
  let enAlerta     = 0 ;

  for( const p of evaluados ) {
    if( !p.esSublimite ) {
      limiteTotal  += p.limite ;
      gastadoTotal += p.gastado ;
    }
    if( p.estado === "excedido" ) {
      excedidas++ ;
    } else if( p.estado === "en_alerta" ) {
      enAlerta++ ;
    }
  }

  return( {
    limiteTotal ,
    gastadoTotal ,
    restanteTotal: limiteTotal - gastadoTotal ,
    porcentaje:    porcentajeDe( gastadoTotal , limiteTotal ) ,
    excedidas ,
    enAlerta ,
  } ) ;
}
