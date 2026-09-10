/**
 * @file page.tsx
 * Página de Suscripciones Recurrentes (Server Component).
 * Resuelve la zona horaria del usuario, calcula los períodos pendientes propuestos
 * y delega el dashboard y la bandeja al cliente (RFC 023).
 */
// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;
import { authOptions }   from "@/shared/lib/auth" ;

// Feature: Profile
import { profileRepository } from "@/features/profile/repositories/profileRepository" ;

// Feature: Accounting
import { accountRepository } from "@/features/accounting/repositories/accountRepository" ;

// Feature: Subscriptions
import { getSubscriptionsAction } from "@/features/subscriptions/actions/subscriptionsActions" ;
import { SubscriptionDashboard }  from "@/features/subscriptions/components/SubscriptionDashboard" ;
import {
  pendientesDe ,
  obtenerHoyCivil
} from "@/features/subscriptions/services/recurrenceService" ;


interface SubscriptionsPageProps {
  params: Promise< {lang: string} > ;
}

export default async function SubscriptionsPage( {params}: SubscriptionsPageProps ) {
  const { lang } = await params ;
  const dict     = await getDictionary( lang ) ;

  const session        = await getServerSession( authOptions ) ;
  const organizationId = session?.user?.organizationId ;

  const result        = await getSubscriptionsAction() ;
  const subscriptions = ( result.success ? result.value : [] ) ;

  // Resolver zona horaria del perfil y fecha civil
  const profile  = ( session?.user?.id ? await profileRepository.findByUserId( session.user.id ) : null ) ;
  const timeZone = ( profile?.timezone || "America/Argentina/Buenos_Aires" ) ;
  const hoyCivil = obtenerHoyCivil( timeZone ) ;

  // Derivar pendientes de cobro propuestos para la bandeja (RFC 023 §3.3)
  const pendingOccurrences = subscriptions.flatMap( ( s ) => pendientesDe( s , hoyCivil ) ) ;
  pendingOccurrences.sort( ( a , b ) => a.fechaCobro.localeCompare( b.fechaCobro ) ) ;

  // Cuentas contables para imputar pagos
  const allAccounts     = ( organizationId ? await accountRepository.findAll( organizationId ) : [] ) ;
  const paymentAccounts = allAccounts.filter( ( a ) => (a.type === "asset") || (a.type === "liability") ) ;

  return(
    <SubscriptionDashboard
      initialData={subscriptions}
      initialPending={pendingOccurrences}
      accounts={paymentAccounts}
      dict={dict}
      lang={lang}
    />
  ) ;
}
