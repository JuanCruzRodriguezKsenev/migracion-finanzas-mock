/**
 * @file page.tsx
 * Página de visualización y gestión del Libro Diario de Transacciones.
 * Server Component fino que compone datos de cuentas, categorías y transacciones iniciales.
 */
// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;
import styles            from "./page.module.css" ;

// Feature: Accounting
import {
  getAccountsAction ,
  getFinancialEntitiesAction ,
  getEarliestMonthKeyAction
} from "@/features/accounting/actions/accountingActions" ;
import { getCategoryTreeAction } from "@/features/accounting/actions/categoryActions" ;

// Feature: Transactions
import { getTransactionsPageAction } from "@/features/transactions/actions/transactionsActions" ;
import { TransactionsContainer }     from "@/features/transactions/components/TransactionsContainer" ;


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
  const [ dict , earliestMonthRes , accountsRes , categoryTreeRes , entitiesRes , transactionsPageRes ] = await Promise.all( [
    getDictionary( lang ) ,
    getEarliestMonthKeyAction() ,
    getAccountsAction() ,
    getCategoryTreeAction() ,
    getFinancialEntitiesAction() ,
    getTransactionsPageAction( {
      limit: 20 ,
      fromDate ,
      toDate ,
    } )
  ] ) ;

  const ahora           = new Date() ;
  const currentMonthKey = `${ahora.getFullYear()}-${String( ahora.getMonth() + 1 ).padStart( 2 , "0" )}` ;
  const minKey          = earliestMonthRes.success ? earliestMonthRes.value : undefined ;

  const accounts            = ( accountsRes.success         ? accountsRes.value                   : [] ) ;
  const categoryTree        = ( categoryTreeRes.success     ? categoryTreeRes.value               : [] ) ;
  const categories          = categoryTree.flatMap( ( c ) => [ c , ...c.children ] ) ;
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
        categoryTree={categoryTree}
        financialEntities={financialEntities}
        dict={dict}
        lang={lang}
        currentMonthKey={currentMonthKey}
        minKey={minKey}
      />
    </div>
  ) ;
}
