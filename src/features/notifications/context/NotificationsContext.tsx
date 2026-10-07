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
import type { AvisoVista }                                      from "../types" ;


interface NotificationsContextType {
  notifications: AvisoVista[] ;
  unreadCount:   number ;
  marcarLeidas:  () => Promise< void > ;
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
  const [ notifications , setNotifications ] = useState< AvisoVista[] >( [] ) ;
  const [ unreadCount , setUnreadCount ]     = useState( 0 ) ;

  /*
   * `listar` es un server action: cada re-render del layout entrega una referencia nueva. Si el efecto
   * dependiera de ella, cada consulta provocaría un re-render que la volvería a disparar (bucle). Se
   * guarda en un ref y el efecto sólo depende de que exista.
   */
  const listarRef = useRef( listar ) ;
  const hayListar = Boolean( listar ) ;

  useEffect( () => {
    listarRef.current = listar ;
  } ) ;

  useEffect( () => {
    const consultar = listarRef.current ;

    if( !hayListar || !consultar ) {
      return ;
    }

    let vigente = true ;

    consultar()
      .then( ( res ) => {
        if( vigente && res.success ) {
          setNotifications( res.value.items ) ;
          setUnreadCount( res.value.noLeidas ) ;
        }
      } )
      .catch( () => { /* sin sesión o sin red: la campana queda vacía */ } ) ;

    return( () => { vigente = false ; } ) ;
  } , [ hayListar ] ) ;

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

  const contextValue = useMemo( () => ( { notifications , unreadCount , marcarLeidas } ) , [ notifications , unreadCount , marcarLeidas ] ) ;

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
