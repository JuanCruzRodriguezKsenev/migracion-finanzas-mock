/**
 * @file ContactFormModal.tsx
 * Modal para el alta y edición de contactos.
 * Conectado a Server Actions y validación local de formulario.
 */
"use client" ;

// Librerías externas
import React , { useState , useTransition } from "react" ;

// Shared
import { Modal }  from "@/shared/ui/feedback/Modal/Modal" ;
import { Button } from "@/shared/ui/display/Button/Button" ;

// Feature: Contacts
import { createContactAction , updateContactAction } from "../actions/contactsActions" ;
import { Contact }                                   from "../types" ;
import styles                                        from "./Contacts.module.css" ;


interface ContactFormModalProps {
  isOpen:         boolean ;
  onClose:        () => void ;
  contactToEdit?: Contact | null ;
  onSuccess:      () => void ;
  dict?: {
    modalNewTitle?:  string ;
    modalEditTitle?: string ;
    modalSubtitle?:  string ;
    fieldNombre?:    string ;
    fieldEmail?:     string ;
    fieldPhone?:     string ;
    fieldNotes?:     string ;
    btnSave?:        string ;
    btnCancel?:      string ;
  } ;
}

interface ContactFormContentProps {
  contactToEdit?: Contact | null ;
  onClose:        () => void ;
  onSuccess:      () => void ;
  dict?:          ContactFormModalProps["dict"] ;
}

function ContactFormContent( {
  contactToEdit ,
  onClose ,
  onSuccess ,
  dict ,
}: ContactFormContentProps ) {
  const [ name , setName ]   = useState( contactToEdit?.name || "" ) ;
  const [ email , setEmail ] = useState( contactToEdit?.email || "" ) ;
  const [ phone , setPhone ] = useState( contactToEdit?.phone || "" ) ;
  const [ notes , setNotes ] = useState( contactToEdit?.notes || "" ) ;
  const [ error , setError ] = useState< string | null >( null ) ;

  const [ isPending , startTransition ] = useTransition() ;

  const handleSubmit = ( e: React.FormEvent ) => {
    e.preventDefault() ;

    if( !name.trim() || ( name.trim().length < 2 ) ) {
      setError( "El nombre debe tener al menos 2 caracteres." ) ;
      return ;
    }

    startTransition( async() => {
      setError( null ) ;

      if( contactToEdit ) {
        const res = await updateContactAction( contactToEdit.id , {
          name:  name.trim() ,
          email: email.trim() || undefined ,
          phone: phone.trim() || undefined ,
          notes: notes.trim() || undefined ,
        } ) ;

        if( res.success ) {
          onSuccess() ;
          onClose() ;
        } else {
          setError( res.error ) ;
        }
      } else {
        const res = await createContactAction( {
          name:  name.trim() ,
          email: email.trim() || undefined ,
          phone: phone.trim() || undefined ,
          notes: notes.trim() || undefined ,
        } ) ;

        if( res.success ) {
          onSuccess() ;
          onClose() ;
        } else {
          setError( res.error ) ;
        }
      }
    } ) ;
  } ;

  return(
    <form onSubmit={handleSubmit} className={styles.modalForm}>
      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          {dict?.fieldNombre || "Nombre"} *
        </label>
        <input
          type="text"
          className={styles.formInput}
          value={name}
          onChange={ ( e ) => setName( e.target.value ) }
          placeholder="Ej: Pedro Gómez"
          required
          autoFocus
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          {dict?.fieldEmail || "Email"}
        </label>
        <input
          type="email"
          className={styles.formInput}
          value={email}
          onChange={ ( e ) => setEmail( e.target.value ) }
          placeholder="pedro@ejemplo.com"
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          {dict?.fieldPhone || "Teléfono"}
        </label>
        <input
          type="tel"
          className={styles.formInput}
          value={phone}
          onChange={ ( e ) => setPhone( e.target.value ) }
          placeholder="+54 9 11 1234-5678"
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          {dict?.fieldNotes || "Notas"}
        </label>
        <textarea
          className={styles.formInput}
          rows={3}
          value={notes}
          onChange={ ( e ) => setNotes( e.target.value ) }
          placeholder="Información adicional o referencia..."
        />
      </div>

      <div className={styles.modalActions}>
        <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
          {dict?.btnCancel || "Cancelar"}
        </Button>
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Guardando..." : ( dict?.btnSave || "Guardar" )}
        </Button>
      </div>
    </form>
  ) ;
}

export function ContactFormModal( {
  isOpen ,
  onClose ,
  contactToEdit ,
  onSuccess ,
  dict ,
}: ContactFormModalProps ) {
  const modalTitle = ( contactToEdit
    ? ( dict?.modalEditTitle || "Editar Contacto" )
    : ( dict?.modalNewTitle  || "Nuevo Contacto" ) ) ;

  return(
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={dict?.modalSubtitle || "Completa los datos del contacto o destinatario."}
    >
      {isOpen && (
        <ContactFormContent
          key={contactToEdit?.id ?? "new"}
          contactToEdit={contactToEdit}
          onClose={onClose}
          onSuccess={onSuccess}
          dict={dict}
        />
      )}
    </Modal>
  ) ;
}
