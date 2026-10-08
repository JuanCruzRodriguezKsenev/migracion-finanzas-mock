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
  type:                 z.enum( [ "income" , "expense" , "transfer" , "exchange" ] ) ,
  amount:               z.number().positive( "El monto debe ser superior a cero." ) ,
  sourceAccountId:      z.string().uuid( "Seleccioná una cuenta válida." ) ,
  destinationAccountId: z.string().uuid( "Seleccioná una cuenta de destino válida." ).optional() ,
  categoryId:           z.string().uuid( "La categoría seleccionada no es válida." ).optional().nullable() ,
  merchantName:         z.string().max( 150 , "El nombre del comercio no puede superar los 150 caracteres." ).optional().nullable() ,
  occurredAt:           z.coerce.date().optional() ,
  currency:             z.string().max( 10 ).optional() ,
  /** A nombre de quién se carga (RN-2). Opcional: sin él, el titular es quien carga. */
  holderUserId:         z.string().uuid( "El titular elegido no es válido." ).optional().nullable() ,
  /** Si el titular absorbe el gasto en vez de repartir la deuda (RN-19). */
  absorbeElDueno:       z.boolean().optional() ,
  /**
   * Importe recibido, en la moneda de la cuenta de destino. Sólo aplica a `exchange`: en un cambio
   * de divisas los dos lados tienen importes distintos, y la cotización se deduce de su cociente
   * en vez de guardarse aparte, para que no pueda contradecir a los asientos.
   */
  destinationAmount:    z.number().positive( "El importe recibido debe ser superior a cero." ).optional() ,
} ).refine(
  ( data ) => {
    if( (data.type === "transfer") || (data.type === "exchange") ) {
      return( Boolean( data.destinationAccountId && (data.destinationAccountId !== data.sourceAccountId) ) ) ;
    }
    return( true ) ;
  } ,
  {
    message: "Para transferencias y cambios debe seleccionar dos cuentas distintas." ,
    path:    [ "destinationAccountId" ] ,
  }
).refine(
  ( data ) => {
    if( data.type === "exchange" ) {
      return( Boolean( data.destinationAmount && (data.destinationAmount > 0) ) ) ;
    }
    return( true ) ;
  } ,
  {
    message: "Indicá cuánto recibís en la moneda de destino." ,
    path:    [ "destinationAmount" ] ,
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
