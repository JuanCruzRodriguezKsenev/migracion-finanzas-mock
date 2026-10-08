/**
 * @file AccountLabel.tsx
 * Etiqueta de una cuenta (RN-15): Privada, Compartida · <organización> o De la organización. En las filas de
 * movimientos suma «Ya no compartida» (RN-13). Es sólo presentación: no tiene estados interactivos.
 */
"use client" ;

// Feature: Accounting
import type { EtiquetaVisible } from "../types" ;
import styles                   from "./AccountLabel.module.css" ;


/** Textos de la etiqueta; `{organizacion}` de `labelShared` se reemplaza por los nombres. */
export interface AccountLabelDict {
  labelPrivate:        string ;
  labelShared:         string ;
  labelOrganization:   string ;
  labelNoLongerShared: string ;
}

interface AccountLabelProps {
  etiqueta:   EtiquetaVisible ;
  dict:       AccountLabelDict ;
  className?: string ;
}

/**
 * Texto plano de una etiqueta, para los lugares que no admiten elementos (las `<option>` de un selector).
 *
 * @param etiqueta - Etiqueta a traducir.
 * @param dict - Textos de la etiqueta.
 * @returns El texto de la etiqueta.
 */
export function textoDeEtiqueta( etiqueta: EtiquetaVisible , dict: AccountLabelDict ): string {
  switch( etiqueta.tipo ) {
    case "privada":
      return( dict.labelPrivate ) ;
    case "compartida":
      return( dict.labelShared.replace( "{organizacion}" , etiqueta.organizaciones.map( ( o ) => o.nombre ).join( ", " ) ) ) ;
    case "yaNoCompartida":
      return( dict.labelNoLongerShared ) ;
    default:
      return( dict.labelOrganization ) ;
  }
}

/** Chip con el color del tipo de etiqueta. */
export function AccountLabel( {etiqueta , dict , className}: AccountLabelProps ) {
  const variante = ( {
    organizacion:   styles.organization ,
    privada:        styles.private ,
    compartida:     styles.shared ,
    yaNoCompartida: styles.noLongerShared ,
  } )[etiqueta.tipo] ;

  return(
    <span className={ `${styles.label} ${variante} ${className ?? ""}` } data-etiqueta={etiqueta.tipo}>
      {textoDeEtiqueta( etiqueta , dict )}
    </span>
  ) ;
}
