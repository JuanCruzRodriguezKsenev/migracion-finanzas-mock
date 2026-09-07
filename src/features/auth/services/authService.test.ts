// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Auth
import {
  hashPassword ,
  verifyPassword ,
  serializarParams ,
  parsearParams ,
  necesitaRehash ,
  PARAMS_ACTUALES ,
  PARAMS_LEGADO
} from "./authService" ;

/**
 * Suite de pruebas unitarias para el servicio de autenticación y hashing.
 * Verifica la robustez del algoritmo scrypt, la aleatoriedad del salting y la validación de contraseñas.
 */
describe( "authService" , () => {
  
  /**
   * Caso de prueba: Hasheo correcto y generación de salt único.
   * Valida que la salida contenga el hash y un salt de 16 bytes (32 caracteres hexadecimales).
   */
  it( "debería hashear la contraseña de forma correcta con salt aleatorio" , async () => {
    const contrasenia = "PasswordSeguro2026!" ;
    
    const resultado = await hashPassword( contrasenia ) ;

    expect( resultado.hash ).toBeDefined() ;
    expect( resultado.salt ).toBeDefined() ;
    expect( resultado.hash.length ).toBeGreaterThan( 0 ) ;
    expect( resultado.salt.length ).toBe( 32 ) ; // 16 bytes en hex = 32 caracteres
  } ) ;

  /**
   * Caso de prueba: Prevención de colisiones de hash (Ataques de diccionario / Rainbow Tables).
   * Valida que una misma contraseña procesada dos veces genere salts y hashes diferentes.
   */
  it( "debería generar hashes diferentes para la misma contraseña debido al salt aleatorio" , async () => {
    const contrasenia = "PasswordSeguro2026!" ;
    
    const resultado1 = await hashPassword( contrasenia ) ;
    const resultado2 = await hashPassword( contrasenia ) ;

    expect( resultado1.salt ).not.toBe( resultado2.salt ) ;
    expect( resultado1.hash ).not.toBe( resultado2.hash ) ;
  } ) ;

  /**
   * Caso de prueba: Verificación exitosa de credenciales correctas.
   * Valida que verifyPassword retorne true al ingresar la contraseña original.
   */
  it( "debería verificar la contraseña de forma exitosa con el hash y salt correctos" , async () => {
    const contrasenia = "PasswordSeguro2026!" ;
    
    const { hash , salt , params } = await hashPassword( contrasenia ) ;

    const esValido = await verifyPassword( contrasenia , hash , salt , params ) ;
    
    expect( esValido ).toBe( true ) ;
  } ) ;

  /**
   * Caso de prueba: Rechazo de credenciales incorrectas.
   * Valida que verifyPassword retorne false ante un password erróneo.
   */
  it( "debería fallar la verificación si la contraseña ingresada es incorrecta" , async () => {
    const contraseniaCorrecta   = "PasswordSeguro2026!" ;
    const contraseniaIncorrecta = "PasswordErroneo!" ;

    const { hash , salt , params } = await hashPassword( contraseniaCorrecta ) ;

    const esValido = await verifyPassword( contraseniaIncorrecta , hash , salt , params ) ;

    expect( esValido ).toBe( false ) ;
  } ) ;

  /**
   * Caso de prueba: Manejo defensivo de hashes de longitud distinta.
   * Valida que verifyPassword retorne false de forma segura (sin lanzar excepción)
   * cuando el hash almacenado no coincide en longitud con la clave derivada.
   */
  it( "debería retornar false sin lanzar excepción si el hash almacenado tiene longitud distinta" , async () => {
    const contrasenia = "PasswordSeguro2026!" ;
    const { salt , params } = await hashPassword( contrasenia ) ;
    const hashCorto         = "abcd1234" ;

    const esValido = await verifyPassword( contrasenia , hashCorto , salt , params ) ;

    expect( esValido ).toBe( false ) ;
  } ) ;
} ) ;
/**
 * Suite de pruebas para la persistencia de parámetros de costo y la migración de hashes.
 * Verifica que una contraseña derivada con parámetros viejos siga verificando, que se detecte
 * cuándo hay que regenerarla, y que un valor corrupto no rompa el login.
 */
describe( "authService — parámetros de costo" , () => {

  /**
   * Caso de prueba: ida y vuelta de la serialización.
   */
  it( "debería serializar y volver a parsear los mismos parámetros" , () => {
    const serializado = serializarParams( PARAMS_ACTUALES ) ;

    expect( serializado ).toBe( `scrypt$${PARAMS_ACTUALES.N}$${PARAMS_ACTUALES.r}$${PARAMS_ACTUALES.p}$${PARAMS_ACTUALES.keylen}` ) ;
    expect( parsearParams( serializado ) ).toEqual( PARAMS_ACTUALES ) ;
  } ) ;

  /**
   * Caso de prueba: filas anteriores a la columna hash_params.
   * Sin este comportamiento, todas las contraseñas creadas antes de la migración dejarían de verificar.
   */
  it( "debería asumir los parámetros de legado cuando el valor es nulo o ilegible" , () => {
    expect( parsearParams( null ) ).toEqual( PARAMS_LEGADO ) ;
    expect( parsearParams( undefined ) ).toEqual( PARAMS_LEGADO ) ;
    expect( parsearParams( "" ) ).toEqual( PARAMS_LEGADO ) ;
    expect( parsearParams( "bcrypt$10" ) ).toEqual( PARAMS_LEGADO ) ;
    expect( parsearParams( "scrypt$abc$8$1$64" ) ).toEqual( PARAMS_LEGADO ) ;
    expect( parsearParams( "scrypt$16384$8$1" ) ).toEqual( PARAMS_LEGADO ) ;
  } ) ;

  /**
   * Caso de prueba: detección de hashes que quedaron con parámetros débiles.
   */
  it( "debería marcar para rehash sólo los parámetros distintos de los vigentes" , () => {
    expect( necesitaRehash( serializarParams( PARAMS_ACTUALES ) ) ).toBe( false ) ;
    expect( necesitaRehash( null ) ).toBe( necesitaRehash( serializarParams( PARAMS_LEGADO ) ) ) ;
    expect( necesitaRehash( "scrypt$1024$8$1$64" ) ).toBe( true ) ;
  } ) ;

  /**
   * Caso de prueba: verificación con parámetros de legado.
   * Es el escenario que hace posible migrar el costo criptográfico sin resetear contraseñas.
   */
  it( "debería verificar una contraseña derivada con los parámetros de legado" , async () => {
    const password = "ClaveHistorica123" ;
    const salt     = "0123456789abcdef0123456789abcdef" ;

    // Derivación manual con los parámetros viejos, imitando una fila anterior a la migración
    const { scrypt } = await import( "crypto" ) ;
    const derivada = await new Promise< Buffer >( ( resolve , reject ) => {
      scrypt(
        password ,
        salt ,
        PARAMS_LEGADO.keylen ,
        {N: PARAMS_LEGADO.N , r: PARAMS_LEGADO.r , p: PARAMS_LEGADO.p , maxmem: (256 * PARAMS_LEGADO.N * PARAMS_LEGADO.r)} ,
        ( err , key ) => ( err ? reject( err ) : resolve( key ) )
      ) ;
    } ) ;

    const hashLegado = derivada.toString( "hex" ) ;

    expect( await verifyPassword( password , hashLegado , salt , null ) ).toBe( true ) ;
    expect( await verifyPassword( "otraClave" , hashLegado , salt , null ) ).toBe( false ) ;
  } ) ;
} ) ;
