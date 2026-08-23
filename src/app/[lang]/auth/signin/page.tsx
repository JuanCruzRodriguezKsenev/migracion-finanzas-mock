/**
 * @file page.tsx
 * Página de inicio de sesión (Sign In) internacionalizada y protegida (Server Component).
 */
// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Auth
import { SignInForm } from "@/features/auth/components/SignInForm" ;


interface SignInPageProps {
  params: Promise< {lang: string} > ;
}

/**
 * Contenedor del servidor para la pantalla de inicio de sesión.
 * Carga el diccionario correspondiente al locale de la URL y delega la renderización.
 */
export default async function SignInPage( {params}: SignInPageProps ) {
  const { lang } = await params ;
  const dict     = await getDictionary( lang ) ;

  return(
    <SignInForm dict={dict.signin} lang={lang} />
  ) ;
}
