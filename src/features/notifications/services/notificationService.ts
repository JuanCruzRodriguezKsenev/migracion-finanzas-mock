/**
 * @file notificationService.ts
 * Decisiones de a quién se avisa (funciones puras) y la emisión de avisos dentro de la transacción del hecho.
 */
// Shared
import { DBOrTx } from "@/shared/db/client" ;

// Feature: Notifications
import { notificationRepository } from "../repositories/notificationRepository" ;
import type { TipoAviso }         from "../types" ;


/**
 * Destinatarios de una carga a nombre de otra persona (RN-9a, RN-10).
 * Sólo se avisa al titular, y sólo si es distinto de quien cargó: quien provoca el hecho no se avisa a sí mismo.
 *
 * @param params - Autor del movimiento y titular (ambos pueden faltar).
 * @returns El titular, o ninguno.
 */
export function destinatariosDeCarga( params: { autorId?: string | null ; titularId?: string | null } ): string[] {
  const { autorId , titularId } = params ;

  if( !titularId || (titularId === autorId) ) {
    return( [] ) ;
  }

  return( [ titularId ] ) ;
}

/**
 * Destinatarios del reverso de un movimiento (RN-9f, S-K): el titular y el autor de la original,
 * sin nulos, sin repetir y sin el actor.
 *
 * @param params - Quien reversa, titular y autor de la original.
 * @returns Ids de los destinatarios.
 */
export function destinatariosDeReverso( params: { actorId?: string | null ; titularId?: string | null ; autorOriginalId?: string | null } ): string[] {
  const { actorId , titularId , autorOriginalId } = params ;
  const candidatos = [ titularId , autorOriginalId ] ;
  const resultado: string[] = [] ;

  for( const id of candidatos ) {
    if( id && (id !== actorId) && !resultado.includes( id ) ) {
      resultado.push( id ) ;
    }
  }

  return( resultado ) ;
}

/** Datos para emitir un aviso a cada destinatario. */
export interface EmitirAviso {
  organizationId: string ;
  tipo:           TipoAviso ;
  actorId?:       string | null ;
  transactionId:  string ;
  monto?:         number | null ;
  divisa?:        string | null ;
  destinatarios:  string[] ;
}

/**
 * Inserta un aviso por destinatario (RN-9). Debe llamarse con la transacción de BD del hecho,
 * para que el aviso y el hecho sean atómicos.
 *
 * @param datos - Tipo, referencias, foto del monto y destinatarios.
 * @param tx - Transacción activa.
 */
export async function notificar( datos: EmitirAviso , tx: DBOrTx ): Promise< void > {
  const { organizationId , tipo , actorId , transactionId , monto , divisa , destinatarios } = datos ;

  await notificationRepository.insertar(
    destinatarios.map( ( recipientUserId ) => ( {
      organizationId ,
      recipientUserId ,
      type:          tipo ,
      actorUserId:   actorId ?? null ,
      transactionId ,
      amountInCents: monto ?? null ,
      currency:      divisa ?? null ,
    } ) ) ,
    tx
  ) ;
}
