/**
 * @file layout.tsx
 * Layout estructural (App Shell) para las rutas principales bajo el grupo (main).
 * Incorpora la barra lateral y el encabezado de navegación global.
 */
// Librerías externas
import { getServerSession } from "next-auth" ;
import { redirect }         from "next/navigation" ;

// Shared
import { MetricsVisibilityProvider } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { AppShell }                  from "@/shared/ui/layout/AppShell/AppShell" ;
import { getDictionary }             from "@/shared/lib/dictionary" ;
import { authOptions }               from "@/shared/lib/auth" ;


interface MainLayoutProps {
  children: React.ReactNode ;
  params:   Promise< {lang: string} > ;
}

export default async function MainLayout( {children , params}: MainLayoutProps ) {
  const { lang } = await params ;
  const session  = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ){
    // `expired` no es cosmético: le dice al proxy que la cookie que trae esta petición ya no vale.
    // Sin esa marca, el proxy —que lee el token con `getToken()`, sin ejecutar los callbacks— sigue
    // viendo una sesión con organización y devuelve al usuario acá, en un bucle de redirecciones.
    // Ver `proxy.ts` §Sesión caducada.
    redirect( `/${lang}/auth/signin?expired=1` ) ;
  }

  const dict = await getDictionary( lang ) ;

  return(
    <MetricsVisibilityProvider>
      <AppShell dict={dict}>
        { children }
      </AppShell>
    </MetricsVisibilityProvider>
  ) ;
}
