/**
 * @file page.tsx
 * Página de visualización y gestión del Libro Diario de Transacciones.
 * Server Component fino que compone datos de cuentas, categorías y transacciones iniciales.
 */
// Shared
import styles from "./page.module.css" ;

// Feature: Accounting
import { getAccountsAction , getFinancialEntitiesAction } from "@/features/accounting/actions/accountingActions" ;

// Feature: Transactions
import { getTransactionsPageAction , getCategoriesAction } from "@/features/transactions/actions/transactionsActions" ;
import { TransactionsContainer }                            from "@/features/transactions/components/TransactionsContainer" ;


interface TransactionsPageProps {
  params:       Promise< {lang: string} > ;
  searchParams: Promise< {month?: string} > ;
}

export default async function TransactionsPage( {params , searchParams}: TransactionsPageProps ) {
  const { lang }  = await params ;
  const { month } = await searchParams ;

  let fromDate: Date | undefined ;
  let toDate:   Date | undefined ;

  if( month ) {
    const [ yStr , mStr ] = month.split( "-" ) ;
    const y = Number( yStr ) ;
    const m = Number( mStr ) ;
    if( !isNaN( y ) && !isNaN( m ) ) {
      fromDate = new Date( y , m - 1 , 1 , 0 , 0 , 0 ) ;
      toDate   = new Date( y , m     , 0 , 23 , 59 , 59 ) ;
    }
  }

  // Carga concurrente en el servidor
  const [ accountsRes , categoriesRes , entitiesRes , transactionsPageRes ] = await Promise.all( [
    getAccountsAction() ,
    getCategoriesAction() ,
    getFinancialEntitiesAction() ,
    getTransactionsPageAction( {
      limit: 20 ,
      fromDate ,
      toDate ,
    } )
  ] ) ;

  const accounts            = ( accountsRes.success         ? accountsRes.value                   : [] ) ;
  const categories          = ( categoriesRes.success       ? categoriesRes.value                 : [] ) ;
  const financialEntities   = ( entitiesRes.success         ? entitiesRes.value                   : [] ) ;
  const initialTransactions = ( transactionsPageRes.success ? transactionsPageRes.value.items      : [] ) ;
  const initialNextCursor   = ( transactionsPageRes.success ? transactionsPageRes.value.nextCursor : null ) ;
  const initialHasMore      = ( transactionsPageRes.success ? transactionsPageRes.value.hasMore    : false ) ;

  return(
    <div className={styles.container}>
      <TransactionsContainer
        initialTransactions={initialTransactions}
        initialNextCursor={initialNextCursor}
        initialHasMore={initialHasMore}
        accounts={accounts}
        categories={categories}
        financialEntities={financialEntities}
        lang={lang}
      />
    </div>
  ) ;
}
