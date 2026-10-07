/**
 * @file NotificationsContext.tsx
 * Proveedor de contexto React de la campana de avisos.
 * Recibe por props las acciones de servidor; sin ellas no consulta nada y queda vacío (login, tests).
 */
"use client" ;

// Librerías externas
import React , { createContext , useContext , useState , useEffect , useCallback , useMemo } from "react" ;

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

  useEffect( () => {
    if( !listar ) {
      return ;
    }

    let vigente = true ;

    listar()
      .then( ( res ) => {
        if( vigente && res.success ) {
          setNotifications( res.value.items ) ;
          setUnreadCount( res.value.noLeidas ) ;
        }
      } )
      .catch( () => { /* sin sesión o sin red: la campana queda vacía */ } ) ;

    return( () => { vigente = false ; } ) ;
  } , [ listar ] ) ;

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
