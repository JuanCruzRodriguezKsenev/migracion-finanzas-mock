/**
 * @file SubscriptionIcon.tsx
 * Componente ligero para visualizar logotipos de servicios.
 * Resuelve imágenes dinámicamente usando URLs de API directas o el CDN de Brandfetch.
 */
import React from "react" ;
import { getBrandLogoUrl } from "@/shared/services/brand/brandService" ;
import styles              from "./SubscriptionIcon.module.css" ;


interface SubscriptionIconProps {
  logoUrl?:   string ; // Si ya se tiene la URL resuelta del backend
  domain?:    string ; // Si se quiere resolver de forma directa vía CDN en el cliente
  size?:      number ;
  className?: string ;
}

export function SubscriptionIcon( {
  logoUrl ,
  domain ,
  size = 28 ,
  className = ""
}: SubscriptionIconProps ) {
  // Determina la URL final a pintar
  const srcUrl = logoUrl || ( domain ? getBrandLogoUrl( domain ) : "" ) ;

  if( !srcUrl ) {
    return( null ) ;
  }

  return(
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={srcUrl}
      alt="Logo de servicio"
      width={size}
      height={size}
      className={ `${className} ${styles.logoImg}` }
    />
  ) ;
}
