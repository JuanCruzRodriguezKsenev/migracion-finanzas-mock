/**
 * @file types.ts
 * Contratos del sistema de avisos (campana de notificaciones).
 */

/**
 * Tipos de aviso vigentes: carga a nombre del titular (RN-9a), reverso de un movimiento (RN-9f),
 * deuda a cargo por un gasto repartido (RN-9b) y cambio del acuerdo de la organización (RN-9e).
 */
export type TipoAviso = "charged_to_holder" | "transaction_reversed" | "debt_created" | "agreement_changed" ;

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
