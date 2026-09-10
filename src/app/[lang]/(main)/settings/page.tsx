/**
 * @file page.tsx
 * Página de configuración de la organización (RFC 022, segunda tajada).
 * Server Component fino que obtiene el árbol de categorías contables y delega en el contenedor cliente.
 */
// Shared
import styles from "./page.module.css" ;

// Feature: Accounting
import { getCategoryTreeAction }       from "@/features/accounting/actions/categoryActions" ;
import { CategoriesSettingsContainer } from "@/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer" ;


export default async function SettingsPage() {
  const categoryTreeRes = await getCategoryTreeAction() ;
  const categoryTree    = ( categoryTreeRes.success ? categoryTreeRes.value : [] ) ;

  return(
    <div className={styles.container}>
      <CategoriesSettingsContainer
        initialTree={categoryTree}
      />
    </div>
  ) ;
}
