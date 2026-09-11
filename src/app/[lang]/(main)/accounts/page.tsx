/**
 * @file page.tsx
 * Página de visualización y gestión del catálogo de cuentas contables por Entidad.
 */
// Shared
import { getDictionary }  from "@/shared/lib/dictionary" ;
import styles             from "./page.module.css" ;

// Feature: Accounting
import { getAccountsAction , getMonthlySummariesAction , getFinancialEntitiesAction } from "@/features/accounting/actions/accountingActions" ;
import { AccountsContainer }                                                          from "@/features/accounting/components/AccountsContainer" ;

// Feature: Cards
import { getCardsAction } from "@/features/cards/actions/cardsActions" ;


interface AccountsPageProps {
  params: Promise< {lang: string} > ;
}

export default async function AccountsPage( {params}: AccountsPageProps ) {
  const { lang } = await params ;
  const dict     = await getDictionary( lang ) ;

  // Consultar cuentas, históricos, entidades y tarjetas concurrentemente de la DB
  const [ accountsRes , summariesRes , entitiesRes , cardsRes ] = await Promise.all( [
    getAccountsAction() ,
    getMonthlySummariesAction() ,
    getFinancialEntitiesAction() ,
    getCardsAction()
  ] ) ;

  const accounts          = ( accountsRes.success ? accountsRes.value : [] ) ;
  const summaries         = ( summariesRes.success ? summariesRes.value : [] ) ;
  const financialEntities = ( entitiesRes.success ? entitiesRes.value : [] ) ;
  const cards             = ( cardsRes.success ? cardsRes.value : [] ) ;

  return(
    <div className={styles.container}>
      <AccountsContainer
        accounts={accounts}
        cards={cards}
        financialEntities={financialEntities}
        summaries={summaries}
        dict={dict}
        lang={lang}
      />
    </div>
  ) ;
}
