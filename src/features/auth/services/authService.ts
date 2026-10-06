/**
 * @file authService.ts
 * Derivación y verificación de contraseñas con `scrypt`.
 *
 * Los parámetros de costo **viajan junto al hash** (columna `users.hash_params`) en vez de estar
 * implícitos en el código. Sin eso, subir el costo criptográfico obliga a resetear todas las
 * contraseñas: no hay forma de distinguir un hash viejo de uno nuevo, así que ninguno de los dos
 * verifica contra el otro conjunto de parámetros. Con los parámetros persistidos, cada fila se
 * verifica con los suyos y `necesitaRehash()` permite migrarlas de a una, en su próximo login.
 */
// Librerías externas
import { promisify } from "util" ;
import crypto        from "crypto" ;

// Promisifica la función nativa 'crypto.scrypt' (basada originalmente en callbacks) y la castea
// a una firma asíncrona fuertemente tipada en TypeScript para evitar sobrecargas genéricas ambiguas.
const scryptAsync = promisify( crypto.scrypt ) as (
  password: string ,              // Contraseña en texto plano a derivar
  salt:     string ,              // Secuencia aleatoria única añadida a la contraseña antes del hash para evitar ataques de precomputación (Rainbow Tables)
  keylen:   number ,              // Longitud en bytes de la clave final resultante
  options:  crypto.ScryptOptions  // Parámetros de configuración de costos algorítmicos
) => Promise< Buffer > ;          // Retorna un Buffer binario asincrónicamente con la clave derivada


/**
 * Parámetros de costo de una derivación `scrypt`.
 */
export interface ScryptParams {
  N:      number ; // Factor de costo de CPU/memoria (potencia de 2)
  r:      number ; // Tamaño de bloque
  p:      number ; // Factor de paralelización
  keylen: number ; // Longitud en bytes de la clave derivada
}

/**
 * Parámetros vigentes para toda contraseña nueva o rehasheada.
 *
 * `N: 131072` (2^17) es el mínimo que recomienda OWASP hoy para scrypt, junto con `r: 8` y `p: 1`.
 * El valor anterior de este repositorio era 2^14, que OWASP sólo admite como piso alternativo
 * cuando la memoria disponible es escasa.
 *
 * ⚠️ **Costo operativo**: 2^17 con `r: 8` reserva ~128 MB y ~0,5 s de CPU **por verificación**.
 * En un host con poca memoria, bajar `N` a 65536 o 16384 acá es seguro y es un cambio de una
 * línea: los hashes existentes siguen verificando con los parámetros que tienen guardados.
 */
export const PARAMS_ACTUALES: ScryptParams = {
  N:      131072 ,
  r:      8 ,
  p:      1 ,
  keylen: 64
} ;

/**
 * Parámetros de las contraseñas hasheadas antes de que se persistieran los parámetros.
 * Toda fila con `hash_params` en `null` se verifica con estos valores.
 */
export const PARAMS_LEGADO: ScryptParams = {
  N:      16384 ,
  r:      8 ,
  p:      1 ,
  keylen: 64
} ;

/**
 * Serializa los parámetros a la forma que se persiste en la base: `scrypt$N$r$p$keylen`.
 *
 * @param params - Parámetros de costo a serializar.
 * @returns Cadena compacta y autodescriptiva apta para la columna `users.hash_params`.
 */
export function serializarParams( params: ScryptParams ): string {
  return( `scrypt$${params.N}$${params.r}$${params.p}$${params.keylen}` ) ;
}

/**
 * Interpreta la cadena persistida en `users.hash_params`.
 *
 * @param raw - Cadena serializada, o `null`/`undefined` para las filas anteriores a esta columna.
 * @returns Los parámetros correspondientes; `PARAMS_LEGADO` si el valor falta o es ilegible.
 */
export function parsearParams( raw: string | null | undefined ): ScryptParams {
  if( !raw ) { return( PARAMS_LEGADO ) ; }

  const partes = raw.split( "$" ) ;

  if( (partes.length !== 5) || (partes[0] !== "scrypt") ) {
    return( PARAMS_LEGADO ) ;
  }

  const [ N , r , p , keylen ] = partes.slice( 1 ).map( Number ) ;

  if( [ N , r , p , keylen ].some( ( n ) => !Number.isInteger( n ) || (n <= 0) ) ) {
    return( PARAMS_LEGADO ) ;
  }

  return( {N , r , p , keylen} ) ;
}

/**
 * Traduce los parámetros a las opciones que espera `crypto.scrypt`.
 *
 * `maxmem` se calcula en vez de dejarse en su valor por defecto (32 MB): scrypt necesita
 * aproximadamente `128 * N * r` bytes, así que con N ≥ 2^15 el default hace fallar la derivación
 * con "memory limit exceeded" en lugar de calcularla.
 *
 * @param params - Parámetros de costo.
 * @returns Opciones listas para `crypto.scrypt`, con el techo de memoria ya dimensionado.
 */
function aOpcionesScrypt( params: ScryptParams ): crypto.ScryptOptions {
  return( {
    N:      params.N ,
    r:      params.r ,
    p:      params.p ,
    maxmem: ( 256 * params.N * params.r )
  } ) ;
}

/**
 * Indica si un hash almacenado quedó con parámetros más débiles que los vigentes y conviene
 * regenerarlo. Se consulta tras una verificación exitosa, único momento en que la contraseña
 * en texto plano está disponible para rehashear.
 *
 * @param raw - Valor de `users.hash_params` de la fila verificada.
 * @returns `true` si los parámetros almacenados difieren de `PARAMS_ACTUALES`.
 */
export function necesitaRehash( raw: string | null | undefined ): boolean {
  return( serializarParams( parsearParams( raw ) ) !== serializarParams( PARAMS_ACTUALES ) ) ;
}

/**
 * Genera un hash criptográfico seguro a partir de una contraseña en texto plano
 * utilizando el algoritmo `scrypt` nativo de Node.js.
 *
 * @param password - La contraseña en texto plano que se va a hashear.
 * @returns Una promesa que se resuelve con el `hash` y el `salt` en hexadecimal, más los `params` con los que se derivó.
 * @throws {Error} Si ocurre un error inesperado durante el proceso de derivación criptográfica.
 */
export async function hashPassword( password: string ): Promise< {hash: string ; salt: string ; params: string} > {
  const salt       = crypto.randomBytes( 16 ).toString( "hex" ) ;
  const derivedKey = await scryptAsync( password , salt , PARAMS_ACTUALES.keylen , aOpcionesScrypt( PARAMS_ACTUALES ) ) ;

  return( {
    hash:   derivedKey.toString( "hex" ) ,
    salt ,
    params: serializarParams( PARAMS_ACTUALES )
  } ) ;
}

/**
 * Verifica si una contraseña en texto plano coincide con el hash almacenado
 * utilizando el mismo salt y los parámetros con los que esa fila fue derivada.
 *
 * @param password - La contraseña en texto plano ingresada por el usuario.
 * @param hash     - El hash hexadecimal previamente almacenado en la base de datos.
 * @param salt     - El salt hexadecimal único asociado a la contraseña original.
 * @param rawParams - Valor de `users.hash_params`. Es obligatorio y admite `null` a propósito: el
 *                    único caso legítimo de "parámetros desconocidos" es una fila anterior a esa
 *                    columna, y pasarlo explícitamente evita que un llamador nuevo verifique en
 *                    silencio con un costo distinto al que se usó para derivar el hash.
 * @returns Una promesa que se resuelve con `true` si la contraseña coincide, o `false` en caso contrario.
 * @throws {Error} Si ocurre un error inesperado durante el proceso de validación.
 */
export async function verifyPassword(
  password:  string ,
  hash:      string ,
  salt:      string ,
  rawParams: string | null
): Promise< boolean > {
  const params = parsearParams( rawParams ) ;

  // Se ejecuta scrypt antes de cualquier comparación rápida de longitud del hash o existencia de datos.
  // Retornar false sincrónicamente abriría una vulnerabilidad a timing attacks de enumeración de usuarios:
  // un atacante podría distinguir emails válidos de inválidos según la velocidad de respuesta del servidor.
  const derivedKey = await scryptAsync( password , salt , params.keylen , aOpcionesScrypt( params ) ) ;
  const hashBuffer = Buffer.from( hash , "hex" ) ;

  // crypto.timingSafeEqual requiere que ambos buffers tengan exactamente la misma longitud.
  // Si no coinciden, retornamos false de forma segura para evitar excepciones en tiempo de ejecución.
  if( derivedKey.length !== hashBuffer.length ){ return( false ) ; }

  return( crypto.timingSafeEqual(derivedKey , hashBuffer) ) ;
}

export const authService = {
  verifyPassword ,
  hashPassword ,
  necesitaRehash ,
  serializarParams ,
  PARAMS_ACTUALES ,
  PARAMS_LEGADO ,
} ;
