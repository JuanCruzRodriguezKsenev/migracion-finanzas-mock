/**
 * @file accounting.schema.ts
 * Esquemas de validación de datos en runtime para el módulo contable usando Zod.
 */
import { z } from "zod" ;

/**
 * Esquema de validación en runtime para la creación de una transacción contable.
 * Exige una estructura balanceada que respete el principio de partida doble.
 */
export const createTransactionSchema = z.object( {
  categoryId:     z.string().uuid( "El ID de categoría debe ser un UUID válido." ).nullable().optional() ,
  description:    z.string().min( 3 , "La descripción debe tener al menos 3 caracteres." ).max( 255 , "La descripción no puede superar los 255 caracteres." ) ,
  merchantName:   z.string().max( 150 , "El nombre del comercio no puede superar los 150 caracteres." ).optional().nullable() ,
  merchantDomain: z.string().max( 100 , "El dominio del comercio no puede superar los 100 caracteres." ).optional().nullable() ,
  
  // Apuntes contables (Mínimo deben ser 2 para cumplir partida doble)
  entries: z.array(
    z.object( {
      accountId: z.string().uuid( "El ID de cuenta debe ser un UUID válido." ) ,
      debit:     z.number().int( "El débito debe ser en centavos enteros." ).nonnegative( "El débito no puede ser negativo." ) ,
      credit:    z.number().int( "El crédito debe ser en centavos enteros." ).nonnegative( "El crédito no puede ser negativo." ) ,
      currency:  z.string().max( 10 ).optional().default( "ARS" ) ,
    } )
  ).min( 2 , "Una transacción contable requiere al menos dos líneas (Débito y Crédito)." ) ,
} ).refine(
  (data) => {
    // Validar en runtime la regla de la partida doble: Suma de Débitos == Suma de Créditos
    const totalDebits  = data.entries.reduce( (acc , entry) => (acc + entry.debit) , 0 ) ;
    const totalCredits = data.entries.reduce( (acc , entry) => (acc + entry.credit) , 0 ) ;
    
    return( totalDebits === totalCredits ) ;
  } ,
  {
    message: "Desbalance contable detectado: La suma de débitos debe ser exactamente igual a la suma de créditos." ,
    path: [ "entries" ] ,
  }
) ;

/**
 * Tipo para la entrada de creación de transacciones inferido del esquema de Zod.
 */
export type CreateTransactionInput = z.infer< typeof createTransactionSchema > ;