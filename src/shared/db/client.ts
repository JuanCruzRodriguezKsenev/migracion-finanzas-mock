/**
 * @file client.ts
 * Inicializa el cliente central de conexión a la base de datos PostgreSQL utilizando postgres-js.
 * Optimizado para evitar fugas de conexiones durante HMR (Hot Module Replacement) en desarrollo.
 */
// Librerías externas
import { drizzle } from "drizzle-orm/postgres-js" ;
import postgres    from "postgres" ;
import dotenv      from "dotenv" ;

// Shared
import { obtenerEnv } from "@/shared/lib/env" ;

// Shared: base de datos
import { opcionesDeConexion } from "./connectionOptions" ;

// Cargar variables de entorno locales
dotenv.config( {path: ".env.local"} ) ;

// Obtiene la URI de conexión validada de las variables de entorno
const connectionString = ( obtenerEnv().DATABASE_URL ) ;

// Declarar tipo global para evitar fugas en desarrollo (HMR)
const globalForDb = globalThis as unknown as {
  conn: ReturnType<typeof postgres> | undefined ;
} ;

// Solo crear el cliente si no existe en el scope global, limitando el pool en desarrollo
const queryClient = globalForDb.conn || postgres( connectionString , opcionesDeConexion( connectionString ) ) ;

if( process.env.NODE_ENV !== "production" ) {
  globalForDb.conn = queryClient ;
}

/**
 * Instancia global de Drizzle ORM configurada con el cliente Postgres.js.
 * Utilizada para ejecutar consultas y operaciones contra la base de datos de manera transversal.
 */
export const db = drizzle( queryClient ) ;

export type DBOrTx = typeof db | Parameters< Parameters<typeof db.transaction>[0] >[0] ;