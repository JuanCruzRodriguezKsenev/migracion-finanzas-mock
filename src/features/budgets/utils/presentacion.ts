/**
 * @file presentacion.ts
 * Helpers de presentación compartidos por los componentes de presupuestos.
 */
// Shared
import type { ProgressBarState } from "@/shared/ui/display/ProgressBar/ProgressBar" ;

// Feature: Budgets
import type { EstadoPresupuesto } from "../types" ;


/** Texto que reemplaza a un importe cuando el ojito está cerrado. */
export const MASCARA_IMPORTE = "••••••" ;

/**
 * Locale de formateo de números según el idioma de la ruta.
 */
export function localeDe( lang: string ): string {
  return( lang === "en" ? "en-US" : lang === "br" ? "pt-BR" : "es-AR" ) ;
}

/**
 * Estado visual de la barra para un estado de presupuesto.
 */
export function estadoABarra( estado: EstadoPresupuesto ): ProgressBarState {
  return( estado === "excedido" ? "danger" : estado === "en_alerta" ? "warning" : "ok" ) ;
}

/**
 * Reemplaza marcadores `{clave}` de una plantilla del diccionario.
 */
export function plantilla( texto: string , valores: Record< string , string | number > ): string {
  return( Object.entries( valores ).reduce( ( acc , [ clave , valor ] ) => {
    return( acc.split( `{${clave}}` ).join( String( valor ) ) ) ;
  } , texto ) ) ;
}
