/**
 * @file authorizationService.ts
 * Guarda de escritura (RN-23, RN-24): toda acción que modifica datos de la organización activa la llama primero.
 */
// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;

// Feature: Auth
import { membershipRepository }          from "@/features/auth/repositories/membershipRepository" ;
import { ERROR_SIN_PERMISO_DE_ESCRITURA } from "@/features/auth/constants" ;


/** Usuario y organización activa de una sesión autorizada a escribir. */
export interface SesionDeEscritura {
  userId:         string ;
  organizationId: string ;
}

/**
 * Resuelve la sesión y exige que el usuario pueda escribir en su organización activa.
 *
 * El rol sale de la **base**, no del token: el del JWT se refresca como mucho cada `REVALIDACION_MS`,
 * y quien acaba de pasar a `viewer` no debe seguir escribiendo durante esa ventana (RN-24, AC-20).
 * Va **primera** en cada acción de escritura, antes de validar con Zod.
 *
 * @returns `ok` con el usuario y la organización para `owner` y `member`; `fail` sin sesión, sin membresía o `viewer`.
 */
export async function obtenerSesionDeEscritura(): Promise< Result< SesionDeEscritura , string > > {
  const session        = await getServerSession( authOptions ) ;
  const userId         = session?.user?.id ;
  const organizationId = session?.user?.organizationId ;

  if( !userId || !organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  const membresia = await membershipRepository.findMembership( userId , organizationId ) ;

  if( !membresia ) {
    return( fail( "Tu sesión ya no es válida. Volvé a iniciar sesión." ) ) ;
  }

  if( membresia.role === "viewer" ) {
    return( fail( ERROR_SIN_PERMISO_DE_ESCRITURA ) ) ;
  }

  return( ok( { userId , organizationId } ) ) ;
}
