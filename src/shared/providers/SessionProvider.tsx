/**
 * @file SessionProvider.tsx
 * Proveedor de sesión de NextAuth para el lado del cliente (Client Component Wrapper).
 */
"use client" ;

// Librerías externas
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react" ;

interface SessionProviderProps {
  children: React.ReactNode ;
}

/**
 * Componente cliente que envuelve a la aplicación con el contexto de sesión de NextAuth.
 */
export function SessionProvider( {children}: SessionProviderProps ) {
  return(
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  ) ;
}
