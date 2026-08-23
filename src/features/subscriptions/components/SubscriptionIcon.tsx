/**
 * @file SubscriptionIcon.tsx
 * Ícono de una suscripción: renderiza logos remotos de marca (con soporte de
 * variantes por tema claro/oscuro separadas por "|") o íconos SVG del sistema
 * como fallback cuando el logoKey no es una URL o la carga remota falla.
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;

// Feature: Subscriptions
import { getLogoConfig } from "../utils/logoMap" ;
import styles            from "./SubscriptionIcon.module.css" ;


interface SubscriptionIconProps {
  logoKey:    string ;
  size?:      number ;
  className?: string ;
}

/**
 * Ícono adaptativo de suscripción con fallback en cascada: logo remoto → SVG del sistema.
 */
export function SubscriptionIcon( { logoKey , size = 28 , className = "" }: SubscriptionIconProps ) {
  const [ hasError , setHasError ] = useState( false ) ;

  // Resetear el estado de error cuando cambia la key (ajuste de estado en render,
  // patrón oficial de React para "reset ante cambio de prop" sin ciclo extra de efecto)
  const [ prevLogoKey , setPrevLogoKey ] = useState( logoKey ) ;
  if( logoKey !== prevLogoKey ){
    setPrevLogoKey( logoKey ) ;
    setHasError( false ) ;
  }

  const isRemote = ( logoKey.startsWith( "http://" ) || logoKey.startsWith( "https://" ) ) ;

  if( isRemote && !hasError ){
    // Par de logos por tema: "urlClaro|urlOscuro"
    if( logoKey.includes( "|" ) ){
      const [ lightSrc , darkSrc ] = logoKey.split( "|" ) ;

      return(
        <div
          className={ `${styles.logoThemeWrapper} ${className}` }
          style={ { "--logo-size": `${size}px` } as React.CSSProperties }
        >
          <img
            src={lightSrc}
            alt="Logo del servicio (tema claro)"
            className={ `${styles.logoImg} ${styles.logoImgLight}` }
            onError={ () => setHasError( true ) }
          />
          <img
            src={darkSrc}
            alt="Logo del servicio (tema oscuro)"
            className={ `${styles.logoImg} ${styles.logoImgDark}` }
            onError={ () => setHasError( true ) }
          />
        </div>
      ) ;
    }

    return(
      <img
        src={logoKey}
        alt="Logo del servicio"
        width={size}
        height={size}
        className={ `${className} ${styles.logoImg}` }
        onError={ () => setHasError( true ) }
      />
    ) ;
  }

  // Fallback a SVG del sistema ('default' si falló la carga remota)
  const config = getLogoConfig( hasError ? "default" : logoKey ) ;

  return(
    <svg
      width={size}
      height={size}
      viewBox={ config.viewBox ?? "0 0 24 24" }
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      dangerouslySetInnerHTML={ { __html: config.svg } }
    />
  ) ;
}
