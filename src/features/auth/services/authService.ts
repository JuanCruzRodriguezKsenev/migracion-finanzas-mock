// Librerías externas
import { promisify } from "util" ;
import crypto        from "crypto" ;

// Definición asíncrona de scrypt con casteo de tipo estricto en TS
const scryptAsync = promisify( crypto.scrypt ) as (
  password: string ,
  salt:     string ,
  keylen:   number ,
  options:  crypto.ScryptOptions
) => Promise< Buffer > ;

// Parámetros scrypt centralizados para consistencia y mantenibilidad
const SCRYPT_PARAMS = {
  keylen:  64 ,
  options: { N: 16384 , r: 8 , p: 1 }
} as const ;

/**
 * Genera un hash criptográfico seguro a partir de una contraseña en texto plano
 * utilizando el algoritmo `scrypt` nativo de Node.js.
 * 
 * @param password - La contraseña en texto plano que se va a hashear.
 * @returns Una promesa que se resuelve con un objeto que contiene el `hash` y el `salt` generados, codificados en hexadecimal.
 * @throws {Error} Si ocurre un error inesperado durante el proceso de derivación criptográfica.
 */
export async function hashPassword( password: string ): Promise< {hash: string ; salt: string} > {
  const salt       = crypto.randomBytes( 16 ).toString( "hex" ) ;
  const derivedKey = await scryptAsync( password , salt , SCRYPT_PARAMS.keylen , SCRYPT_PARAMS.options ) ;

  return( {
    hash: derivedKey.toString( "hex" ) ,
    salt
  } ) ;
}

/**
 * Verifica si una contraseña en texto plano coincide con el hash almacenado
 * utilizando el mismo salt y parámetros de derivación `scrypt` de la generación.
 * 
 * @param password - La contraseña en texto plano ingresada por el usuario.
 * @param hash     - El hash hexadecimal previamente almacenado en la base de datos.
 * @param salt     - El salt hexadecimal único asociado a la contraseña original.
 * @returns Una promesa que se resuelve con `true` si la contraseña coincide, o `false` en caso contrario.
 * @throws {Error} Si ocurre un error inesperado durante el proceso de validación.
 */
export async function verifyPassword( password: string , hash: string , salt: string ): Promise< boolean > {
  // Se ejecuta scrypt antes de cualquier comparación rápida de longitud del hash o existencia de datos.
  // Retornar false sincrónicamente abriría una vulnerabilidad a timing attacks de enumeración de usuarios:
  // un atacante podría distinguir emails válidos de inválidos según la velocidad de respuesta del servidor.
  const derivedKey = await scryptAsync( password , salt , SCRYPT_PARAMS.keylen , SCRYPT_PARAMS.options ) ;
  const hashBuffer = Buffer.from( hash , "hex" ) ;

  // crypto.timingSafeEqual requiere que ambos buffers tengan exactamente la misma longitud.
  // Si no coinciden, retornamos false de forma segura para evitar excepciones en tiempo de ejecución.
  if( derivedKey.length !== hashBuffer.length ){ return( false ) ; }

  return( crypto.timingSafeEqual(derivedKey , hashBuffer) ) ;
}