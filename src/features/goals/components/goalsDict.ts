/**
 * @file goalsDict.ts
 * Tipo del diccionario de Metas, sustitución de marcadores y formateo de importes y fechas de los componentes.
 */
// Librerías externas
import { useContext } from "react" ;

// Shared
import { MetricsVisibilityContext } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { formatCurrency }           from "@/shared/lib/currencyFormatter" ;
import type { getDictionary }       from "@/shared/lib/dictionary" ;


export type GoalsPageDict = Awaited< ReturnType< typeof getDictionary > >["goalsPage"] ;

/** Texto que reemplaza a un importe cuando el ojito está cerrado. */
export const HIDDEN_AMOUNT = "••••••" ;

/** Locale de formateo según el idioma de la ruta. */
export function localeDe( lang: string ): string {
  return( lang === "en" ? "en-US" : lang === "br" ? "pt-BR" : "es-AR" ) ;
}

/**
 * Reemplaza los marcadores `{clave}` de una plantilla del diccionario.
 *
 * @param template - Texto con marcadores.
 * @param vars - Valores por clave.
 */
export function fmt( template: string , vars: Record< string , string | number > ): string {
  return( template.replace( /\{(\w+)\}/g , ( whole , key: string ) => {
    return( key in vars ? String( vars[ key ] ) : whole ) ;
  } ) ) ;
}

/** Fecha civil `YYYY-MM-DD` formateada sin corrimientos de zona horaria. */
export function formatCivilDate( civil: string , locale: string ): string {
  const [ y , m , d ] = civil.split( "-" ).map( Number ) ;
  return( new Intl.DateTimeFormat( locale , { year: "numeric" , month: "short" , day: "numeric" , timeZone: "UTC" } ).format( new Date( Date.UTC( y , (m - 1) , d , 12 ) ) ) ) ;
}

/** Instante formateado como fecha corta en el locale. */
export function formatInstant( value: Date | string , locale: string ): string {
  return( new Intl.DateTimeFormat( locale , { year: "numeric" , month: "short" , day: "numeric" } ).format( new Date( value ) ) ) ;
}

/**
 * Hook: devuelve el formateador de importes de Metas, que respeta el ojito (RN-20 / AC-17).
 *
 * @param locale - Locale de formateo.
 */
export function useGoalMoney( locale: string ): ( cents: number , currency: string ) => string {
  const { isContentVisible } = useContext( MetricsVisibilityContext ) ;
  return( ( cents , currency ) => {
    return( isContentVisible ? formatCurrency( cents , currency , locale ) : HIDDEN_AMOUNT ) ;
  } ) ;
}
