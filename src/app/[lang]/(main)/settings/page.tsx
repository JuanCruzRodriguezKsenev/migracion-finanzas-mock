/**
 * @file page.tsx
 * Página de configuración de la organización (RFC 022 / RFC 024).
 * Server Component fino que obtiene datos contables concurrentemente y delega en el shell cliente.
 */
// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;
import styles            from "./page.module.css" ;

// Feature: Settings
import { SettingsContainer } from "@/features/settings/components/SettingsContainer" ;

// Feature: Accounting
import { getAccountsAction }     from "@/features/accounting/actions/accountingActions" ;
import { getCategoryTreeAction } from "@/features/accounting/actions/categoryActions" ;


interface SettingsPageProps {
  params: Promise< {lang: string} > ;
}

export default async function SettingsPage( {params}: SettingsPageProps ) {
  const { lang } = await params ;

  const [ dict , categoryTreeRes , accountsRes ] = await Promise.all( [
    getDictionary( lang ) ,
    getCategoryTreeAction() ,
    getAccountsAction() ,
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
      />
    </div>
  ) ;
}
