// Librerías externas
import { describe , it , expect }      from "vitest" ;

// Feature: Notifications
import { getUnreadNotificationsCount } from "./notificationHelpers" ;
import { Notification }                from "../types" ;


describe( "getUnreadNotificationsCount" , () => {
  it( "debe retornar 0 si no hay notificaciones" , () => {
    expect( getUnreadNotificationsCount( [] ) ).toBe( 0 ) ;
  } ) ;

  it( "debe contar correctamente las deudas pendientes y recibos enviados" , () => {
    const listado: Notification[] = [
      { id: "1" , type: "debt" , event: "Asado" , amount: 1000 , name: "A" , status: "pending" , createdAt: "" } ,
      { id: "2" , type: "debt" , event: "Fútbol" , amount: 2000 , name: "B" , status: "sent" , createdAt: "" } , // Ya enviada, no cuenta
      { id: "3" , type: "receipt" , event: "Asado" , amount: 1000 , name: "C" , status: "sent" , createdAt: "" } , // Recibo por confirmar, cuenta
      { id: "4" , type: "receipt" , event: "Asado" , amount: 1000 , name: "D" , status: "pending" , createdAt: "" } , // Pendiente de envío, no cuenta
    ] ;

    expect( getUnreadNotificationsCount( listado ) ).toBe( 2 ) ;
  } ) ;
} ) ;
