/**
 * @file reclamos.schema.ts
 * Esquemas de validación Zod de las acciones de reclamo de pago («Ya pagué») y su resolución.
 */
// Librerías externas
import { z } from "zod" ;


/** Reclamo de pago: el id del aviso desde el que se reclama y el monto en centavos enteros `> 0`. */
export const reclamarPagoSchema = z.object( {
  avisoId:         z.string().uuid( "Aviso inválido." ) ,
  montoEnCentavos: z.number().int( "El monto debe ser un número entero de centavos." ).positive( "El monto debe ser mayor que cero." ).refine( Number.isSafeInteger , "El monto es demasiado grande." ) ,
} ).strict() ;

export type ReclamarPagoInput = z.input< typeof reclamarPagoSchema > ;

/** Acción sobre un reclamo existente (confirmar, rechazar, cancelar). */
export const reclamoIdSchema = z.object( {
  reclamoId: z.string().uuid( "Reclamo inválido." ) ,
} ).strict() ;

export type ReclamoIdInput = z.input< typeof reclamoIdSchema > ;
