/**
 * @file client.ts
 * Inicializa el cliente central de conexión a la base de datos PostgreSQL utilizando postgres-js.
 */
import { drizzle } from "drizzle-orm/postgres-js" ;
import postgres from "postgres" ;
import dotenv   from "dotenv" ;

// Cargar variables de entorno locales
dotenv.config( {path: ".env.local"} ) ;

// Obtiene la URI de conexión de las variables de entorno o usa una por defecto en desarrollo local
const connectionString = ( process.env.DATABASE_URL || "postgresql://postgres:postgres_dev_pwd@localhost:5432/finanzas_db" ) ;

// Inicializa el pool de conexiones de consultas reutilizable de postgres-js
const queryClient = postgres( connectionString ) ;

/**
 * Instancia global de Drizzle ORM configurada con el cliente Postgres.js.
 * Utilizada para ejecutar consultas y operaciones contra la base de datos de manera transversal.
 */
export const db = drizzle( queryClient ) ;