/**
 * @file identificadores.ts
 * Validadores y normalizadores puros para identificadores bancarios y fiscales de Argentina.
 * Incluye validación de CBU/CVU (algoritmo de doble dígito verificador BCRA),
 * Alias (charset AFIP/BCRA) y CUIT/CUIL (módulo 11).
 */

const PONDERADORES_CBU_BLOQUE_1 = [ 7 , 1 , 3 , 9 , 7 , 1 , 3 ] as const ;
const PONDERADORES_CBU_BLOQUE_2 = [ 3 , 9 , 7 , 1 , 3 , 9 , 7 , 1 , 3 , 9 , 7 , 1 , 3 ] as const ;
const PONDERADORES_CUIT         = [ 5 , 4 , 3 , 2 , 7 , 6 , 5 , 4 , 3 , 2 ] as const ;

/**
 * Normaliza un CBU o CVU eliminando espacios y caracteres no numéricos.
 *
 * @param cbu - Cadena a normalizar.
 * @returns Cadena únicamente numérica.
 */
export function normalizarCbu( cbu: string ): string {
  return( cbu.replace( /\D/g , "" ) ) ;
}

/**
 * Valida un CBU o CVU de 22 dígitos según el algoritmo de doble dígito verificador del BCRA.
 *
 * Bloque 1: 8 dígitos (Banco 3 + Sucursal 4 + Verificador 1).
 * Bloque 2: 14 dígitos (Cuenta 13 + Verificador 2).
 *
 * @param cbu - CBU o CVU a validar.
 * @returns `true` si la longitud y ambos dígitos verificadores son válidos; de lo contrario `false`.
 */
export function validarCbu( cbu: string ): boolean {
  const limpio = normalizarCbu( cbu ) ;

  if( limpio.length !== 22 ) {
    return( false ) ;
  }

  // --- Validación del Bloque 1 (primeros 8 dígitos) ---
  let sumaBloque1 = 0 ;
  for( let i = 0 ; i < 7 ; i++ ) {
    sumaBloque1 += Number( limpio[i] ) * PONDERADORES_CBU_BLOQUE_1[i] ;
  }
  const dv1Esperado = ( 10 - ( sumaBloque1 % 10 ) ) % 10 ;
  if( Number( limpio[7] ) !== dv1Esperado ) {
    return( false ) ;
  }

  // --- Validación del Bloque 2 (últimos 14 dígitos) ---
  let sumaBloque2 = 0 ;
  for( let i = 0 ; i < 13 ; i++ ) {
    sumaBloque2 += Number( limpio[i + 8] ) * PONDERADORES_CBU_BLOQUE_2[i] ;
  }
  const dv2Esperado = ( 10 - ( sumaBloque2 % 10 ) ) % 10 ;
  if( Number( limpio[21] ) !== dv2Esperado ) {
    return( false ) ;
  }

  return( true ) ;
}

/**
 * Normaliza un Alias bancario o de billetera virtual.
 *
 * @param alias - Alias a normalizar.
 * @returns Cadena en minúsculas sin espacios extremos.
 */
export function normalizarAlias( alias: string ): string {
  return( alias.trim().toLowerCase() ) ;
}

/**
 * Valida que un Alias cumpla con las especificaciones de AFIP / BCRA:
 * Longitud entre 6 y 20 caracteres, compuesto por letras, números, puntos y guiones.
 *
 * @param alias - Alias a validar.
 * @returns `true` si cumple con el charset y longitud; de lo contrario `false`.
 */
export function validarAlias( alias: string ): boolean {
  const limpio = alias.trim() ;

  if( ( limpio.length < 6 ) || ( limpio.length > 20 ) ) {
    return( false ) ;
  }

  // Charset alfanumérico, puntos y guiones
  const regex = /^[a-zA-Z0-9.-]{6,20}$/ ;
  return( regex.test( limpio ) ) ;
}

/**
 * Normaliza un CUIT o CUIL eliminando guiones y espacios.
 *
 * @param cuit - CUIT a normalizar.
 * @returns Cadena de 11 dígitos numéricos sin separadores.
 */
export function normalizarCuit( cuit: string ): string {
  return( cuit.replace( /[\s-]/g , "" ) ) ;
}

/**
 * Valida un CUIT o CUIL argentino utilizando el algoritmo Módulo 11 de AFIP.
 *
 * @param cuit - CUIT o CUIL a validar (con o sin guiones).
 * @returns `true` si el CUIT es válido según módulo 11; de lo contrario `false`.
 */
export function validarCuit( cuit: string ): boolean {
  const limpio = normalizarCuit( cuit ) ;

  if( ( limpio.length !== 11 ) || !/^\d{11}$/.test( limpio ) ) {
    return( false ) ;
  }

  const prefijosValidos = [ "20" , "23" , "24" , "27" , "30" , "33" , "34" ] ;
  const prefijo = limpio.slice( 0 , 2 ) ;
  if( !prefijosValidos.includes( prefijo ) ) {
    return( false ) ;
  }

  let suma = 0 ;
  for( let i = 0 ; i < 10 ; i++ ) {
    suma += Number( limpio[i] ) * PONDERADORES_CUIT[i] ;
  }

  const resto = suma % 11 ;
  let dvEsperado = 0 ;

  if( resto === 0 ) {
    dvEsperado = 0 ;
  } else if( resto === 1 ) {
    // Para módulo 11 estándar de AFIP, un residuo de 1 indica combinación inválida
    return( false ) ;
  } else {
    dvEsperado = 11 - resto ;
  }

  return( Number( limpio[10] ) === dvEsperado ) ;
}
