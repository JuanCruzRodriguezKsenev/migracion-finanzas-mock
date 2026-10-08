/**
 * @file TransactionsContainer.tsx
 * Contenedor orquestador del módulo de transacciones en el cliente.
 */
"use client" ;

// Librerías externas
import React , { useState , useEffect , useTransition , useCallback } from "react" ;
import { useSearchParams , useRouter }                                 from "next/navigation" ;

// Shared
import { PageHeader }          from "@/shared/ui/layout/PageHeader/PageHeader" ;
import { Column }              from "@/shared/ui/display/Toolbar/ColumnSelector" ;
import { Button }              from "@/shared/ui/display/Button/Button" ;
import type { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Profile
import { useProfileContext } from "@/features/profile/context/ProfileContext" ;

// Feature: Splits
import { previsualizarRepartoAction } from "@/features/splits/actions/acuerdoActions" ;

// Feature: Auth
import type { TitularPosible } from "@/features/auth/services/titularService" ;

// Feature: Accounting
import type { TransactionWithEntries , CuentaPersonalReferenciada } from "@/features/accounting/repositories/ledgerRepository" ;
import type { CuentaConEtiqueta }                                   from "@/features/accounting/repositories/accountRepository" ;
import { Account , Category , FinancialEntity , CategoryTreeNode }  from "@/features/accounting/types" ;

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
import { fusionarPersonales , cuentasParaMovimientos }         from "../utils/cuentasDeMovimientos" ;
import { getTransactionsPageAction }                           from "../actions/transactionsActions" ;
import styles                                                  from "./Transactions.module.css" ;


interface TransactionsContainerProps {
  initialTransactions: TransactionWithEntries[] ;
  initialNextCursor:   { occurredAt: string ; id: string } | null ;
  initialHasMore:      boolean ;
  accounts:            Account[] ;
  categories:          Category[] ;
  dict:                Awaited< ReturnType< typeof getDictionary > > ;
  categoryTree?:       CategoryTreeNode[] ;
  financialEntities?:  FinancialEntity[] ;
  lang?:               string ;
  currentMonthKey?:    string ;
  minKey?:             string ;
  /** A nombre de quiénes puede cargar la sesión (uno mismo primero); alimenta el selector del formulario. */
  titulares?:          TitularPosible[] ;
  /** Miembros de la organización; alimentan el filtro por titular. */
  miembros?:           TitularPosible[] ;
  /** Personales que nombran los asientos de la primera página, aunque ya no se compartan (RN-13). */
  cuentasPersonales?:  CuentaPersonalReferenciada[] ;
  /** Cuentas que ofrece el selector de origen (las de la organización y las personales compartidas del usuario, RN-10). Sin ellas, `accounts`. */
  usables?:            CuentaConEtiqueta[] ;
  /** Personales del usuario que aún no se compartieron con la organización («Compartir y usar»). */
  compartibles?:       CuentaConEtiqueta[] ;
  /** Organización activa: con su id se comparte y con su nombre se avisa. */
  organizacionId?:     string ;
  organizacionNombre?: string ;
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
  dict ,
  categoryTree ,
  financialEntities = [] ,
  lang = "es" ,
  currentMonthKey ,
  minKey ,
  titulares = [] ,
  miembros = [] ,
  cuentasPersonales = [] ,
  usables ,
  compartibles = [] ,
  organizacionId = "" ,
  organizacionNombre = "" ,
}: TransactionsContainerProps ) {
  const router       = useRouter() ;
  const searchParams = useSearchParams() ;
  const monthParam   = searchParams?.get( "month" ) ;
  const { profile }  = useProfileContext() ;

  const [ transactions , setTransactions ] = useState< TransactionWithEntries[] >( initialTransactions ) ;
  const [ nextCursor , setNextCursor ]     = useState( initialNextCursor ) ;
  const [ hasMore , setHasMore ]           = useState( initialHasMore ) ;

  // Personales que nombran los asientos de todas las páginas cargadas (la primera y cada «cargar más»)
  const [ personales , setPersonales ] = useState< CuentaPersonalReferenciada[] >( cuentasPersonales ) ;

  // El mapa que nombra y clasifica cada movimiento: la organización, las personales usables y las referenciadas
  const cuentasDeMovimientos = cuentasParaMovimientos( [ ...(usables ?? []) , ...accounts ] , personales ) ;

  const [ isPending , startTransition ]    = useTransition() ;
  const [ loadingMore , setLoadingMore ]   = useState( false ) ;

  // Filtros
  const [ searchTerm , setSearchTerm ]             = useState( "" ) ;
  const [ selectedAccount , setSelectedAccount ]   = useState( "" ) ;
  const [ selectedCategory , setSelectedCategory ] = useState( "" ) ;
  const [ selectedType , setSelectedType ]         = useState( "" ) ;
  const [ selectedCurrency , setSelectedCurrency ] = useState( "" ) ;
  const [ selectedHolder , setSelectedHolder ]     = useState( "" ) ;

  // Selector de columnas visibles
  const [ visibleColumns , setVisibleColumns ] = useState< TransactionColumnKey[] >( DEFAULT_COLUMNS ) ;

  // Lista de monedas disponibles
  const availableCurrencies = Array.from(
    new Set( [ "ARS" , ...cuentasDeMovimientos.map( ( a ) => a.currency ).filter( Boolean ) ] )
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
        cursor:       cursorOverride !== undefined ? cursorOverride : (reset ? null : nextCursor) ,
        limit:        20 ,
        search:       searchTerm.trim() || undefined ,
        categoryId:   selectedCategory || undefined ,
        accountId:    selectedAccount || undefined ,
        holderUserId: selectedHolder || undefined ,
        fromDate ,
        toDate ,
      } ) ;

      if( res.success ) {
        if( reset ) {
          setTransactions( res.value.items ) ;
        } else {
          setTransactions( ( prev ) => [ ...prev , ...res.value.items ] ) ;
        }
        setPersonales( ( prev ) => fusionarPersonales( prev , res.value.cuentasPersonales ) ) ;
        setNextCursor( res.value.nextCursor ) ;
        setHasMore( res.value.hasMore ) ;
      }
    } ) ;
  } , [ getMonthDateRange , nextCursor , searchTerm , selectedCategory , selectedAccount , selectedHolder ] ) ;

  // Reaccionar a cambios de mes o filtros con debounce básico
  useEffect( () => {
    const timer = setTimeout( () => {
      fetchPage( true , null ) ;
    } , 250 ) ;

    return( () => clearTimeout(timer) ) ;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  } , [ monthParam , searchTerm , selectedAccount , selectedCategory , selectedHolder ] ) ;

  const handleClearFilters = () => {
    setSearchTerm( "" ) ;
    setSelectedAccount( "" ) ;
    setSelectedCategory( "" ) ;
    setSelectedType( "" ) ;
    setSelectedHolder( "" ) ;
  } ;

  const handleLoadMore = async () => {
    if( !nextCursor || loadingMore ) { return ; }
    setLoadingMore( true ) ;

    const { fromDate , toDate } = getMonthDateRange() ;
    const res = await getTransactionsPageAction( {
      cursor:       nextCursor ,
      limit:        20 ,
      search:       searchTerm.trim() || undefined ,
      categoryId:   selectedCategory || undefined ,
      accountId:    selectedAccount || undefined ,
      holderUserId: selectedHolder || undefined ,
      fromDate ,
      toDate ,
    } ) ;

    if( res.success ) {
      setTransactions( ( prev ) => [ ...prev , ...res.value.items ] ) ;
      setPersonales( ( prev ) => fusionarPersonales( prev , res.value.cuentasPersonales ) ) ;
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
      const derived = derivarTipoTransaccion( tx.entries , cuentasDeMovimientos ) ;
      if( derived !== selectedType ) { return( false ) ; }
    }
    if( selectedCurrency ) {
      const resumen = calcularResumenTransaccion( tx.entries , cuentasDeMovimientos ) ;
      if( (resumen.currency || "ARS") !== selectedCurrency ) { return( false ) ; }
    }
    return( true ) ;
  } ) ;

  return(
    <div className={styles.container}>
      <PageHeader
        title={dict.transactionsPage?.title || "Libro Diario"}
        subtitle={dict.transactionsPage?.subtitle || "Historial de movimientos y asientos contables de partida doble."}
        actions={
          <Button variant="primary" onClick={ () => setIsFormModalOpen( true ) }>
            + Nueva Transacción
          </Button>
        }
        showMonthSelector={true}
        dict={dict}
        lang={lang}
        currentMonthKey={currentMonthKey}
        minKey={minKey}
      />

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
        accounts={cuentasDeMovimientos}
        categories={categories}
        columns={ALL_COLUMNS}
        visibleColumns={visibleColumns}
        onToggleColumn={handleToggleColumn}
        onShowAllColumns={handleShowAllColumns}
        onHideAllColumns={handleHideAllColumns}
        onClear={handleClearFilters}
        holderOptions={miembros}
        selectedHolder={selectedHolder}
        setSelectedHolder={setSelectedHolder}
        holderDict={dict.transactionsPage}
      />

      <TransactionsTable
        transactions={displayedTransactions}
        accounts={cuentasDeMovimientos}
        categories={categories}
        financialEntities={financialEntities}
        visibleColumns={visibleColumns}
        loading={isPending}
        holderDict={dict.transactionsPage}
        cuentasDict={dict.accountsPage}
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
        accounts={usables ?? accounts}
        compartibles={compartibles}
        organizacionId={organizacionId}
        organizacionNombre={organizacionNombre}
        cuentasDict={dict.accountsPage}
        onCuentaCompartida={ () => router.refresh() }
        categories={categories}
        categoryTree={categoryTree}
        titulares={titulares}
        holderDict={dict.transactionsPage}
        previsualizar={previsualizarRepartoAction}
        repartoDict={dict.splits}
        locale={profile?.numberFormat || "es-AR"}
      />

      {/* Modal de detalle, edición y reversión */}
      <TransactionDetailModal
        transaction={selectedTxDetail}
        isOpen={Boolean(selectedTxDetail)}
        onClose={ () => setSelectedTxDetail(null) }
        onSuccess={handleDataMutated}
        accounts={cuentasDeMovimientos}
        categories={categories}
        holderDict={dict.transactionsPage}
        cuentasDict={dict.accountsPage}
      />
    </div>
  ) ;
}
