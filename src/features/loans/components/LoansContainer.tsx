/**
 * @file LoansContainer.tsx
 * Contenedor principal de la pantalla de préstamos (/loans).
 * Integra métricas agregadas por divisa dominante, bandeja de liquidación y tabla con tabs.
 */
"use client" ;

// Librerías externas
import { useState , useTransition } from "react" ;
import { useRouter }                from "next/navigation" ;

// Shared
import { formatCurrency }       from "@/shared/lib/currencyFormatter" ;
import type { getDictionary }   from "@/shared/lib/dictionary" ;
import { usePuedeEscribir }     from "@/shared/providers/PermissionsProvider" ;
import { DataTable }            from "@/shared/ui/display/DataTable/DataTable" ;
import type { DataTableColumn } from "@/shared/ui/display/DataTable/DataTable" ;
import { MetricsSection }       from "@/shared/ui/layout/MetricsSection/MetricsSection" ;
import { InstitutionLogo }      from "@/shared/ui/display/InstitutionLogo/InstitutionLogo" ;
import { EmptyState }           from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { MetricCard }           from "@/shared/ui/MetricCard/MetricCard" ;
import { PageHeader }           from "@/shared/ui/layout/PageHeader/PageHeader" ;
import { Button }               from "@/shared/ui/display/Button/Button" ;
import { Tabs }                 from "@/shared/ui/display/Tabs/Tabs" ;
import { IconLoan }             from "@/shared/ui/display/Icons/Icons" ;

// Feature: Profile
import { useProfileContext } from "@/features/profile/context/ProfileContext" ;

// Feature: Accounting
import type { Account , FinancialEntity } from "@/features/accounting/types" ;

// Feature: Contacts
import type { Contact } from "@/features/contacts/types" ;

// Feature: Loans
import {
  PendingLoanSettlementsInbox ,
  formatearFechaCivil
} from "./PendingLoanSettlementsInbox" ;
import { archiveLoanAction } from "../actions/loansActions" ;
import { LoanFormModal }     from "./LoanFormModal" ;
import type {
  LoanConResumen ,
  PendienteCuota
} from "../types" ;
import styles                from "./Loans.module.css" ;


export interface LoansContainerProps {
  initialLoans:      LoanConResumen[] ;
  initialPending:    PendienteCuota[] ;
  accounts:          Account[] ;
  financialEntities: FinancialEntity[] ;
  contacts:          Contact[] ;
  dict:              Awaited< ReturnType< typeof getDictionary > > ;
  lang?:             string ;
}

/**
 * Componente contenedor de la vista /loans.
 */
export function LoansContainer( {
  initialLoans ,
  initialPending ,
  accounts ,
  financialEntities ,
  contacts ,
  dict ,
  lang = "es"
}: LoansContainerProps ) {
  const router      = useRouter() ;
  const { profile } = useProfileContext() ;
  const puedeEscribir = usePuedeEscribir() ;
  const locale      = ( profile.numberFormat || "es-AR" ) ;

  const [ activeTab , setActiveTab ]       = useState< "all" | "borrowed" | "lent" >( "all" ) ;
  const [ isModalOpen , setIsModalOpen ]   = useState< boolean >( false ) ;
  const [ , startTransition ] = useTransition() ;

  const handleArchive = ( id: string ) => {
    const confirmMsg = ( dict.loansPage.archiveConfirm || "¿Estás seguro de que querés dar de baja este préstamo?" ) ;
    if( !confirm( confirmMsg ) ) {
      return ;
    }

    startTransition( async () => {
      const res = await archiveLoanAction( id ) ;
      if( res.success ) {
        router.refresh() ;
      }
    } ) ;
  } ;

  // Estado vacío absoluto
  if( initialLoans.length === 0 ) {
    return(
      <div className={styles.container}>
        <PageHeader
          title={dict.loansPage.title}
          subtitle={dict.loansPage.subtitle}
          actions={ puedeEscribir ? (
            <Button variant="primary" onClick={ () => setIsModalOpen( true ) }>
              {dict.loansPage.newLoan}
            </Button>
          ) : undefined }
          showMonthSelector={false}
          dict={dict}
          lang={lang}
        />

        <EmptyState
          title={dict.loansPage.emptyTitle}
          description={dict.loansPage.emptyDescription}
          icon={<IconLoan size={32} />}
          action={ puedeEscribir ? (
            <Button variant="primary" onClick={ () => setIsModalOpen( true ) }>
              {dict.loansPage.emptyAction}
            </Button>
          ) : undefined }
        />

        { isModalOpen ? (
          <LoanFormModal
            isOpen={true}
            onClose={ () => setIsModalOpen( false ) }
            financialEntities={financialEntities}
            contacts={contacts}
            accounts={accounts}
            dict={dict}
            locale={locale}
            onSuccess={ () => {
              setIsModalOpen( false ) ;
              router.refresh() ;
            } }
          />
        ) : null }
      </div>
    ) ;
  }

  // 7.2 Métricas agregadas por divisa dominante
  const currencyCounts = initialLoans.reduce( ( acc , loan ) => {
    acc[ loan.currency ] = ( acc[ loan.currency ] || 0 ) + 1 ;
    return( acc ) ;
  } , {} as Record< string , number > ) ;

  let dominantCurrency = initialLoans[ 0 ].currency ;
  let maxCount         = 0 ;
  for( const [ curr , count ] of Object.entries( currencyCounts ) ) {
    if( count > maxCount ) {
      maxCount         = count ;
      dominantCurrency = curr ;
    }
  }

  const dominantLoans    = initialLoans.filter( ( l ) => l.currency === dominantCurrency ) ;
  const excludedCount    = ( initialLoans.length - dominantLoans.length ) ;
  const borrowedDominant = dominantLoans.filter( ( l ) => l.direction === "borrowed" ) ;
  const lentDominant     = dominantLoans.filter( ( l ) => l.direction === "lent" ) ;

  const totalOwed       = borrowedDominant.reduce( ( sum , l ) => sum + ( l.saldoPendiente || 0 ) , 0 ) ;
  const totalReceivable = lentDominant.reduce( ( sum , l ) => sum + ( l.saldoPendiente || 0 ) , 0 ) ;
  const nextDueText     = (
    initialPending[ 0 ]
      ? formatearFechaCivil( initialPending[ 0 ].fechaCuota , locale )
      : dict.loansPage.noNextDue
  ) ;

  // Cálculo del Hero de amortización sobre la divisa dominante
  const withSaldo    = dominantLoans.filter( ( l ) => l.saldoPendiente !== null ) ;
  const sumPrincipal = withSaldo.reduce( ( sum , l ) => sum + l.principalAmount , 0 ) ;
  const sumRepaid    = withSaldo.reduce( ( sum , l ) => sum + ( l.principalAmount - ( l.saldoPendiente || 0 ) ) , 0 ) ;
  const pctGlobal    = (
    sumPrincipal > 0
      ? Math.min( 100 , Math.max( 0 , Math.round( ( sumRepaid / sumPrincipal ) * 100 ) ) )
      : 0
  ) ;
  const totalSaldoVivo = withSaldo.reduce( ( sum , l ) => sum + ( l.saldoPendiente || 0 ) , 0 ) ;

  // 7.3 Tabs y filtrado
  const filteredLoans = initialLoans.filter( ( l ) => {
    if( activeTab === "all" ) { return( true ) ; }
    return( l.direction === activeTab ) ;
  } ) ;

  const tabItems = [
    { key: "all"      , label: `${dict.loansPage.tabAll} (${initialLoans.length})` } ,
    { key: "borrowed" , label: `${dict.loansPage.tabBorrowed} (${initialLoans.filter( ( l ) => l.direction === "borrowed" ).length})` } ,
    { key: "lent"     , label: `${dict.loansPage.tabLent} (${initialLoans.filter( ( l ) => l.direction === "lent" ).length})` }
  ] ;

  // 7.4 Columnas del DataTable
  const todasLasColumnas: DataTableColumn< LoanConResumen >[] = [
    {
      key:    "name" ,
      header: dict.loansPage.columnLoan ,
      align:  "left" ,
      render: ( l ) => (
        <div className={styles.loanNameCell}>
          <span className={styles.loanName}>{l.name}</span>
          <span className={ l.direction === "borrowed" ? styles.badgeBorrowed : styles.badgeLent }>
            { l.direction === "borrowed" ? dict.loansPage.badgeBorrowed : dict.loansPage.badgeLent }
          </span>
        </div>
      )
    } ,
    {
      key:    "counterparty" ,
      header: dict.loansPage.columnCounterparty ,
      align:  "left" ,
      render: ( l ) => {
        if( l.entity ) {
          return(
            <div className={styles.counterpartyCell}>
              <InstitutionLogo
                institution={l.entity.name}
                brandDomain={l.entity.brandDomain || undefined}
                size={14}
              />
              <span>{l.entity.name}</span>
            </div>
          ) ;
        }
        if( l.contact ) {
          return( <span>{l.contact.name}</span> ) ;
        }
        return( <span className={styles.mutedText}>{dict.loansPage.noCounterparty}</span> ) ;
      }
    } ,
    {
      key:    "balance" ,
      header: dict.loansPage.columnBalance ,
      align:  "right" ,
      render: ( l ) => (
        <span>
          { l.saldoPendiente === null
            ? dict.loansPage.balanceUnavailable
            : formatCurrency( l.saldoPendiente , l.currency , locale ) }
        </span>
      )
    } ,
    {
      key:    "progress" ,
      header: dict.loansPage.columnProgress ,
      align:  "left" ,
      render: ( l ) => {
        if( l.progreso === null ) {
          return( <span>{dict.loansPage.balanceUnavailable}</span> ) ;
        }
        return(
          <div className={styles.tableProgress}>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressBar}
                style={ { width: `${l.progreso}%` } }
              />
            </div>
            <span className={styles.progressPct}>{l.progreso}%</span>
          </div>
        ) ;
      }
    } ,
    {
      key:    "installments" ,
      header: dict.loansPage.columnInstallments ,
      align:  "center" ,
      render: ( l ) => (
        <span>
          { `${l.cuotasPagadas} ${dict.loansPage.installmentsSeparator} ${l.totalInstallments}` }
        </span>
      )
    } ,
    {
      key:    "nextDue" ,
      header: dict.loansPage.columnNextDue ,
      align:  "left" ,
      render: ( l ) => (
        <span>
          { l.pendientes[ 0 ]
            ? formatearFechaCivil( l.pendientes[ 0 ].fechaCuota , locale )
            : "—" }
        </span>
      )
    } ,
    {
      key:    "actions" ,
      header: dict.loansPage.columnActions ,
      align:  "right" ,
      render: ( l ) => (
        <Button
          variant="outline"
          onClick={ () => handleArchive( l.id ) }
        >
          {dict.loansPage.archive}
        </Button>
      )
    }
  ] ;

  // Un `viewer` no archiva: sin la columna de acciones (RN-22)
  const columns = todasLasColumnas.filter( ( c ) => puedeEscribir || (c.key !== "actions") ) ;

  return(
    <div className={styles.container}>
      <PageHeader
        title={dict.loansPage.title}
        subtitle={dict.loansPage.subtitle}
        actions={ puedeEscribir ? (
          <Button variant="primary" onClick={ () => setIsModalOpen( true ) }>
            {dict.loansPage.newLoan}
          </Button>
        ) : undefined }
        showMonthSelector={false}
        dict={dict}
        lang={lang}
      />

      {/* Métricas agregadas */}
      <MetricsSection
        hero={ {
          label:         dict.loansPage.heroLabel ,
          value:         `${pctGlobal}%` ,
          valueLabel:    dict.loansPage.heroSuffix ,
          progressBar: (
            <div className={styles.progressTrack}>
              <div
                className={styles.progressBar}
                style={ { width: `${pctGlobal}%` } }
              />
            </div>
          ) ,
          progressLabel: formatCurrency( totalSaldoVivo , dominantCurrency , locale )
        } }
      >
        <MetricCard
          title={dict.loansPage.totalOwed}
          value={formatCurrency( totalOwed , dominantCurrency , locale )}
          isSensitive
        />
        <MetricCard
          title={dict.loansPage.totalReceivable}
          value={formatCurrency( totalReceivable , dominantCurrency , locale )}
          isSensitive
        />
        <MetricCard
          title={dict.loansPage.nextDue}
          value={nextDueText}
        />
      </MetricsSection>

      { excludedCount > 0 ? (
        <p className={styles.currencyNote}>
          { dict.loansPage.metricsCurrencyNote
              .replace( "{currency}" , dominantCurrency )
              .replace( "{count}" , String( excludedCount ) ) }
        </p>
      ) : null }

      {/* Bandeja de liquidación */}
      <PendingLoanSettlementsInbox
        initialPending={initialPending}
        accounts={accounts}
        dict={dict}
        locale={locale}
      />

      {/* Pestañas de filtrado */}
      <div className={styles.tabsRow}>
        <Tabs
          tabs={tabItems}
          activeTab={activeTab}
          onChange={ ( key ) => setActiveTab( key as "all" | "borrowed" | "lent" ) }
        />
      </div>

      {/* Tabla de préstamos */}
      <div className={styles.tableCard}>
        <DataTable
          columns={columns}
          data={filteredLoans}
          keyExtractor={ ( l ) => l.id }
          emptyMessage={dict.loansPage.emptyTitle}
        />
      </div>

      { isModalOpen ? (
        <LoanFormModal
          isOpen={true}
          onClose={ () => setIsModalOpen( false ) }
          financialEntities={financialEntities}
          contacts={contacts}
          accounts={accounts}
          dict={dict}
          locale={locale}
          onSuccess={ () => {
            setIsModalOpen( false ) ;
            router.refresh() ;
          } }
        />
      ) : null }
    </div>
  ) ;
}
