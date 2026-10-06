/**
 * @file googleSignInService.ts
 * Servicio para la resolución atómica de identidad y membresías al iniciar sesión con Google.
 * Implementa las reglas RN-1 a RN-5, RN-8, RN-14 y NFR-2 del sistema de acceso.
 */
// Librerías externas
import { eq } from "drizzle-orm" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { db }                 from "@/shared/db/client" ;

// Feature: Profile
import { profiles } from "@/features/profile/schema.db" ;

// Feature: Auth
import { invitationRepository } from "../repositories/invitationRepository" ;
import { userRepository }       from "../repositories/userRepository" ;
import { memberships }          from "../schema.db" ;


export interface ResolverIdentidadGoogleParams {
  sub:             string ;
  email:           string ;
  emailVerificado: boolean ;
  nombre?:         string | null ;
  imagen?:         string | null ;
}

export type ErrorGoogleSignIn = "no_verificado" | "sin_acceso" ;

/**
 * Error de control interno para forzar el rollback atómico de la transacción
 * ante denegaciones de acceso (RN-5, Fila 6).
 */
class RollbackError extends Error {
  constructor( public readonly errorReason: ErrorGoogleSignIn ) {
    super( errorReason ) ;
  }
}

/**
 * Servicio de Autenticación con Google.
 */
export const googleSignInService = {
  /**
   * Resuelve la identidad de un usuario a partir de su cuenta de Google.
   * Ejecuta de forma atómica dentro de una única transacción la vinculación,
   * alta de cuenta, aceptación de invitaciones vigentes y actualización de perfil.
   *
   * @param params - Datos del perfil y claims entregados por el proveedor Google.
   * @returns Result con `{ userId }` en caso de éxito, o código de fallo `"no_verificado" | "sin_acceso"`.
   */
  async resolverIdentidadGoogle(
    params: ResolverIdentidadGoogleParams
  ): Promise< Result< { userId: string } , ErrorGoogleSignIn > > {
    // 1. Si el email no está verificado en Google, denegar acceso inmediatamente sin tocar base de datos (Fila 1, RN-1)
    if( !params.emailVerificado ){
      return( fail( "no_verificado" ) ) ;
    }

    try {
      return(
        await db.transaction( async ( tx ) => {
          let usuario = await userRepository.findByGoogleSub( params.sub , tx ) ;

          if( !usuario ){
            // 3. Si no existe por sub, buscar si existe por email
            const usuarioExistente = await userRepository.findByEmail( params.email , tx ) ;

            if( usuarioExistente ){
              if( usuarioExistente.googleSub === null ){
                // Fila 3: vincular googleSub a la cuenta existente
                await userRepository.linkGoogle( usuarioExistente.id , params.sub , tx ) ;
                usuario = { ...usuarioExistente , googleSub: params.sub } ;
              } else {
                // Caso 3b: el usuario ya tiene otro sub vinculado; denegar acceso
                throw( new RollbackError( "sin_acceso" ) ) ;
              }
            } else {
              // 4. Si no hay usuario: comprobar si tiene invitaciones vigentes (Fila 4 vs Fila 5)
              const invitacionesVigentes = await invitationRepository.findVigentesPorEmail( params.email , tx ) ;

              if( invitacionesVigentes.length === 0 ){
                throw( new RollbackError( "sin_acceso" ) ) ;
              }

              // Crear usuario y su registro de perfil inicial (con valores por defecto)
              usuario = await userRepository.createFromGoogle(
                {
                  googleSub: params.sub ,
                  email:     params.email ,
                  name:      params.nombre ,
                  image:     params.imagen
                } ,
                tx
              ) ;

              await tx.insert( profiles ).values( { userId: usuario.id } ) ;
            }
          }

          // 5. En todos los caminos exitosos (2, 3 y 4): aceptar todas las invitaciones vigentes del email (RN-4)
          const invitaciones = await invitationRepository.findVigentesPorEmail( params.email , tx ) ;

          for( const inv of invitaciones ){
            await tx
              .insert( memberships )
              .values( {
                userId:         usuario.id ,
                organizationId: inv.organizationId ,
                role:           inv.role
              } )
              .onConflictDoNothing() ;

            await invitationRepository.marcarAceptada( inv.id , tx ) ;
          }

          // Si el usuario no tenía lastOrganizationId, fijarlo en la primera organización aceptada (RN-14)
          if( !usuario.lastOrganizationId && (invitaciones.length > 0) ){
            const primeraOrgId = invitaciones[0].organizationId ;
            await userRepository.registrarUltimaOrganizacion( usuario.id , primeraOrgId , tx ) ;
            usuario.lastOrganizationId = primeraOrgId ;
          }

          // 6. Actualizar name e image desde Google (RN-8)
          if( (params.nombre !== undefined) || (params.imagen !== undefined) ){
            await userRepository.updateProfileFromGoogle(
              usuario.id ,
              { name: params.nombre , image: params.imagen } ,
              tx
            ) ;
          }

          // 7. Si después de todo el usuario no tiene ninguna membresía, denegar y hacer rollback (Fila 6, RN-5)
          const [ algunaMembresia ] = await tx
            .select( { id: memberships.userId } )
            .from( memberships )
            .where( eq( memberships.userId , usuario.id ) )
            .limit( 1 ) ;

          if( !algunaMembresia ){
            throw( new RollbackError( "sin_acceso" ) ) ;
          }

          return( ok( { userId: usuario.id } ) ) ;
        } )
      ) ;
    } catch( error ) {
      if( error instanceof RollbackError ){
        return( fail( error.errorReason ) ) ;
      }
      throw( error ) ;
    }
  }
} ;
