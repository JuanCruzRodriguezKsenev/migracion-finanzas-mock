/**
 * @file route.ts
 * Manejador de rutas de API de NextAuth.
 * Expone los endpoints GET y POST necesarios para la autenticación local y de sesión.
 */
import NextAuth from "next-auth" ;
import { authOptions } from "@/shared/lib/auth" ;

const handler = NextAuth( authOptions ) ;

// Re-exportar el manejador de NextAuth bajo las firmas GET y POST requeridas por Next.js App Router.
export { handler as GET , handler as POST } ;
