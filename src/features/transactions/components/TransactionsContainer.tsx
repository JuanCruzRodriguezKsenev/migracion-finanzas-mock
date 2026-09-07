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
import { Column } from "@/shared/ui/display/Toolbar/ColumnSelector" ;

// Feature: Accounting
import { TransactionWithEntries }                      from "@/features/accounting/repositories/ledgerRepository" ;
import { Account , Category , FinancialEntity }         from "@/features/accounting/types" ;

// Feature: Transactions
import {
  TransactionsControls ,
  TransactionTableColumns ,
  TransactionColumnKey
} from "./TransactionsControls" ;
import { TransactionsTable }                                   from "./TransactionsTable" ;
import { TransactionFormModal }                                from "./TransactionFormModal" ;
import { TransactionDetailModal }                              from "./TransactionDetailModal" ;
import { derivarTipoTransaccion , calcularResumenTransaccion } from "../utils/derivarTipo" ;
import { getTransactionsPageAction }                           from "../actions/transactionsActions" ;
import styles                                                  from "./Transactions.module.css" ;


interface TransactionsContainerProps {
  initialTransactions: TransactionWithEntries[] ;
  initialNextCursor:   { occurredAt: string ; id: string } | null ;
  initialHasMore:      boolean ;
  accounts:            Account[] ;
  categories:          Category[] ;
  financialEntities?:  FinancialEntity[] ;
  lang?:               string ;
}

const ALL_COLUMNS: Column< TransactionTableColumns >[] = [
  { key: "occurredAt"  , label: "Fecha" } ,
  { key: "description" , label: "Descripción" } ,
  { key: "category"    , label: "Categoría" } ,
  { key: "account"     , label: "Cuenta" } ,
  { key: "type"        , label: "Tipo" } ,
  { key: "amount"      , label: "Monto" } ,
  { key: "actions"     , label: "Acciones" } ,
] ;

const DEFAULT_COLUMNS: TransactionColumnKey[] = [
  "occurredAt" ,
  "description" ,
  "category" ,
  "account" ,
  "type" ,
  "amount" ,
  "actions" ,
] ;

export function TransactionsContainer( {
  initialTransactions ,
  initialNextCursor ,
  initialHasMore ,
  accounts ,
  categories ,
  financialEntities = [] ,
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
  const [ selectedCurrency , setSelectedCurrency ] = useState( "" ) ;

  // Selector de columnas visibles
  const [ visibleColumns , setVisibleColumns ] = useState< TransactionColumnKey[] >( DEFAULT_COLUMNS ) ;

  // Lista de monedas disponibles
  const availableCurrencies = Array.from(
    new Set( [ "ARS" , ...accounts.map( ( a ) => a.currency ).filter( Boolean ) ] )
  ) ;

  // Modales
  const [ isFormModalOpen , setIsFormModalOpen ]   = useState( false ) ;
  const [ selectedTxDetail , setSelectedTxDetail ] = useState< TransactionWithEntries | null >( null ) ;

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

  const handleToggleColumn = ( key: TransactionColumnKey ) => {
    setVisibleColumns( ( prev ) => {
      if( prev.includes( key ) ) {
        if( prev.length <= 1 ) { return( prev ) ; }
        return( prev.filter( ( k ) => k !== key ) ) ;
      }
      return( [ ...prev , key ] ) ;
    } ) ;
  } ;

  const handleShowAllColumns = () => {
    setVisibleColumns( DEFAULT_COLUMNS ) ;
  } ;

  const handleHideAllColumns = () => {
    setVisibleColumns( [ "description" , "amount" ] ) ;
  } ;

  const handleDataMutated = () => {
    fetchPage( true , null ) ;
  } ;

  // Filtrado de tipo y moneda en memoria
  const displayedTransactions = transactions.filter( ( tx ) => {
    if( selectedType ) {
      const derived = derivarTipoTransaccion( tx.entries , accounts ) ;
      if( derived !== selectedType ) { return( false ) ; }
    }
    if( selectedCurrency ) {
      const resumen = calcularResumenTransaccion( tx.entries , accounts ) ;
      if( (resumen.currency || "ARS") !== selectedCurrency ) { return( false ) ; }
    }
    return( true ) ;
  } ) ;

  return(
    <div className={styles.container}>
      <div className={styles.actionBar}>
        <Button variant="primary" onClick={ () => setIsFormModalOpen( true ) }>
          + Nueva Transacción
        </Button>
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
        selectedCurrency={selectedCurrency}
        setSelectedCurrency={setSelectedCurrency}
        currencies={availableCurrencies}
        accounts={accounts}
        categories={categories}
        columns={ALL_COLUMNS}
        visibleColumns={visibleColumns}
        onToggleColumn={handleToggleColumn}
        onShowAllColumns={handleShowAllColumns}
        onHideAllColumns={handleHideAllColumns}
        onClear={handleClearFilters}
      />

      <TransactionsTable
        transactions={displayedTransactions}
        accounts={accounts}
        categories={categories}
        financialEntities={financialEntities}
        visibleColumns={visibleColumns}
        loading={isPending}
        onSelectTransaction={ ( tx ) => setSelectedTxDetail( tx ) }
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
