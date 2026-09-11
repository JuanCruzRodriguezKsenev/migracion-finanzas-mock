/**
 * @file accounting.schema.ts
 * Esquemas de validación de datos en runtime para el módulo contable usando Zod.
 */

// Librerías externas
import { z } from "zod" ;

/**
 * Esquema de validación en runtime para la creación de una transacción contable.
 * Exige una estructura balanceada que respete el principio de partida doble.
 */
export const createTransactionSchema = z.object( {
  categoryId:     z.string().uuid( "El ID de categoría debe ser un UUID válido." ).nullable().optional() ,
  description:    z.string().min( 3   , "La descripción debe tener al menos 3 caracteres."             ).max( 255 , "La descripción no puede superar los 255 caracteres." ) ,
  merchantName:   z.string().max( 150 , "El nombre del comercio no puede superar los 150 caracteres."  ).optional().nullable() ,
  merchantDomain: z.string().max( 100 , "El dominio del comercio no puede superar los 100 caracteres." ).optional().nullable() ,
  occurredAt:     z.coerce.date().optional() ,
  
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
    const totalDebits  = data.entries.reduce( (acc , entry) => (acc + entry.debit ) , 0 ) ;
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

/**
 * Esquema de validación en runtime para la creación de una cuenta contable.
 */
export const createAccountSchema = z.object( {
  name:     z.string().min( 2 , "El nombre de la cuenta debe tener al menos 2 caracteres." ).max( 150 ) ,
  type:     z.enum( [ "asset" , "liability" ] , {
    error: "El tipo de cuenta debe ser asset o liability." ,
  } ) ,
  code:     z.string().max( 50 ).optional() ,
  balance:  z.number().int( "El saldo debe expresarse en centavos enteros." ).optional() ,
  currency: z.string().max( 10 ).optional() ,
  entityId: z.string().uuid( "El ID de entidad debe ser un UUID válido." ).optional().nullable() ,
} ) ;

/**
 * Tipo para la entrada de creación de cuentas inferido del esquema de Zod.
 */
export type CreateAccountInput = z.infer< typeof createAccountSchema > ;

/**
 * Esquema de validación en runtime para la creación de una entidad financiera.
 */
export const createFinancialEntitySchema = z.object( {
  name:        z.string().min( 2 , "El nombre de la entidad debe tener al menos 2 caracteres." ).max( 150 ) ,
  logo:        z.string().max( 100 ).optional().nullable() ,
  brandDomain: z.string().max( 100 ).optional().nullable() ,
  color:       z.string().regex( /^#[0-9A-Fa-f]{6}$/ , "El color debe ser un hexadecimal válido (#RRGGBB)." ).optional().nullable() ,
} ) ;

/**
 * Tipo para la entrada de creación de entidades inferido del esquema de Zod.
 */
export type CreateFinancialEntityInput = z.infer< typeof createFinancialEntitySchema > ;

/**
 * Esquema de validación en runtime para la creación de una cuenta contable vinculada a una entidad financiera.
 */
export const createAccountForEntitySchema = z.object( {
  entityId: z.string().uuid( "El ID de entidad debe ser un UUID válido." ) ,
  balance:  z.number().int( "El saldo inicial debe expresarse en centavos enteros." ).nonnegative( "El saldo inicial no puede ser negativo." ).optional() ,
} ) ;

/**
 * Tipo para la entrada de creación de cuentas vinculadas a entidades inferido de Zod.
 */
export type CreateAccountForEntityInput = z.infer< typeof createAccountForEntitySchema > ;