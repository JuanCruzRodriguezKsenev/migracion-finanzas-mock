/**
 * @file saldos.schema.ts
 * Esquemas de validación Zod de las acciones de pagos y solicitudes de pago entre miembros.
 */
// Librerías externas
import { z } from "zod" ;


/** Registro de un pago: la contraparte (el deudor), la divisa y el monto en centavos enteros `> 0`. */
export const registrarPagoSchema = z.object( {
  contraparteId:   z.string().uuid( "Miembro inválido." ) ,
  divisa:          z.string().regex( /^[A-Z]{3,10}$/ , "Divisa inválida." ) ,
  montoEnCentavos: z.number().int( "El monto debe ser un número entero de centavos." ).positive( "El monto debe ser mayor que cero." ).refine( Number.isSafeInteger , "El monto es demasiado grande." ) ,
} ).strict() ;

export type RegistrarPagoInput = z.input< typeof registrarPagoSchema > ;

/** Solicitud de un pago: la contraparte (el deudor) y la divisa. */
export const solicitarPagoSchema = z.object( {
  contraparteId: z.string().uuid( "Miembro inválido." ) ,
  divisa:        z.string().regex( /^[A-Z]{3,10}$/ , "Divisa inválida." ) ,
} ).strict() ;

export type SolicitarPagoInput = z.input< typeof solicitarPagoSchema > ;
