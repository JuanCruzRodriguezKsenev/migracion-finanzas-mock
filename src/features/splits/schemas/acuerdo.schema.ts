/**
 * @file acuerdo.schema.ts
 * Esquemas de validación Zod de las acciones del acuerdo de reparto.
 */
// Librerías externas
import { z } from "zod" ;


/** Modos del acuerdo (RN-12): no hay tipos de organización, sólo un modo de reparto. */
export const MODOS_ACUERDO = [ "none" , "fixed_percentages" , "monthly_contributions" ] as const ;

/** Acuerdo que guarda un `owner`. Los porcentajes van en puntos básicos enteros (S-Q); las cuentas de la caja común (S-AG), en ids. */
export const guardarAcuerdoSchema = z.object( {
  modo:          z.enum( MODOS_ACUERDO , { error: "El modo de reparto no es válido." } ) ,
  usesCommonPot: z.boolean() ,
  porcentajes:   z.array( z.object( {
    userId:       z.string().uuid( "Miembro inválido." ) ,
    percentageBp: z.number().int( "Cada porcentaje debe tener hasta dos decimales." ).min( 0 , "Cada porcentaje debe estar entre 0 y 100." ).max( 10000 , "Cada porcentaje debe estar entre 0 y 100." ) ,
  } ) ).max( 500 ) ,
  cuentasCajaIds: z.array( z.string().uuid( "Cuenta inválida para la caja común." ) ).max( 50 ).default( [] ) ,
} ) ;

/** Entrada de `guardarAcuerdoAction`: `cuentasCajaIds` es opcional (por omisión, ninguna). */
export type GuardarAcuerdoInput = z.input< typeof guardarAcuerdoSchema > ;

/** Aporte mensual de un miembro, en centavos enteros `>= 0`. */
export const declararAporteSchema = z.object( {
  userId:        z.string().uuid( "Miembro inválido." ).optional() ,
  year:          z.number().int().min( 2000 , "Año inválido." ).max( 2200 , "Año inválido." ) ,
  month:         z.number().int().min( 1 , "Mes inválido." ).max( 12 , "Mes inválido." ) ,
  amountInCents: z.number().int( "El aporte debe ser un número entero de centavos." ).min( 0 , "El aporte no puede ser negativo." ).max( Number.MAX_SAFE_INTEGER ) ,
} ) ;

export type DeclararAporteInput = z.infer< typeof declararAporteSchema > ;

/** Datos del gasto en el formulario para la vista previa del reparto. */
export const previsualizarSchema = z.object( {
  tipo:            z.string().min( 1 ).max( 20 ) ,
  montoEnCentavos: z.number().int().min( 0 ).max( Number.MAX_SAFE_INTEGER ) ,
  currency:        z.string().min( 1 ).max( 10 ) ,
  fecha:           z.string().min( 1 ).max( 40 ).optional() ,
  holderUserId:    z.string().uuid().optional() ,
  accountIds:      z.array( z.string().uuid() ).max( 50 ) ,
} ) ;

export type PrevisualizarInput = z.infer< typeof previsualizarSchema > ;
