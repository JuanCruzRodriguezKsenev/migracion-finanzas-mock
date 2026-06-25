/**
 * @file types.ts
 * Interfaces y tipos de datos de perfil de usuario.
 */
import { InferSelectModel } from "drizzle-orm" ;
import { profiles } from "./schema.db" ;

export type ProfileData = InferSelectModel< typeof profiles > ;
