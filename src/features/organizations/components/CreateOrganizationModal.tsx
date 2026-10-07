/**
 * @file CreateOrganizationModal.tsx
 * Modal de alta de organización: un campo de nombre, el botón y el error en línea (AC-12).
 */
"use client" ;

// Librerías externas
import React , { useRef , useState } from "react" ;

// Shared
import { FormActions } from "@/shared/ui/forms/Form/FormActions" ;
import { FormInput }   from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }   from "@/shared/ui/forms/Form/FormError" ;
import { Modal }       from "@/shared/ui/feedback/Modal/Modal" ;

// Feature: Organizations
import { crearOrganizacionAction } from "../actions/organizationActions" ;


export interface CreateOrganizationModalProps {
  isOpen:    boolean ;
  onClose:   () => void ;
  /** Se invoca con el id de la organización creada; el modal queda "enviando" hasta que resuelve. */
  onCreated: ( organizationId: string ) => Promise< void > ;
  dict: {
    title:           string ;
    subtitle:        string ;
    nameLabel:       string ;
    namePlaceholder: string ;
    cancel:          string ;
    submit:          string ;
    genericError:    string ;
  } ;
}

/**
 * Contenido del formulario. El estado vive acá y no en el modal: así el `onClose` que recibe `Modal`
 * es el de las props (estable) y escribir no reinicia su efecto de foco (mismo patrón que `ContactFormModal`).
 */
function CreateOrganizationContent( { onClose , onCreated , dict }: Omit< CreateOrganizationModalProps , "isOpen" > ) {
  const [ nombre , setNombre ]     = useState( "" ) ;
  const [ error , setError ]       = useState( "" ) ;
  const [ enviando , setEnviando ] = useState( false ) ;
  const inputRef                   = useRef< HTMLInputElement >( null ) ;

  const handleSubmit = async ( e: React.FormEvent ) => {
    e.preventDefault() ;
    if( enviando ) { return ; }

    setError( "" ) ;
    setEnviando( true ) ;
    // El botón queda deshabilitado mientras crea: el foco vuelve al campo para no perderse en el <body>.
    inputRef.current?.focus() ;

    try {
      const res = await crearOrganizacionAction( { nombre } ) ;

      if( !res.success ) {
        setError( res.error || dict.genericError ) ;
        return ;
      }

      await onCreated( res.value.organizationId ) ;
      setNombre( "" ) ;
      onClose() ;
    } catch {
      setError( dict.genericError ) ;
    } finally {
      setEnviando( false ) ;
      inputRef.current?.focus() ;
    }
  } ;

  return(
    <form onSubmit={handleSubmit}>
      <FormError error={error} />

      <FormInput
        ref={inputRef}
        label={dict.nameLabel}
        value={nombre}
        onChange={ ( e ) => setNombre( e.target.value ) }
        placeholder={dict.namePlaceholder}
        maxLength={100}
        readOnly={enviando}
        required
      />

      <FormActions
        onCancel={onClose}
        cancelLabel={dict.cancel}
        submitLabel={dict.submit}
        submitting={enviando}
      />
    </form>
  ) ;
}

/**
 * Modal con el formulario de creación de una organización nueva.
 */
export function CreateOrganizationModal( { isOpen , onClose , onCreated , dict }: CreateOrganizationModalProps ) {
  return(
    <Modal isOpen={isOpen} onClose={onClose} title={dict.title} subtitle={dict.subtitle}>
      { isOpen && <CreateOrganizationContent onClose={onClose} onCreated={onCreated} dict={dict} /> }
    </Modal>
  ) ;
}
