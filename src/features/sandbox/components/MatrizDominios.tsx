/**
 * @file MatrizDominios.tsx
 * Tabla de resultados de la batería «dominio → ícono» con fuentes evaluadas y resumen del resolutor.
 */

// Librerías externas
import React from "react" ;

// Feature: Sandbox
import type { ResultadoIcono }    from "../services/marcas/tipos" ;
import type { IdentidadMarcaLab } from "./CeldaIdentidad" ;

import { CeldaIdentidad } from "./CeldaIdentidad" ;
import { CeldaFuente }    from "./CeldaFuente" ;
import styles             from "./LaboratorioMarcas.module.css" ;

export interface FilaBateriaDominios {
  nombre:       string ;
  dominio:      string ;
  resultados:   ResultadoIcono[] ;
  identidad?:   IdentidadMarcaLab | null ;
  msIdentidad?: number ;
}

export interface MatrizDominiosDict {
  brandsBatteryDomainTitle: string ;
  brandsResolverSummary:    string ;
  brandsResolverNoColor:    string ;
  brandsNotConsulted:       string ;
  brandsInformative:        string ;
  brandsResolverCol:        string ;
  brandsUsedColor:          string ;
  brandsUsedIcon:           string ;
  brandsSmall?:             string ;
}

export interface MatrizDominiosProps {
  filas: FilaBateriaDominios[] ;
  dict:  MatrizDominiosDict ;
}

/**
 * Matriz visual para la batería de dominio a ícono.
 */
export function MatrizDominios( { filas , dict }: MatrizDominiosProps ) {
  if( filas.length === 0 ) {
    return( null ) ;
  }

  let cantSitio = 0 ;
  let cantGoogle = 0 ;
  let cantSinIcono = 0 ;
  let cantConColor = 0 ;

  for( const f of filas ) {
    const origen = f.identidad?.icono?.origen ;
    if( origen === "sitio" ) {
      cantSitio++ ;
    } else if( origen === "google-s2" ) {
      cantGoogle++ ;
    } else {
      cantSinIcono++ ;
    }

    if( f.identidad?.color ) {
      cantConColor++ ;
    }
  }

  const total = filas.length ;
  const textoResumen = `sitio ${cantSitio} · google-s2 ${cantGoogle} · sin ícono ${cantSinIcono} · con color ${cantConColor}/${total}` ;

  return(
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {dict.brandsBatteryDomainTitle} ({filas.length} marcas evaluadas)
      </h3>
      <div className={styles.matrixWrapper}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th>Marca / Dominio</th>
              <th>{dict.brandsResolverCol}</th>
              <th>1 · Sitio</th>
              <th>2 · Google S2</th>
              <th>
                DDG Icons
                <span className={styles.encabezadoInformativo}>
                  {dict.brandsInformative}
                </span>
              </th>
              <th>
                Icon Horse
                <span className={styles.encabezadoInformativo}>
                  {dict.brandsInformative}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map( ( fila , fIdx ) => {
              const mapa = Object.fromEntries(
                fila.resultados.map( ( r ) => [ r.estrategia , r ] )
              ) ;

              const titleIntentos = fila.identidad?.intentos
                ? fila.identidad.intentos.map( ( it ) => `${it.fuente}: ${it.ok ? "ok" : "falló"}${it.motivo ? ` (${it.motivo})` : ""}` ).join( "\n" )
                : "" ;

              return(
                <tr key={fIdx}>
                  <td>
                    <strong>{fila.nombre}</strong>
                    <br />
                    <span className={styles.candidateDetail}>
                      {fila.dominio}
                      {fila.identidad?.redirigeA && ` → ${fila.identidad.redirigeA}`}
                    </span>
                  </td>
                  <td className={styles.resolverCell} title={titleIntentos}>
                    <CeldaIdentidad identidad={fila.identidad} />
                  </td>
                  <CeldaFuente
                    fuente="sitio"
                    resultado={mapa["sitio"]}
                    identidad={fila.identidad}
                    dict={dict}
                  />
                  <CeldaFuente
                    fuente="google-s2"
                    resultado={mapa["google-s2"]}
                    identidad={fila.identidad}
                    dict={dict}
                  />
                  <CeldaFuente
                    fuente="ddg-icons"
                    resultado={mapa["ddg-icons"]}
                    identidad={fila.identidad}
                    esInformativa
                    dict={dict}
                  />
                  <CeldaFuente
                    fuente="icon-horse"
                    resultado={mapa["icon-horse"]}
                    identidad={fila.identidad}
                    esInformativa
                    dict={dict}
                  />
                </tr>
              ) ;
            } )}
          </tbody>
        </table>
      </div>

      <div className={styles.resolverSummary}>
        <strong>{dict.brandsResolverSummary}:</strong>
        <span>{textoResumen}</span>
      </div>
    </div>
  ) ;
}
