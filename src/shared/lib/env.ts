/**
 * @file env.ts
 * Validación tipada y segura en runtime de las variables de entorno del sistema con Zod.
 * Proporciona acceso validado de forma lazy para evitar fallos tempranos en fases estáticas de build.
 */
import { z } from "zod" ;

export const envSchema = z.object( {
  NODE_ENV: z.enum( [ "development" , "production" , "test" ] ).default( "development" ) ,
  DATABASE_URL: z.string( { message: "DATABASE_URL es obligatoria." } ).min( 1 , "DATABASE_URL no puede estar vacía." ).refine(
    ( url ) => url.startsWith( "postgres://" ) || url.startsWith( "postgresql://" ) ,
    { message: "DATABASE_URL debe ser una URL de PostgreSQL válida (postgres:// o postgresql://)" }
  ) ,
  NEXTAUTH_SECRET: z.string().optional() ,
  NEXTAUTH_URL: z.string().url( "NEXTAUTH_URL debe ser una URL válida" ).optional() ,
  GOOGLE_CLIENT_ID: z.string().optional() ,
  GOOGLE_CLIENT_SECRET: z.string().optional() ,
} ).refine(
  ( data ) => {
    if( (data.NODE_ENV === "production") && !data.NEXTAUTH_SECRET ) {
      return( false ) ;
    }
    return( true ) ;
  } ,
  {
    message: "NEXTAUTH_SECRET es obligatoria en entorno de producción." ,
    path: [ "NEXTAUTH_SECRET" ] ,
  }
).refine(
  ( data ) => {
    const tieneId     = Boolean( data.GOOGLE_CLIENT_ID ) ;
    const tieneSecret = Boolean( data.GOOGLE_CLIENT_SECRET ) ;
    return( tieneId === tieneSecret ) ;
  } ,
  {
    message: "GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET deben definirse ambas o ninguna." ,
    path: [ "GOOGLE_CLIENT_ID" ] ,
  }
) ;

export type Env = z.infer< typeof envSchema > ;

let cachedEnv: Env | null = null ;

/**
 * Valida y retorna las variables de entorno de la aplicación.
 * Utiliza caché en memoria tras la primera evaluación exitosa.
 *
 * @param overrides - Objeto opcional para inyectar variables en pruebas unitarias.
 * @returns Variables de entorno validadas e inferidas.
 * @throws Error con los detalles de validación si faltan variables críticas.
 */
export function obtenerEnv( overrides?: Record< string , string | undefined > ): Env {
  if( !overrides && cachedEnv ) {
    return( cachedEnv ) ;
  }

  const source = ( overrides || process.env ) ;
  const result = envSchema.safeParse( source ) ;

  if( !result.success ) {
    const errorDetails = result.error.issues
      .map( ( issue ) => `  - ${issue.path.join( "." )}: ${issue.message}` )
      .join( "\n" ) ;
    const errorMessage = `[Configuración Inválida] Falló la validación de variables de entorno:\n${errorDetails}` ;
    throw( new Error( errorMessage ) ) ;
  }

  if( !overrides ) {
    cachedEnv = result.data ;
  }

  return( result.data ) ;
}

/**
 * Limpia la caché en memoria de la validación (para uso en pruebas unitarias).
 */
export function resetEnvCache(): void {
  cachedEnv = null ;
}
