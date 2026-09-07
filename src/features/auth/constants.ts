/**
 * @file constants.ts
 * Constantes de autenticación compartidas entre servidor y cliente.
 *
 * Vive aparte de `shared/lib/auth.ts` a propósito: aquel módulo arrastra la configuración de
 * NextAuth, el cliente de base de datos y los repositorios, así que importarlo desde un Client
 * Component metería todo eso en el bundle del navegador. Este archivo no importa nada.
 */

/**
 * Código que devuelve `authorize` cuando el freno de fuerza bruta rechaza el intento.
 * Es un código y no una frase para que la traducción viva en los diccionarios.
 */
export const ERROR_DEMASIADOS_INTENTOS = "DEMASIADOS_INTENTOS" ;
