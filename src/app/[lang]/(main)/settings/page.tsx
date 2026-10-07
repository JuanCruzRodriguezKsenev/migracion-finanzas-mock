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

// Feature: Organizations
import { listarMiembrosAction } from "@/features/organizations/actions/membersActions" ;

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
      />
    </div>
  ) ;
}
