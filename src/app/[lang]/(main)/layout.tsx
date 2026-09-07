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

// Feature: Accounting
import { getEarliestMonthKeyAction } from "@/features/accounting/actions/accountingActions" ;


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

  const [ dict , earliestMonthResult ] = await Promise.all( [
    getDictionary( lang ) ,
    getEarliestMonthKeyAction() ,
  ] ) ;

  const ahora           = new Date() ;
  const currentMonthKey = `${ahora.getFullYear()}-${String( ahora.getMonth() + 1 ).padStart( 2 , "0" )}` ;
  const minKey          = earliestMonthResult.success ? earliestMonthResult.value : undefined ;

  return(
    <MetricsVisibilityProvider>
      <AppShell dict={dict} lang={lang} currentMonthKey={currentMonthKey} minKey={minKey}>
        { children }
      </AppShell>
    </MetricsVisibilityProvider>
  ) ;
}
