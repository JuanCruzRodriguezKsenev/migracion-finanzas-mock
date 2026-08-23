/**
 * @file types.ts
 * Extensiones de tipos globales para NextAuth.
 * Añade soporte para el id de organización (multi-tenant) y roles de usuario.
 */
// Librerías externas
import { DefaultSession } from "next-auth" ;


declare module "next-auth" {
  /**
   * Extensión de la sesión del usuario en NextAuth para incorporar
   * metadatos multi-tenant indispensables para la capa de seguridad.
   */
  interface Session {
    user: {
      id:             string ; // Identificador único del usuario (UUID)
      organizationId: string ; // ID de la organización (Tenant) activa
      role:           string ; // Rol del usuario en la organización ('owner' | 'admin' | 'member')
    } & DefaultSession[ "user" ] ;
  }

  /**
   * Extensión de la interfaz de Usuario base de NextAuth.
   */
  interface User {
    id:             string ;
    organizationId: string ;
    role:           string ;
  }
}

declare module "next-auth/jwt" {
  /**
   * Extensión de los claims del JWT de NextAuth para persistir
   * la identidad y contexto multi-tenant en cookies encriptadas.
   */
  interface JWT {
    id:             string ;
    organizationId: string ;
    role:           string ;
  }
}