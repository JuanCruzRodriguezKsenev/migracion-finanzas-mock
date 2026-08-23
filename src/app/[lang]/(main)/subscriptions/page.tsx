/**
 * @file page.tsx
 * Página de Suscripciones Recurrentes (Server Component).
 * Carga las suscripciones de la organización y delega el dashboard al cliente.
 */
// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Subscriptions
import { SubscriptionDashboard } from "@/features/subscriptions/components/SubscriptionDashboard" ;
import { getSubscriptionsAction } from "@/features/subscriptions/actions/subscriptionsActions" ;


interface SubscriptionsPageProps {
  params: Promise< {lang: string} > ;
}

export default async function SubscriptionsPage( {params}: SubscriptionsPageProps ) {
  const { lang } = await params ;
  const dict     = await getDictionary( lang ) ;

  const result        = await getSubscriptionsAction() ;
  const subscriptions = ( result.success ? result.value : [] ) ;

  return(
    <SubscriptionDashboard
      initialData={subscriptions}
      dict={dict.subscriptionsPage}
    />
  ) ;
}
