/**
 * @file loginAttemptService.ts
 * Freno de fuerza bruta para el proveedor de credenciales.
 *
 * El costo de `scrypt` encarece cada intento, pero no lo limita: sin un contador persistido, una
 * botnet puede probar contraseñas indefinidamente contra una cuenta conocida. Este servicio
 * bloquea temporalmente tanto la **cuenta** atacada como el **origen** que la ataca.
 *
 * El estado vive en PostgreSQL y no en memoria del proceso: un contador en memoria se reinicia en
 * cada despliegue y no se comparte entre instancias, que es justo lo que necesita un atacante para
 * que el bloqueo no exista.
 */
// Librerías externas
import { inArray , sql } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;
import { logger }      from "@/shared/lib/logger" ;

// Feature: Auth
import { loginAttempts } from "../schema.db" ;


/** Fallos tolerados por cuenta antes de bloquearla temporalmente. */
export const MAX_FALLOS_EMAIL = 5 ;

/** Fallos tolerados por dirección de origen, más alto porque una IP legítima puede ser compartida (NAT, oficina). */
export const MAX_FALLOS_IP = 20 ;

/** Duración del bloqueo una vez superado el umbral. */
export const BLOQUEO_MINUTOS = 15 ;

/** Inactividad tras la cual el contador de fallos vuelve a cero. */
export const VENTANA_MINUTOS = 15 ;


/**
 * Resultado de consultar si un identificador está bloqueado.
 */
export interface EstadoBloqueo {
  bloqueado:      boolean ;
  hasta?:         Date ;
  segundosRestantes?: number ;
}

/**
 * Construye la clave de cuenta para la tabla de intentos.
 *
 * @param email - Email tal como lo escribió el usuario.
 * @returns Clave normalizada, para que `Admin@X` y `admin@x` compartan contador.
 */
export function claveEmail( email: string ): string {
  return( `email:${email.trim().toLowerCase()}` ) ;
}

/**
 * Construye la clave de origen para la tabla de intentos.
 *
 * @param ip - Dirección de origen de la petición, o null si no se pudo determinar.
 * @returns Clave de origen, o null cuando no hay IP que limitar.
 */
export function claveIp( ip: string | null | undefined ): string | null {
  if( !ip ) { return( null ) ; }

  return( `ip:${ip.trim()}` ) ;
}

/**
 * Consulta si alguno de los identificadores está bloqueado en este momento.
 *
 * Ante un error de base se responde "no bloqueado" a propósito: la autenticación necesita la base
 * igual, así que un fallo de conexión ya impide entrar. Devolver "bloqueado" acá sólo convertiría
 * una caída en un mensaje engañoso para el usuario.
 *
 * @param identificadores - Claves a consultar (cuenta y origen).
 * @param tx - Instancia de transacción opcional.
 * @returns Estado de bloqueo con el instante de expiración si corresponde.
 */
export async function verificarBloqueo(
  identificadores: ( string | null )[] ,
  tx:              DBOrTx = db
): Promise< EstadoBloqueo > {
  const claves = identificadores.filter( ( c ): c is string => !!c ) ;

  if( claves.length === 0 ) { return( {bloqueado: false} ) ; }

  try {
    const filas = await tx
      .select( {lockedUntil: loginAttempts.lockedUntil} )
      .from( loginAttempts )
      .where( inArray(loginAttempts.identifier , claves) ) ;

    const ahora = Date.now() ;
    let masLejano: Date | undefined = undefined ;

    for( const fila of filas ) {
      if( fila.lockedUntil && (fila.lockedUntil.getTime() > ahora) ) {
        if( !masLejano || (fila.lockedUntil > masLejano) ) {
          masLejano = fila.lockedUntil ;
        }
      }
    }

    if( !masLejano ) { return( {bloqueado: false} ) ; }

    return( {
      bloqueado:         true ,
      hasta:             masLejano ,
      segundosRestantes: Math.ceil( (masLejano.getTime() - ahora) / 1000 )
    } ) ;
  } catch( error ) {
    logger.error( "No se pudo consultar el estado de bloqueo de login." , {error: String(error)} ) ;

    return( {bloqueado: false} ) ;
  }
}

/**
 * Registra un intento fallido para cada identificador y aplica el bloqueo si se superó el umbral.
 *
 * El conteo y la decisión de bloquear se resuelven **dentro de la misma sentencia SQL**: leer el
 * contador, decidir en JavaScript y volver a escribir permitiría que varios intentos simultáneos
 * lean el mismo valor y se pisen, dejando pasar más intentos de los tolerados.
 *
 * @param identificadores - Claves a incrementar (cuenta y origen), con su umbral respectivo.
 * @param tx - Instancia de transacción opcional.
 */
export async function registrarFallo(
  identificadores: ( {clave: string | null ; maximo: number} )[] ,
  tx:              DBOrTx = db
): Promise< void > {
  const objetivos = identificadores.filter( ( o ): o is {clave: string ; maximo: number} => !!o.clave ) ;

  for( const objetivo of objetivos ) {
    try {
      // `expirado` distingue un intento aislado de una racha: pasada la ventana de inactividad el
      // contador arranca de cero en vez de acumular fallos de hace horas.
      const expirado = sql`( ${loginAttempts.lastFailedAt} < now() - ( ${VENTANA_MINUTOS} * interval '1 minute' ) )` ;
      const nuevoConteo = sql`( case when ${expirado} then 1 else ${loginAttempts.failedCount} + 1 end )` ;

      await tx
        .insert( loginAttempts )
        .values( {
          identifier:  objetivo.clave ,
          failedCount: 1
        } )
        .onConflictDoUpdate( {
          target: loginAttempts.identifier ,
          set:    {
            failedCount:   nuevoConteo ,
            firstFailedAt: sql`( case when ${expirado} then now() else ${loginAttempts.firstFailedAt} end )` ,
            lastFailedAt:  sql`now()` ,
            lockedUntil:   sql`( case when ${nuevoConteo} >= ${objetivo.maximo} then now() + ( ${BLOQUEO_MINUTOS} * interval '1 minute' ) else null end )`
          }
        } ) ;
    } catch( error ) {
      logger.error( "No se pudo registrar el intento fallido de login." , {
        identificador: objetivo.clave ,
        error:         String( error )
      } ) ;
    }
  }
}

/**
 * Borra el historial de fallos de los identificadores tras un login exitoso, para que una racha
 * de errores de tipeo no siga contando contra el usuario legítimo.
 *
 * @param identificadores - Claves a limpiar (cuenta y origen).
 * @param tx - Instancia de transacción opcional.
 */
export async function limpiarIntentos(
  identificadores: ( string | null )[] ,
  tx:              DBOrTx = db
): Promise< void > {
  const claves = identificadores.filter( ( c ): c is string => !!c ) ;

  if( claves.length === 0 ) { return ; }

  try {
    await tx
      .delete( loginAttempts )
      .where( inArray(loginAttempts.identifier , claves) ) ;
  } catch( error ) {
    logger.error( "No se pudieron limpiar los intentos de login." , {error: String(error)} ) ;
  }
}
