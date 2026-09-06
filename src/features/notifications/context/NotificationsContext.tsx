/**
 * @file NotificationsContext.tsx
 * Proveedor de contexto React para gestionar el estado reactivo de las alertas y notificaciones del dashboard.
 */
"use client" ;

// Librerías externas
import React , { createContext , useContext , useSyncExternalStore , useCallback } from "react" ;

// Feature: Notifications
import { getUnreadNotificationsCount } from "../lib/notificationHelpers" ;
import { Notification }                from "../types" ;


interface NotificationsContextType {
  notifications:  Notification[] ;
  unreadCount:    number ;
  markAsSent:     ( id: string ) => void ;
  confirmReceipt: ( id: string ) => void ;
  rejectReceipt:  ( id: string ) => void ;
  resetDemo:      () => void ;
}

const NotificationsContext = createContext< NotificationsContextType | undefined >( undefined ) ;

const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id:        "notif-1" ,
    type:      "debt" ,
    event:     "Asado Viernes" ,
    amount:    1250000 , // $12.500,00 en centavos
    name:      "Juan" ,
    alias:     "juan.mp.finanzas" ,
    status:    "pending" ,
    createdAt: new Date().toISOString() ,
  } ,
  {
    id:        "notif-2" ,
    type:      "receipt" ,
    event:     "Fútbol Semanal" ,
    amount:    870000 , // $8.700,00 en centavos
    name:      "Maria" ,
    status:    "sent" ,
    createdAt: new Date().toISOString() ,
  }
] ;

const STORAGE_KEY = "finanzia-notifications-demo" ;
const EMPTY_NOTIFICATIONS: Notification[] = [] ;

let listeners: Array< () => void > = [] ;
let memoryNotifications: Notification[] | null = null ;

function getStoredNotifications(): Notification[] {
  if( typeof window === "undefined" ) {
    return( EMPTY_NOTIFICATIONS ) ;
  }
  if( memoryNotifications !== null ) {
    return( memoryNotifications ) ;
  }
  const saved = localStorage.getItem( STORAGE_KEY ) ;
  if( saved ) {
    try {
      memoryNotifications = JSON.parse( saved ) ;
      return( memoryNotifications! ) ;
    } catch {
      memoryNotifications = DEMO_NOTIFICATIONS ;
      return( DEMO_NOTIFICATIONS ) ;
    }
  }
  memoryNotifications = DEMO_NOTIFICATIONS ;
  return( DEMO_NOTIFICATIONS ) ;
}

function emitChange() {
  for( const listener of listeners ) {
    listener() ;
  }
}

const notificationStore = {
  subscribe( listener: () => void ) {
    listeners.push( listener ) ;
    const onStorage = ( event: StorageEvent ) => {
      if( event.key === STORAGE_KEY ) {
        memoryNotifications = null ;
        listener() ;
      }
    } ;
    if( typeof window !== "undefined" ) {
      window.addEventListener( "storage" , onStorage ) ;
    }
    return( () => {
      listeners = listeners.filter( ( l ) => l !== listener ) ;
      if( typeof window !== "undefined" ) {
        window.removeEventListener( "storage" , onStorage ) ;
      }
    } ) ;
  } ,
  getSnapshot(): Notification[] {
    return( getStoredNotifications() ) ;
  } ,
  getServerSnapshot(): Notification[] {
    return( EMPTY_NOTIFICATIONS ) ;
  } ,
  setNotifications( updater: ( prev: Notification[] ) => Notification[] ) {
    const prev = getStoredNotifications() ;
    const next = updater( prev ) ;
    memoryNotifications = next ;
    if( typeof window !== "undefined" ) {
      localStorage.setItem( STORAGE_KEY , JSON.stringify( next ) ) ;
    }
    emitChange() ;
  } ,
  resetDemo() {
    memoryNotifications = DEMO_NOTIFICATIONS ;
    if( typeof window !== "undefined" ) {
      localStorage.setItem( STORAGE_KEY , JSON.stringify( DEMO_NOTIFICATIONS ) ) ;
    }
    emitChange() ;
  }
} ;

/**
 * Proveedor de contexto para las alertas y notificaciones.
 * Persiste el estado de demostración interactiva en localStorage mediante useSyncExternalStore.
 */
export function NotificationsProvider( {children}: {children: React.ReactNode} ) {
  const notifications = useSyncExternalStore(
    notificationStore.subscribe ,
    notificationStore.getSnapshot ,
    notificationStore.getServerSnapshot
  ) ;

  const markAsSent = useCallback( ( id: string ) => {
    notificationStore.setNotifications( ( prev ) =>
      prev.map( ( n ) => ( n.id === id ? {...n , status: "sent"} : n ) )
    ) ;
  } , [] ) ;

  const confirmReceipt = useCallback( ( id: string ) => {
    notificationStore.setNotifications( ( prev ) => prev.filter( ( n ) => n.id !== id ) ) ;
  } , [] ) ;

  const rejectReceipt = useCallback( ( id: string ) => {
    notificationStore.setNotifications( ( prev ) =>
      prev.map( ( n ) => ( n.id === id ? {...n , status: "pending"} : n ) )
    ) ;
  } , [] ) ;

  const resetDemo = useCallback( () => {
    notificationStore.resetDemo() ;
  } , [] ) ;

  // Unread count: deudas pendientes o recibos enviados por confirmar
  const unreadCount = getUnreadNotificationsCount( notifications ) ;

  const contextValue = {
    notifications ,
    unreadCount ,
    markAsSent ,
    confirmReceipt ,
    rejectReceipt ,
    resetDemo
  } ;

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
