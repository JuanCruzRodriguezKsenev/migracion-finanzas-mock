/**
 * @file auth.ts
 * Configuración central y callbacks para NextAuth.
 * Implementa la estrategia de sesión basada en JWT y el proveedor de credenciales locales.
 */
// Librerías externas
import CredentialsProvider from "next-auth/providers/credentials" ;
import { NextAuthOptions } from "next-auth" ;

// Feature: Auth
import { userRepository }  from "@/features/auth/repositories/userRepository" ;
import { verifyPassword }  from "@/features/auth/services/authService" ;

// Hash y salt señuelo (valores fijos arbitrarios) para igualar el tiempo de respuesta
// cuando el email no existe. Nunca validan a nadie: solo consumen el mismo costo de scrypt.
const DUMMY_SALT = "0123456789abcdef0123456789abcdef" ;
const DUMMY_HASH = "0".repeat( 128 ) ;

// Falla rápido en producción si falta el secreto de firma del JWT:
// sin él, NextAuth generaría sesiones con un secreto derivado inseguro.
if( (process.env.NODE_ENV === "production") && !process.env.NEXTAUTH_SECRET ){
  throw new Error( "NEXTAUTH_SECRET no está definida. Configurala en las variables de entorno antes de desplegar." ) ;
}

export const authOptions: NextAuthOptions = {
  secret:  process.env.NEXTAUTH_SECRET ,
  session: { strategy: "jwt" } ,

  providers: [
    CredentialsProvider( {
      name: "credentials" ,
      credentials: {
        email:    { label: "Email"    , type: "email"    } ,
        password: { label: "Password" , type: "password" } ,
      } ,
      /**
       * Método encargado de autenticar y autorizar a un usuario validando credenciales
       * contra la base de datos física PostgreSQL.
       * 
       * @param credentials - Credenciales enviadas por el formulario (email y contraseña).
       * @returns Un objeto de usuario si la verificación es exitosa, o null en caso contrario.
       */
      async authorize( credentials ) {
        if( !credentials?.email || !credentials?.password ){
          return( null ) ;
        }

        // Buscar el usuario utilizando el repositorio de la feature auth
        const usuario = await userRepository.findByEmail( credentials.email ) ;

        if( !usuario ){
          // Ejecutar una verificación señuelo con costo criptográfico idéntico al camino real.
          // Sin esto, la respuesta inmediata delataría por tiempo qué emails existen en el sistema
          // (el propio authService.ts documenta esta amenaza en verifyPassword).
          await verifyPassword( credentials.password , DUMMY_HASH , DUMMY_SALT ) ;

          return( null ) ;
        }

        // Verificar la contraseña cifrada
        const esContraseniaValida = await verifyPassword(
          credentials.password ,
          usuario.passwordHash ,
          usuario.salt ,
        ) ;

        if( !esContraseniaValida ){ return( null ) ; }

        // Retornar la información del usuario mapeada con los tipos extendidos
        return( {
          id:             usuario.id ,
          email:          usuario.email ,
          name:           usuario.name ,
          organizationId: usuario.organizationId ,
          role:           usuario.role ,
        } ) ;
      } ,
    } ) ,
  ] ,
  callbacks: {
    /**
     * Transfiere la información de identidad del usuario al JWT de forma segura
     * durante el flujo de inicio de sesión.
     */
    async jwt( {token , user} ) {
      if( user ){
        token.id             = user.id ;
        token.organizationId = user.organizationId ;
        token.role           = user.role ;
      }
      return( token ) ;
    } ,
    /**
     * Inyecta los metadatos multi-tenant desde el JWT decodificado en la sesión
     * de React, haciéndolos accesibles para componentes servidor y cliente.
     */
    async session( {session , token} ) {
      if( session.user ){
        session.user.id             = token.id ;
        session.user.organizationId = token.organizationId ;
        session.user.role           = token.role ;
      }
      return( session ) ;
    } ,
  } ,
  pages: {signIn: "/auth/signin"} ,
} ;


