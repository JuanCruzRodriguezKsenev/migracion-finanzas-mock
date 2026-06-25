/**
 * @file profileActions.ts
 * Acciones de servidor (Server Actions) para la gestión del perfil de usuario.
 */
"use server" ;

import { eq } from "drizzle-orm" ;
import { db } from "@/shared/db/client" ;
import { profiles } from "../schema.db" ;
import { ProfileData } from "../types" ;
import { getServerSession } from "next-auth" ;
import { authOptions } from "@/shared/lib/auth" ;

/**
 * Actualiza el perfil del usuario autenticado en la base de datos.
 * 
 * @param newData - Datos parciales a actualizar.
 * @returns Un objeto que indica el éxito de la operación y el registro actualizado o el error.
 */
export async function updateProfileAction( newData: Partial< ProfileData > ) {
  const session = await getServerSession( authOptions ) ;
  
  if( !session?.user?.id ){
    return( {isOk: false , error: {message: "No autorizado para modificar el perfil."}} ) ;
  }

  try {
    const [ updated ] = await db
      .update( profiles )
      .set( newData )
      .where( eq(profiles.userId , session.user.id) )
      .returning() ;

    return( {isOk: true , value: updated} ) ;
  } catch( error ) {
    return( {isOk: false , error: {message: "Error al actualizar el perfil en la base de datos."}} ) ;
  }
}
