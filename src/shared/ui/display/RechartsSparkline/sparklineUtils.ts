/**
 * @file sparklineUtils.ts
 * Utilidades puras para formateo, puntos de serie y cálculo de porcentajes en Sparklines.
 * Módulo isomórfico (apto para Server Components y Client Components).
 */

/**
 * Representa un punto de la serie temporal del Sparkline con su clave de mes explícita.
 */
export interface SparklinePoint {
  value:    number ;
  monthKey: string ; // Formato: "YYYY-MM"
}

/**
 * Formatea una clave "YYYY-MM" a etiqueta legible internacionalizada ("May 26" / "May. 26").
 */
export function formatMonthKeyLabel( monthKey: string , lang: string = "es" ): string {
  const parts = monthKey.split( "-" ) ;
  if( parts.length !== 2 ) {
    return( monthKey ) ;
  }
  const year  = parseInt( parts[0] , 10 ) ;
  const month = parseInt( parts[1] , 10 ) ;
  if( isNaN( year ) || isNaN( month ) ) {
    return( monthKey ) ;
  }
  const date   = new Date( year , month - 1 , 1 ) ;
  const locale = lang === "en" ? "en-US" : lang === "br" ? "pt-BR" : "es-ES" ;
  const mStr   = date.toLocaleDateString( locale , {month: "short"} ) ;
  const yStr   = date.toLocaleDateString( locale , {year: "2-digit"} ) ;
  const cleanMonth     = mStr.replace( "." , "" ) ;
  const formattedMonth = ( cleanMonth.charAt( 0 ).toUpperCase() + cleanMonth.slice( 1 ) ) ;
  return( `${formattedMonth} ${yStr}` ) ;
}

/**
 * Calcula el cambio porcentual entre dos valores numéricos.
 * Retorna null si no hay valor anterior o si el valor anterior es 0 (evita porcentajes inventados).
 */
export function calcularCambioPorcentual(
  actual:   number ,
  anterior: number | null | undefined
): number | null {
  if( (anterior === null) || (anterior === undefined) || (anterior === 0) ) {
    return( null ) ;
  }
  return( ((actual - anterior) / Math.abs( anterior )) * 100 ) ;
}
