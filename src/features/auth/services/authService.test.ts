import { describe , it , expect } from "vitest" ;
import { hashPassword , verifyPassword } from "./authService" ;

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
    const { hash , salt } = await hashPassword( contrasenia ) ;

    const esValido = await verifyPassword( contrasenia , hash , salt ) ;
    expect( esValido ).toBe( true ) ;
  } ) ;

  /**
   * Caso de prueba: Rechazo de credenciales incorrectas.
   * Valida que verifyPassword retorne false ante un password erróneo.
   */
  it( "debería fallar la verificación si la contraseña ingresada es incorrecta" , async () => {
    const contraseniaCorrecta = "PasswordSeguro2026!" ;
    const contraseniaIncorrecta = "PasswordErroneo!" ;
    const { hash , salt } = await hashPassword( contraseniaCorrecta ) ;

    const esValido = await verifyPassword( contraseniaIncorrecta , hash , salt ) ;
    expect( esValido ).toBe( false ) ;
  } ) ;
} ) ;