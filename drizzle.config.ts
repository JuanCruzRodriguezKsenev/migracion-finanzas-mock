/**
 * Configuración central de Drizzle Kit para la generación y ejecución de migraciones SQL.
 */
import { defineConfig } from "drizzle-kit" ;
import * as dotenv from "dotenv" ;

// Carga de forma explícita las variables de entorno locales desde el archivo `.env.local`
// Esto garantiza que Drizzle Kit pueda acceder a las credenciales locales de la base de datos
dotenv.config( {path: ".env.local"} ) ;

export default defineConfig( {
  schema:        "./src/shared/db/schema.ts" ,
  out:           "./drizzle/migrations" ,
  dialect:       "postgresql" ,
  dbCredentials: {url: process.env.DATABASE_URL!} ,
  verbose:       true ,
  strict:        true ,
} ) ;