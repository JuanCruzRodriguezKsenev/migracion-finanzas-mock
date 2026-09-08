/**
 * @file cards.schema.ts
 * Esquema de validación en runtime para la creación y gestión de tarjetas (RFC 007).
 * Utiliza Zod en modo strict para cumplir PCI-DSS (rechazo expreso de CVV y PAN).
 */
// Librerías externas
import { z } from "zod" ;


/**
 * Redes de emisión admitidas.
 */
export const CARD_NETWORKS = [ "visa" , "mastercard" , "amex" , "other" ] as const ;

/**
 * Tipos de tarjetas reconocidas.
 */
export const CARD_TYPES = [ "credit" , "debit" ] as const ;

/**
 * Esquema de validación estricto para el alta de tarjetas.
 * Rechaza cualquier clave no reconocida (como cvv, pan o cardNumber) para salvaguarda PCI.
 */
export const createCardSchema = z.object( {
  label:                 z.string().min( 1 , "La etiqueta de la tarjeta es obligatoria." ).max( 100 , "Máximo 100 caracteres." ) ,
  type:                  z.enum( CARD_TYPES , { message: "Tipo de tarjeta inválido (credit o debit)." } ) ,
  network:               z.enum( CARD_NETWORKS , { message: "Red de tarjeta inválida." } ) ,
  entityId:              z.string().uuid( "ID de entidad inválido." ).nullable().optional() ,
  linkedAccountId:       z.string().uuid( "ID de cuenta vinculada inválido." ).nullable().optional() ,
  lastFour:              z.string().regex( /^\d{4}$/ , "Los últimos 4 dígitos deben ser exactamente 4 números." ) ,
  expiryMonth:           z.number().int().min( 1 , "Mes inválido." ).max( 12 , "Mes inválido." ) ,
  expiryYear:            z.number().int().min( 1000 , "Año de 4 dígitos requerido." ).max( 9999 , "Año inválido." ) ,
  currency:              z.string().min( 1 ).max( 10 ).default( "ARS" ) ,
  creditLimit:           z.number().int( "El límite debe ser entero." ).nonnegative( "El límite no puede ser negativo." ).nullable().optional() ,
  closingDay:            z.number().int().min( 1 , "El día de cierre debe estar entre 1 y 31." ).max( 31 , "El día de cierre debe estar entre 1 y 31." ).nullable().optional() ,
  dueDay:                z.number().int().min( 1 , "El día de vencimiento debe estar entre 1 y 31." ).max( 31 , "El día de vencimiento debe estar entre 1 y 31." ).nullable().optional() ,
  interestRateFinancing: z.number().int( "La tasa debe expresarse en puntos básicos enteros." ).nonnegative().nullable().optional() ,
  interestRatePenalty:   z.number().int( "La tasa debe expresarse en puntos básicos enteros." ).nonnegative().nullable().optional() ,
  monthlyMaintenanceFee: z.number().int().nonnegative().default( 0 ) ,
  annualRenewalFee:      z.number().int().nonnegative().default( 0 ) ,
  deudaInicial:          z.number().int().nonnegative().default( 0 ) ,
} ).strict().superRefine( ( data , ctx ) => {
  const now          = new Date() ;
  const currentYear  = now.getFullYear() ;
  const currentMonth = ( now.getMonth() + 1 ) ;

  // 1. Verificación de expiración
  if( (data.expiryYear < currentYear) || ((data.expiryYear === currentYear) && (data.expiryMonth < currentMonth)) ) {
    ctx.addIssue( {
      code:    z.ZodIssueCode.custom ,
      message: "La tarjeta se encuentra vencida." ,
      path:    [ "expiryYear" ] ,
    } ) ;
  }

  // 2. Reglas condicionales para tarjetas de débito
  if( data.type === "debit" ) {
    if( (data.closingDay !== undefined) && (data.closingDay !== null) ) {
      ctx.addIssue( {
        code:    z.ZodIssueCode.custom ,
        message: "Una tarjeta de débito no puede tener día de cierre." ,
        path:    [ "closingDay" ] ,
      } ) ;
    }
    if( (data.dueDay !== undefined) && (data.dueDay !== null) ) {
      ctx.addIssue( {
        code:    z.ZodIssueCode.custom ,
        message: "Una tarjeta de débito no puede tener día de vencimiento." ,
        path:    [ "dueDay" ] ,
      } ) ;
    }
    if( (data.creditLimit !== undefined) && (data.creditLimit !== null) && (data.creditLimit > 0) ) {
      ctx.addIssue( {
        code:    z.ZodIssueCode.custom ,
        message: "Una tarjeta de débito no puede tener límite de crédito." ,
        path:    [ "creditLimit" ] ,
      } ) ;
    }
    if( data.deudaInicial && (data.deudaInicial > 0) ) {
      ctx.addIssue( {
        code:    z.ZodIssueCode.custom ,
        message: "Una tarjeta de débito no puede tener deuda inicial." ,
        path:    [ "deudaInicial" ] ,
      } ) ;
    }
  }

  // 3. Reglas condicionales para tarjetas de crédito
  if( data.type === "credit" ) {
    if( (data.closingDay === undefined) || (data.closingDay === null) ) {
      ctx.addIssue( {
        code:    z.ZodIssueCode.custom ,
        message: "El día de cierre es obligatorio para tarjetas de crédito." ,
        path:    [ "closingDay" ] ,
      } ) ;
    }
    if( (data.dueDay === undefined) || (data.dueDay === null) ) {
      ctx.addIssue( {
        code:    z.ZodIssueCode.custom ,
        message: "El día de vencimiento es obligatorio para tarjetas de crédito." ,
        path:    [ "dueDay" ] ,
      } ) ;
    }
  }
} ) ;

/**
 * Tipo inferido de los datos válidos para creación de tarjetas.
 */
export type CreateCardInput = z.input< typeof createCardSchema > ;
