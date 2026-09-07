/**
 * @file contacts.schema.ts
 * Esquemas de validación Zod para formularios de Contactos y Métodos de Cobro.
 * Integra validadores puros para CBU/CVU, Alias y CUIT.
 */
// Librerías externas
import { z } from "zod" ;

// Feature: Contacts
import {
  validarCbu ,
  validarAlias ,
  validarCuit ,
  normalizarCbu ,
  normalizarAlias ,
  normalizarCuit
} from "../utils/identificadores" ;


/**
 * Esquema de validación para creación y edición de contactos.
 */
export const contactFormSchema = z.object( {
  name: z
    .string( { message: "El nombre es obligatorio." } )
    .trim()
    .min( 2 , "El nombre debe tener al menos 2 caracteres." )
    .max( 150 , "El nombre no puede exceder 150 caracteres." ) ,
  email: z
    .string()
    .trim()
    .email( "El formato del correo electrónico es inválido." )
    .optional()
    .or( z.literal( "" ) ) ,
  phone: z
    .string()
    .trim()
    .max( 50 , "El teléfono no puede exceder 50 caracteres." )
    .optional()
    .or( z.literal( "" ) ) ,
  notes: z
    .string()
    .trim()
    .max( 1000 , "Las notas no pueden exceder 1000 caracteres." )
    .optional()
    .or( z.literal( "" ) ) ,
} ) ;

export type ContactFormData = z.infer< typeof contactFormSchema > ;

/**
 * Esquema de validación para alta de métodos de cobro.
 * Requiere que se indique al menos un CBU/CVU válido o un Alias válido.
 */
export const paymentMethodFormSchema = z
  .object( {
    financialEntityId: z
      .string( { message: "La entidad financiera es obligatoria." } )
      .uuid( "ID de entidad financiera inválido." ) ,
    type: z
      .enum( [ "bank_account" , "wallet" ] , {
        error: "El tipo debe ser 'bank_account' o 'wallet'." ,
      } )
      .default( "wallet" ) ,
    cbuCvu: z
      .string()
      .optional()
      .transform( ( val ) => ( val ? normalizarCbu( val ) : "" ) )
      .refine(
        ( val ) => !val || validarCbu( val ) ,
        { message: "El CBU/CVU ingresado no es válido según los dígitos verificadores del BCRA." }
      ) ,
    alias: z
      .string()
      .optional()
      .transform( ( val ) => ( val ? normalizarAlias( val ) : "" ) )
      .refine(
        ( val ) => !val || validarAlias( val ) ,
        { message: "El Alias debe tener entre 6 y 20 caracteres y contener solo letras, números, puntos o guiones." }
      ) ,
    holderName: z
      .string()
      .trim()
      .max( 150 , "El nombre del titular no puede exceder 150 caracteres." )
      .optional()
      .or( z.literal( "" ) ) ,
    holderTaxId: z
      .string()
      .optional()
      .transform( ( val ) => ( val ? normalizarCuit( val ) : "" ) )
      .refine(
        ( val ) => !val || validarCuit( val ) ,
        { message: "El CUIT/CUIL del titular es inválido (debe cumplir módulo 11 de AFIP)." }
      ) ,
    isDefault: z.boolean().default( false ) ,
  } )
  .refine(
    ( data ) => ( ( data.cbuCvu && ( data.cbuCvu.length > 0 ) ) || ( data.alias && ( data.alias.length > 0 ) ) ) ,
    {
      message: "Debe ingresar al menos un CBU/CVU o un Alias para registrar la cuenta de cobro." ,
      path:    [ "alias" ] ,
    }
  ) ;

export type PaymentMethodFormData  = z.infer< typeof paymentMethodFormSchema > ;
export type PaymentMethodFormInput = z.input< typeof paymentMethodFormSchema > ;
