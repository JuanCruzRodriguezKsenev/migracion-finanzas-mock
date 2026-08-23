/**
 * @file types.ts
 * Definición de tipos y contratos para el sistema de alertas y notificaciones.
 */

export type NotificationType = "debt" | "receipt" ;
export type NotificationStatus = "pending" | "sent" | "confirmed" ;

/**
 * Representa una alerta o notificación de saldo/deuda de eventos en el sistema.
 */
export interface Notification {
  id:        string ;
  type:      NotificationType ;
  event:     string ;
  amount:    number ; // En centavos
  name:      string ; // Nombre de la contraparte
  alias?:    string ; // CBU/CVU/Alias bancario (requerido para tipo 'debt')
  status:    NotificationStatus ;
  createdAt: string ;
}
