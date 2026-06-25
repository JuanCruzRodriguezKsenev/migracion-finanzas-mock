/**
 * @file auth.ts
 * Configuración central y callbacks para NextAuth.
 * Implementa la estrategia de sesión basada en JWT y el proveedor de credenciales locales.
 */
import { NextAuthOptions } from "next-auth" ;
import CredentialsProvider from "next-auth/providers/credentials" ;
import { eq } from "drizzle-orm" ;
import { db } from "@/shared/db/client" ;
import { users } from "@/features/auth/schema.db" ;
import { verifyPassword } from "@/features/auth/services/authService" ;

export const authOptions: NextAuthOptions = {
  session: {strategy: "jwt" ,} ,
  providers: [
    CredentialsProvider( {
      name: "credentials" ,
      credentials: {
        email:    {label: "Email" , type: "email"} ,
        password: {label: "Password" , type: "password"} ,
      } ,
      /**
       * Método encargado de autenticar y autorizar a un usuario validando credenciales
       * contra la base de datos física PostgreSQL.
       * 
       * @param credentials - Credenciales enviadas por el formulario (email y contraseña).
       * @returns Un objeto de usuario si la verificación es exitosa, o null en caso contrario.
       */
      async authorize( credentials ) {
        if( !(credentials?.email) || !(credentials?.password) ){
          return( null ) ;
        }

        // Buscar el usuario directamente en la base de datos sin barrel files
        const [ usuario ] = await db
          .select()
          .from( users )
          .where( eq(users.email , credentials.email) )
          .limit( 1 ) ;

        if( !usuario ){
          return( null ) ;
        }

        // Verificar la contraseña cifrada
        const esContraseniaValida = await verifyPassword(
          credentials.password ,
          usuario.passwordHash ,
          usuario.salt ,
        ) ;

        if( !esContraseniaValida ){
          return( null ) ;
        }

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
  pages: {signIn: "/auth/signin" ,} ,
} ;
