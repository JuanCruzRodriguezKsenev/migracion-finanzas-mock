/**
 * @file CeldaIdentidad.tsx
 * Celda que renderiza el resultado del resolutor de identidad (ícono, color y metadatos).
 */

// Librerías externas
import React from "react" ;

// Feature: Sandbox
import styles from "./LaboratorioMarcas.module.css" ;

export interface IdentidadMarcaLab {
  dominio:    string ;
  icono:      {
    origen:       string ;
    dataUri?:     string ;
    url?:         string ;
    ancho?:       number ;
    alto?:        number ;
    origenAncho?: number ;
    origenAlto?:  number ;
    fuenteUrl?:      string ;
    bajaResolucion?: boolean ;
  } | null ;
  color:      string | null ;
  intentos:   { fuente: string ; ok: boolean ; motivo?: string }[] ;
  redirigeA?: string ;
}

export interface CeldaIdentidadProps {
  identidad?: IdentidadMarcaLab | null ;
}

/**
 * Celda que muestra el resultado de identidad: ícono, muestra de color, hex y fuente.
 */
export function CeldaIdentidad( { identidad }: CeldaIdentidadProps ) {
  if( !identidad ) {
    return(
      <div className={styles.resolverCellContent}>
        <span>✗</span>
        <span className={styles.resolverOrigin}>—</span>
      </div>
    ) ;
  }

  const partesTitle: string[] = [] ;
  if( identidad.intentos && (identidad.intentos.length > 0) ) {
    partesTitle.push(
      identidad.intentos.map( ( it ) => `${it.fuente}: ${it.ok ? "ok" : "falló"}${it.motivo ? ` (${it.motivo})` : ""}` ).join( "\n" )
    ) ;
  }
  if( identidad.icono?.origenAncho && identidad.icono?.origenAlto ) {
    partesTitle.push( `${identidad.icono.origenAncho}×${identidad.icono.origenAlto}` ) ;
  }
  if( identidad.icono?.fuenteUrl ) {
    partesTitle.push( identidad.icono.fuenteUrl ) ;
  }
  if( identidad.redirigeA ) {
    partesTitle.push( `→ ${identidad.redirigeA}` ) ;
  }
  const titleText = partesTitle.join( "\n" ) ;

  const imgSrc = identidad.icono?.dataUri || identidad.icono?.url ;

  return(
    <div className={styles.resolverCellContent} title={titleText}>
      {imgSrc ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={imgSrc}
          alt={identidad.icono?.origen || "resolutor"}
          className={styles.matrixCellThumb}
        />
      ) : (
        <span>✗</span>
      )}
      {identidad.color && (
        <span
          className={styles.colorSwatch}
          style={{ backgroundColor: identidad.color }}
        />
      )}
      {identidad.color && (
        <span className={styles.colorHex}>{identidad.color}</span>
      )}
      <span className={styles.resolverOrigin}>
        {identidad.icono?.origen || "—"}
      </span>
      {identidad.icono?.bajaResolucion && (
        <span className={styles.bajaResolucionBadge}>
          baja resolución
        </span>
      )}
    </div>
  ) ;
}
