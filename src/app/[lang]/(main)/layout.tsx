/**
 * @file layout.tsx
 * Layout estructural (App Shell) para las rutas principales bajo el grupo (main).
 * Incorpora la barra lateral y el encabezado de navegación global.
 */
// Shared
import { MetricsVisibilityProvider } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { AppShell }                  from "@/shared/ui/layout/AppShell/AppShell" ;
import { getDictionary }             from "@/shared/lib/dictionary" ;

// Feature: Accounting
import { getEarliestMonthKeyAction } from "@/features/accounting/actions/accountingActions" ;


interface MainLayoutProps {
  children: React.ReactNode ;
  params:   Promise< {lang: string} > ;
}

export default async function MainLayout( {children , params}: MainLayoutProps ) {
  const { lang } = await params ;
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
