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
import { profileRepository }   from "../repositories/profileRepository" ;
import { updateProfileSchema } from "../schemas/profile.schema" ;
import { ProfileData }         from "../types" ;

/**
 * Actualiza el perfil del usuario autenticado en la base de datos tras validar los campos permitidos.
 * 
 * @param newData - Datos parciales a actualizar.
 * @returns Un objeto que indica el éxito de la operación y el registro actualizado o el error.
 */
export async function updateProfileAction( newData: unknown ): Promise< Result<ProfileData> > {

  const session = await getServerSession( authOptions ) ;
  
  if( !session?.user?.id ) {
    return( fail("No autorizado para modificar el perfil.") ) ;
  }

  const validation = updateProfileSchema.safeParse( newData ) ;
  if( !validation.success ) {
    const errorMsg = validation.error.issues[0]?.message || "Datos de perfil inválidos." ;
    return( fail(errorMsg) ) ;
  }

  try {
    const updated = await profileRepository.update( session.user.id , validation.data ) ;

    return( ok(updated) ) ;
  } catch {
    return( fail("Error al actualizar el perfil en la base de datos.") ) ;
  }

}

