/**
 * @file loans.schema.ts
 * Esquema de validación en runtime para la creación y gestión de préstamos (RFC 008).
 * Valida la invariante de contraparte (entityId XOR contactId) y el cronograma de amortización.
 */
// Librerías externas
import { z } from "zod" ;


/**
 * Direcciones posibles de un préstamo en el sistema.
 */
export const LOAN_DIRECTIONS = [ "borrowed" , "lent" ] as const ;

/**
 * Frecuencias admitidas para los vencimientos de cuotas.
 */
export const LOAN_FREQUENCIES = [ "weekly" , "monthly" , "quarterly" , "yearly" , "custom" ] as const ;

/**
 * Esquema de validación para el alta de un préstamo (otorgado o recibido).
 */
export const createLoanSchema = z.object( {
  name:                   z.string().min( 1 , "El nombre del préstamo es obligatorio." ).max( 150 , "Máximo 150 caracteres." ) ,
  direction:              z.enum( LOAN_DIRECTIONS , { message: "La dirección debe ser 'borrowed' o 'lent'." } ) ,
  entityId:               z.string().uuid( "ID de entidad financiera inválido." ).nullable().optional() ,
  contactId:              z.string().uuid( "ID de contacto inválido." ).nullable().optional() ,
  principalAmount:        z.number().int( "El capital debe ser un número entero de centavos." ).positive( "El capital debe ser mayor a cero." ) ,
  currency:               z.string().length( 3 , "La moneda debe tener exactamente 3 caracteres (ej: ARS, USD)." ).default( "ARS" ) ,
  interestRateAnnual:     z.number().int( "La tasa debe ser un entero en puntos básicos." ).nonnegative( "La tasa no puede ser negativa." ).default( 0 ) ,
  totalInstallments:      z.number().int( "La cantidad de cuotas debe ser un número entero." ).min( 1 , "Debe tener al menos 1 cuota." ).default( 1 ) ,
  frequency:              z.enum( LOAN_FREQUENCIES , { message: "Frecuencia de cuotas no soportada." } ).default( "monthly" ) ,
  intervalCount:          z.number().int( "El intervalo debe ser un número entero." ).min( 1 , "El intervalo debe ser al menos 1." ).default( 1 ) ,
  startDate:              z.coerce.date( { message: "Fecha de desembolso inválida." } ) ,
  firstInstallmentDate:   z.string().regex( /^\d{4}-\d{2}-\d{2}$/ , "La primera cuota debe tener formato YYYY-MM-DD." ) ,
  disbursementAccountId: z.string().uuid( "ID de cuenta de desembolso inválido." ).nullable().optional() ,
  resolvedThrough:        z.string().regex( /^\d{4}-\d{2}-\d{2}$/ , "Formato de fecha inválido (YYYY-MM-DD)." ).nullable().optional()
} ).strict().superRefine( ( data , ctx ) => {
  const hasEntity  = Boolean( data.entityId ) ;
  const hasContact = Boolean( data.contactId ) ;

  // Invariante de contraparte: entityId XOR contactId (exactamente uno debe estar presente)
  if( (hasEntity && hasContact) || (!hasEntity && !hasContact) ) {
    ctx.addIssue( {
      code:    z.ZodIssueCode.custom ,
      message: "Debe especificarse exactamente una contraparte: entidad financiera o contacto, nunca ambas ni ninguna." ,
      path:    [ "entityId" ]
    } ) ;
  }
} ) ;

export type CreateLoanInput = z.input< typeof createLoanSchema > ;

/**
 * Esquema de validación para el pago o cobro de una cuota de préstamo.
 */
export const payLoanInstallmentSchema = z.object( {
  loanId:            z.string().uuid( "ID de préstamo inválido." ) ,
  paymentAccountId:  z.string().uuid( "ID de cuenta de pago inválido." ) ,
  installmentNumber: z.number().int( "El número de cuota debe ser un entero." ).min( 1 , "El número de cuota debe ser al menos 1." ) ,
  hoyCivil:          z.string().regex( /^\d{4}-\d{2}-\d{2}$/ , "Formato civil inválido (YYYY-MM-DD)." ).optional()
} ).strict() ;

export type PayLoanInstallmentInput = z.input< typeof payLoanInstallmentSchema > ;
