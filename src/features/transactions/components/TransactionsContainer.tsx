/**
 * @file TransactionsContainer.tsx
 * Contenedor orquestador del módulo de transacciones en el cliente.
 */
"use client" ;

// Librerías externas
import React , { useState , useEffect , useTransition , useCallback } from "react" ;
import { useSearchParams }                                             from "next/navigation" ;

// Shared
import { Button } from "@/shared/ui/display/Button/Button" ;

// Feature: Accounting
import { TransactionWithEntries } from "@/features/accounting/repositories/ledgerRepository" ;
import { Account , Category }     from "@/features/accounting/types" ;

// Feature: Transactions
import { getTransactionsPageAction } from "../actions/transactionsActions" ;
import { TransactionsControls }      from "./TransactionsControls" ;
import { TransactionsTable }         from "./TransactionsTable" ;
import { TransactionFormModal }      from "./TransactionFormModal" ;
import { TransactionDetailModal }    from "./TransactionDetailModal" ;
import { derivarTipoTransaccion }    from "../utils/derivarTipo" ;
import styles                        from "./Transactions.module.css" ;


interface TransactionsContainerProps {
  initialTransactions: TransactionWithEntries[] ;
  initialNextCursor:   { occurredAt: string ; id: string } | null ;
  initialHasMore:      boolean ;
  accounts:            Account[] ;
  categories:          Category[] ;
  lang?:               string ;
}

export function TransactionsContainer( {
  initialTransactions ,
  initialNextCursor ,
  initialHasMore ,
  accounts ,
  categories ,
}: TransactionsContainerProps ) {
  const searchParams = useSearchParams() ;
  const monthParam   = searchParams?.get( "month" ) ;

  const [ transactions , setTransactions ] = useState< TransactionWithEntries[] >( initialTransactions ) ;
  const [ nextCursor , setNextCursor ]     = useState( initialNextCursor ) ;
  const [ hasMore , setHasMore ]           = useState( initialHasMore ) ;

  const [ isPending , startTransition ]    = useTransition() ;
  const [ loadingMore , setLoadingMore ]   = useState( false ) ;

  // Filtros
  const [ searchTerm , setSearchTerm ]             = useState( "" ) ;
  const [ selectedAccount , setSelectedAccount ]   = useState( "" ) ;
  const [ selectedCategory , setSelectedCategory ] = useState( "" ) ;
  const [ selectedType , setSelectedType ]         = useState( "" ) ;

  // Modales
  const [ isFormModalOpen , setIsFormModalOpen ]         = useState( false ) ;
  const [ selectedTxDetail , setSelectedTxDetail ]       = useState< TransactionWithEntries | null >( null ) ;

  // Calcular rango de mes si viene por URL
  const getMonthDateRange = useCallback( () => {
    if( !monthParam ) { return( {} ) ; }
    const [ yStr , mStr ] = monthParam.split( "-" ) ;
    const y = Number( yStr ) ;
    const m = Number( mStr ) ;
    if( isNaN( y ) || isNaN( m ) ) { return( {} ) ; }

    const fromDate = new Date( y , m - 1 , 1 , 0 , 0 , 0 ) ;
    const toDate   = new Date( y , m     , 0 , 23 , 59 , 59 ) ;
    return( { fromDate , toDate } ) ;
  } , [ monthParam ] ) ;

  // Cargar datos al cambiar mes o filtros
  const fetchPage = useCallback( ( reset: boolean = true , cursorOverride?: { occurredAt: string ; id: string } | null ) => {
    const { fromDate , toDate } = getMonthDateRange() ;

    startTransition( async () => {
      const res = await getTransactionsPageAction( {
        cursor:     cursorOverride !== undefined ? cursorOverride : (reset ? null : nextCursor) ,
        limit:      20 ,
        search:     searchTerm.trim() || undefined ,
        categoryId: selectedCategory || undefined ,
        accountId:  selectedAccount || undefined ,
        fromDate ,
        toDate ,
      } ) ;

      if( res.success ) {
        if( reset ) {
          setTransactions( res.value.items ) ;
        } else {
          setTransactions( ( prev ) => [ ...prev , ...res.value.items ] ) ;
        }
        setNextCursor( res.value.nextCursor ) ;
        setHasMore( res.value.hasMore ) ;
      }
    } ) ;
  } , [ getMonthDateRange , nextCursor , searchTerm , selectedCategory , selectedAccount ] ) ;

  // Reaccionar a cambios de mes o filtros con debounce básico
  useEffect( () => {
    const timer = setTimeout( () => {
      fetchPage( true , null ) ;
    } , 250 ) ;

    return( () => clearTimeout(timer) ) ;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  } , [ monthParam , searchTerm , selectedAccount , selectedCategory ] ) ;

  const handleClearFilters = () => {
    setSearchTerm( "" ) ;
    setSelectedAccount( "" ) ;
    setSelectedCategory( "" ) ;
    setSelectedType( "" ) ;
  } ;

  const handleLoadMore = async () => {
    if( !nextCursor || loadingMore ) { return ; }
    setLoadingMore( true ) ;

    const { fromDate , toDate } = getMonthDateRange() ;
    const res = await getTransactionsPageAction( {
      cursor:     nextCursor ,
      limit:      20 ,
      search:     searchTerm.trim() || undefined ,
      categoryId: selectedCategory || undefined ,
      accountId:  selectedAccount || undefined ,
      fromDate ,
      toDate ,
    } ) ;

    if( res.success ) {
      setTransactions( ( prev ) => [ ...prev , ...res.value.items ] ) ;
      setNextCursor( res.value.nextCursor ) ;
      setHasMore( res.value.hasMore ) ;
    }

    setLoadingMore( false ) ;
  } ;

  const handleDataMutated = () => {
    fetchPage( true , null ) ;
  } ;

  // Filtrado de tipo en memoria (derivación pura de partida doble)
  const displayedTransactions = selectedType
    ? transactions.filter( ( tx ) => {
        const derived = derivarTipoTransaccion( tx.entries , accounts ) ;
        return( derived === selectedType ) ;
      } )
    : transactions ;

  return(
    <div className={styles.container}>
      <div className={styles.headerBar}>
        <div className={styles.titleArea}>
          <h1 className={styles.pageTitle}>Libro Diario</h1>
          <p className={styles.pageSubtitle}>
            Historial de movimientos y asientos contables de partida doble.
          </p>
        </div>

        <div className={styles.actionsArea}>
          <Button variant="primary" onClick={ () => setIsFormModalOpen(true) }>
            + Nueva Transacción
          </Button>
        </div>
      </div>

      <TransactionsControls
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedAccount={selectedAccount}
        setSelectedAccount={setSelectedAccount}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        accounts={accounts}
        categories={categories}
        onClear={handleClearFilters}
      />

      <TransactionsTable
        transactions={displayedTransactions}
        accounts={accounts}
        categories={categories}
        loading={isPending}
        onSelectTransaction={ ( tx ) => setSelectedTxDetail(tx) }
      />

      {hasMore && (
        <div className={styles.loadMoreWrapper}>
          <Button
            variant="secondary"
            onClick={handleLoadMore}
            isLoading={loadingMore}
          >
            Cargar más transacciones
          </Button>
        </div>
      )}

      {/* Modal de alta asistida */}
      <TransactionFormModal
        isOpen={isFormModalOpen}
        onClose={ () => setIsFormModalOpen(false) }
        onSuccess={handleDataMutated}
        accounts={accounts}
        categories={categories}
      />

      {/* Modal de detalle, edición y reversión */}
      <TransactionDetailModal
        transaction={selectedTxDetail}
        isOpen={Boolean(selectedTxDetail)}
        onClose={ () => setSelectedTxDetail(null) }
        onSuccess={handleDataMutated}
        accounts={accounts}
        categories={categories}
      />
    </div>
  ) ;
}
