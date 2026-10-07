/**
 * @file types.ts
 * Contratos del sistema de avisos (campana de notificaciones).
 */

/** Tipos de aviso vigentes: carga a nombre del titular (RN-9a) y reverso de un movimiento (RN-9f). */
export type TipoAviso = "charged_to_holder" | "transaction_reversed" ;

/**
 * Aviso listo para mostrar. La interfaz arma el texto desde `tipo` y estos campos con el diccionario (NFR-4).
 */
export interface AvisoVista {
  id:              string ;
  tipo:            string ;
  actor:           string | null ;
  titular:         string | null ;
  descripcion:     string ;
  montoEnCentavos: number | null ;
  divisa:          string | null ;
  leida:           boolean ;
  creadaEn:        string ;
}

/** Respuesta de la campana: los avisos recientes y el total de no leídas. */
export interface ListadoAvisos {
  items:    AvisoVista[] ;
  noLeidas: number ;
}
