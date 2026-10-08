/**
 * @file page.tsx
 * Página de visualización y gestión del catálogo de cuentas contables por Entidad.
 */
// Shared
import { getDictionary }  from "@/shared/lib/dictionary" ;
import styles             from "./page.module.css" ;

// Feature: Accounting
import { getMonthlySummariesAction , getFinancialEntitiesAction } from "@/features/accounting/actions/accountingActions" ;
import { obtenerCuentasDeListadoAction }                           from "@/features/accounting/actions/cuentasPersonalesActions" ;
import { AccountsContainer }                                       from "@/features/accounting/components/AccountsContainer" ;

// Feature: Cards
import { getCardsAction } from "@/features/cards/actions/cardsActions" ;

// Feature: Loans
import { getLoansAction } from "@/features/loans/actions/loansActions" ;

// Feature: Goals
import { getReservedByAccountAction } from "@/features/goals/actions/goalsActions" ;


interface AccountsPageProps {
  params: Promise< {lang: string} > ;
}

export default async function AccountsPage( {params}: AccountsPageProps ) {
  const { lang } = await params ;
  const dict     = await getDictionary( lang ) ;

  // Consultar cuentas, históricos, entidades, tarjetas y préstamos concurrentemente de la DB
  const [ accountsRes , summariesRes , entitiesRes , cardsRes , loansRes , reservedRes ] = await Promise.all( [
    obtenerCuentasDeListadoAction() ,
    getMonthlySummariesAction() ,
    getFinancialEntitiesAction() ,
    getCardsAction() ,
    getLoansAction() ,
    getReservedByAccountAction()
  ] ) ;

  const accounts          = ( accountsRes.success ? accountsRes.value : [] ) ;
  const summaries         = ( summariesRes.success ? summariesRes.value : [] ) ;
  const financialEntities = ( entitiesRes.success ? entitiesRes.value : [] ) ;
  const cards             = ( cardsRes.success ? cardsRes.value : [] ) ;
  const loans             = ( loansRes.success ? loansRes.value : [] ) ;

  // Un fallo de Metas no puede impedir que /accounts cargue: sin reservas, la pantalla queda como siempre
  const reservado         = ( reservedRes.success ? reservedRes.value : undefined ) ;

  return(
    <div className={styles.container}>
      <AccountsContainer
        accounts={accounts}
        cards={cards}
        loans={loans}
        financialEntities={financialEntities}
        summaries={summaries}
        reservado={reservado}
        dict={dict}
        lang={lang}
      />
    </div>
  ) ;
}
