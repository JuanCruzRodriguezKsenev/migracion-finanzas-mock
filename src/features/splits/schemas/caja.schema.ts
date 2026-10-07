/**
 * @file caja.schema.ts
 * Esquema de validación Zod del registro de un aporte o retiro de la caja común.
 */
// Librerías externas
import { z } from "zod" ;


/**
 * Aporte o retiro: el monto va con signo (positivo = aporte, negativo = retiro) en centavos enteros distintos de
 * cero. `userId` es opcional: por omisión, quien llama.
 */
export const registrarAporteCajaSchema = z.object( {
  userId:        z.string().uuid( "Miembro inválido." ).optional() ,
  currency:      z.string().min( 1 , "Divisa inválida." ).max( 10 , "Divisa inválida." ) ,
  amountInCents: z.number().int( "El monto debe ser un número entero de centavos." ).refine( ( n ) => (n !== 0) , "El monto no puede ser cero." ).refine( Number.isSafeInteger , "El monto es demasiado grande." ) ,
  note:          z.string().max( 200 , "La nota admite hasta 200 caracteres." ).optional() ,
} ).strict() ;

export type RegistrarAporteCajaInput = z.input< typeof registrarAporteCajaSchema > ;
