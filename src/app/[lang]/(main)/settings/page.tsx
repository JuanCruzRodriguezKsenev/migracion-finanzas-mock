/**
 * @file page.tsx
 * Página de configuración de la organización (RFC 022 / RFC 024).
 * Server Component fino que obtiene datos contables concurrentemente y delega en el shell cliente.
 */
// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;
import { authOptions }   from "@/shared/lib/auth" ;
import styles            from "./page.module.css" ;

// Feature: Settings
import { SettingsContainer } from "@/features/settings/components/SettingsContainer" ;

// Feature: Auth
import { membershipRepository } from "@/features/auth/repositories/membershipRepository" ;

// Feature: Organizations
import { listarHabilitacionesAction } from "@/features/organizations/actions/habilitacionesActions" ;
import { listarMiembrosAction }        from "@/features/organizations/actions/membersActions" ;

// Feature: Splits
import { obtenerAcuerdoAction } from "@/features/splits/actions/acuerdoActions" ;
import { obtenerSaldosAction }  from "@/features/splits/actions/saldosActions" ;
import { obtenerCajaAction }   from "@/features/splits/actions/cajaActions" ;

// Feature: Accounting
import { getAccountsAction }     from "@/features/accounting/actions/accountingActions" ;
import { getCategoryTreeAction } from "@/features/accounting/actions/categoryActions" ;


interface SettingsPageProps {
  params: Promise< {lang: string} > ;
}

export default async function SettingsPage( {params}: SettingsPageProps ) {
  const { lang } = await params ;

  const [ dict , categoryTreeRes , accountsRes , miembrosRes , session ] = await Promise.all( [
    getDictionary( lang ) ,
    getCategoryTreeAction() ,
    getAccountsAction() ,
    // Falla (y se descarta) si quien mira no es `owner`: la pestaña Miembros sólo existe para ellos.
    listarMiembrosAction() ,
    getServerSession( authOptions ) ,
  ] ) ;

  const categoryTree = ( categoryTreeRes.success ? categoryTreeRes.value : [] ) ;
  const accounts     = ( accountsRes.success ? accountsRes.value : [] ) ;

  // Nombre y cantidad de organizaciones para la pestaña Organización, que sólo existe para un `owner`.
  const membresias   = ( (miembrosRes.success && session?.user?.id) ? await membershipRepository.findByUser( session.user.id ) : [] ) ;
  const activa       = membresias.find( ( m ) => m.organizationId === session?.user?.organizationId ) ;
  const organizacion = ( activa ? { nombre: activa.organizationName , cantidadOrganizaciones: membresias.length } : null ) ;

  // El rol sale de la base, no del token (como el layout). La pestaña Habilitaciones no es para `viewer`.
  const membresia         = ( (session?.user?.id && session.user.organizationId) ? await membershipRepository.findMembership( session.user.id , session.user.organizationId ) : null ) ;
  const rol               = ( membresia?.role ?? "" ) ;
  const habilitacionesRes = ( ((rol === "owner") || (rol === "member")) ? await listarHabilitacionesAction() : null ) ;
  // La pestaña Acuerdo es para `owner` y `member`; el `viewer` no la ve (S-W)
  const acuerdoRes        = ( ((rol === "owner") || (rol === "member")) ? await obtenerAcuerdoAction() : null ) ;
  // La pestaña Saldos la ven los tres roles cuando hay algo que mostrar (S-X); el `viewer` la ve sin botones
  const saldosRes         = await obtenerSaldosAction() ;
  // La pestaña Caja la ven los tres roles cuando la caja común está activa (RN-25, S-AN)
  const cajaRes           = await obtenerCajaAction() ;

  return(
    <div className={styles.container}>
      <SettingsContainer
        initialTree={categoryTree}
        accounts={accounts}
        dict={dict}
        lang={lang}
        esOwner={miembrosRes.success}
        miembros={miembrosRes.success ? miembrosRes.value : null}
        currentUserId={session?.user?.id ?? ""}
        organizacion={organizacion}
        rol={rol}
        habilitaciones={habilitacionesRes?.success ? habilitacionesRes.value : null}
        acuerdo={acuerdoRes?.success ? acuerdoRes.value : null}
        saldos={saldosRes.success ? saldosRes.value : null}
        caja={cajaRes.success ? cajaRes.value : null}
      />
    </div>
  ) ;
}
