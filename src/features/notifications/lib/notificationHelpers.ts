/**
 * @file notificationHelpers.ts
 * Utilidades puras para el procesamiento y filtrado de alertas.
 */

// Feature: Notifications
import { Notification } from "../types" ;

/**
 * Filtra y devuelve la cantidad de notificaciones que requieren una acción del usuario.
 */
export function getUnreadNotificationsCount( notifications: Notification[] ): number {
  return(
    notifications.filter( ( n ) =>
      ( n.type === "debt" && n.status === "pending" ) ||
      ( n.type === "receipt" && n.status === "sent" )
    ).length
  ) ;
}
