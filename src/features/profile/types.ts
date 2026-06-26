/**
 * @file types.ts
 * Interfaces y tipos de datos de perfil de usuario.
 */
// Librerías externas
import { InferSelectModel } from "drizzle-orm" ;

// Feature: Profile
import { profiles } from "./schema.db" ;

export type ProfileData = InferSelectModel< typeof profiles > ;
