/**
 * @file page.tsx
 * Página de visualización y gestión de Tarjetas de Crédito y Débito (/cards).
 * Server Component fino que orquesta la carga concurrente sin cascadas (Promise.all).
 */
// Shared
import styles from "./page.module.css" ;

// Feature: Accounting
import { getAccountsAction , getFinancialEntitiesAction } from "@/features/accounting/actions/accountingActions" ;

// Feature: Cards
import { CardsContainer } from "@/features/cards/components/CardsContainer" ;
import { getCardsAction } from "@/features/cards/actions/cardsActions" ;


export default async function CardsPage() {
  // Carga concurrente en el servidor sin cascadas (async-parallel de Vercel y RFC 007 §8D)
  const [ cardsRes , accountsRes , entitiesRes ] = await Promise.all( [
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
      />
    </div>
  ) ;
}
