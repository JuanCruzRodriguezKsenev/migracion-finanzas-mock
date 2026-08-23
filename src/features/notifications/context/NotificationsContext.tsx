/**
 * @file NotificationsContext.tsx
 * Proveedor de contexto React para gestionar el estado reactivo de las alertas y notificaciones del dashboard.
 */
"use client" ;

// Librerías externas
import React , { createContext , useContext , useState , useEffect } from "react" ;

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

/**
 * Proveedor de contexto para las alertas y notificaciones.
 * Persiste el estado de demostración interactiva en localStorage.
 */
export function NotificationsProvider( {children}: {children: React.ReactNode} ) {
  const [ notifications , setNotifications ] = useState< Notification[] >( [] ) ;
  const [ isLoaded , setIsLoaded ]           = useState( false ) ;

  // Cargar estado inicial desde localStorage
  useEffect( () => {
    const saved = localStorage.getItem( "finanzia-notifications-demo" ) ;
    if( saved ) {
      try {
        setNotifications( JSON.parse( saved ) ) ;
      } catch( e ) {
        setNotifications( DEMO_NOTIFICATIONS ) ;
      }
    } else {
      setNotifications( DEMO_NOTIFICATIONS ) ;
    }
    setIsLoaded( true ) ;
  } , [] ) ;

  // Guardar cambios en localStorage
  useEffect( () => {
    if( isLoaded ) {
      localStorage.setItem( "finanzia-notifications-demo" , JSON.stringify( notifications ) ) ;
    }
  } , [ notifications , isLoaded ] ) ;

  const markAsSent = ( id: string ) => {
    setNotifications( ( prev ) =>
      prev.map( ( n ) => ( n.id === id ? {...n , status: "sent"} : n ) )
    ) ;
  } ;

  const confirmReceipt = ( id: string ) => {
    // Al confirmar, removemos la notificación ya que fue resuelta
    setNotifications( ( prev ) => prev.filter( ( n ) => n.id !== id ) ) ;
  } ;

  const rejectReceipt = ( id: string ) => {
    // Al rechazar, volvemos el estado a pending para el deudor
    setNotifications( ( prev ) =>
      prev.map( ( n ) => ( n.id === id ? {...n , status: "pending"} : n ) )
    ) ;
  } ;

  const resetDemo = () => {
    setNotifications( DEMO_NOTIFICATIONS ) ;
  } ;

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
