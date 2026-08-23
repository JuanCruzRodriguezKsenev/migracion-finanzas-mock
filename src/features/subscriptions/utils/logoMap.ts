/**
 * @file logoMap.ts
 * Mapeo de logoKey → ícono SVG inline del sistema para suscripciones personalizadas.
 * Las marcas reales usan URLs (Brandfetch/Clearbit) resueltas por SubscriptionIcon;
 * este catálogo cubre los íconos genéricos y el fallback por defecto.
 */

/**
 * Configuración visual asociada a un ícono del sistema.
 */
export interface LogoConfig {
  bgColor:   string ; // color de fondo sugerido para la tarjeta
  textColor: string ; // color del badge de porcentaje
  svg:       string ; // interior del SVG (sin el wrapper <svg>)
  viewBox?:  string ;
}

export const LOGO_MAP: Record< string , LogoConfig > = {
  gym: {
    bgColor:   "#DBEAFE" ,
    textColor: "#1E40AF" ,
    viewBox:   "0 0 24 24" ,
    svg:       `<path fill="currentColor" d="M6 5h2v14H6V5zm10 0h2v14h-2V5zM3 9h3v6H3V9zm15 0h3v6h-3V9zM8 11h8v2H8v-2z"/>` ,
  } ,
  home: {
    bgColor:   "#FFE4E6" ,
    textColor: "#9F1239" ,
    viewBox:   "0 0 24 24" ,
    svg:       `<path fill="currentColor" d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 2.5l7 6.3V18h-2v-6H7v6H5v-6.2l7-6.3z"/>` ,
  } ,
  bolt: {
    bgColor:   "#FEF9C3" ,
    textColor: "#854D0E" ,
    viewBox:   "0 0 24 24" ,
    svg:       `<path fill="currentColor" d="M11 21h-1l1.5-7h-4.5c-.55 0-.83-.43-.44-.87l6-9.13h1l-1.5 7h4.5c.55 0 .83.43.44.87l-6 9.13z"/>` ,
  } ,
  book: {
    bgColor:   "#EDE9FE" ,
    textColor: "#5B21B6" ,
    viewBox:   "0 0 24 24" ,
    svg:       `<path fill="currentColor" d="M12 21c-2.5 0-7.5 1.5-7.5 1.5V6s5-1.5 7.5-1.5s7.5 1.5 7.5 1.5v16s-5-1.5-7.5-1.5zm-.5-15.5c-2.3 0-5.3 1-6 1.3v12.2c.7-.3 3.7-1.3 6-1.3v-12.2zm7 1.3c-.7-.3-3.7-1.3-6-1.3v12.2c2.3 0 5.3 1 6 1.3V6.8z"/>` ,
  } ,
  coffee: {
    bgColor:   "#FDE8D8" ,
    textColor: "#9A3412" ,
    viewBox:   "0 0 24 24" ,
    svg:       `<path fill="currentColor" d="M2 21h18v-2H2v2zM20 8h-2V5h2v3zm-4-5H4c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3h2c1.1 0 2-.9 2-2V7c0-2.2-1.8-4-4-4zm-2 10H4V5h12v8z"/>` ,
  } ,
  car: {
    bgColor:   "#E0F2FE" ,
    textColor: "#0369A1" ,
    viewBox:   "0 0 24 24" ,
    svg:       `<path fill="currentColor" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-5h14v5zm-2.5-3.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5s1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5zm-9 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5s1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/>` ,
  } ,
  heart: {
    bgColor:   "#FCE7F3" ,
    textColor: "#9D174D" ,
    viewBox:   "0 0 24 24" ,
    svg:       `<path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>` ,
  } ,
  gift: {
    bgColor:   "#FEF3C7" ,
    textColor: "#92400E" ,
    viewBox:   "0 0 24 24" ,
    svg:       `<path fill="currentColor" d="M20 6h-2.18c.11-.31.18-.65.18-1c0-1.66-1.34-3-3-3c-1.05 0-1.96.54-2.5 1.35c-.54-.81-1.45-1.35-2.5-1.35c-1.66 0-3 1.34-3 3c0 .35.07.69.18 1H5c-1.1 0-2 .9-2 2v3c0 .55.45 1 1 1h1v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V12h1c.55 0 1-.45 1-1V8c0-1.1-.9-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1h-2v-1c0-.55.45-1 1-1zm-6 1c0-.55.45-1 1-1s1 .45 1 1v1H9V5zm-4 5V8h7v2H5zm9 0V8h7v2h-7zm-7 2h5v8H7v-8zm10 8h-3v-8h3v8z"/>` ,
  } ,
  default: {
    bgColor:   "#F3F4F6" ,
    textColor: "#374151" ,
    viewBox:   "0 0 24 24" ,
    svg:       `<path fill="#6B7280" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>` ,
  } ,
} ;

/**
 * Resuelve la configuración visual de un logoKey, con fallback al ícono por defecto.
 *
 * @param logoKey - Clave del ícono del sistema (o URL de marca, que cae al default).
 * @returns La configuración visual correspondiente.
 */
export function getLogoConfig( logoKey: string ): LogoConfig {
  return( LOGO_MAP[logoKey.toLowerCase()] ?? LOGO_MAP.default ) ;
}
