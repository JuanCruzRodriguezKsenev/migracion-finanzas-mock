/**
 * @file page.tsx
 * Página de visualización y gestión del Libro Diario de Transacciones.
 * Server Component fino que compone datos de cuentas, categorías y transacciones iniciales.
 */
// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;
import { authOptions }   from "@/shared/lib/auth" ;
import styles            from "./page.module.css" ;

// Feature: Organizations
import { listarTitularesPosiblesAction } from "@/features/organizations/actions/habilitacionesActions" ;

// Feature: Auth
import { membershipRepository } from "@/features/auth/repositories/membershipRepository" ;
import { nombreVisible }        from "@/features/auth/utils/nombreVisible" ;

// Feature: Accounting
import {
  getAccountsAction ,
  getFinancialEntitiesAction ,
  getEarliestMonthKeyAction
} from "@/features/accounting/actions/accountingActions" ;
import { getCategoryTreeAction }               from "@/features/accounting/actions/categoryActions" ;
import { obtenerCuentasParaMovimientoAction } from "@/features/accounting/actions/cuentasPersonalesActions" ;

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
  const [ dict , earliestMonthRes , accountsRes , cuentasMovimientoRes , categoryTreeRes , entitiesRes , transactionsPageRes , titularesRes , session ] = await Promise.all( [
    getDictionary( lang ) ,
    getEarliestMonthKeyAction() ,
    getAccountsAction() ,
    obtenerCuentasParaMovimientoAction() ,
    getCategoryTreeAction() ,
    getFinancialEntitiesAction() ,
    getTransactionsPageAction( {
      limit: 20 ,
      fromDate ,
      toDate ,
    } ) ,
    listarTitularesPosiblesAction() ,
    getServerSession( authOptions )
  ] ) ;

  // Miembros de la organización para el filtro por titular (cualquier miembro puede filtrar la lista)
  const organizationId = session?.user?.organizationId ;
  const miembrosDeOrg  = ( organizationId ? await membershipRepository.findByOrganization( organizationId ) : [] ) ;
  const miembros       = miembrosDeOrg.map( ( m ) => ( { userId: m.userId , nombre: nombreVisible( m.nombre , m.email ) } ) ) ;
  const titulares      = ( titularesRes.success ? titularesRes.value : [] ) ;

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

  // Lo que ofrece el selector de origen lo decide el servidor (RN-10); las personales que nombran los asientos
  // de la página viajan aparte y sin saldo (RN-13).
  const cuentasMovimiento    = ( cuentasMovimientoRes.success ? cuentasMovimientoRes.value : undefined ) ;
  const cuentasPersonales    = ( transactionsPageRes.success ? transactionsPageRes.value.cuentasPersonales : [] ) ;

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
        titulares={titulares}
        miembros={miembros}
        cuentasPersonales={cuentasPersonales}
        usables={cuentasMovimiento?.usables}
        compartibles={cuentasMovimiento?.compartibles}
        organizacionId={cuentasMovimiento?.organizacionId}
        organizacionNombre={cuentasMovimiento?.organizacionNombre}
      />
    </div>
  ) ;
}
