/**
 * @file exigirOwner.ts
 * Autorización de las acciones de gestión de miembros: sólo un `owner` de la organización activa.
 */
// Librerías externas
import type { Session } from "next-auth" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;

// Feature: Auth
import { membershipRepository } from "@/features/auth/repositories/membershipRepository" ;


export interface ContextoOwner {
  userId:         string ;
  organizationId: string ;
}

/**
 * Exige que la sesión pertenezca a un `owner` de su organización activa.
 *
 * El rol se consulta en la **base**, no en `session.user.role`: el rol del token se refresca como
 * mucho cada `REVALIDACION_MS`, y quien acaba de perder el rol `owner` no debe seguir gestionando
 * miembros durante esa ventana.
 *
 * @param session - Sesión de NextAuth, o `null` si no hay.
 * @returns Result con el usuario y la organización activa, o `fail("No autorizado.")`.
 */
export async function exigirOwner( session: Session | null ): Promise< Result< ContextoOwner , string > > {
  const userId         = session?.user?.id ;
  const organizationId = session?.user?.organizationId ;

  if( !userId || !organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  const membresia = await membershipRepository.findMembership( userId , organizationId ) ;

  if( !membresia || (membresia.role !== "owner") ) {
    return( fail( "No autorizado." ) ) ;
  }

  return( ok( { userId , organizationId } ) ) ;
}
