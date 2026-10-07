/**
 * @file organization.schema.ts
 * Esquemas de validación Zod para organizaciones, miembros e invitaciones (Spec Acceso con Google).
 */

// Librerías externas
import { z } from "zod" ;

/**
 * Roles que se pueden asignar al invitar a alguien.
 */
export const ROLES_INVITABLES = [ "owner" , "member" , "viewer" ] as const ;

/**
 * Esquema para crear una organización: nombre de 1 a 100 caracteres, recortado.
 */
export const crearOrganizacionSchema = z.object( {
  nombre: z.string().trim().min( 1 , "El nombre de la organización no puede estar vacío." ).max( 100 , "El nombre no puede superar los 100 caracteres." ) ,
} ) ;

export type CrearOrganizacionInput = z.infer< typeof crearOrganizacionSchema > ;

/**
 * Esquema para invitar a una persona por correo con un rol.
 */
export const invitarMiembroSchema = z.object( {
  email: z.string().trim().email( "El correo ingresado no es válido." ) ,
  rol:   z.enum( ROLES_INVITABLES , { error: "El rol debe ser 'owner', 'member' o 'viewer'." } ) ,
} ) ;

export type InvitarMiembroInput = z.infer< typeof invitarMiembroSchema > ;

/**
 * Esquema para renombrar la organización activa: nombre de 1 a 100 caracteres, recortado (RN-33).
 */
export const renombrarSchema = z.object( {
  nombre: z.string().trim().min( 1 , "El nombre de la organización no puede estar vacío." ).max( 100 , "El nombre no puede superar los 100 caracteres." ) ,
} ) ;

export type RenombrarInput = z.infer< typeof renombrarSchema > ;

/**
 * Esquema para cambiar el rol de un miembro (RN-31).
 */
export const cambiarRolSchema = z.object( {
  userId: z.string().uuid( "Miembro inválido." ) ,
  rol:    z.enum( ROLES_INVITABLES , { error: "El rol debe ser 'owner', 'member' o 'viewer'." } ) ,
} ) ;

export type CambiarRolInput = z.infer< typeof cambiarRolSchema > ;

/**
 * Esquema para eliminar la organización: el texto de confirmación se compara exacto en la acción (RN-35).
 */
export const eliminarSchema = z.object( {
  confirmacion: z.string() ,
} ) ;

export type EliminarInput = z.infer< typeof eliminarSchema > ;

/**
 * Esquema para otorgar o revocar una habilitación: sólo el miembro habilitado; el otorgante es la sesión (RN-6).
 */
export const habilitacionSchema = z.object( {
  habilitadoUserId: z.string().uuid( "Miembro inválido." ) ,
} ) ;

export type HabilitacionInput = z.infer< typeof habilitacionSchema > ;
