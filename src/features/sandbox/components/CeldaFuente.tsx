/**
 * @file CeldaFuente.tsx
 * Casilla de una fuente en la matriz de la batería por dominio, con miniatura, métricas y veredicto.
 */

// Librerías externas
import React , { useState } from "react" ;

// Feature: Sandbox
import type { ResultadoIcono }    from "../services/marcas/tipos" ;
import type { IdentidadMarcaLab } from "./CeldaIdentidad" ;

import { veredictoFuente } from "./bateriaVista" ;
import styles              from "./LaboratorioMarcas.module.css" ;

export interface CeldaFuenteDict {
  brandsUsedIcon:        string ;
  brandsUsedColor:       string ;
  brandsResolverNoColor: string ;
  brandsNotConsulted:    string ;
  brandsSmall?:          string ;
}

export interface CeldaFuenteProps {
  resultado?:     ResultadoIcono ;
  identidad?:     IdentidadMarcaLab | null ;
  fuente:         string ;
  esInformativa?: boolean ;
  dict:           CeldaFuenteDict ;
}

/**
 * Casilla de una fuente individual en la matriz de la batería por dominio.
 */
export function CeldaFuente( {
  resultado ,
  identidad ,
  fuente ,
  esInformativa ,
  dict
}: CeldaFuenteProps ) {
  const [ tamanoReal , setTamanoReal ] = useState<{ w: number ; h: number } | null>( null ) ;

  const veredicto = esInformativa
    ? { tipo: "sin-resolutor" as const }
    : veredictoFuente( fuente , identidad ) ;

  let claseCelda = "" ;
  if( veredicto.tipo === "usada" ) {
    claseCelda = styles.celdaUsada ;
  } else if( veredicto.tipo === "fallo" ) {
    claseCelda = styles.celdaFallo ;
  }

  const titleText = resultado
    ? `${resultado.estrategia}: ${resultado.estado} (${resultado.ms}ms, ${resultado.bytes || 0}B)`
    : "" ;

  const imgSrc = resultado?.dataUri || resultado?.url ;

  return(
    <td className={claseCelda || undefined} title={titleText}>
      {imgSrc ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={imgSrc}
          alt={resultado?.estrategia || fuente}
          className={styles.matrixCellThumb}
          onLoad={( e ) => {
            const el = e.currentTarget ;
            setTamanoReal( { w: el.naturalWidth , h: el.naturalHeight } ) ;
          }}
        />
      ) : resultado ? (
        <span>{resultado.ok ? "✓" : "✗"}</span>
      ) : (
        <span>-</span>
      )}

      {resultado && (
        <div className={styles.celdaMetricas}>
          <span>{resultado.estado} · {resultado.ms} ms · {resultado.bytes || 0} B</span>
          {tamanoReal && (
            <span>{tamanoReal.w}×{tamanoReal.h}</span>
          )}
        </div>
      )}

      {veredicto.tipo === "usada" && (
        <div className={styles.celdaMetricas}>
          <span className={styles.etiquetaUsada}>{dict.brandsUsedIcon}</span>
          {identidad?.color ? (
            <div>
              <span
                className={styles.colorSwatch}
                style={{ backgroundColor: identidad.color }}
              />
              <span className={styles.colorHex}>{identidad.color}</span>
              <span className={styles.candidateDetail}>{dict.brandsUsedColor}</span>
            </div>
          ) : (
            <span className={styles.candidateDetail}>{dict.brandsResolverNoColor}</span>
          )}
          {Boolean( identidad?.icono?.origenAncho && identidad?.icono?.origenAlto ) && (
            <span className={styles.candidateDetail}>
              {identidad?.icono?.origenAncho}×{identidad?.icono?.origenAlto}
            </span>
          )}
          {veredicto.respaldo && (
            <span className={styles.candidateDetail}>respaldo chico</span>
          )}
        </div>
      )}

      {veredicto.tipo === "fallo" && (
        <div className={styles.celdaMetricas}>
          <span className={styles.candidateDetail}>falló: {veredicto.motivo}</span>
        </div>
      )}

      {veredicto.tipo === "no-consultada" && (
        <div className={styles.celdaMetricas}>
          <span className={styles.candidateDetail}>{dict.brandsNotConsulted}</span>
        </div>
      )}
    </td>
  ) ;
}
