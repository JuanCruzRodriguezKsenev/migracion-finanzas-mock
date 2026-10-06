/**
 * @file testFixtures.ts
 * Utilidades y creadores de entidades base para la suite de pruebas automatizadas.
 */
// Shared
import { db , DBOrTx } from "./client" ;

// Feature: Auth
import { users , memberships } from "@/features/auth/schema.db" ;
import type { User }           from "@/features/auth/repositories/userRepository" ;


export interface OpcionesCrearUsuarioConMembresia {
  organizationId:      string ;
  email?:              string ;
  name?:               string ;
  role?:               string ;
  passwordHash?:       string ;
  salt?:               string ;
  hashParams?:         string ;
  lastOrganizationId?: string | null ;
}

/**
 * Inserta un usuario junto con su membresía inicial en una organización dada.
 *
 * @param opciones - Parámetros de creación del usuario y su rol en la organización.
 * @param tx - Instancia de transacción opcional.
 * @returns El registro de usuario insertado.
 */
export async function crearUsuarioConMembresia(
  opciones: OpcionesCrearUsuarioConMembresia ,
  tx:       DBOrTx = db
): Promise< User > {
  const [ usuario ] = await tx
    .insert( users )
    .values( {
      email:              opciones.email ?? `usuario-${Date.now()}-${Math.random().toString( 36 ).slice( 2 , 7 )}@ejemplo.com` ,
      name:               opciones.name ?? "Usuario de Prueba" ,
      passwordHash:       opciones.passwordHash ?? "0".repeat( 128 ) ,
      salt:               opciones.salt ?? "0123456789abcdef0123456789abcdef" ,
      hashParams:         opciones.hashParams ,
      lastOrganizationId: ( opciones.lastOrganizationId !== undefined ) ? opciones.lastOrganizationId : opciones.organizationId ,
    } )
    .returning() ;

  await tx
    .insert( memberships )
    .values( {
      userId:         usuario.id ,
      organizationId: opciones.organizationId ,
      role:           opciones.role ?? "member" ,
    } ) ;

  return( usuario ) ;
}
