/**
 * @file AccountsContainer.tsx
 * Contenedor principal cliente para la gestión de cuentas financieras.
 * Integra las tarjetas de métricas, tabs de navegación y el formulario de creación en modal.
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;

// Shared
import { useMetricsVisibility } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { InstitutionLogo }      from "@/shared/ui/display/InstitutionLogo/InstitutionLogo" ;
import { MetricsSection }       from "@/shared/ui/layout/MetricsSection/MetricsSection" ;
import { Sparkline }            from "@/shared/ui/display/RechartsSparkline/Sparkline" ;
import { formatCurrency }       from "@/shared/lib/currencyFormatter" ;
import { PageHeader }           from "@/shared/ui/layout/PageHeader/PageHeader" ;
import { EmptyState }           from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { MetricCard }           from "@/shared/ui/MetricCard/MetricCard" ;
import { Button }               from "@/shared/ui/display/Button/Button" ;
import type { getDictionary }   from "@/shared/lib/dictionary" ;
import { Modal }                from "@/shared/ui/feedback/Modal/Modal" ;
import { Card }                 from "@/shared/ui/display/Card/Card" ;

// Feature: Accounting
import {
  formatCents ,
  formatMonthKey ,
  SparklinePoint ,
  calcularTendenciaDesdeSparkline
} from "../utils/dashboardMetrics" ;
import { CuentaDeListado , FinancialEntity , MonthlySummary }   from "../types" ;
import styles                                                   from "./AccountsContainer.module.css" ;
import { CreateAccountForm }                                    from "./CreateAccountForm" ;
import { MyAccountsPanel }                                      from "./MyAccountsPanel" ;
import { AccountLabel }                                         from "./AccountLabel" ;

// Feature: Cards
import { CardWithAccountsAndEntity } from "@/features/cards/types" ;
import { CardVisual }                from "@/features/cards/components/CardVisual" ;
import { deudaDe }                   from "@/features/cards/utils/ciclo" ;

// Feature: Loans
import type { LoanConResumen } from "@/features/loans/types" ;

// Feature: Goals
import type { ReservedByAccount } from "@/features/goals/types" ;


interface AccountsContainerProps {
  accounts:          CuentaDeListado[] ;
  cards:             CardWithAccountsAndEntity[] ;
  loans:             LoanConResumen[] ;
  financialEntities: FinancialEntity[] ;
  summaries:         MonthlySummary[] ;
  dict:              Awaited< ReturnType< typeof getDictionary > > ;
  lang:              string ;
  /** Reservado y libre por cuenta de activo (Metas, RFC 011). Opcional: sin él, nada cambia. */
  reservado?:        Record< string , ReservedByAccount > ;
  /** La organización activa es el espacio Personal de quien mira: la vista única es «Mis cuentas» (RN-16). */
  esPersonal?:       boolean ;
}

export function AccountsContainer( {
  accounts ,
  cards ,
  loans ,
  financialEntities ,
  summaries ,
  dict ,
  lang ,
  reservado ,
  esPersonal = false
}: AccountsContainerProps ) {
  const { isContentVisible }                         = useMetricsVisibility() ;
  const [ isModalOpen , setIsModalOpen ]             = useState( false ) ;
  const [ selectedEntity , setSelectedEntity ]       = useState< string | null >( null ) ;
  const [ preselectedEntityId , setPreselectedEntityId ] = useState< string | null >( null ) ;
  const [ vistaElegida , setVista ]                  = useState< "organizacion" | "mias" >( "organizacion" ) ;

  // En Personal no hay elección: «Mis cuentas» es la única vista
  const vista = ( esPersonal ? "mias" : vistaElegida ) ;

  const accountsPageDict = ( dict.accountsPage || {} ) ;

  // Separar cuentas de balance
  const walletAccounts = accounts.filter( ( a ) => (a.type === "asset") || (a.type === "liability") ) ;

  // Las personales compartidas se listan con su etiqueta, pero no entran en los totales ni en el saldo neto
  // de la entidad: ésos son de la organización (RN-16), y el saldo de una ajena ni siquiera llega (RN-11).
  const cuentasDeLaOrg = walletAccounts.filter( ( a ) => !a.ownerUserId ) ;

  // Agrupar cuentas financieras por Entidad/Institución
  const groupedWallets = walletAccounts.reduce( ( acc , val ) => {
    const key = ( val.entity?.name || "Otros" ) ;
    if( !acc[key] ) {
      acc[key] = [] ;
    }
    acc[key].push( val ) ;
    return( acc ) ;
  } , {} as Record< string , CuentaDeListado[] > ) ;

  // Conjunto de IDs de cuentas contables vinculadas a tarjetas (evita duplicar la deuda en el listado de cuentas)
  const cardAccountIds = new Set(
    cards.flatMap( ( c ) => c.accounts.map( ( ca ) => ca.account.id ) )
  ) ;

  // Conjunto de IDs de cuentas contables vinculadas a préstamos (evita duplicar la deuda en el listado de cuentas)
  const loanAccountIds = new Set(
    loans.flatMap( ( l ) => l.accounts.map( ( la ) => la.account.id ) )
  ) ;

  // Calcular métricas
  const totalAssets = cuentasDeLaOrg.filter( ( a ) => a.type === "asset" ).reduce( ( sum , a ) => (sum + (a.balance ?? 0)) , 0 ) ;
  const totalLiabs  = cuentasDeLaOrg.filter( ( a ) => a.type === "liability" ).reduce( ( sum , a ) => (sum + (a.balance ?? 0)) , 0 ) ;

  // Procesar series temporales reales para Activos y Pasivos
  const sparklinePointsAssets: SparklinePoint[] = summaries.map( ( s ) => ( {
    value:    s.assetsSnapshot / 100 ,
    monthKey: formatMonthKey( s.year , s.month )
  } ) ).reverse() ;

  const sparklinePointsLiabs: SparklinePoint[] = summaries.map( ( s ) => ( {
    value:    s.liabilitiesSnapshot / 100 ,
    monthKey: formatMonthKey( s.year , s.month )
  } ) ).reverse() ;

  // Calcular tendencias dinámicas
  const tendenciaAssets   = calcularTendenciaDesdeSparkline( sparklinePointsAssets ) ;
  const tendenciaLiabs    = calcularTendenciaDesdeSparkline( sparklinePointsLiabs , true ) ; // Invertida para pasivos

  const labelTrend = ( dict.dashboard?.savingTrend || "vs mes anterior" ) ;

  return(
    <div className={styles.container}>
      {/* Encabezado unificado de página */}
      <PageHeader
        title={accountsPageDict.title}
        subtitle={accountsPageDict.subtitle}
        actions={ esPersonal ? undefined : (
          <div className={styles.actionBarButtons}>
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
        ) }
        showMonthSelector={false}
        dict={dict}
        lang={lang}
      />

      {/* Selector de vista: la lista de la organización o «Mis cuentas» (RN-16). No es una ruta. */}
      {!esPersonal && (
      <div className={styles.viewSwitch} role="group" aria-label={accountsPageDict.viewSelectorLabel}>
        <button
          type="button"
          className={ `${styles.viewBtn} ${(vista === "organizacion") ? styles.viewBtnActive : ""}` }
          aria-pressed={vista === "organizacion"}
          onClick={ () => setVista( "organizacion" ) }
        >
          {accountsPageDict.viewOrganization}
        </button>
        <button
          type="button"
          className={ `${styles.viewBtn} ${(vista === "mias") ? styles.viewBtnActive : ""}` }
          aria-pressed={vista === "mias"}
          onClick={ () => setVista( "mias" ) }
        >
          {accountsPageDict.viewMine}
        </button>
      </div>
      )}

      {(vista === "mias") ? (
        <MyAccountsPanel dict={accountsPageDict} financialEntities={financialEntities} esPersonal={esPersonal} />
      ) : (
      <>
      {/* Indicadores de Balance Superior utilizando MetricsSection en modo simpleGrid */}
      <MetricsSection
        allowVisibilityToggle={true}
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

      {/* Grilla de Cuentas */}
      <div className={styles.gridContent}>
        {Object.keys( groupedWallets ).length === 0 ? (
          <EmptyState title={accountsPageDict.emptyState} />
        ) : (
          <div className={styles.cardsGrid}>
            {Object.entries( groupedWallets ).map( ( [ institution , list ] ) => {
              const netBalance = list.filter( ( a ) => !a.ownerUserId ).reduce( ( sum , a ) => (sum + (a.balance ?? 0)) , 0 ) ;
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
        )}
      </div>

      </>
      )}

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

          { ( () => {
            const selectedEntityObj = financialEntities.find( ( e ) => e.name === selectedEntity ) ;
            const entityCards = selectedEntityObj
              ? cards.filter( ( c ) => c.entityId === selectedEntityObj.id )
              : ( ( selectedEntity === "Otros" ) ? cards.filter( ( c ) => !c.entityId ) : [] ) ;
            const entityLoans = selectedEntityObj
              ? loans.filter( ( l ) => l.entityId === selectedEntityObj.id )
              : ( ( selectedEntity === "Otros" ) ? loans.filter( ( l ) => !l.entityId ) : [] ) ;
            const entityAccounts = ( groupedWallets[selectedEntity || ""] || [] ).filter(
              ( a ) => !cardAccountIds.has( a.id ) && !loanAccountIds.has( a.id )
            ) ;

            if( ( entityCards.length === 0 ) && ( entityAccounts.length === 0 ) && ( entityLoans.length === 0 ) ) {
              return(
                <EmptyState title={accountsPageDict.emptyState} />
              ) ;
            }

            return(
              <>
                { entityCards.length > 0 ? (
                  <div className={styles.modalSection}>
                    <h4 className={styles.modalSectionTitle}>
                      {accountsPageDict.sectionCards || "Tarjetas"}
                    </h4>
                    <div className={styles.cardsVisualGrid}>
                      {entityCards.map( ( card ) => (
                        <CardVisual
                          key={card.id}
                          card={card}
                          locale={lang}
                        />
                      ) )}
                    </div>
                  </div>
                ) : null }

                { entityLoans.length > 0 ? (
                  <div className={styles.modalSection}>
                    <h4 className={styles.modalSectionTitle}>
                      {accountsPageDict.sectionLoans || "Préstamos"}
                    </h4>
                    <div className={styles.detailedCardsGrid}>
                      {entityLoans.map( ( loan ) => {
                        const isBorrowed     = ( loan.direction === "borrowed" ) ;
                        const balanceDisplay = (
                          loan.saldoPendiente === null
                            ? "—"
                            : formatCurrency( loan.saldoPendiente , loan.currency , lang )
                        ) ;

                        return(
                          <Card key={loan.id} className={styles.accountCardDetailed}>
                            <div className={styles.cardHeader}>
                              <span className={styles.accountNameDetailed}>{ loan.name }</span>
                              <span className={ isBorrowed ? styles.badgeBorrowed : styles.badgeLent }>
                                { isBorrowed
                                  ? ( dict.loansPage?.badgeBorrowed || "Pedido" )
                                  : ( dict.loansPage?.badgeLent || "Dado" ) }
                              </span>
                            </div>
                            <div className={styles.cardFooterDetailed}>
                              <span className={styles.accountType}>
                                { `${loan.cuotasPagadas} / ${loan.totalInstallments}` }
                              </span>
                              <span className={ `${styles.accountBalanceDetailed} ${isBorrowed ? styles.redText : styles.greenText}` }>
                                { isContentVisible ? balanceDisplay : "" }
                              </span>
                            </div>
                          </Card>
                        ) ;
                      } )}
                    </div>
                  </div>
                ) : null }

                { entityAccounts.length > 0 ? (
                  <div className={styles.modalSection}>
                    <h4 className={styles.modalSectionTitle}>
                      {accountsPageDict.sectionAccounts || "Cuentas"}
                    </h4>
                    <div className={styles.detailedCardsGrid}>
                      {entityAccounts.map( ( a ) => {
                        const isLiability    = ( a.type === "liability" ) ;
                        const balanceDisplay = isLiability ? deudaDe( {balance: (a.balance ?? 0)} ) : (a.balance ?? 0) ;

                        return(
                          <Card key={a.id} className={styles.accountCardDetailed}>
                            <div className={styles.cardHeader}>
                              <span className={styles.accountNameDetailed}>{ a.name }</span>
                              <span className={styles.accountCode}>{ a.code }</span>
                            </div>
                            { a.etiqueta ? (
                              <AccountLabel etiqueta={a.etiqueta} dict={accountsPageDict} className={styles.accountLabelRow} />
                            ) : null }
                            <div className={styles.cardFooterDetailed}>
                              <span className={styles.accountType}>
                                {isLiability ? accountsPageDict.typeLiability.split( " " )[0] : accountsPageDict.typeAsset.split( " " )[0]}
                              </span>
                              <span className={ `${styles.accountBalanceDetailed} ${isLiability ? styles.redText : styles.greenText}` }>
                                { (a.balance === null)
                                  ? accountsPageDict.balanceHidden
                                  : ( isContentVisible ? formatCents( balanceDisplay ) : "" ) }
                              </span>
                            </div>
                            { reservado?.[ a.id ] ? (
                              <div className={styles.freeLine}>
                                <span>
                                  { `${accountsPageDict.freeLabel || "libre"} ` }
                                  { isContentVisible ? formatCents( reservado[ a.id ].libre ) : "" }
                                </span>
                                { ( reservado[ a.id ].libre < 0 ) ? (
                                  <span className={styles.uncoveredBadge}>
                                    { accountsPageDict.uncoveredLabel || "descubierta" }
                                  </span>
                                ) : null }
                              </div>
                            ) : null }
                          </Card>
                        ) ;
                      } )}
                    </div>
                  </div>
                ) : null }
              </>
            ) ;
          } )() }
        </div>
      </Modal>
    </div>
  ) ;
}
