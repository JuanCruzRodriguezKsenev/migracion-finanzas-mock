/**
 * @file profile.schema.ts
 * Esquema de validación en runtime para la actualización del perfil y preferencias de usuario.
 */
// Librerías externas
import { z } from "zod" ;

// Feature: Profile
import {
  CURRENCY_CODES ,
  TIMEZONE_CODES ,
  NUMBER_FORMAT_CODES ,
  WEEKLY_START_CODES ,
  DEFAULT_VIEW_CODES ,
} from "../preferences" ;

/**
 * Esquema de validación estricto para la actualización parcial del perfil.
 * Solo admite campos de contacto y preferencias configurables, excluyendo y rechazando
 * explícitamente los campos comerciales de suscripción (planName, planBilling, planNextCharge).
 */
export const updateProfileSchema = z.object( {
  phone:            z.string().max( 50 ).nullable().optional() ,
  bio:              z.string().nullable().optional() ,
  currency:         z.enum( CURRENCY_CODES ).optional() ,
  timezone:         z.enum( TIMEZONE_CODES ).optional() ,
  theme:            z.enum( [ "light" , "dark" , "system" ] ).optional() ,
  defaultView:      z.enum( DEFAULT_VIEW_CODES ).optional() ,
  fastLogin:        z.boolean().optional() ,
  weeklyStart:      z.enum( WEEKLY_START_CODES ).optional() ,
  dateFormat:       z.string().max( 50 ).optional() ,
  numberFormat:     z.enum( NUMBER_FORMAT_CODES ).optional() ,
  roundAmounts:     z.boolean().optional() ,
  includeTransfers: z.boolean().optional() ,
  defaultAccount:   z.string().max( 100 ).nullable().optional() ,
} ).strict() ;

/**
 * Tipo inferido de los datos válidos para actualización de perfil.
 */
export type UpdateProfileInput = z.infer< typeof updateProfileSchema > ;
