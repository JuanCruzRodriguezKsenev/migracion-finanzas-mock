import crypto from "crypto" ;

/**
 * Genera un hash criptográfico seguro a partir de una contraseña en texto plano
 * utilizando el algoritmo `scrypt` nativo de Node.js.
 * 
 * @param password - La contraseña en texto plano que se va a hashear.
 * @returns Una promesa que se resuelve con un objeto que contiene el `hash` y el `salt` generados, codificados en hexadecimal.
 * @throws {Error} Si ocurre un error inesperado durante el proceso de derivación criptográfica.
 */
export async function hashPassword( password: string ): Promise< {hash: string ; salt: string} > {
  return( new Promise( (resolve , reject) => {
    const salt = crypto.randomBytes(16).toString( "hex" ) ;
    
    crypto.scrypt( password , salt , 64 , {N: 16384 , r: 8 , p: 1} , (err , derivedKey) => {
      if( err ){ return( reject(err) ) ; }
      
      resolve( {
        hash: derivedKey.toString("hex") ,
        salt
      } ) ;
    } ) ;
  } ) ) ;
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
  return( new Promise( (resolve , reject) => {
    crypto.scrypt( password , salt , 64 , {N: 16384 , r: 8 , p: 1} , (err , derivedKey) => {
      if( err ){ return( reject(err) ) ; }

      resolve( derivedKey.toString("hex") === hash ) ;
    } ) ;
  } ) ) ;
}