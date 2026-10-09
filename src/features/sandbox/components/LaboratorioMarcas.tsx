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
  IdEstrategiaDominio
} from "../services/marcas/tipos" ;
import type { FilaBateriaDominios } from "./MatrizDominios" ;
import type { FilaBateriaNombres }  from "./bateriaVista" ;
import type { IdentidadMarcaLab }   from "./CeldaIdentidad" ;

import {
  primerCandidato ,
  posicionEsperado ,
  columnaDeOrigen
} from "./bateriaVista" ;
import { CeldaIdentidad } from "./CeldaIdentidad" ;
import { MatrizDominios } from "./MatrizDominios" ;
import { MatrizNombres }  from "./MatrizNombres" ;
import { CONSULTAS }      from "./consultas" ;
import { BATERIA }        from "./bateria" ;
import styles             from "./LaboratorioMarcas.module.css" ;

export interface LaboratorioMarcasProps {
  dict: Awaited< ReturnType< typeof getDictionary > > ;
  lang: string ;
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
  const [ resultadosDominios , setResultadosDom ]    = useState< ResultadoDominios[] >( [] ) ;
  const [ resultadosIconos , setResultadosIconos ]   = useState< ResultadoIcono[] >( [] ) ;
  const [ dominioActual , setDominioActual ]         = useState( "" ) ;
  const [ identidadIndividual , setIdentidadIndividual ] = useState< IdentidadMarcaLab | null | undefined >( undefined ) ;
  const [ cargandoIdentidad , setCargandoIdentidad ] = useState( false ) ;

  // Dimensiones leídas de imágenes
  const [ dimensionesImg , setDimensionesImg ]       = useState< Record< string , { w: number ; h: number } > >( {} ) ;
  const [ estadosNavegador , setEstadosNavegador ]   = useState< Record< string , "cargado" | "error" > >( {} ) ;

  // Batería «dominio → ícono»
  const [ corriendoBateria , setCorriendoBateria ]   = useState( false ) ;
  const [ matrizBateria , setMatrizBateria ]         = useState< FilaBateriaDominios[] >( [] ) ;
  const [ progresoBateria , setProgresoBateria ]     = useState< string >( "" ) ;
  const cancelacionBateriaRef                        = useRef( false ) ;

  // Batería «nombre → ícono»
  const [ corriendoNombres , setCorriendoNombres ]   = useState( false ) ;
  const [ matrizNombres , setMatrizNombres ]         = useState< FilaBateriaNombres[] >( [] ) ;
  const [ progresoNombres , setProgresoNombres ]     = useState< string >( "" ) ;
  const cancelacionNombresRef                        = useRef( false ) ;

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

  const probarIconos = async( candidato: { dominio: string ; nombre?: string ; archivoLogo?: string } ) => {
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

  const ejecutarBateriaNombres = async() => {
    setCorriendoNombres( true ) ;
    cancelacionNombresRef.current = false ;
    setMatrizNombres( [] ) ;
    const cacheIdentidad = new Map< string , IdentidadMarcaLab | null >() ;

    for( let i = 0 ; i < CONSULTAS.length ; i++ ) {
      if( cancelacionNombresRef.current ) break ;
      const c = CONSULTAS[i] ;
      setProgresoNombres( `${i + 1}/${CONSULTAS.length}: ${c.consulta}` ) ;

      let resultadosDom: ResultadoDominios[] = [] ;
      try {
        const res = await fetch( `/api/sandbox/marcas?fase=dominios&q=${encodeURIComponent( c.consulta )}` ) ;
        if( res.status === 404 ) {
          const body = await res.json().catch( () => ( {} ) ) ;
          if( body.error === "disabled" ) {
            setDisabledServer( true ) ;
            break ;
          }
        }
        if( res.ok ) {
          const data = await res.json() ;
          resultadosDom = data.resultados || [] ;
        }
      } catch {
        resultadosDom = [] ;
      }

      const estrategiasFila: FilaBateriaNombres["estrategias"] = [] ;
      const ordenEstrategias: IdEstrategiaDominio[] = [ "wikidata" , "candidatos" , "verificados" ] ;

      for( const est of ordenEstrategias ) {
        const r = resultadosDom.find( ( item ) => item.estrategia === est ) ;
        if( !r ) {
          estrategiasFila.push( {
            estrategia: est ,
            ok:         false ,
            estado:     "sin-respuesta" ,
            ms:         0 ,
            candidatos: [] ,
            primero: {
              dominio:          null ,
              esperado:         false ,
              posicionEsperado: -1
            }
          } ) ;
          continue ;
        }

        const primerDom = primerCandidato( est , r.candidatos ) ;
        const pos = posicionEsperado( r.candidatos , c.esperados ) ;
        const esEsperado = (pos === 0) ;

        let identidadRes: IdentidadMarcaLab | null = null ;
        let msId: number | undefined ;

        if( primerDom ) {
          if( cacheIdentidad.has( primerDom ) ) {
            identidadRes = cacheIdentidad.get( primerDom ) || null ;
          } else {
            try {
              const t0 = performance.now() ;
              const resId = await fetch( `/api/brand/identidad?domain=${encodeURIComponent( primerDom )}` ) ;
              msId = Math.round( performance.now() - t0 ) ;
              if( resId.ok ) {
                identidadRes = await resId.json() ;
              } else {
                identidadRes = null ;
              }
            } catch {
              identidadRes = null ;
            }
            cacheIdentidad.set( primerDom , identidadRes ) ;
          }
        }

        estrategiasFila.push( {
          estrategia: est ,
          ok:         r.ok ,
          estado:     r.estado ,
          ms:         r.ms ,
          candidatos: r.candidatos ,
          primero: {
            dominio:          primerDom ,
            esperado:         esEsperado ,
            posicionEsperado: pos ,
            identidad:        identidadRes ,
            msIdentidad:      msId
          }
        } ) ;
      }

      const nuevaFila: FilaBateriaNombres = {
        consulta:    c.consulta ,
        esperados:   c.esperados ,
        parcial:     c.parcial ,
        estrategias: estrategiasFila
      } ;

      setMatrizNombres( ( prev ) => [ ...prev , nuevaFila ] ) ;

      if( i < CONSULTAS.length - 1 ) {
        await new Promise( ( resolve ) => setTimeout( resolve , 1500 ) ) ;
      }
    }

    setCorriendoNombres( false ) ;
    setProgresoNombres( "" ) ;
  } ;

  const cancelarBateriaNombres = () => {
    cancelacionNombresRef.current = true ;
    setCorriendoNombres( false ) ;
    setProgresoNombres( "" ) ;
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

  const limpiarIdentidadParaBateriaNombres = ( id?: IdentidadMarcaLab | null ) => {
    if( !id ) return( null ) ;
    const iconoLimpio = id.icono ? {
      origen:      id.icono.origen ,
      ancho:       id.icono.ancho ,
      alto:        id.icono.alto ,
      origenAncho: id.icono.origenAncho ,
      origenAlto:  id.icono.origenAlto ,
      fuenteUrl:   id.icono.fuenteUrl
    } : null ;
    return( {
      icono:    iconoLimpio ,
      color:    id.color ,
      intentos: id.intentos
    } ) ;
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
      } ) ) ,
      bateriaNombres: matrizNombres.map( ( f ) => ( {
        consulta:    f.consulta ,
        esperados:   f.esperados ,
        parcial:     f.parcial ,
        estrategias: f.estrategias.map( ( e ) => ( {
          estrategia: e.estrategia ,
          ok:         e.ok ,
          estado:     e.estado ,
          ms:         e.ms ,
          candidatos: e.candidatos.map( ( c ) => ( {
            dominio:  c.dominio ,
            resuelve: c.resuelve ,
            coincide: c.coincide ,
            titulo:   c.titulo
          } ) ) ,
          primero: {
            dominio:          e.primero.dominio ,
            esperado:         e.primero.esperado ,
            posicionEsperado: e.primero.posicionEsperado ,
            identidad:        limpiarIdentidadParaBateriaNombres( e.primero.identidad ) ,
            msIdentidad:      e.primero.msIdentidad
          }
        } ) )
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
            {!corriendoNombres ? (
              <button
                type="button"
                className={styles.buttonSecondary}
                disabled={corriendoBateria || disabledServer}
                onClick={ejecutarBateriaNombres}
              >
                {sandboxDict.brandsBatteryName}
              </button>
            ) : (
              <button
                type="button"
                className={styles.buttonDanger}
                onClick={cancelarBateriaNombres}
              >
                {sandboxDict.brandsCancel} ({progresoNombres})
              </button>
            )}

            {!corriendoBateria ? (
              <button
                type="button"
                className={styles.buttonSecondary}
                disabled={corriendoNombres || disabledServer}
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
                          {cand.coincide !== undefined && (
                            <span className={styles.strategyMeta}>
                              {cand.coincide ? "✓ coincide" : "✗ difiere"}
                            </span>
                          )}
                          <button
                            type="button"
                            className={styles.candidateAction}
                            onClick={ () => probarIconos( cand ) }
                          >
                            {sandboxDict.brandsTryIcons}
                          </button>
                        </div>
                        {cand.titulo && (
                          <span className={styles.candidateDetail}>
                            {cand.titulo}
                          </span>
                        )}
                        {cand.nombre && (
                          <span className={styles.candidateDetail}>
                            {cand.nombre}
                          </span>
                        )}
                        {cand.descripcion && (
                          <span className={styles.candidateDetail}>
                            {cand.descripcion}
                          </span>
                        )}
                      </li>
                    ) )}
                  </ul>
                ) : (
                  <div className={styles.emptyText}>{sandboxDict.brandsNoResults}</div>
                )}
              </div>
            ) )}
          </div>
        ) : (
          <div className={styles.emptyText}>{sandboxDict.brandsNoResults}</div>
        )}
      </div>

      {/* Identidad Individual Resuelta */}
      {identidadIndividual !== undefined && (
        <div className={styles.section}>
          <div className={styles.individualResolverRow}>
            <strong>{sandboxDict.brandsResolverCol} ({dominioActual}):</strong>
            <CeldaIdentidad identidad={identidadIndividual} />
          </div>
        </div>
      )}

      {/* Fase 2: Íconos y logotipos */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {sandboxDict.brandsIconsTitle} {dominioActual && `(${dominioActual})`}
        </h3>
        {resultadosIconos.length > 0 ? (
          <div className={styles.iconsGrid}>
            {resultadosIconos.map( ( icono ) => {
              const dim = dimensionesImg[icono.estrategia] ;
              const estadoNav = estadosNavegador[icono.estrategia] ;
              const origenUsado = columnaDeOrigen( identidadIndividual?.icono?.origen ) ;
              const esUsada = Boolean( origenUsado && (icono.estrategia === origenUsado) ) ;
              const esChico = Boolean( dim && ((dim.w < 64) || (dim.h < 64)) ) ;

              return(
                <div
                  key={icono.estrategia}
                  className={`${styles.iconTile}${esUsada ? ` ${styles.celdaUsada}` : ""}`}
                >
                  <div className={styles.iconTileHeader}>
                    <span className={styles.iconTileName}>{icono.estrategia}</span>
                    {esUsada && (
                      <span className={styles.etiquetaUsada}>{sandboxDict.brandsUsedIcon}</span>
                    )}
                    {esChico && (
                      <span className={styles.badgeSmall}>{sandboxDict.brandsSmall}</span>
                    )}
                    <span className={styles.iconTileMode}>{icono.modo}</span>
                  </div>

                  <div className={styles.iconTilePreview}>
                    {(icono.dataUri || icono.url) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={icono.dataUri || icono.url}
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

      {/* Matriz Batería «nombre → ícono» */}
      <MatrizNombres filas={matrizNombres} dict={sandboxDict} />

      {/* Matriz Batería «dominio → ícono» */}
      <MatrizDominios filas={matrizBateria} dict={sandboxDict} />
    </div>
  ) ;
}
