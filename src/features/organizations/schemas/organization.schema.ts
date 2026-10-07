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
