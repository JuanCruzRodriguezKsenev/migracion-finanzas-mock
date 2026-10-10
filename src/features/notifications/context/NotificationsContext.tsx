/**
 * @file NotificationsContext.tsx
 * Proveedor de contexto React de la campana de avisos.
 * Recibe por props las acciones de servidor; sin ellas no consulta nada y queda vacío (login, tests).
 */
"use client" ;

// Librerías externas
import React , { createContext , useContext , useState , useEffect , useCallback , useMemo , useRef } from "react" ;

// Feature: Notifications
import type { listarNotificacionesAction , marcarLeidasAction } from "../actions/notificationsActions" ;
import type { AvisoVista , OrganizacionDeAvisos }               from "../types" ;


const CLAVE_STORAGE_FILTRO = "finanzia.avisos.filtroOrg" ;

interface NotificationsContextType {
  notifications:  AvisoVista[] ;
  unreadCount:    number ;
  marcarLeidas:   () => Promise< void > ;
  filtro:         string | null ;
  setFiltro:      ( organizacionId: string | null ) => void ;
  organizaciones: OrganizacionDeAvisos[] ;
}

const NotificationsContext = createContext< NotificationsContextType | undefined >( undefined ) ;

interface NotificationsProviderProps {
  children:      React.ReactNode ;
  listar?:       typeof listarNotificacionesAction ;
  marcarLeidas?: typeof marcarLeidasAction ;
}

/**
 * Proveedor de la campana. Carga los avisos **después del montaje** (NFR-7: no bloquea la página).
 * Sin `listar` no hace ninguna consulta; si `listar` responde `fail` (sin sesión) el estado queda vacío.
 */
export function NotificationsProvider( {children , listar , marcarLeidas: marcarLeidasAccion}: NotificationsProviderProps ) {
  const [ notifications , setNotifications ]   = useState< AvisoVista[] >( [] ) ;
  const [ unreadCount , setUnreadCount ]       = useState( 0 ) ;
  const [ organizaciones , setOrganizaciones ] = useState< OrganizacionDeAvisos[] >( [] ) ;
  const [ filtro , setFiltroInterno ]          = useState< string | null >( null ) ;

  /*
   * `listar` es un server action: cada re-render del layout entrega una referencia nueva. Si el efecto
   * dependiera de ella, cada consulta provocaría un re-render que la volvería a disparar (bucle). Se
   * guarda en un ref y el efecto sólo depende de que exista y del filtro seleccionado.
   */
  const listarRef = useRef( listar ) ;
  const hayListar = Boolean( listar ) ;

  useEffect( () => {
    listarRef.current = listar ;
  } ) ;

  // Persistencia del filtro (RN-34): se recupera de localStorage después del montaje.
  useEffect( () => {
    try {
      const guardado = localStorage.getItem( CLAVE_STORAGE_FILTRO ) ;
      if( guardado ) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización inicial con almacenamiento externo tras el montaje
        setFiltroInterno( guardado ) ;
      }
    } catch {
      // Ignora excepciones si localStorage no está disponible o lanza en entornos restringidos.
    }
  } , [] ) ;

  const setFiltro = useCallback( ( nuevoFiltro: string | null ) => {
    setFiltroInterno( nuevoFiltro ) ;
    try {
      if( nuevoFiltro ) {
        localStorage.setItem( CLAVE_STORAGE_FILTRO , nuevoFiltro ) ;
      } else {
        localStorage.removeItem( CLAVE_STORAGE_FILTRO ) ;
      }
    } catch {
      // Ignora excepciones si localStorage no está disponible.
    }
  } , [] ) ;

  useEffect( () => {
    const consultar = listarRef.current ;

    if( !hayListar || !consultar ) {
      return ;
    }

    let vigente = true ;

    consultar( filtro ? { organizacionId: filtro } : undefined )
      .then( ( res ) => {
        if( vigente && res.success ) {
          setNotifications( res.value.items ) ;
          setUnreadCount( res.value.noLeidas ) ;
          setOrganizaciones( res.value.organizaciones ) ;

          if( filtro && !res.value.organizaciones.some( ( o ) => o.id === filtro ) ) {
            setFiltro( null ) ;
          }
        } else if( vigente && !res.success && filtro ) {
          setFiltro( null ) ;
        }
      } )
      .catch( () => { /* sin sesión o sin red: la campana queda vacía */ } ) ;

    return( () => { vigente = false ; } ) ;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el efecto de carga depende exclusivamente de [ hayListar , filtro ] (RN-34)
  } , [ hayListar , filtro ] ) ;

  const marcarLeidas = useCallback( async () => {
    if( !marcarLeidasAccion || (unreadCount === 0) ) {
      return ;
    }

    setUnreadCount( 0 ) ;
    setNotifications( ( prev ) => prev.map( ( n ) => ( {...n , leida: true} ) ) ) ;

    try {
      await marcarLeidasAccion() ;
    } catch { /* se reintenta en la próxima apertura si el contador vuelve a cargarse */ }
  } , [ marcarLeidasAccion , unreadCount ] ) ;

  const contextValue = useMemo(
    () => ( {
      notifications ,
      unreadCount ,
      marcarLeidas ,
      filtro ,
      setFiltro ,
      organizaciones ,
    } ) ,
    [ notifications , unreadCount , marcarLeidas , filtro , setFiltro , organizaciones ]
  ) ;

  return(
    <NotificationsContext.Provider value={contextValue}>
      { children }
    </NotificationsContext.Provider>
  ) ;
}

/**
 * Hook personalizado para consumir el contexto de notificaciones.
 */
export function useNotifications() {
  const context = useContext( NotificationsContext ) ;
  if( context === undefined ) {
    throw( new Error( "useNotifications debe usarse dentro de un NotificationsProvider" ) ) ;
  }
  return( context ) ;
}
