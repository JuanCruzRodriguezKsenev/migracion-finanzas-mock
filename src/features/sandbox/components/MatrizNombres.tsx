/**
 * @file MatrizNombres.tsx
 * Tabla de resultados de la batería «nombre → ícono» con evaluación por estrategia y resumen de aciertos.
 */

// Librerías externas
import React from "react" ;

// Feature: Sandbox
import type { FilaBateriaNombres } from "./bateriaVista" ;

import { resumenNombres } from "./bateriaVista" ;
import styles             from "./LaboratorioMarcas.module.css" ;

export interface MatrizNombresDict {
  brandsBatteryNameTitle: string ;
  brandsHitsSummary:      string ;
  brandsNoOrder:          string ;
  brandsNoResults:        string ;
  brandsPartial:          string ;
}

export interface MatrizNombresProps {
  filas: FilaBateriaNombres[] ;
  dict:  MatrizNombresDict ;
}

/**
 * Matriz visual para la batería de nombre a ícono.
 */
export function MatrizNombres( { filas , dict }: MatrizNombresProps ) {
  if( filas.length === 0 ) {
    return( null ) ;
  }

  const resumen = resumenNombres( filas ) ;
  const estrategias = [ "wikidata" , "candidatos" , "verificados" ] as const ;

  const partesResumen = estrategias.map( ( est ) => {
    const m = resumen.estrategias[est] ;
    if( !m ) {
      return( `${est} 1.º 0/${resumen.total} · top3 0/${resumen.total} · ícono 0/${resumen.total} · color 0/${resumen.total}` ) ;
    }
    return( `${est} 1.º ${m.enPrimero}/${resumen.total} · top3 ${m.enTop3}/${resumen.total} · ícono ${m.conIcono}/${resumen.total} · color ${m.conColor}/${resumen.total}` ) ;
  } ) ;

  const textoResumen = `${partesResumen.join( " — " )} — alguna acierta ${resumen.alMenosUna}/${resumen.total} · ninguna: ${resumen.ningunaAcierta}` ;

  return(
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {dict.brandsBatteryNameTitle} ({filas.length} consultas)
      </h3>
      <div className={styles.matrixWrapper}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th>Consulta / Esperados</th>
              {estrategias.map( ( est ) => (
                <th key={est}>
                  {est}
                  <span className={styles.encabezadoInformativo}>
                    {dict.brandsNoOrder}
                  </span>
                </th>
              ) )}
            </tr>
          </thead>
          <tbody>
            {filas.map( ( fila , fIdx ) => {
              const mapaEstrategias = Object.fromEntries(
                fila.estrategias.map( ( e ) => [ e.estrategia , e ] )
              ) ;

              return(
                <tr key={fIdx}>
                  <td>
                    <strong>{fila.consulta}</strong>
                    {fila.parcial && (
                      <span className={styles.candidateDetail}>
                        {" "}({dict.brandsPartial})
                      </span>
                    )}
                    <br />
                    <span className={styles.candidateDetail}>
                      {fila.esperados.join( ", " )}
                    </span>
                  </td>
                  {estrategias.map( ( est ) => {
                    const col = mapaEstrategias[est] ;
                    if( !col ) {
                      return( <td key={est}>-</td> ) ;
                    }

                    if( !col.ok ) {
                      return(
                        <td key={est} className={styles.celdaFallo}>
                          <div className={styles.celdaMetricas}>
                            <span>✗ {col.estado}</span>
                            <span>{col.ms} ms</span>
                          </div>
                        </td>
                      ) ;
                    }

                    if( !col.candidatos || (col.candidatos.length === 0) ) {
                      return(
                        <td key={est} className={styles.celdaVacia}>
                          <span className={styles.celdaVacia}>
                            {dict.brandsNoResults}
                          </span>
                        </td>
                      ) ;
                    }

                    const primero = col.primero ;
                    const esAciertoPrimero = primero.posicionEsperado === 0 ;
                    const claseCelda = esAciertoPrimero
                      ? styles.celdaUsada
                      : styles.celdaFallo ;

                    const imgSrc = primero.identidad?.icono?.dataUri || primero.identidad?.icono?.url ;
                    const siguientes = col.candidatos.slice( 1 , 3 ) ;

                    return(
                      <td key={est} className={claseCelda}>
                        <div>
                          <strong>{primero.dominio}</strong>
                          {esAciertoPrimero ? (
                            <span> ✓</span>
                          ) : (
                            <span>
                              {" "}✗
                              {primero.posicionEsperado > 0 && ` esperado en #${primero.posicionEsperado + 1}`}
                            </span>
                          )}
                        </div>

                        {imgSrc && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={imgSrc}
                            alt={primero.dominio || est}
                            className={styles.matrixCellThumb}
                          />
                        )}

                        {primero.identidad?.color && (
                          <div>
                            <span
                              className={styles.colorSwatch}
                              style={{ backgroundColor: primero.identidad.color }}
                            />
                            <span className={styles.colorHex}>
                              {primero.identidad.color}
                            </span>
                          </div>
                        )}

                        {primero.identidad?.icono?.origen && (
                          <div className={styles.resolverOrigin}>
                            {primero.identidad.icono.origen}
                          </div>
                        )}

                        <div className={styles.celdaMetricas}>
                          <span>
                            {col.ms} ms
                            {primero.msIdentidad !== undefined ? ` · id: ${primero.msIdentidad} ms` : ""}
                          </span>
                        </div>

                        {siguientes.length > 0 && (
                          <div className={styles.siguientesCandidatos}>
                            {siguientes.map( ( c , cIdx ) => (
                              <span key={cIdx}>
                                #{cIdx + 2} {c.dominio}
                                {c.resuelve !== undefined && (c.resuelve ? " ✓" : " ✗")}
                                {c.coincide !== undefined && c.titulo && ` ≈ ${c.titulo}`}
                              </span>
                            ) )}
                          </div>
                        )}
                      </td>
                    ) ;
                  } )}
                </tr>
              ) ;
            } )}
          </tbody>
        </table>
      </div>

      <div className={styles.resolverSummary}>
        <strong>{dict.brandsHitsSummary}:</strong>
        <span>{textoResumen}</span>
      </div>
    </div>
  ) ;
}
