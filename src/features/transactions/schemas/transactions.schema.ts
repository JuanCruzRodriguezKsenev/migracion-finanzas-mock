/**
 * @file transactions.schema.ts
 * Esquemas de validación Zod para el módulo de transacciones y libro diario.
 */
// Librerías externas
import { z } from "zod" ;


/**
 * Esquema de validación para el formulario de alta de transacciones en la interfaz.
 */
export const createTransactionFormSchema = z.object( {
  description:          z.string().min( 3 , "La descripción debe tener al menos 3 caracteres." ).max( 255 ) ,
  type:                 z.enum( [ "income" , "expense" , "transfer" ] ) ,
  amount:               z.number().positive( "El monto debe ser superior a cero." ) ,
  sourceAccountId:      z.string().uuid( "Seleccioná una cuenta válida." ) ,
  destinationAccountId: z.string().uuid( "Seleccioná una cuenta de destino válida." ).optional() ,
  categoryId:           z.string().uuid( "La categoría seleccionada no es válida." ).optional().nullable() ,
  merchantName:         z.string().max( 150 , "El nombre del comercio no puede superar los 150 caracteres." ).optional().nullable() ,
  occurredAt:           z.coerce.date().optional() ,
} ).refine(
  ( data ) => {
    if( data.type === "transfer" ) {
      return( Boolean( data.destinationAccountId && (data.destinationAccountId !== data.sourceAccountId) ) ) ;
    }
    return( true ) ;
  } ,
  {
    message: "Para transferencias debe seleccionar dos cuentas distintas." ,
    path:    [ "destinationAccountId" ] ,
  }
) ;

export type CreateTransactionFormData = z.infer< typeof createTransactionFormSchema > ;

/**
 * Esquema para la edición de metadatos de una transacción existente.
 */
export const updateTransactionMetadataSchema = z.object( {
  transactionId: z.string().uuid() ,
  description:   z.string().min( 3 , "La descripción debe tener al menos 3 caracteres." ).max( 255 ).optional() ,
  categoryId:    z.string().uuid().optional().nullable() ,
  merchantName:  z.string().max( 150 ).optional().nullable() ,
  occurredAt:    z.coerce.date().optional() ,
} ) ;

export type UpdateTransactionMetadataInput = z.infer< typeof updateTransactionMetadataSchema > ;
