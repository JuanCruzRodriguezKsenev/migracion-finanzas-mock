/**
 * @file types.ts
 * Contratos del sistema de avisos (campana de notificaciones).
 */

/**
 * Tipos de aviso vigentes: carga a nombre del titular (RN-9a), reverso de un movimiento (RN-9f),
 * deuda a cargo por un gasto repartido (RN-9b), cambio del acuerdo de la organización (RN-9e),
 * solicitud de un pago (RN-9c) y pago registrado (RN-9d).
 */
export type TipoAviso = "charged_to_holder" | "transaction_reversed" | "debt_created" | "agreement_changed" | "payment_requested" | "payment_received" | "payment_claimed" | "payment_claim_rejected" ;

/**
 * Organización en la que el usuario participa, para el selector de la campana.
 */
export interface OrganizacionDeAvisos {
  id:         string ;
  nombre:     string ;
  esPersonal: boolean ;
}

/**
 * Aviso listo para mostrar. La interfaz arma el texto desde `tipo` y estos campos con el diccionario (NFR-4).
 */
export interface AvisoVista {
  id:                     string ;
  tipo:                   string ;
  actor:                  string | null ;
  titular:                string | null ;
  descripcion:            string ;
  montoEnCentavos:        number | null ;
  divisa:                 string | null ;
  leida:                  boolean ;
  creadaEn:               string ;
  organizacionId:         string ;
  organizacionNombre:     string ;
  organizacionEsPersonal: boolean ;
  accion?:
    | { tipo: "ya_pague" ; saldoEnCentavos: number ; reclamoPendienteId?: string }
    | { tipo: "responder_reclamo" ; reclamoId: string ; estado: "pending" | "confirmed" | "rejected" | "cancelled" } ;
}

/** Respuesta de la campana: los avisos recientes, el total de no leídas y las organizaciones del usuario. */
export interface ListadoAvisos {
  items:          AvisoVista[] ;
  noLeidas:       number ;
  organizaciones: OrganizacionDeAvisos[] ;
}
