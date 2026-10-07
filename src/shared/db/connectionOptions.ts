/**
 * @file connectionOptions.ts
 * Opciones del cliente postgres-js según el destino de la conexión.
 * Función pura: no lee el entorno ni abre conexiones.
 */

/** Opciones de conexión que `client.ts` entrega a postgres-js. */
export interface OpcionesDeConexion {
  /** Tamaño máximo del pool de conexiones. */
  max     : number ;
  /** `false` contra un pooler en modo transacción (pgbouncer), que no soporta sentencias preparadas. */
  prepare : boolean ;
}

const OPCIONES_POR_DEFECTO: OpcionesDeConexion = { max: 5 , prepare: true } ;

/**
 * Calcula las opciones de conexión a partir de la URL de la base.
 * Si el host contiene `-pooler` (endpoint con pgbouncer de Neon) desactiva las sentencias preparadas.
 * Ante una URL no parseable devuelve los valores por defecto: la validación de la URL vive en `env.ts`.
 *
 * @param url Cadena de conexión de PostgreSQL.
 * @returns Opciones para `postgres( url , opciones )`.
 */
export function opcionesDeConexion( url: string ): OpcionesDeConexion {
  try {
    const { hostname } = new URL( url ) ;
    return( { ...OPCIONES_POR_DEFECTO , prepare: !hostname.includes( "-pooler" ) } ) ;
  } catch {
    return( { ...OPCIONES_POR_DEFECTO } ) ;
  }
}
