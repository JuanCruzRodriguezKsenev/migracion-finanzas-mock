/**
 * @file Icons.tsx
 * Componentes de iconos SVG reutilizables para la interfaz de usuario.
 * Provee un componente base IconWrapper para evitar la duplicación de código boilerplate en SVGs.
 */
"use client" ;

// Librerías externas
import React from "react" ;

interface IconProps {
  className?: string ;
  style?:     React.CSSProperties ;
  size?:      number ;
}

interface IconWrapperProps extends IconProps {
  children:     React.ReactNode ;
  strokeWidth?: number ;
  viewBox?:     string ;
}

/**
 * Componente base que envuelve los vectores SVG comunes de la aplicación.
 * Centraliza los atributos base del estilo visual de los iconos.
 */
function IconWrapper( {className , style , size = 16 , strokeWidth = 2 , viewBox = "0 0 24 24" , children}: IconWrapperProps ) {
  return(
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {children}
    </svg>
  ) ;
}

export function IconBrand( props: IconProps ) {
  return(
    <IconWrapper {...props} size={props.size || 20} strokeWidth={2.5}>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </IconWrapper>
  ) ;
}

export function IconDashboard( props: IconProps ) {
  return(
    <IconWrapper {...props}>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </IconWrapper>
  ) ;
}

export function IconAccounts( props: IconProps ) {
  return(
    <IconWrapper {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </IconWrapper>
  ) ;
}

export function IconChevronDown( props: IconProps ) {
  return(
    <IconWrapper {...props} size={props.size || 12}>
      <polyline points="6 9 12 15 18 9" />
    </IconWrapper>
  ) ;
}

export function IconLogout( props: IconProps ) {
  return(
    <IconWrapper {...props} size={props.size || 14}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </IconWrapper>
  ) ;
}

export function IconCalendar( props: IconProps ) {
  return(
    <IconWrapper {...props} size={props.size || 14}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </IconWrapper>
  ) ;
}

export function IconBell( props: IconProps ) {
  return(
    <IconWrapper {...props}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </IconWrapper>
  ) ;
}

export function IconMenu( props: IconProps ) {
  return(
    <IconWrapper {...props}>
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </IconWrapper>
  ) ;
}

export function IconClose( props: IconProps ) {
  return(
    <IconWrapper {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </IconWrapper>
  ) ;
}

export function IconSettings( props: IconProps ) {
  return(
    <IconWrapper {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </IconWrapper>
  ) ;
}

export function IconSandbox( props: IconProps ) {
  return(
    <IconWrapper {...props}>
      <path d="M6 2h12" />
      <path d="M10 2v7.586a1 1 0 0 1-.293.707l-6.414 6.414A2 2 0 0 0 4.707 20h14.586a2 2 0 0 0 1.414-3.414l-6.414-6.414A1 1 0 0 1 14 9.586V2" />
    </IconWrapper>
  ) ;
}

export function IconRepeat( props: IconProps ) {
  return(
    <IconWrapper {...props}>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </IconWrapper>
  ) ;
}

export function IconTransactions( props: IconProps ) {
  return(
    <IconWrapper {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </IconWrapper>
  ) ;
}

export function IconContacts( props: IconProps ) {
  return(
    <IconWrapper {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </IconWrapper>
  ) ;
}

export function IconCreditCard( props: IconProps ) {
  return(
    <IconWrapper {...props}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </IconWrapper>
  ) ;
}

export function IconLoan( props: IconProps ) {
  return(
    <IconWrapper {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <line x1="6" y1="12" x2="6.01" y2="12" />
      <line x1="18" y1="12" x2="18.01" y2="12" />
    </IconWrapper>
  ) ;
}

export function IconGoal( props: IconProps ) {
  return(
    <IconWrapper {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </IconWrapper>
  ) ;
}

export function IconStats( props: IconProps ) {
  return(
    <IconWrapper {...props}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </IconWrapper>
  ) ;
}

export function IconGoogle( props: IconProps ) {
  return(
    <svg
      width={props.size || 18}
      height={props.size || 18}
      viewBox="0 0 24 24"
      className={props.className}
      style={props.style}
    >
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  ) ;
}





