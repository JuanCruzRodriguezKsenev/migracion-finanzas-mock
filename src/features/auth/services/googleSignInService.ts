/**
 * @file googleSignInService.ts
 * Servicio para la resolución atómica de identidad y membresías al iniciar sesión con Google.
 * Implementa las reglas RN-1 a RN-4, RN-8, RN-14 y RN-40 a RN-44 del sistema de acceso (Revisión 3).
 */
// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { db }                 from "@/shared/db/client" ;

// Feature: Profile
import { profiles } from "@/features/profile/schema.db" ;

// Feature: Auth
import { invitationRepository }    from "../repositories/invitationRepository" ;
import { userRepository }          from "../repositories/userRepository" ;
import { asegurarEspacioPersonal } from "./espacioPersonalService" ;
import { memberships }             from "../schema.db" ;


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
 * ante denegaciones de acceso (Revisión 3 — registro abierto, caso 3b).
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
   * alta de cuenta, aceptación de invitaciones vigentes, aprovisionamiento
   * del espacio Personal y actualización de perfil (Revisión 3 — registro abierto).
   *
   * @param params - Datos del perfil y claims entregados por el proveedor Google.
   * @returns Result con `{ userId }` en caso de éxito, o código de fallo `"no_verificado" | "sin_acceso"`.
   */
  async resolverIdentidadGoogle(
    params: ResolverIdentidadGoogleParams
  ): Promise< Result< { userId: string } , ErrorGoogleSignIn > > {
    // 1. Si el email no está verificado en Google, denegar acceso inmediatamente sin tocar base de datos (Fila 1, RN-1, RN-43)
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
                // Caso 3b: el usuario ya tiene otro sub vinculado; denegar acceso (RN-43)
                throw( new RollbackError( "sin_acceso" ) ) ;
              }
            } else {
              // 4. Si no hay usuario: crear usuario y su registro de perfil inicial (Revisión 3, RN-40)
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

          // 5. En todos los caminos exitosos: aceptar todas las invitaciones vigentes del email (RN-4)
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

          // 6. Asegurar siempre el espacio Personal dentro de la transacción (RN-40, idempotente)
          await asegurarEspacioPersonal( usuario.id , tx ) ;

          // 7. Actualizar name e image desde Google si cambiaron (RN-8)
          if( (params.nombre !== undefined) || (params.imagen !== undefined) ){
            await userRepository.updateProfileFromGoogle(
              usuario.id ,
              { name: params.nombre , image: params.imagen } ,
              tx
            ) ;
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
