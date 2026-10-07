/**
 * @file avisoOrganizacion.ts
 * Aviso provisorio tras abandonar o eliminar una organización (RN-37).
 * No hay sistema de avisos en el repo: el texto viaja por `sessionStorage` hasta que el selector,
 * que vive en el layout, lo lee. Si `sessionStorage` no está disponible el flujo sigue sin aviso.
 */

/** Clave de `sessionStorage` donde se deja el texto del aviso. */
export const CLAVE_AVISO_ORGANIZACION = "aviso-organizacion" ;

/**
 * Guarda el texto del aviso para el próximo render del selector.
 *
 * @param texto - Mensaje ya armado («Abandonaste Casa»).
 */
export function guardarAvisoOrganizacion( texto: string ): void {
  try {
    sessionStorage.setItem( CLAVE_AVISO_ORGANIZACION , texto ) ;
  } catch {
    // Sin aviso: no es motivo para romper la operación.
  }
}

/**
 * Lee el aviso pendiente y lo borra, para que se muestre una sola vez.
 *
 * @returns El texto, o cadena vacía si no hay o no se puede leer.
 */
export function consumirAvisoOrganizacion(): string {
  try {
    const texto = sessionStorage.getItem( CLAVE_AVISO_ORGANIZACION ) ;

    if( texto ) {
      sessionStorage.removeItem( CLAVE_AVISO_ORGANIZACION ) ;
    }

    return( texto ?? "" ) ;
  } catch {
    return( "" ) ;
  }
}
