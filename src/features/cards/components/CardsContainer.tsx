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
import { EmptyState }   from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { Button }       from "@/shared/ui/display/Button/Button" ;
import { IconAccounts } from "@/shared/ui/display/Icons/Icons" ;

// Feature: Profile
import { useProfileContext } from "@/features/profile/context/ProfileContext" ;

// Feature: Accounting
import { Account , FinancialEntity } from "@/features/accounting/types" ;

// Feature: Cards
import { CardWithAccountsAndEntity } from "../types" ;
import { archiveCardAction }          from "../actions/cardsActions" ;
import { CardFormModal }              from "./CardFormModal" ;
import { CardVisual }                 from "./CardVisual" ;
import styles                         from "./Cards.module.css" ;


interface CardsContainerProps {
  initialCards:      CardWithAccountsAndEntity[] ;
  financialEntities: FinancialEntity[] ;
  accounts:          Account[] ;
}

export function CardsContainer( {
  initialCards ,
  financialEntities ,
  accounts ,
}: CardsContainerProps ) {
  const router      = useRouter() ;
  const { profile } = useProfileContext() ;
  const locale      = ( profile.numberFormat || "es-AR" ) ;

  const [ activeTab , setActiveTab ]     = useState< "all" | "credit" | "debit" >( "all" ) ;
  const [ isModalOpen , setIsModalOpen ] = useState( false ) ;

  const [ , startTransition ] = useTransition() ;

  const filteredCards = initialCards.filter( ( c ) => {
    if( activeTab === "all" ) { return( true ) ; }
    return( c.type === activeTab ) ;
  } ) ;

  const handleArchive = ( id: string ) => {
    if( !confirm( "¿Estás seguro de que querés dar de baja esta tarjeta?" ) ) {
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
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Tarjetas</h1>
          <p className={styles.subtitle}>
            Administrá tus plásticos de crédito y débito, límites y cuentas de pasivo.
          </p>
        </div>

        <Button variant="primary" onClick={ () => setIsModalOpen( true ) }>
          Nueva Tarjeta
        </Button>
      </header>

      <nav className={styles.tabsRow}>
        <button
          type="button"
          className={ `${styles.tabButton} ${activeTab === "all" ? styles.tabButtonActive : ""}` }
          onClick={ () => setActiveTab( "all" ) }
        >
          Todas ({ initialCards.length })
        </button>
        <button
          type="button"
          className={ `${styles.tabButton} ${activeTab === "credit" ? styles.tabButtonActive : ""}` }
          onClick={ () => setActiveTab( "credit" ) }
        >
          Crédito ({ initialCards.filter( ( c ) => c.type === "credit" ).length })
        </button>
        <button
          type="button"
          className={ `${styles.tabButton} ${activeTab === "debit" ? styles.tabButtonActive : ""}` }
          onClick={ () => setActiveTab( "debit" ) }
        >
          Débito ({ initialCards.filter( ( c ) => c.type === "debit" ).length })
        </button>
      </nav>

      { filteredCards.length === 0 ? (
        <EmptyState
          icon={<IconAccounts size={48} />}
          title="No hay tarjetas registradas"
          description="Agregá tu primera tarjeta de crédito o débito para organizar tus instrumentos de pago."
          action={
            <Button variant="primary" onClick={ () => setIsModalOpen( true ) }>
              Agregar Tarjeta
            </Button>
          }
        />
      ) : (
        <div className={styles.grid}>
          { filteredCards.map( ( c ) => (
            <CardVisual
              key={c.id}
              card={c}
              locale={locale}
              onArchive={handleArchive}
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
    </div>
  ) ;
}
