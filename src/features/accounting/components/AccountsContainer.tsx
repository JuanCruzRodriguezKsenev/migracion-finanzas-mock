/**
 * @file AccountsContainer.tsx
 * Contenedor principal cliente para la gestión de cuentas financieras.
 * Integra las tarjetas de métricas, tabs de navegación y el formulario de creación en modal.
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;

// Shared
import type { getDictionary }   from "@/shared/lib/dictionary" ;
import { useMetricsVisibility } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { InstitutionLogo }      from "@/shared/ui/display/InstitutionLogo/InstitutionLogo" ;
import { MetricsSection }       from "@/shared/ui/layout/MetricsSection/MetricsSection" ;
import { Sparkline }            from "@/shared/ui/display/RechartsSparkline/Sparkline" ;
import { EmptyState }           from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { MetricCard }           from "@/shared/ui/MetricCard/MetricCard" ;
import { Button }               from "@/shared/ui/display/Button/Button" ;
import { Modal }                from "@/shared/ui/feedback/Modal/Modal" ;
import { Card }                 from "@/shared/ui/display/Card/Card" ;
import { Tabs }                 from "@/shared/ui/display/Tabs/Tabs" ;

// Feature: Accounting
import {
  formatCents ,
  formatMonthKey ,
  SparklinePoint ,
  calcularTendenciaDesdeSparkline
} from "../utils/dashboardMetrics" ;
import { CreateFinancialEntityForm }                             from "./CreateFinancialEntityForm" ;
import styles                                                   from "./AccountsContainer.module.css" ;
import { CreateAccountForm }                                    from "./CreateAccountForm" ;
import { Account , FinancialEntity , MonthlySummary }           from "../types" ;


interface AccountsContainerProps {
  accounts:          (Account & { entity?: { name: string ; logo: string | null ; color: string | null } | null })[] ;
  financialEntities: FinancialEntity[] ;
  summaries:         MonthlySummary[] ;
  dict:              Awaited< ReturnType< typeof getDictionary > > ;
  lang:              string ;
}

export function AccountsContainer( {
  accounts ,
  financialEntities ,
  summaries ,
  dict ,
  lang
}: AccountsContainerProps ) {
  const { isContentVisible }                   = useMetricsVisibility() ;
  const [ activeTab , setActiveTab ]           = useState< "wallets" | "ledger" >( "wallets" ) ;
  const [ isModalOpen , setIsModalOpen ]       = useState( false ) ;
  const [ isEntityModalOpen , setIsEntityModalOpen ] = useState( false ) ;
  const [ selectedEntity , setSelectedEntity ] = useState< string | null >( null ) ;
  const [ preselectedEntityId , setPreselectedEntityId ] = useState< string | null >( null ) ;

  const accountsPageDict = ( dict.accountsPage || {} ) ;

  // Separar cuentas de balance vs nominales
  const ledgerAccounts = accounts.filter( ( a ) => (a.type === "equity") || (a.type === "revenue") || (a.type === "expense") ) ;
  const walletAccounts = accounts.filter( ( a ) => (a.type === "asset") || (a.type === "liability") ) ;

  // Agrupar cuentas financieras por Entidad/Institución
  const groupedWallets = walletAccounts.reduce( ( acc , val ) => {
    const key = ( val.entity?.name || "Otros" ) ;
    if( !acc[key] ) {
      acc[key] = [] ;
    }
    acc[key].push( val ) ;
    return( acc ) ;
  } , {} as Record< string , Account[] > ) ;

  // Agrupar plan contable por tipo contable
  const groupedLedger = ledgerAccounts.reduce( ( acc , val ) => {
    const key = val.type ;
    if( !acc[key] ) {
      acc[key] = [] ;
    }
    acc[key].push( val ) ;
    return( acc ) ;
  } , {} as Record< string , Account[] > ) ;

  // Calcular métricas
  const totalAssets = walletAccounts.filter( ( a ) => a.type === "asset" ).reduce( ( sum , a ) => (sum + a.balance) , 0 ) ;
  const totalLiabs  = walletAccounts.filter( ( a ) => a.type === "liability" ).reduce( ( sum , a ) => (sum + a.balance) , 0 ) ;
  const netWorth    = ( totalAssets - totalLiabs ) ;

  // Procesar series temporales reales para Patrimonio Neto, Activos y Pasivos
  const sparklinePointsNetWorth: SparklinePoint[] = summaries.map( ( s ) => ( {
    value:    s.balanceSnapshot / 100 ,
    monthKey: formatMonthKey( s.year , s.month )
  } ) ).reverse() ;

  const sparklinePointsAssets: SparklinePoint[] = summaries.map( ( s ) => ( {
    value:    s.assetsSnapshot / 100 ,
    monthKey: formatMonthKey( s.year , s.month )
  } ) ).reverse() ;

  const sparklinePointsLiabs: SparklinePoint[] = summaries.map( ( s ) => ( {
    value:    s.liabilitiesSnapshot / 100 ,
    monthKey: formatMonthKey( s.year , s.month )
  } ) ).reverse() ;

  // Calcular tendencias dinámicas
  const tendenciaNetWorth = calcularTendenciaDesdeSparkline( sparklinePointsNetWorth ) ;
  const tendenciaAssets   = calcularTendenciaDesdeSparkline( sparklinePointsAssets ) ;
  const tendenciaLiabs    = calcularTendenciaDesdeSparkline( sparklinePointsLiabs , true ) ; // Invertida para pasivos

  const labelTrend = ( dict.dashboard?.savingTrend || "vs mes anterior" ) ;

  const tabsConfig = [
    { key: "wallets" , label: accountsPageDict.tabWallets } ,
    { key: "ledger"  , label: accountsPageDict.tabLedger }
  ] ;

  return(
    <div className={styles.container}>
      {/* Botones superiores de Acción */}
      <div className={styles.actionBar}>
        <div className={styles.actionBarButtons}>
          <Button
            variant="outline"
            className={styles.createBtn}
            onClick={ () => setIsEntityModalOpen( true ) }
          >
            + Nueva Entidad
          </Button>
          <Button
            className={styles.createBtn}
            onClick={ () => {
              setPreselectedEntityId( null ) ;
              setIsModalOpen( true ) ;
            } }
          >
            + Nueva Cuenta
          </Button>
        </div>
      </div>

      {/* Indicadores de Balance Superior utilizando MetricsSection en modo Hero Layout */}
      <MetricsSection
        allowVisibilityToggle={true}
        hero={ {
          label:           accountsPageDict.netWorth ,
          value:           formatCents( netWorth ) ,
          sparklinePoints: sparklinePointsNetWorth ,
          lang:            lang ,
          trend:           tendenciaNetWorth ? {
            value:      tendenciaNetWorth.value ,
            isPositive: tendenciaNetWorth.isPositive ,
            isRising:   tendenciaNetWorth.isRising ,
            label:      labelTrend
          } : undefined
        } }
      >
        <MetricCard
          title={accountsPageDict.totalAssets}
          value={formatCents( totalAssets )}
          iconBg="rgba( 16 , 185 , 129 , 0.1 )"
          iconColor="#10b981"
          isSensitive={true}
          trend={ tendenciaAssets ? {
            value:      tendenciaAssets.value ,
            isPositive: tendenciaAssets.isPositive ,
            isRising:   tendenciaAssets.isRising ,
            label:      labelTrend
          } : undefined }
          sparkline={
            sparklinePointsAssets.length > 0 ? (
              <Sparkline
                points={sparklinePointsAssets}
                color="#10b981"
                height={26}
                lang={lang}
              />
            ) : undefined
          }
        />
        <MetricCard
          title={accountsPageDict.totalLiabilities}
          value={formatCents( totalLiabs )}
          isDanger={true}
          isSensitive={true}
          trend={ tendenciaLiabs ? {
            value:      tendenciaLiabs.value ,
            isPositive: tendenciaLiabs.isPositive ,
            isRising:   tendenciaLiabs.isRising ,
            label:      labelTrend
          } : undefined }
          sparkline={
            sparklinePointsLiabs.length > 0 ? (
              <Sparkline
                points={sparklinePointsLiabs}
                color="#ef4444"
                height={26}
                lang={lang}
                isInverted={true}
              />
            ) : undefined
          }
        />
      </MetricsSection>

      {/* Tabs Reutilizable */}
      <div className={styles.tabsRow}>
        <Tabs
          tabs={tabsConfig}
          activeTab={activeTab}
          onChange={ ( key ) => setActiveTab( key as "wallets" | "ledger" ) }
        />
      </div>

      {/* Grilla de Cuentas */}
      <div className={styles.gridContent}>
        {activeTab === "wallets" ? (
          Object.keys( groupedWallets ).length === 0 ? (
            <EmptyState title={accountsPageDict.emptyState} />
          ) : (
            <div className={styles.cardsGrid}>
              {Object.entries( groupedWallets ).map( ( [ institution , list ] ) => {
                const netBalance = list.reduce( ( sum , a ) => sum + a.balance , 0 ) ;
                const totalLiabsCount  = list.filter( ( a ) => a.type === "liability" ).length ;
                const totalAssetsCount = list.filter( ( a ) => a.type === "asset" ).length ;

                const entityObj = financialEntities.find( ( e ) => e.name === institution ) ;
                const hasColor  = !!entityObj?.color ;

                const cardStyle = entityObj?.color ? {
                  background: `linear-gradient(135deg, ${entityObj.color}d5 0%, ${entityObj.color} 100%)` ,
                  boxShadow: `0 8px 24px -6px ${entityObj.color}50` ,
                  border: "none"
                } : undefined ;

                return(
                  <Card
                    key={institution}
                    className={ `${styles.entitySummaryCard} ${hasColor ? styles.hasBrandColor : ""}` }
                    interactive={true}
                    onClick={ () => setSelectedEntity( institution ) }
                    style={cardStyle}
                  >
                    <div className={styles.entityCardTop}>
                      <div className={styles.entityMeta}>
                        <h3 className={styles.entityNameMain}>{ institution }</h3>
                        <span className={styles.subAccountsCount}>
                          {list.length} {list.length === 1 ? "cuenta" : "cuentas"} ({totalAssetsCount} act / {totalLiabsCount} pas)
                        </span>
                      </div>
                      <div className={styles.entityLogoBadge}>
                        <InstitutionLogo
                          institution={institution}
                          brandDomain={financialEntities.find( ( e ) => e.name === institution )?.brandDomain}
                        />
                      </div>
                    </div>
                    <div className={styles.entityCardBottom}>
                      <span className={styles.netBalanceLabel}>Saldo Neto</span>
                      <span className={ `${styles.entityNetBalance} ${netBalance >= 0 ? styles.greenText : styles.redText}` }>
                        {isContentVisible ? formatCents( netBalance ) : ""}
                      </span>
                    </div>
                  </Card>
                ) ;
              } )}
            </div>
          )
        ) : (
          Object.keys( groupedLedger ).length === 0 ? (
            <EmptyState title={accountsPageDict.emptyState} />
          ) : (
            Object.entries( groupedLedger ).map( ( [ type , list ] ) => (
              <div key={type} className={styles.entitySection}>
                <h3 className={styles.entityTitle}>
                  {type === "equity" ? accountsPageDict.typeEquity : type === "revenue" ? accountsPageDict.typeRevenue : accountsPageDict.typeExpense}
                </h3>
                <div className={styles.cardsGridPlan}>
                  {list.map( ( a ) => (
                    <Card key={a.id} className={styles.accountCardDetailed}>
                      <div className={styles.cardHeader}>
                        <span className={styles.accountNameDetailed}>{ a.name }</span>
                        <span className={styles.accountCode}>{ a.code }</span>
                      </div>
                      <div className={styles.cardFooterDetailed}>
                        <span className={styles.accountType}>ARS</span>
                        <span className={styles.accountBalanceMuted}>
                          {isContentVisible ? formatCents( a.balance ) : ""}
                        </span>
                      </div>
                    </Card>
                  ) )}
                </div>
              </div>
            ) )
          )
        )}
      </div>

      {/* Modal para Registrar Entidad */}
      <Modal
        isOpen={isEntityModalOpen}
        onClose={ () => setIsEntityModalOpen( false ) }
        title="Registrar Entidad Financiera"
        subtitle="Agrega un banco, billetera o caja de efectivo a tu panel."
      >
        <CreateFinancialEntityForm
          dict={accountsPageDict}
          onSuccess={ () => setIsEntityModalOpen( false ) }
        />
      </Modal>

      {/* Modal para Crear Cuenta */}
      <Modal
        isOpen={isModalOpen}
        onClose={ () => {
          setIsModalOpen( false ) ;
          setPreselectedEntityId( null ) ;
        } }
        title={accountsPageDict.titleCreateModal || "Crear Cuenta"}
        subtitle="Registra una nueva cuenta en tu catálogo financiero."
      >
        <CreateAccountForm
          dict={accountsPageDict}
          financialEntities={financialEntities}
          defaultEntityId={preselectedEntityId || undefined}
          onSuccess={ () => {
            setIsModalOpen( false ) ;
            setPreselectedEntityId( null ) ;
          } }
        />
      </Modal>

      {/* Modal de Detalle de Cuentas por Entidad */}
      <Modal
        isOpen={!!selectedEntity}
        onClose={ () => setSelectedEntity( null ) }
        title={selectedEntity || ""}
        subtitle="Listado de cuentas e instrumentos financieros asociados"
      >
        <div className={styles.modalScrollBody}>
          <div className={styles.modalActionBar}>
            <Button
              variant="outline"
              onClick={ () => {
                const entityObj = financialEntities.find( ( e ) => e.name === selectedEntity ) ;
                setSelectedEntity( null ) ;
                setPreselectedEntityId( entityObj?.id || null ) ;
                setIsModalOpen( true ) ;
              } }
            >
              + Agregar Cuenta a { selectedEntity }
            </Button>
          </div>

          <div className={styles.detailedCardsGrid}>
            {( groupedWallets[selectedEntity || ""] || [] ).map( ( a ) => {
              const isLiability = ( a.type === "liability" ) ;
              return(
                <Card key={a.id} className={styles.accountCardDetailed}>
                  <div className={styles.cardHeader}>
                    <span className={styles.accountNameDetailed}>{ a.name }</span>
                    <span className={styles.accountCode}>{ a.code }</span>
                  </div>
                  <div className={styles.cardFooterDetailed}>
                    <span className={styles.accountType}>
                      {isLiability ? accountsPageDict.typeLiability.split( " " )[0] : accountsPageDict.typeAsset.split( " " )[0]}
                    </span>
                    <span className={ `${styles.accountBalanceDetailed} ${isLiability ? styles.redText : styles.greenText}` }>
                      {isContentVisible ? formatCents( a.balance ) : ""}
                    </span>
                  </div>
                </Card>
              ) ;
            } )}
          </div>
        </div>
      </Modal>
    </div>
  ) ;
}
