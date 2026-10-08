/**
 * @file OrganizationSwitcher.tsx
 * Selector de organización activa del Navbar (RN-9, AC-7, NFR-5).
 * Cambiar actualiza el JWT con `update( { organizationId } )` y luego refresca el router:
 * sin ese refresco, las páginas del servidor seguirían mostrando datos de la organización anterior.
 */
"use client" ;

// Librerías externas
import React , { useEffect , useRef , useState } from "react" ;
import { useSession }                from "next-auth/react" ;
import { useRouter }                 from "next/navigation" ;

// Shared
import { IconChevronDown , IconCheck , IconUser } from "@/shared/ui/display/Icons/Icons" ;
import { Popup }                                   from "@/shared/ui/feedback/Popup/Popup" ;

// Feature: Organizations
import { consumirAvisoOrganizacion } from "./avisoOrganizacion" ;
import type { CambioDeOrganizacion }  from "../actions/organizationActions" ;
import { CreateOrganizationModal }    from "./CreateOrganizationModal" ;
import { LeaveOrganizationModal }     from "./LeaveOrganizationModal" ;
import styles                         from "./OrganizationSwitcher.module.css" ;


export interface OrganizacionDelSelector {
  id:          string ;
  nombre:      string ;
  rol:         string ;
  /** Es un espacio Personal: va primero, con otro ícono y sin etiqueta de rol (RN-15). */
  esPersonal?: boolean ;
}

export interface OrganizationSwitcherProps {
  organizaciones: OrganizacionDelSelector[] ;
  activaId:       string ;
  /** La persona es el único `owner` de la organización activa: no puede abandonarla (RN-29). */
  esUnicoOwner?:  boolean ;
  dict: {
    ariaLabel:     string ;
    listLabel:     string ;
    createNew:     string ;
    viewerBadge:   string ;
    switchError:   string ;
    /** Nombre con el que se muestra el espacio Personal; sin él, el guardado en la base. */
    personalLabel?: string ;
    create:        React.ComponentProps< typeof CreateOrganizationModal >[ "dict" ] ;
    /** Textos de «Abandonar»; sin ellos el selector no ofrece esa línea. */
    leave?: React.ComponentProps< typeof LeaveOrganizationModal >[ "dict" ] & {
      menuLabel:         string ;
      disabledOnlyOrg:   string ;
      disabledOnlyOwner: string ;
      notice:            string ;
      dismiss:           string ;
    } ;
  } ;
}

/**
 * Botón con la organización activa que abre una lista para cambiar de organización o crear otra.
 */
export function OrganizationSwitcher( { organizaciones , activaId , esUnicoOwner = false , dict }: OrganizationSwitcherProps ) {
  const { update }                    = useSession() ;
  const router                        = useRouter() ;
  const triggerRef                    = useRef< HTMLButtonElement >( null ) ;
  const listRef                       = useRef< HTMLDivElement >( null ) ;
  const [ abierto , setAbierto ]      = useState( false ) ;
  const [ creando , setCreando ]      = useState( false ) ;
  const [ cambiando , setCambiando ]  = useState( false ) ;
  const [ abandonando , setAbandonando ] = useState( false ) ;
  const [ aviso , setAviso ]          = useState( "" ) ;
  const [ error , setError ]          = useState( "" ) ;

  const activa = organizaciones.find( ( o ) => o.id === activaId ) ;

  /** El espacio Personal se muestra con el nombre del diccionario, no con el guardado en la base. */
  const nombreDe = ( org?: OrganizacionDelSelector ) => ( org?.esPersonal ? ( dict.personalLabel ?? org.nombre ) : ( org?.nombre ?? "" ) ) ;

  // El dueño no abandona su espacio Personal: la línea «Abandonar» no se ofrece (RN-3)
  const sinAbandonar = ( !!activa?.esPersonal && (activa.rol === "owner") ) ;

  // El selector vive en el layout y no se remonta al cambiar de organización: el aviso que dejó otra
  // pantalla (eliminar desde Configuración) se lee cuando cambia la organización activa.
  useEffect( () => {
    const pendiente = consumirAvisoOrganizacion() ;

    if( pendiente ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- se sincroniza con un almacenamiento externo
      setAviso( pendiente ) ;
    }
  } , [ activaId ] ) ;

  const motivoSinAbandonar = ( organizaciones.length === 1 )
    ? dict.leave?.disabledOnlyOrg
    : ( esUnicoOwner ? dict.leave?.disabledOnlyOwner : undefined ) ;

  const cerrar = () => {
    setAbierto( false ) ;
    triggerRef.current?.focus() ;
  } ;

  const abrir = () => {
    setError( "" ) ;
    setAbierto( true ) ;
    // El Popup monta su contenido en un portal: el foco va a la opción activa recién cuando existe.
    setTimeout( () => {
      const items = listRef.current?.querySelectorAll< HTMLElement >( "[role='menuitemradio']" ) ;
      const activo = listRef.current?.querySelector< HTMLElement >( "[aria-checked='true']" ) ;
      ( activo || items?.[0] )?.focus() ;
    } , 0 ) ;
  } ;

  const handleTriggerKeyDown = ( e: React.KeyboardEvent ) => {
    if( (e.key === "ArrowDown") && !abierto ) {
      e.preventDefault() ;
      abrir() ;
    }
  } ;

  const handleListKeyDown = ( e: React.KeyboardEvent ) => {
    if( (e.key !== "ArrowDown") && (e.key !== "ArrowUp") && (e.key !== "Home") && (e.key !== "End") ) { return ; }

    const items = Array.from( listRef.current?.querySelectorAll< HTMLElement >( "[role='menuitemradio'],[role='menuitem']" ) ?? [] ) ;
    if( items.length === 0 ) { return ; }

    e.preventDefault() ;
    const actual = items.indexOf( document.activeElement as HTMLElement ) ;
    let destino  = actual ;

    if( e.key === "ArrowDown" ) { destino = ( (actual + 1) % items.length ) ; }
    if( e.key === "ArrowUp" )   { destino = ( (actual <= 0) ? (items.length - 1) : (actual - 1) ) ; }
    if( e.key === "Home" )      { destino = 0 ; }
    if( e.key === "End" )       { destino = ( items.length - 1 ) ; }

    items[destino].focus() ;
  } ;

  /**
   * Cambia la organización activa. Si el servidor rechaza el cambio (AC-8) la sesión no cambia
   * y se muestra el mensaje en vez de dejar la interfaz diciendo una cosa y sirviendo otra.
   */
  const cambiarA = async ( organizationId: string ) => {
    if( organizationId === activaId ) {
      cerrar() ;
      return ;
    }

    setError( "" ) ;
    setCambiando( true ) ;

    try {
      const sesion = await update( { organizationId } ) ;

      if( sesion?.user?.organizationId !== organizationId ) {
        setError( dict.switchError ) ;
        return ;
      }

      setAbierto( false ) ;
      router.refresh() ;
    } catch {
      setError( dict.switchError ) ;
    } finally {
      setCambiando( false ) ;
    }
  } ;

  const alCrear = async ( organizationId: string ) => {
    const sesion = await update( { organizationId } ) ;

    if( sesion?.user?.organizationId === organizationId ) {
      router.refresh() ;
    }
  } ;

  /**
   * Tras abandonar: la sesión pasa a la organización siguiente y recién entonces se refresca el router.
   * El aviso se muestra directo (el selector sigue montado) y no depende de `sessionStorage`.
   */
  const alAbandonar = async ( cambio: CambioDeOrganizacion ) => {
    await update( { organizationId: cambio.organizationId } ) ;
    setAviso( ( dict.leave?.notice ?? "" ).replace( "{nombre}" , cambio.nombreAnterior ) ) ;
    router.refresh() ;
  } ;

  return(
    <div className={styles.wrap}>
      <button
        ref={triggerRef}
        type="button"
        className={ `${styles.trigger} ${abierto ? styles.open : ""}` }
        onClick={ () => ( abierto ? cerrar() : abrir() ) }
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={dict.ariaLabel}
      >
        {activa?.esPersonal && <IconUser size={12} className={styles.personalIcon} />}
        <span className={styles.name}>{nombreDe( activa )}</span>
        {(activa?.rol === "viewer") && <span className={styles.badge}>{dict.viewerBadge}</span>}
        <IconChevronDown size={12} className={styles.chevron} />
      </button>

      <Popup anchor={triggerRef} open={abierto} onClose={cerrar} placement="bottom-start" offset={6}>
        <div
          ref={listRef}
          className={styles.list}
          role="menu"
          aria-label={dict.listLabel}
          onKeyDown={handleListKeyDown}
        >
          {organizaciones.map( ( org ) => {
            const esActiva = ( org.id === activaId ) ;
            return(
              <button
                key={org.id}
                type="button"
                role="menuitemradio"
                aria-checked={esActiva}
                className={ `${styles.item} ${esActiva ? styles.itemActive : ""}` }
                disabled={cambiando}
                onClick={ () => cambiarA( org.id ) }
              >
                <span className={styles.check}>{esActiva ? <IconCheck size={12} /> : null}</span>
                {org.esPersonal && <IconUser size={12} className={styles.personalIcon} />}
                <span className={styles.itemName}>{nombreDe( org )}</span>
                {(org.rol === "viewer") && <span className={styles.badge}>{dict.viewerBadge}</span>}
              </button>
            ) ;
          } )}

          <div className={styles.separator} role="separator" />

          <button
            type="button"
            role="menuitem"
            className={ `${styles.item} ${styles.itemCreate}` }
            disabled={cambiando}
            onClick={ () => {
              setAbierto( false ) ;
              setCreando( true ) ;
            } }
          >
            {dict.createNew}
          </button>

          {dict.leave && !sinAbandonar && (
            <>
              <button
                type="button"
                role="menuitem"
                className={ `${styles.item} ${styles.itemLeave}` }
                aria-disabled={!!motivoSinAbandonar}
                aria-describedby={motivoSinAbandonar ? "organizacion-abandonar-motivo" : undefined}
                disabled={cambiando}
                onClick={ () => {
                  if( motivoSinAbandonar ) { return ; }
                  setAbierto( false ) ;
                  setAbandonando( true ) ;
                } }
              >
                {dict.leave.menuLabel.replace( "{nombre}" , nombreDe( activa ) )}
              </button>
              {motivoSinAbandonar && <p id="organizacion-abandonar-motivo" className={styles.hint}>{motivoSinAbandonar}</p>}
            </>
          )}

          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>
      </Popup>

      <CreateOrganizationModal
        isOpen={creando}
        onClose={ () => setCreando( false ) }
        onCreated={alCrear}
        dict={dict.create}
      />

      {dict.leave && (
        <LeaveOrganizationModal
          isOpen={abandonando}
          onClose={ () => setAbandonando( false ) }
          nombre={nombreDe( activa )}
          onLeft={alAbandonar}
          dict={dict.leave}
        />
      )}

      {aviso && (
        <div className={styles.notice} role="status">
          <span className={styles.noticeText}>{aviso}</span>
          <button type="button" className={styles.noticeClose} aria-label={dict.leave?.dismiss} onClick={ () => setAviso( "" ) }>×</button>
        </div>
      )}
    </div>
  ) ;
}
