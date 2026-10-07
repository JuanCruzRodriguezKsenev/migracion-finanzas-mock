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

// Feature: Auth
import { membershipRepository } from "@/features/auth/repositories/membershipRepository" ;

// Feature: Organizations
import { OrganizationSwitcher } from "@/features/organizations/components/OrganizationSwitcher" ;


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

  const [ dict , membresias ] = await Promise.all( [
    getDictionary( lang ) ,
    membershipRepository.findByUser( session.user.id ) ,
  ] ) ;

  const organizaciones = membresias.map( ( m ) => ( { id: m.organizationId , nombre: m.organizationName , rol: m.role } ) ) ;
  const t              = dict.organizations ;

  return(
    <MetricsVisibilityProvider>
      <AppShell
        dict={dict}
        selector={
          <OrganizationSwitcher
            organizaciones={organizaciones}
            activaId={session.user.organizationId}
            dict={ { ...t.switcher , create: t.create } }
          />
        }
      >
        { children }
      </AppShell>
    </MetricsVisibilityProvider>
  ) ;
}
