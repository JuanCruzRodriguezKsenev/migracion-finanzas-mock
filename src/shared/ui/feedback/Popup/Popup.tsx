/**
 * @file Popup.tsx
 * Componente genérico de popup flotante con portal.
 * Se ancla a un elemento de referencia y escapa de cualquier stacking context.
 */
"use client" ;

// Librerías externas
import { useEffect , useRef , useLayoutEffect } from "react" ;
import { createPortal }                        from "react-dom" ;

// Shared
import styles from "./Popup.module.css" ;

type PopupPlacement = "top-start" | "top-end" | "bottom-start" | "bottom-end" ;

interface PopupProps {
  anchor:     React.RefObject<HTMLElement | null> ;
  open:       boolean ;
  onClose:    () => void ;
  children:   React.ReactNode ;
  placement?: PopupPlacement ;
  offset?:    number ;
  className?: string ;
}

/**
 * Componente flotante de portal para menús y popovers.
 */
export function Popup( {
  anchor ,
  open ,
  onClose ,
  children ,
  placement = "top-start" ,
  offset    = 8 ,
  className
}: PopupProps ) {
  const popupRef = useRef<HTMLDivElement>( null ) ;

  // Posicionar el popup relativo al anchor
  useLayoutEffect( () => {
    if( !open || !anchor.current || !popupRef.current ) { return ; }

    const anchorRect = anchor.current.getBoundingClientRect() ;
    const popup      = popupRef.current ;
    const popupRect  = popup.getBoundingClientRect() ;

    let top  = 0 ;
    let left = 0 ;

    switch( placement ) {
      case "top-start":
        top  = ( anchorRect.top - popupRect.height - offset ) ;
        left = anchorRect.left ;
        break ;
      case "top-end":
        top  = ( anchorRect.top - popupRect.height - offset ) ;
        left = ( anchorRect.right - popupRect.width ) ;
        break ;
      case "bottom-start":
        top  = ( anchorRect.bottom + offset ) ;
        left = anchorRect.left ;
        break ;
      case "bottom-end":
        top  = ( anchorRect.bottom + offset ) ;
        left = ( anchorRect.right - popupRect.width ) ;
        break ;
    }

    // Evitar que se salga de la pantalla horizontalmente
    const margin = 8 ;
    if( left < margin ) { left = margin ; }
    if( (left + popupRect.width) > (window.innerWidth - margin) ) {
      left = ( window.innerWidth - popupRect.width - margin ) ;
    }
    // Evitar que se salga verticalmente
    if( top < margin ) { top = ( anchorRect.bottom + offset ) ; }
    if( (top + popupRect.height) > (window.innerHeight - margin) ) {
      top = ( anchorRect.top - popupRect.height - offset ) ;
    }

    popup.style.top  = `${top}px` ;
    popup.style.left = `${left}px` ;
  } , [ open , placement , offset , anchor ] ) ;

  // Cerrar al clickear fuera
  useEffect( () => {
    if( !open ) { return ; }
    const handler = ( e: MouseEvent ) => {
      if(
        popupRef.current && !popupRef.current.contains( e.target as Node ) &&
        anchor.current && !anchor.current.contains( e.target as Node )
      ) {
        onClose() ;
      }
    } ;
    const timer = setTimeout( () => document.addEventListener( "mousedown" , handler ) , 0 ) ;
    return( () => {
      clearTimeout( timer ) ;
      document.removeEventListener( "mousedown" , handler ) ;
    } ) ;
  } , [ open , onClose , anchor ] ) ;

  // Cerrar con Escape
  useEffect( () => {
    if( !open ) { return ; }
    const handler = ( e: KeyboardEvent ) => {
      if( e.key === "Escape" ) { onClose() ; }
    } ;
    document.addEventListener( "keydown" , handler ) ;
    return( () => document.removeEventListener( "keydown" , handler ) ) ;
  } , [ open , onClose ] ) ;

  if( !open ) { return( null ) ; }

  return(
    createPortal(
      <div
        ref={popupRef}
        className={ `${styles.popup} ${className ?? ""}` }
        role="dialog"
      >
        {children}
      </div> ,
      document.body
    )
  ) ;
}
