/**
 * @file ContactsContainer.tsx
 * Componente contenedor orquestador del módulo de Contactos y Cuentas de Cobro.
 * Gestiona estados interactivos, búsqueda reactiva, modales de alta/edición y panel de métodos.
 */
"use client" ;

// Librerías externas
import React , { useState , useTransition , useMemo } from "react" ;

// Shared
import type { getDictionary } from "@/shared/lib/dictionary" ;
import { SearchInput }        from "@/shared/ui/forms/SearchInput/SearchInput" ;
import { Button }             from "@/shared/ui/display/Button/Button" ;

// Feature: Accounting
import { FinancialEntity } from "@/features/accounting/types" ;

// Feature: Contacts
import { getContactsAction , archiveContactAction } from "../actions/contactsActions" ;
import { ContactWithPaymentMethods , Contact }      from "../types" ;
import { PaymentMethodsPanel }                      from "./PaymentMethodsPanel" ;
import { ContactFormModal }                         from "./ContactFormModal" ;
import { ContactsTable }                            from "./ContactsTable" ;
import styles                                       from "./Contacts.module.css" ;


interface ContactsContainerProps {
  initialContacts:   ContactWithPaymentMethods[] ;
  financialEntities: FinancialEntity[] ;
  dict?:             Awaited< ReturnType< typeof getDictionary > > ;
}

export function ContactsContainer( {
  initialContacts ,
  financialEntities ,
  dict ,
}: ContactsContainerProps ) {
  const [ contacts , setContacts ]                         = useState< ContactWithPaymentMethods[] >( initialContacts ) ;
  const [ search , setSearch ]                             = useState( "" ) ;
  const [ selectedContactId , setSelectedContactId ]       = useState< string | null >( null ) ;
  const [ isContactModalOpen , setIsContactModalOpen ]     = useState( false ) ;
  const [ contactToEdit , setContactToEdit ]               = useState< Contact | null >( null ) ;
  const [ isMethodsPanelOpen , setIsMethodsPanelOpen ]     = useState( false ) ;

  const [ isPending , startTransition ] = useTransition() ;

  const pageDict = dict?.contactsPage ;

  const refreshData = () => {
    startTransition( async() => {
      const res = await getContactsAction( { search } ) ;
      if( res.success ) {
        setContacts( res.value ) ;
      }
    } ) ;
  } ;

  // Filtrado reactivo en cliente sobre el término de búsqueda
  const filteredContacts = useMemo( () => {
    if( !search.trim() ) {
      return( contacts ) ;
    }
    const q = search.toLowerCase().trim() ;
    return(
      contacts.filter( ( c ) => (
        c.name.toLowerCase().includes( q ) ||
        ( c.email && c.email.toLowerCase().includes( q ) ) ||
        ( c.phone && c.phone.toLowerCase().includes( q ) ) ||
        ( c.notes && c.notes.toLowerCase().includes( q ) )
      ) )
    ) ;
  } , [ contacts , search ] ) ;

  const selectedContact = useMemo( () => {
    if( !selectedContactId ) {
      return( null ) ;
    }
    return( contacts.find( ( c ) => c.id === selectedContactId ) || null ) ;
  } , [ contacts , selectedContactId ] ) ;

  const handleOpenCreate = () => {
    setContactToEdit( null ) ;
    setIsContactModalOpen( true ) ;
  } ;

  const handleOpenEdit = ( contact: ContactWithPaymentMethods ) => {
    setContactToEdit( contact ) ;
    setIsContactModalOpen( true ) ;
  } ;

  const handleOpenMethods = ( contact: ContactWithPaymentMethods ) => {
    setSelectedContactId( contact.id ) ;
    setIsMethodsPanelOpen( true ) ;
  } ;

  const handleArchive = ( contact: ContactWithPaymentMethods ) => {
    if( !confirm( `¿Estás seguro de archivar a "${contact.name}"? Podrás restaurarlo más adelante.` ) ) {
      return ;
    }

    startTransition( async() => {
      const res = await archiveContactAction( contact.id ) ;
      if( res.success ) {
        setContacts( ( prev ) => prev.filter( ( c ) => c.id !== contact.id ) ) ;
      } else {
        alert( res.error ) ;
      }
    } ) ;
  } ;

  return(
    <div className={styles.container}>
      {/* Encabezado */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>
              {pageDict?.title || "Agenda de Contactos"}
            </h1>
            <span className={styles.countBadge}>
              {contacts.length} {contacts.length === 1 ? "contacto" : "contactos"}
            </span>
          </div>
          <p className={styles.subtitle}>
            {pageDict?.subtitle || "Administra tus contactos, destinatarios y sus cuentas de cobro (CBU/CVU y Alias)."}
          </p>
        </div>

        <Button variant="primary" onClick={handleOpenCreate}>
          {pageDict?.btnNew || "Nuevo Contacto"}
        </Button>
      </div>

      {/* Controles de Búsqueda */}
      <div className={styles.controlsBar}>
        <div className={styles.searchWrapper}>
          <SearchInput
            placeholder={pageDict?.filterSearch || "Buscar por nombre, email o teléfono..."}
            value={search}
            onChange={setSearch}
          />
        </div>
      </div>

      {/* Tabla de Contactos */}
      <ContactsTable
        contacts={filteredContacts}
        loading={isPending}
        onSelectContact={handleOpenMethods}
        onEditContact={handleOpenEdit}
        onArchiveContact={handleArchive}
        dict={pageDict}
      />

      {/* Modal de Alta y Edición de Contactos */}
      <ContactFormModal
        isOpen={isContactModalOpen}
        onClose={ () => setIsContactModalOpen( false ) }
        contactToEdit={contactToEdit}
        onSuccess={refreshData}
        dict={pageDict}
      />

      {/* Panel de Métodos de Cobro del Contacto Seleccionado */}
      <PaymentMethodsPanel
        isOpen={isMethodsPanelOpen}
        onClose={ () => {
          setIsMethodsPanelOpen( false ) ;
          setSelectedContactId( null ) ;
        } }
        contact={selectedContact}
        financialEntities={financialEntities}
        onRefresh={refreshData}
        dict={pageDict ? {
          ...pageDict ,
          accountsPage: dict?.accountsPage ,
        } : undefined}
      />
    </div>
  ) ;
}
