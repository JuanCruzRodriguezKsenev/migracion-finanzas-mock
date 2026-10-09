/**
 * @file tiposMarca.ts
 * Definición de tipos compartidos para la detección y normalización de marcas.
 */

/**
 * Candidato a ícono extraído del HTML o manifiesto de un sitio.
 */
export interface CandidatoIcono {
  url:     string ;
  origen:  string ;
  tamano?: number ;
  tipo?:   string ;
}
