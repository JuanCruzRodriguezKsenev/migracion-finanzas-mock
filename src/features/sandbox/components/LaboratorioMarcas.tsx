/**
 * @file LaboratorioMarcas.tsx
 * Componente cliente del Laboratorio de Marcas para experimentación interactiva.
 */
"use client" ;

// Librerías externas
import React , { useState , useRef } from "react" ;

// Shared
import type { getDictionary } from "@/shared/lib/dictionary" ;
import { EmptyState }         from "@/shared/ui/feedback/EmptyState/EmptyState" ;

// Feature: Sandbox
import type {
  ResultadoDominios ,
  ResultadoIcono ,
  CandidatoDominio
} from "../services/marcas/tipos" ;
import styles      from "./LaboratorioMarcas.module.css" ;
import { BATERIA } from "./bateria" ;

interface LaboratorioMarcasProps {
  dict: Awaited< ReturnType< typeof getDictionary > > ;
  lang: string ;
}

interface FilaBateria {
  nombre:     string ;
  dominio:    string ;
  resultados: ResultadoIcono[] ;
}

/**
 * Selecciona el dominio más votado entre las estrategias de dominio.
 * En caso de empate, prioriza el primero de wikidata y luego brandfetch-search.
 */
function resolverDominioPreferido( resultados: ResultadoDominios[] ): CandidatoDominio | null {
  const conteo: Record< string , number > = {} ;
  const candidatosPorDominio: Record< string , CandidatoDominio > = {} ;

  for( const res of resultados ) {
    for( const cand of res.candidatos ) {
      const d = cand.dominio.toLowerCase() ;
      conteo[d] = ( conteo[d] || 0 ) + 1 ;
      if( !candidatosPorDominio[d] ) {
        candidatosPorDominio[d] = cand ;
      } else {
        // Enriquecer datos con archivoLogo o icono si faltaban
        if( cand.archivoLogo && !candidatosPorDominio[d].archivoLogo ) {
          candidatosPorDominio[d].archivoLogo = cand.archivoLogo ;
        }
        if( cand.iconoBrandfetch && !candidatosPorDominio[d].iconoBrandfetch ) {
          candidatosPorDominio[d].iconoBrandfetch = cand.iconoBrandfetch ;
        }
      }
    }
  }

  const entradas = Object.entries( conteo ) ;
  if( entradas.length === 0 ) return( null ) ;

  entradas.sort( ( a , b ) => b[1] - a[1] ) ;
  const maxVotos = entradas[0][1] ;
  const empatados = entradas.filter( ( e ) => e[1] === maxVotos ).map( ( e ) => e[0] ) ;

  if( empatados.length === 1 ) {
    return( candidatosPorDominio[empatados[0]] ) ;
  }

  // Desempate 1: wikidata
  const wikiRes = resultados.find( ( r ) => r.estrategia === "wikidata" ) ;
  if( wikiRes ) {
    for( const c of wikiRes.candidatos ) {
      if( empatados.includes( c.dominio.toLowerCase() ) ) {
        return( candidatosPorDominio[c.dominio.toLowerCase()] ) ;
      }
    }
  }

  // Desempate 2: brandfetch-search
  const bfRes = resultados.find( ( r ) => r.estrategia === "brandfetch-search" ) ;
  if( bfRes ) {
    for( const c of bfRes.candidatos ) {
      if( empatados.includes( c.dominio.toLowerCase() ) ) {
        return( candidatosPorDominio[c.dominio.toLowerCase()] ) ;
      }
    }
  }

  return( candidatosPorDominio[empatados[0]] ) ;
}

/**
 * Componente principal del Laboratorio de Marcas.
 */
export function LaboratorioMarcas( { dict }: LaboratorioMarcasProps ) {
  const sandboxDict = dict.sandboxPage ;

  const [ query , setQuery ]                         = useState( "" ) ;
  const [ dominioManual , setDominioManual ]         = useState( "" ) ;
  const [ disabledServer , setDisabledServer ]       = useState( false ) ;
  const [ cargandoDominios , setCargandoDominios ]   = useState( false ) ;
  const [ cargandoIconos , setCargandoIconos ]       = useState( false ) ;
  const [ resultadosDominios , setResultadosDom ]   = useState< ResultadoDominios[] >( [] ) ;
  const [ resultadosIconos , setResultadosIconos ]   = useState< ResultadoIcono[] >( [] ) ;
  const [ dominioActual , setDominioActual ]         = useState( "" ) ;

  // Dimensiones leídas de imágenes
  const [ dimensionesImg , setDimensionesImg ]       = useState< Record< string , { w: number ; h: number } > >( {} ) ;
  const [ estadosNavegador , setEstadosNavegador ]   = useState< Record< string , "cargado" | "error" > >( {} ) ;

  // Batería de pruebas
  const [ corriendoBateria , setCorriendoBateria ]   = useState( false ) ;
  const [ matrizBateria , setMatrizBateria ]         = useState< FilaBateria[] >( [] ) ;
  const [ progresoBateria , setProgresoBateria ]     = useState< string >( "" ) ;
  const cancelacionBateriaRef                        = useRef( false ) ;

  if( disabledServer ) {
    return(
      <EmptyState
        title={sandboxDict.tabBrands}
        description={sandboxDict.brandsDisabled}
      />
    ) ;
  }

  const buscarDominios = async( textoConsulta: string ) => {
    const q = textoConsulta.trim() ;
    if( !q ) return ;

    setCargandoDominios( true ) ;
    setResultadosDom( [] ) ;

    try {
      const res = await fetch( `/api/sandbox/marcas?fase=dominios&q=${encodeURIComponent( q )}` ) ;
      if( res.status === 404 ) {
        const body = await res.json().catch( () => ( {} ) ) ;
        if( body.error === "disabled" ) {
          setDisabledServer( true ) ;
          return ;
        }
      }
      if( res.ok ) {
        const data = await res.json() ;
        setResultadosDom( data.resultados || [] ) ;
      }
    } catch {
      // Manejo silencioso en UI de laboratorio
    } finally {
      setCargandoDominios( false ) ;
    }
  } ;

  const probarIconos = async( candidato: { dominio: string ; nombre?: string ; archivoLogo?: string ; iconoBrandfetch?: string } ) => {
    const d = candidato.dominio.trim() ;
    if( !d ) return ;

    setCargandoIconos( true ) ;
    setDominioActual( d ) ;
    setResultadosIconos( [] ) ;
    setDimensionesImg( {} ) ;
    setEstadosNavegador( {} ) ;

    try {
      const params = new URLSearchParams( {
        fase:    "iconos" ,
        dominio: d
      } ) ;
      if( candidato.nombre ) params.set( "nombre" , candidato.nombre ) ;
      if( candidato.archivoLogo ) params.set( "archivoLogo" , candidato.archivoLogo ) ;
      if( candidato.iconoBrandfetch ) params.set( "iconoBf" , candidato.iconoBrandfetch ) ;

      const res = await fetch( `/api/sandbox/marcas?${params.toString()}` ) ;
      if( res.status === 404 ) {
        const body = await res.json().catch( () => ( {} ) ) ;
        if( body.error === "disabled" ) {
          setDisabledServer( true ) ;
          return ;
        }
      }
      if( res.ok ) {
        const data = await res.json() ;
        setResultadosIconos( data.resultados || [] ) ;
      }
    } catch {
      // Error de red
    } finally {
      setCargandoIconos( false ) ;
    }
  } ;

  const ejecutarBateria = async() => {
    setCorriendoBateria( true ) ;
    cancelacionBateriaRef.current = false ;
    setMatrizBateria( [] ) ;

    for( let i = 0 ; i < BATERIA.length ; i++ ) {
      if( cancelacionBateriaRef.current ) break ;
      const nombreMarca = BATERIA[i] ;
      setProgresoBateria( `${i + 1}/${BATERIA.length}: ${nombreMarca}` ) ;

      try {
        const resDom = await fetch( `/api/sandbox/marcas?fase=dominios&q=${encodeURIComponent( nombreMarca )}` ) ;
        if( resDom.status === 404 ) {
          setDisabledServer( true ) ;
          break ;
        }
        if( !resDom.ok ) continue ;
        const dataDom = await resDom.json() ;
        const dominiosRes: ResultadoDominios[] = dataDom.resultados || [] ;
        const mejor = resolverDominioPreferido( dominiosRes ) ;

        if( mejor ) {
          const params = new URLSearchParams( {
            fase:    "iconos" ,
            dominio: mejor.dominio
          } ) ;
          if( mejor.nombre ) params.set( "nombre" , mejor.nombre ) ;
          if( mejor.archivoLogo ) params.set( "archivoLogo" , mejor.archivoLogo ) ;
          if( mejor.iconoBrandfetch ) params.set( "iconoBf" , mejor.iconoBrandfetch ) ;

          const resIcons = await fetch( `/api/sandbox/marcas?${params.toString()}` ) ;
          if( resIcons.ok ) {
            const dataIcons = await resIcons.json() ;
            setMatrizBateria( ( prev ) => [
              ...prev ,
              {
                nombre:     nombreMarca ,
                dominio:    mejor.dominio ,
                resultados: dataIcons.resultados || []
              }
            ] ) ;
          }
        }
      } catch {
        // Continuar siguiente en lote
      }

      if( i < BATERIA.length - 1 ) {
        await new Promise( ( resolve ) => setTimeout( resolve , 1500 ) ) ;
      }
    }

    setCorriendoBateria( false ) ;
    setProgresoBateria( "" ) ;
  } ;

  const cancelarBateria = () => {
    cancelacionBateriaRef.current = true ;
    setCorriendoBateria( false ) ;
    setProgresoBateria( "" ) ;
  } ;

  const copiarResultados = async() => {
    // Generar JSON limpio sin dataUri para no exceder portapapeles
    const payload = {
      busquedaActual: {
        query ,
        dominioActual ,
        dominios: resultadosDominios ,
        iconos:   resultadosIconos.map( ( r ) => {
          const copia = { ...r } ;
          delete copia.dataUri ;
          return( copia ) ;
        } )
      } ,
      bateria: matrizBateria.map( ( f ) => ( {
        nombre:     f.nombre ,
        dominio:    f.dominio ,
        resultados: f.resultados.map( ( r ) => {
          const copia = { ...r } ;
          delete copia.dataUri ;
          return( copia ) ;
        } )
      } ) )
    } ;

    try {
      await navigator.clipboard.writeText( JSON.stringify( payload , null , 2 ) ) ;
      alert( "Resultados copiados al portapapeles." ) ;
    } catch {
      // Ignorar fallo de portapapeles
    }
  } ;

  return(
    <div className={styles.container}>
      {/* Controles de Búsqueda y Batería */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.barActions}>
            <div className={styles.inputGroup}>
              <span className={styles.inputLabel}>{sandboxDict.brandsQueryLabel}:</span>
              <input
                type="text"
                className={styles.input}
                placeholder={sandboxDict.brandsQueryPlaceholder}
                value={query}
                onChange={ ( e ) => setQuery( e.target.value ) }
                onKeyDown={ ( e ) => {
                  if( e.key === "Enter" ) buscarDominios( query ) ;
                } }
              />
              <button
                type="button"
                className={styles.buttonPrimary}
                disabled={cargandoDominios || (query.trim().length < 2)}
                onClick={ () => buscarDominios( query ) }
              >
                {cargandoDominios ? "..." : sandboxDict.brandsSearch}
              </button>
            </div>

            <div className={styles.inputGroup}>
              <span className={styles.inputLabel}>{sandboxDict.brandsDomainInput}:</span>
              <input
                type="text"
                className={styles.input}
                placeholder="ej: bbva.com"
                value={dominioManual}
                onChange={ ( e ) => setDominioManual( e.target.value ) }
                onKeyDown={ ( e ) => {
                  if( e.key === "Enter" ) probarIconos( { dominio: dominioManual } ) ;
                } }
              />
              <button
                type="button"
                className={styles.buttonSecondary}
                disabled={cargandoIconos || !dominioManual.trim()}
                onClick={ () => probarIconos( { dominio: dominioManual } ) }
              >
                {sandboxDict.brandsTryIcons}
              </button>
            </div>
          </div>

          <div className={styles.barActions}>
            {!corriendoBateria ? (
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={ejecutarBateria}
              >
                {sandboxDict.brandsBattery}
              </button>
            ) : (
              <button
                type="button"
                className={styles.buttonDanger}
                onClick={cancelarBateria}
              >
                {sandboxDict.brandsCancel} ({progresoBateria})
              </button>
            )}

            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={copiarResultados}
            >
              {sandboxDict.brandsCopy}
            </button>
          </div>
        </div>
      </div>

      {/* Fase 1: Dominios */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{sandboxDict.brandsDomainsTitle}</h3>
        {resultadosDominios.length > 0 ? (
          <div className={styles.domainsGrid}>
            {resultadosDominios.map( ( res ) => (
              <div key={res.estrategia} className={styles.strategyCard}>
                <div className={styles.strategyCardHeader}>
                  <span className={styles.strategyName}>{res.estrategia}</span>
                  <span className={styles.strategyMeta}>
                    {res.estado} · {res.ms} ms
                  </span>
                </div>
                {res.candidatos.length > 0 ? (
                  <ul className={styles.candidatesList}>
                    {res.candidatos.map( ( cand , idx ) => (
                      <li key={idx} className={styles.candidateItem}>
                        <div className={styles.candidateHeader}>
                          <span className={styles.candidateDomain}>{cand.dominio}</span>
                          {cand.resuelve !== undefined && (
                            <span className={styles.strategyMeta}>
                              {cand.resuelve ? "✓ resuelve" : "✗ no resuelve"}
                            </span>
                          )}
                        </div>
                        {cand.detalle && (
                          <span className={styles.candidateDetail}>{cand.detalle}</span>
                        )}
                        <div className={styles.candidateActions}>
                          <button
                            type="button"
                            className={styles.candidateButton}
                            onClick={ () => probarIconos( cand ) }
                          >
                            {sandboxDict.brandsTryIcons}
                          </button>
                        </div>
                      </li>
                    ) )}
                  </ul>
                ) : (
                  <span className={styles.candidateDetail}>{sandboxDict.brandsNoResults}</span>
                )}
              </div>
            ) )}
          </div>
        ) : (
          <div className={styles.emptyText}>{sandboxDict.brandsNoResults}</div>
        )}
      </div>

      {/* Fase 2: Íconos */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            {sandboxDict.brandsIconsTitle} {dominioActual ? `(${dominioActual})` : ""}
          </h3>
        </div>

        {resultadosIconos.length > 0 ? (
          <div className={styles.iconsGrid}>
            {resultadosIconos.map( ( icono ) => {
              const src = icono.dataUri || icono.url ;
              const dim = dimensionesImg[icono.estrategia] ;
              const esChico = dim && (Math.max( dim.w , dim.h ) < 64) ;
              const estadoNav = estadosNavegador[icono.estrategia] ;

              return(
                <div key={icono.estrategia} className={styles.iconTile}>
                  <div className={styles.tileHeader}>
                    <span className={styles.tileStrategyName}>{icono.estrategia}</span>
                    {esChico && (
                      <span className={styles.badgeSmall}>{sandboxDict.brandsSmall}</span>
                    )}
                  </div>

                  <div className={styles.iconPreviewBox}>
                    {src ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={src}
                        alt={icono.estrategia}
                        className={styles.iconImage}
                        onLoad={ ( e ) => {
                          const img = e.currentTarget ;
                          setDimensionesImg( ( prev ) => ( {
                            ...prev ,
                            [icono.estrategia]: {
                              w: img.naturalWidth ,
                              h: img.naturalHeight
                            }
                          } ) ) ;
                          if( icono.modo === "navegador" ) {
                            setEstadosNavegador( ( prev ) => ( {
                              ...prev ,
                              [icono.estrategia]: "cargado"
                            } ) ) ;
                          }
                        } }
                        onError={ () => {
                          if( icono.modo === "navegador" ) {
                            setEstadosNavegador( ( prev ) => ( {
                              ...prev ,
                              [icono.estrategia]: "error"
                            } ) ) ;
                          }
                        } }
                      />
                    ) : (
                      <span className={styles.candidateDetail}>-</span>
                    )}
                  </div>

                  <div className={styles.tileMetrics}>
                    <div className={styles.tileMetricRow}>
                      <span>Estado:</span>
                      <span>
                        {icono.modo === "navegador"
                          ? (estadoNav === "cargado"
                            ? sandboxDict.brandsLoaded
                            : estadoNav === "error"
                              ? sandboxDict.brandsNotLoaded
                              : icono.estado)
                          : icono.estado}
                      </span>
                    </div>
                    {icono.ms > 0 && (
                      <div className={styles.tileMetricRow}>
                        <span>Tiempo:</span>
                        <span>{icono.ms} ms</span>
                      </div>
                    )}
                    {icono.bytes !== undefined && (
                      <div className={styles.tileMetricRow}>
                        <span>Tamaño:</span>
                        <span>{icono.bytes} B</span>
                      </div>
                    )}
                    {dim && (
                      <div className={styles.tileMetricRow}>
                        <span>Dimensión:</span>
                        <span>{dim.w} × {dim.h}</span>
                      </div>
                    )}
                    {icono.origen && (
                      <div className={styles.tileMetricRow}>
                        <span>Origen:</span>
                        <span>{icono.origen}</span>
                      </div>
                    )}
                    {icono.color && (
                      <div className={styles.tileMetricRow}>
                        <span>Color:</span>
                        <div className={styles.colorSwatchWrapper}>
                          <span
                            className={styles.colorSwatch}
                            style={{ backgroundColor: icono.color }}
                          />
                          <span>{icono.color}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {icono.hallados && (icono.hallados.length > 0) && (
                    <details className={styles.tileDetails}>
                      <summary>Declarados ({icono.hallados.length})</summary>
                      <div className={styles.tileDetailsList}>
                        {icono.hallados.map( ( h , hIdx ) => (
                          <span key={hIdx} className={styles.tileDetailsItem}>
                            • {h.origen}: {h.tamano ? `${h.tamano}px ` : ""}{h.url}
                          </span>
                        ) )}
                      </div>
                    </details>
                  )}
                </div>
              ) ;
            } )}
          </div>
        ) : (
          <div className={styles.emptyText}>{sandboxDict.brandsNoResults}</div>
        )}
      </div>

      {/* Matriz de Batería */}
      {matrizBateria.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Matriz de Batería ({matrizBateria.length} marcas evaluadas)
          </h3>
          <div className={styles.matrixWrapper}>
            <table className={styles.matrixTable}>
              <thead>
                <tr>
                  <th>Marca / Dominio</th>
                  <th>Sitio</th>
                  <th>Wikidata</th>
                  <th>Google S2</th>
                  <th>DDG Icons</th>
                  <th>Icon Horse</th>
                  <th>Brandfetch CDN</th>
                  <th>Brandfetch Search</th>
                </tr>
              </thead>
              <tbody>
                {matrizBateria.map( ( fila , fIdx ) => {
                  const mapa = Object.fromEntries(
                    fila.resultados.map( ( r ) => [r.estrategia , r] )
                  ) ;
                  const estrategiasOrdenadas = [
                    "sitio" ,
                    "wikidata-logo" ,
                    "google-s2" ,
                    "ddg-icons" ,
                    "icon-horse" ,
                    "brandfetch-cdn" ,
                    "brandfetch-search-icon"
                  ] ;

                  return(
                    <tr key={fIdx}>
                      <td>
                        <strong>{fila.nombre}</strong>
                        <br />
                        <span className={styles.candidateDetail}>{fila.dominio}</span>
                      </td>
                      {estrategiasOrdenadas.map( ( est ) => {
                        const item = mapa[est] ;
                        if( !item ) return( <td key={est}>-</td> ) ;

                        const titleText = `${item.estrategia}: ${item.estado} (${item.ms}ms, ${item.bytes || 0}B)` ;
                        const imgSrc = item.dataUri || item.url ;

                        return(
                          <td key={est} title={titleText}>
                            {imgSrc ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={imgSrc}
                                alt={item.estrategia}
                                className={styles.matrixCellThumb}
                              />
                            ) : (
                              <span>{item.ok ? "✓" : "✗"}</span>
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
        </div>
      )}
    </div>
  ) ;
}
