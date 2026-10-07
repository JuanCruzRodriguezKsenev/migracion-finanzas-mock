/**
 * @file nombreVisible.ts
 * Nombre con el que se muestra a una persona en la interfaz y en las consultas de autoría.
 */

/**
 * Nombre que se muestra de una persona: su nombre, o la parte local del correo si no tiene.
 *
 * @param nombre - `users.name`, posiblemente nulo o vacío.
 * @param email - Correo del usuario.
 * @returns Texto visible, nunca vacío.
 */
export function nombreVisible( nombre: string | null | undefined , email: string ): string {
  const limpio = nombre?.trim() ;

  return( limpio ? limpio : email.split( "@" )[0] ) ;
}
