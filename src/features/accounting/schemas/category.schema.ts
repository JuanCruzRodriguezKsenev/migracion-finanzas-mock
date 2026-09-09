/**
 * @file category.schema.ts
 * Esquemas de validación Zod para operaciones sobre Categorías Contables (RFC 022).
 */

// Librerías externas
import { z } from "zod" ;

/**
 * Esquema para la creación de una nueva categoría o subcategoría contable.
 */
export const createCategorySchema = z.object( {
  name:     z.string().min( 2 , "El nombre debe tener al menos 2 caracteres." ).max( 100 , "El nombre no puede superar los 100 caracteres." ) ,
  type:     z.enum( [ "expense" , "revenue" ] , {
    error: "El tipo de categoría debe ser 'expense' o 'revenue'." ,
  } ) ,
  parentId: z.string().uuid( "El ID de categoría padre debe ser un UUID válido." ).optional().nullable() ,
  icon:     z.string().max( 50 , "El ícono no puede superar los 50 caracteres." ).optional().nullable() ,
  color:    z.string().regex( /^#[0-9A-Fa-f]{6}$/ , "El color debe ser un hexadecimal válido (#RRGGBB)." ).optional().nullable() ,
} ) ;

export type CreateCategoryInput = z.infer< typeof createCategorySchema > ;

/**
 * Esquema para la actualización de una categoría existente.
 * Nota: accountCode y type son inmutables (RFC 022 §6).
 */
export const updateCategorySchema = z.object( {
  id:    z.string().uuid( "El ID de categoría debe ser un UUID válido." ) ,
  name:  z.string().min( 2 , "El nombre debe tener al menos 2 caracteres." ).max( 100 , "El nombre no puede superar los 100 caracteres." ).optional() ,
  icon:  z.string().max( 50 , "El ícono no puede superar los 50 caracteres." ).optional().nullable() ,
  color: z.string().regex( /^#[0-9A-Fa-f]{6}$/ , "El color debe ser un hexadecimal válido (#RRGGBB)." ).optional().nullable() ,
} ) ;

export type UpdateCategoryInput = z.infer< typeof updateCategorySchema > ;

/**
 * Esquema para archivar una categoría contable.
 */
export const archiveCategorySchema = z.object( {
  id: z.string().uuid( "El ID de categoría debe ser un UUID válido." ) ,
} ) ;

export type ArchiveCategoryInput = z.infer< typeof archiveCategorySchema > ;

/**
 * Esquema para desarchivar una categoría contable.
 */
export const unarchiveCategorySchema = z.object( {
  id: z.string().uuid( "El ID de categoría debe ser un UUID válido." ) ,
} ) ;

export type UnarchiveCategoryInput = z.infer< typeof unarchiveCategorySchema > ;
