/**
 * @file page.tsx
 * Página de configuración de la organización (RFC 022, segunda tajada).
 * Server Component fino que obtiene el árbol de categorías contables y delega en el contenedor cliente.
 */
// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;
import styles            from "./page.module.css" ;

// Feature: Accounting
import { getCategoryTreeAction }       from "@/features/accounting/actions/categoryActions" ;
import { CategoriesSettingsContainer } from "@/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer" ;


interface SettingsPageProps {
  params: Promise< {lang: string} > ;
}

export default async function SettingsPage( {params}: SettingsPageProps ) {
  const { lang } = await params ;

  const [ dict , categoryTreeRes ] = await Promise.all( [
    getDictionary( lang ) ,
    getCategoryTreeAction() ,
  ] ) ;

  const categoryTree = ( categoryTreeRes.success ? categoryTreeRes.value : [] ) ;

  return(
    <div className={styles.container}>
      <CategoriesSettingsContainer
        initialTree={categoryTree}
        dict={dict}
        lang={lang}
      />
    </div>
  ) ;
}
