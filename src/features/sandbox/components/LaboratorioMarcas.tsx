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
  ResultadoIcono
} from "../services/marcas/tipos" ;
import styles      from "./LaboratorioMarcas.module.css" ;
import { BATERIA } from "./bateria" ;

interface LaboratorioMarcasProps {
  dict: Awaited< ReturnType< typeof getDictionary > > ;
  lang: string ;
}

interface IdentidadMarcaLab {
  dominio:    string ;
  icono:      {
    origen:       string ;
    dataUri?:     string ;
    url?:         string ;
    ancho?:       number ;
    alto?:        number ;
    origenAncho?: number ;
    origenAlto?:  number ;
    fuenteUrl?:   string ;
  } | null ;
  color:      string | null ;
  intentos:   { fuente: string ; ok: boolean ; motivo?: string }[] ;
  redirigeA?: string ;
}

interface FilaBateria {
  nombre:       string ;
  dominio:      string ;
  resultados:   ResultadoIcono[] ;
  identidad?:   IdentidadMarcaLab | null ;
  msIdentidad?: number ;
}

interface CeldaIdentidadProps {
  identidad?: IdentidadMarcaLab | null ;
}

/**
 * Celda que muestra el resultado de identidad: ícono, muestra de color, hex y fuente.
 */
function CeldaIdentidad( { identidad }: CeldaIdentidadProps ) {
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
    </div>
  ) ;
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
  const [ dominioActual , setDominioActual ]                 = useState( "" ) ;
  const [ identidadIndividual , setIdentidadIndividual ]     = useState< IdentidadMarcaLab | null | undefined >( undefined ) ;
  const [ cargandoIdentidad , setCargandoIdentidad ]         = useState( false ) ;

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

  const resolverIdentidadIndividual = async( dominioObjetivo?: string ) => {
    const d = ( dominioObjetivo || dominioActual || dominioManual ).trim() ;
    if( !d ) return ;

    setCargandoIdentidad( true ) ;
    setDominioActual( d ) ;

    try {
      const res = await fetch( `/api/brand/identidad?domain=${encodeURIComponent( d )}` ) ;
      if( res.ok ) {
        const data = await res.json() ;
        setIdentidadIndividual( data ) ;
      } else {
        setIdentidadIndividual( null ) ;
      }
    } catch {
      setIdentidadIndividual( null ) ;
    } finally {
      setCargandoIdentidad( false ) ;
    }
  } ;

  const ejecutarBateria = async() => {
    setCorriendoBateria( true ) ;
    cancelacionBateriaRef.current = false ;
    setMatrizBateria( [] ) ;

    for( let i = 0 ; i < BATERIA.length ; i++ ) {
      if( cancelacionBateriaRef.current ) break ;
      const marca = BATERIA[i] ;
      setProgresoBateria( `${i + 1}/${BATERIA.length}: ${marca.nombre}` ) ;

      try {
        const params = new URLSearchParams( {
          fase:    "iconos" ,
          dominio: marca.dominio ,
          nombre:  marca.nombre
        } ) ;

        const resIcons = await fetch( `/api/sandbox/marcas?${params.toString()}` ) ;
        if( resIcons.status === 404 ) {
          const body = await resIcons.json().catch( () => ( {} ) ) ;
          if( body.error === "disabled" ) {
            setDisabledServer( true ) ;
            break ;
          }
        }

        const dataIcons = resIcons.ok ? await resIcons.json() : { resultados: [] } ;
        const resultadosIconos: ResultadoIcono[] = dataIcons.resultados || [] ;

        let identidadRes: IdentidadMarcaLab | null = null ;
        let msIdentidad: number | undefined ;

        try {
          const tInicio = performance.now() ;
          const resId = await fetch( `/api/brand/identidad?domain=${encodeURIComponent( marca.dominio )}` ) ;
          msIdentidad = Math.round( performance.now() - tInicio ) ;
          if( resId.ok ) {
            identidadRes = await resId.json() ;
          } else {
            identidadRes = null ;
          }
        } catch {
          identidadRes = null ;
        }

        setMatrizBateria( ( prev ) => [
          ...prev ,
          {
            nombre:      marca.nombre ,
            dominio:     marca.dominio ,
            resultados:  resultadosIconos ,
            identidad:   identidadRes ,
            msIdentidad: msIdentidad
          }
        ] ) ;
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

  const limpiarIdentidadParaCopia = ( id?: IdentidadMarcaLab | null ) => {
    if( !id ) return( id ) ;
    const copia = { ...id } ;
    if( copia.icono ) {
      const copiaIcono = { ...copia.icono } ;
      delete copiaIcono.dataUri ;
      copia.icono = copiaIcono ;
    }
    return( copia ) ;
  } ;

  const copiarResultados = async() => {
    // Generar JSON limpio sin dataUri para no exceder portapapeles
    const payload = {
      busquedaActual: {
        query ,
        dominioActual ,
        dominios:  resultadosDominios ,
        iconos:    resultadosIconos.map( ( r ) => {
          const copia = { ...r } ;
          delete copia.dataUri ;
          return( copia ) ;
        } ) ,
        identidad: limpiarIdentidadParaCopia( identidadIndividual )
      } ,
      bateria: matrizBateria.map( ( f ) => ( {
        nombre:      f.nombre ,
        dominio:     f.dominio ,
        identidad:   limpiarIdentidadParaCopia( f.identidad ) ,
        msIdentidad: f.msIdentidad ,
        resultados:  f.resultados.map( ( r ) => {
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
              <button
                type="button"
                className={styles.buttonSecondary}
                disabled={cargandoIdentidad || !(dominioManual.trim() || dominioActual)}
                onClick={ () => resolverIdentidadIndividual( dominioManual.trim() || dominioActual ) }
              >
                {sandboxDict.brandsResolverRun}
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

        {identidadIndividual !== undefined && (
          <div className={styles.individualResolverRow}>
            <strong>{sandboxDict.brandsResolverCol}:</strong>
            <CeldaIdentidad identidad={identidadIndividual} />
          </div>
        )}

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
                  <th>{sandboxDict.brandsResolverCol}</th>
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

                  const titleIntentos = fila.identidad?.intentos
                    ? fila.identidad.intentos.map( ( it ) => `${it.fuente}: ${it.ok ? "ok" : "falló"}${it.motivo ? ` (${it.motivo})` : ""}` ).join( "\n" )
                    : "" ;

                  return(
                    <tr key={fIdx}>
                      <td>
                        <strong>{fila.nombre}</strong>
                        <br />
                        <span className={styles.candidateDetail}>{fila.dominio}</span>
                      </td>
                      <td className={styles.resolverCell} title={titleIntentos}>
                        <CeldaIdentidad identidad={fila.identidad} />
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

          {/* Resumen del resolutor */}
          {(() => {
            let cantSitio = 0 ;
            let cantGoogle = 0 ;
            let cantBrandfetch = 0 ;
            let cantSinIcono = 0 ;
            let cantConColor = 0 ;

            for( const f of matrizBateria ) {
              const origen = f.identidad?.icono?.origen ;
              if( origen === "sitio" ) {
                cantSitio++ ;
              } else if( origen === "google-s2" ) {
                cantGoogle++ ;
              } else if( origen === "brandfetch-cdn" ) {
                cantBrandfetch++ ;
              } else {
                cantSinIcono++ ;
              }

              if( f.identidad?.color ) {
                cantConColor++ ;
              }
            }

            const total = matrizBateria.length ;
            const textoResumen = `sitio ${cantSitio} · google-s2 ${cantGoogle} · brandfetch-cdn ${cantBrandfetch} · sin ícono ${cantSinIcono} · con color ${cantConColor}/${total}` ;

            return(
              <div className={styles.resolverSummary}>
                <strong>{sandboxDict.brandsResolverSummary}:</strong>
                <span>{textoResumen}</span>
              </div>
            ) ;
          })()}
        </div>
      )}
    </div>
  ) ;
}
