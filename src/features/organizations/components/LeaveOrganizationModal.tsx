/**
 * @file LeaveOrganizationModal.tsx
 * Confirmación simple para abandonar la organización activa (RN-28, AC-24).
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;

// Shared
import { FormError } from "@/shared/ui/forms/Form/FormError" ;
import { Button }    from "@/shared/ui/display/Button/Button" ;
import { Modal }     from "@/shared/ui/feedback/Modal/Modal" ;

// Feature: Organizations
import { abandonarOrganizacionAction , type CambioDeOrganizacion } from "../actions/organizationActions" ;
import styles                                                       from "./LeaveOrganizationModal.module.css" ;


export interface LeaveOrganizationModalProps {
  isOpen:  boolean ;
  onClose: () => void ;
  /** Nombre de la organización que se deja, para el título. */
  nombre:  string ;
  /** Se invoca con la organización a la que pasa el usuario; el modal queda "enviando" hasta que resuelve. */
  onLeft:  ( cambio: CambioDeOrganizacion ) => Promise< void > ;
  dict: {
    title:        string ;
    subtitle:     string ;
    cancel:       string ;
    submit:       string ;
    genericError: string ;
  } ;
}

/**
 * Modal de confirmación: avisa qué se pierde y qué se conserva, y ejecuta la salida.
 */
export function LeaveOrganizationModal( { isOpen , onClose , nombre , onLeft , dict }: LeaveOrganizationModalProps ) {
  const [ error , setError ]       = useState( "" ) ;
  const [ enviando , setEnviando ] = useState( false ) ;

  const handleClose = () => {
    if( enviando ) { return ; }
    setError( "" ) ;
    onClose() ;
  } ;

  const handleConfirm = async () => {
    if( enviando ) { return ; }

    setError( "" ) ;
    setEnviando( true ) ;

    try {
      const res = await abandonarOrganizacionAction() ;

      if( !res.success ) {
        setError( res.error || dict.genericError ) ;
        return ;
      }

      await onLeft( res.value ) ;
      onClose() ;
    } catch {
      setError( dict.genericError ) ;
    } finally {
      setEnviando( false ) ;
    }
  } ;

  return(
    <Modal isOpen={isOpen} onClose={handleClose} title={dict.title.replace( "{nombre}" , nombre )} subtitle={dict.subtitle}>
      <FormError error={error} />
      <div className={styles.actions}>
        <Button variant="secondary" disabled={enviando} onClick={handleClose}>{dict.cancel}</Button>
        <Button variant="danger" isLoading={enviando} onClick={handleConfirm}>{dict.submit}</Button>
      </div>
    </Modal>
  ) ;
}
