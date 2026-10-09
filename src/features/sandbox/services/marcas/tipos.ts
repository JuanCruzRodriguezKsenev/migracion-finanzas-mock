/**
 * @file tipos.ts
 * Definición de tipos e interfaces para el Laboratorio de Marcas del Sandbox.
 */

export type IdEstrategiaDominio = "brandfetch-search" | "wikidata" | "duckduckgo" | "candidatos" ;

export type IdEstrategiaIcono =
  | "sitio"
  | "wikidata-logo"
  | "google-s2"
  | "ddg-icons"
  | "icon-horse"
  | "brandfetch-cdn"
  | "brandfetch-search-icon" ;

/**
 * Representa un dominio candidato detectado por una estrategia de dominio.
 */
export interface CandidatoDominio {
  dominio:          string ;
  nombre?:          string ;
  detalle?:         string ;
  iconoBrandfetch?: string ;
  archivoLogo?:     string ;
  resuelve?:        boolean ;
}

/**
 * Resultado devuelto por una estrategia de búsqueda de dominios.
 */
export interface ResultadoDominios {
  estrategia: IdEstrategiaDominio ;
  ok:         boolean ;
  ms:         number ;
  estado:     string ;
  candidatos: CandidatoDominio[] ;
}

// Shared: Brand
import type { CandidatoIcono } from "@/shared/services/brand/tiposMarca" ;

export type { CandidatoIcono } ;

/**
 * Resultado devuelto por una estrategia de resolución de íconos.
 */
export interface ResultadoIcono {
  estrategia: IdEstrategiaIcono ;
  modo:       "servidor" | "navegador" ;
  ok:         boolean ;
  ms:         number ;
  estado:     string ;
  url?:       string ;
  dataUri?:   string ;
  mime?:      string ;
  bytes?:     number ;
  origen?:    string ;
  color?:     string ;
  hallados?:  CandidatoIcono[] ;
}
