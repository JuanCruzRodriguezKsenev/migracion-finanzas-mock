/**
 * @file page.tsx
 * Página de visualización y gestión de Tarjetas de Crédito y Débito (/cards).
 * Server Component fino que orquesta la carga concurrente sin cascadas (Promise.all).
 */
// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;
import styles            from "./page.module.css" ;

// Feature: Accounting
import { getAccountsAction , getFinancialEntitiesAction } from "@/features/accounting/actions/accountingActions" ;

// Feature: Cards
import { CardsContainer } from "@/features/cards/components/CardsContainer" ;
import { getCardsAction } from "@/features/cards/actions/cardsActions" ;


interface CardsPageProps {
  params: Promise< {lang: string} > ;
}

export default async function CardsPage( {params}: CardsPageProps ) {
  const { lang } = await params ;

  // Carga concurrente en el servidor sin cascadas (async-parallel de Vercel y RFC 007 §8D)
  const [ dict , cardsRes , accountsRes , entitiesRes ] = await Promise.all( [
    getDictionary( lang ) ,
    getCardsAction() ,
    getAccountsAction() ,
    getFinancialEntitiesAction() ,
  ] ) ;

  const cards             = ( cardsRes.success ? cardsRes.value : [] ) ;
  const accounts          = ( accountsRes.success ? accountsRes.value : [] ) ;
  const financialEntities = ( entitiesRes.success ? entitiesRes.value : [] ) ;

  return(
    <div className={styles.container}>
      <CardsContainer
        initialCards={cards}
        accounts={accounts}
        financialEntities={financialEntities}
        dict={dict}
        lang={lang}
      />
    </div>
  ) ;
}
