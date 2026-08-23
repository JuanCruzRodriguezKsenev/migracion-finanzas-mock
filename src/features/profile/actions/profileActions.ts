/**
 * @file profileActions.ts
 * Acciones de servidor (Server Actions) para la gestión del perfil de usuario.
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;

// Feature: Profile
import { profileRepository } from "../repositories/profileRepository" ;
import { ProfileData }       from "../types" ;

/**
 * Actualiza el perfil del usuario autenticado en la base de datos.
 * 
 * @param newData - Datos parciales a actualizar.
 * @returns Un objeto que indica el éxito de la operación y el registro actualizado o el error.
 */
export async function updateProfileAction( newData: Partial< ProfileData > ): Promise< Result<ProfileData> > {

  const session = await getServerSession( authOptions ) ;
  
  if( !session?.user?.id ) {
    return( fail("No autorizado para modificar el perfil.") ) ;
  }

  try {
    const updated = await profileRepository.update( session.user.id , newData ) ;

    return( ok(updated) ) ;
  } catch( error ) {
    return( fail("Error al actualizar el perfil en la base de datos.") ) ;
  }

}
