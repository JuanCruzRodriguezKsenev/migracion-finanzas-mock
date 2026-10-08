/**
 * @file CardsContainer.tsx
 * Contenedor principal del módulo de Tarjetas (RFC 007).
 * Conecta estado de cliente, filtros, modal de alta, baja lógica y contexto de perfil para locale.
 */
"use client" ;

// Librerías externas
import { useRouter }                     from "next/navigation" ;
import React , { useState , useTransition } from "react" ;

// Shared
import { PageHeader }         from "@/shared/ui/layout/PageHeader/PageHeader" ;
import { EmptyState }         from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { Button }             from "@/shared/ui/display/Button/Button" ;
import { IconAccounts }       from "@/shared/ui/display/Icons/Icons" ;
import type { getDictionary } from "@/shared/lib/dictionary" ;
import { usePuedeEscribir }   from "@/shared/providers/PermissionsProvider" ;

// Feature: Profile
import { useProfileContext } from "@/features/profile/context/ProfileContext" ;

// Feature: Accounting
import { Account , FinancialEntity , CategoryTreeNode } from "@/features/accounting/types" ;

// Feature: Cards
import { PendingInstallmentsInbox }                 from "./PendingInstallmentsInbox" ;
import { archiveCardAction }                         from "../actions/cardsActions" ;
import { InstallmentPlansModal }                    from "./InstallmentPlansModal" ;
import { CardWithAccountsAndEntity , PendienteCuota } from "../types" ;
import styles                                        from "./Cards.module.css" ;
import { CardFormModal }                             from "./CardFormModal" ;
import { CardVisual }                                from "./CardVisual" ;


interface CardsContainerProps {
  initialCards:      CardWithAccountsAndEntity[] ;
  financialEntities: FinancialEntity[] ;
  accounts:          Account[] ;
  dict:              Awaited< ReturnType< typeof getDictionary > > ;
  initialPending:    PendienteCuota[] ;
  categoryTree:      CategoryTreeNode[] ;
  lang?:             string ;
}

export function CardsContainer( {
  initialCards ,
  financialEntities ,
  accounts ,
  dict ,
  initialPending ,
  categoryTree ,
  lang = "es" ,
}: CardsContainerProps ) {
  const router      = useRouter() ;
  const { profile } = useProfileContext() ;
  const puedeEscribir = usePuedeEscribir() ;
  const locale      = ( profile.numberFormat || "es-AR" ) ;

  const [ activeTab , setActiveTab ]                 = useState< "all" | "credit" | "debit" >( "all" ) ;
  const [ isModalOpen , setIsModalOpen ]             = useState( false ) ;
  const [ plansModalCard , setPlansModalCard ]       = useState< CardWithAccountsAndEntity | null >( null ) ;

  const [ , startTransition ] = useTransition() ;

  const filteredCards = initialCards.filter( ( c ) => {
    if( activeTab === "all" ) { return( true ) ; }
    return( c.type === activeTab ) ;
  } ) ;

  const handleArchive = ( id: string ) => {
    const confirmMsg = (
      dict.cardsPage?.archiveCardConfirm ||
      "¿Estás seguro de que querés dar de baja esta tarjeta?"
    ) ;

    if( !confirm( confirmMsg ) ) {
      return ;
    }

    startTransition( async () => {
      const res = await archiveCardAction( id ) ;
      if( res.success ) {
        router.refresh() ;
      }
    } ) ;
  } ;

  const handleSuccessNewCard = () => {
    router.refresh() ;
  } ;

  return(
    <div className={styles.container}>
      <PageHeader
        title={ dict.cardsPage?.title || "Tarjetas" }
        subtitle={ dict.cardsPage?.subtitle || "Administrá tus plásticos de crédito y débito, límites y cuentas de pasivo." }
        actions={ puedeEscribir ? (
          <Button variant="primary" onClick={ () => setIsModalOpen( true ) }>
            { dict.cardsPage?.newCard || "Nueva tarjeta" }
          </Button>
        ) : undefined }
        showMonthSelector={false}
        dict={dict}
        lang={lang}
      />

      <PendingInstallmentsInbox
        initialPending={initialPending}
        cards={initialCards}
        dict={dict}
        locale={locale}
      />

      <nav className={styles.tabsRow}>
        <button
          type="button"
          className={ `${styles.tabButton} ${activeTab === "all" ? styles.tabButtonActive : ""}` }
          onClick={ () => setActiveTab( "all" ) }
        >
          { dict.cardsPage?.tabAll || "Todas" } ({ initialCards.length })
        </button>
        <button
          type="button"
          className={ `${styles.tabButton} ${activeTab === "credit" ? styles.tabButtonActive : ""}` }
          onClick={ () => setActiveTab( "credit" ) }
        >
          { dict.cardsPage?.tabCredit || "Crédito" } ({ initialCards.filter( ( c ) => c.type === "credit" ).length })
        </button>
        <button
          type="button"
          className={ `${styles.tabButton} ${activeTab === "debit" ? styles.tabButtonActive : ""}` }
          onClick={ () => setActiveTab( "debit" ) }
        >
          { dict.cardsPage?.tabDebit || "Débito" } ({ initialCards.filter( ( c ) => c.type === "debit" ).length })
        </button>
      </nav>

      { filteredCards.length === 0 ? (
        <EmptyState
          icon={<IconAccounts size={48} />}
          title={ dict.cardsPage?.emptyTitle || "No hay tarjetas registradas" }
          description={
            dict.cardsPage?.emptyDescription ||
            "Agregá tu primera tarjeta de crédito o débito para organizar tus instrumentos de pago."
          }
          action={ puedeEscribir ? (
            <Button variant="primary" onClick={ () => setIsModalOpen( true ) }>
              { dict.cardsPage?.emptyAction || "Agregar tarjeta" }
            </Button>
          ) : undefined }
        />
      ) : (
        <div className={styles.grid}>
          { filteredCards.map( ( c ) => (
            <CardVisual
              key={c.id}
              card={c}
              locale={locale}
              dict={dict}
              onArchive={ puedeEscribir ? handleArchive : undefined }
              onViewPlans={ ( card ) => setPlansModalCard( card ) }
            />
          ) ) }
        </div>
      ) }

      { isModalOpen ? (
        <CardFormModal
          isOpen={isModalOpen}
          onClose={ () => setIsModalOpen( false ) }
          financialEntities={financialEntities}
          accounts={accounts}
          onSuccess={handleSuccessNewCard}
        />
      ) : null }

      { plansModalCard ? (
        <InstallmentPlansModal
          card={plansModalCard}
          isOpen={Boolean( plansModalCard )}
          onClose={ () => setPlansModalCard( null ) }
          categoryTree={categoryTree}
          dict={dict}
          locale={locale}
          onChanged={ () => {
            setPlansModalCard( null ) ;
            router.refresh() ;
          } }
        />
      ) : null }
    </div>
  ) ;
}
