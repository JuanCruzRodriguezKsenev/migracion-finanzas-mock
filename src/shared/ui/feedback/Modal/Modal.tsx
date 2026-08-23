/**
 * @file Modal.tsx
 * Componente modal superpuesto genérico, accesible y de alto rendimiento.
 * Utiliza React Portals para inyección en el body y previene cierres accidentales.
 * Implementa una trampa de foco (Focus Trap) completa para navegación por teclado segura.
 */
"use client" ;

// Librerías externas
import React , { useEffect , useRef , useSyncExternalStore } from "react" ;
import { createPortal }                                      from "react-dom" ;

// Shared
import { IconClose } from "@/shared/ui/display/Icons/Icons" ;
import styles        from "./Modal.module.css" ;


// Suscripción vacía: nunca hay actualizaciones externas, solo diferenciamos servidor/cliente
function subscribeNoop() { return( () => {} ) ; }

interface ModalProps {
  isOpen:    boolean ;
  onClose:   () => void ;
  title:     string ;
  subtitle?: string ;
  children:  React.ReactNode ;
  footer?:   React.ReactNode ;
  size?:     "small" | "medium" | "large" | "xlarge" ;
}

export function Modal( {
  isOpen ,
  onClose ,
  title ,
  subtitle ,
  children ,
  footer ,
  size = "small"
}: ModalProps ) {
  // Portal seguro para SSR: "false" en el snapshot de servidor, "true" en el de cliente
  const mounted = useSyncExternalStore( subscribeNoop , () => true , () => false ) ;
  const overlayRef                      = useRef< HTMLDivElement >( null ) ;
  const modalBoxRef                     = useRef< HTMLDivElement >( null ) ;
  const mouseDownOnOverlayRef           = useRef( false ) ;
  const previouslyFocusedRef            = useRef< HTMLElement | null >( null ) ;

  const handleMouseDown = ( e: React.MouseEvent ) => {
    mouseDownOnOverlayRef.current = ( e.target === overlayRef.current ) ;
  } ;

  const handleMouseUp = ( e: React.MouseEvent ) => {
    if( mouseDownOnOverlayRef.current && ( e.target === overlayRef.current ) ) {
      onClose() ;
    }
  } ;

  useEffect( () => {
    if( !isOpen ) { return ; }

    // Recordar el elemento que tenía el foco antes de abrir, para restaurarlo al cerrar
    previouslyFocusedRef.current = ( document.activeElement as HTMLElement ) ;

    const handleKeyDown = ( e: KeyboardEvent ) => {
      // Cerrar con Escape
      if( e.key === "Escape" ) {
        onClose() ;
        return ;
      }

      // Trampa de Foco al presionar Tab
      if( e.key === "Tab" ) {
        if( !modalBoxRef.current ) { return ; }

        const focusableSelector = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]' ;
        const focusableElements = Array.from( modalBoxRef.current.querySelectorAll( focusableSelector ) ) as HTMLElement[] ;

        if( focusableElements.length === 0 ) {
          e.preventDefault() ;
          return ;
        }

        const firstElement  = focusableElements[0] ;
        const lastElement   = focusableElements[focusableElements.length - 1] ;
        const activeElement = document.activeElement as HTMLElement ;

        if( e.shiftKey ) {
          // Shift + Tab: si está en el primero, salta al último
          if( activeElement === firstElement ) {
            lastElement.focus() ;
            e.preventDefault() ;
          }
        } else {
          // Tab: si está en el último, salta al primero
          if( activeElement === lastElement ) {
            firstElement.focus() ;
            e.preventDefault() ;
          }
        }
      }
    } ;

    // Auto-enfocar el primer elemento interactivo al abrir el modal
    const focusTimer = setTimeout( () => {
      if( modalBoxRef.current ) {
        const focusableSelector = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]' ;
        const focusableElements = Array.from( modalBoxRef.current.querySelectorAll( focusableSelector ) ) as HTMLElement[] ;
        if( focusableElements.length > 0 ) {
          focusableElements[0].focus() ;
        }
      }
    } , 50 ) ;

    document.addEventListener( "keydown" , handleKeyDown ) ;
    document.body.style.overflow = "hidden" ;

    return( () => {
      clearTimeout( focusTimer ) ;
      document.removeEventListener( "keydown" , handleKeyDown ) ;
      document.body.style.overflow = "" ;

      // Devolver el foco al elemento que lo tenía antes de abrir el modal
      previouslyFocusedRef.current?.focus?.() ;
    } ) ;
  } , [ isOpen , onClose ] ) ;

  if( !isOpen ) { return( null ) ; }

  const sizeClass = ( styles[`size${size.charAt( 0 ).toUpperCase() + size.slice( 1 )}`] || styles.sizeSmall ) ;

  const modalContent = (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <div
        ref={modalBoxRef}
        className={ `${styles.modalBox} ${sizeClass}` }
        onClick={ ( e ) => e.stopPropagation() }
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h3 id="modal-title" className={styles.title}>{ title }</h3>
            {subtitle && <p className={styles.subtitle}>{ subtitle }</p>}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar modal">
            <IconClose size={18} />
          </button>
        </div>

        <div className={styles.content}>
          { children }
        </div>

        {footer && (
          <div className={styles.footer}>
            { footer }
          </div>
        )}
      </div>
    </div>
  ) ;

  return( mounted ? createPortal( modalContent , document.body ) : null ) ;
}
