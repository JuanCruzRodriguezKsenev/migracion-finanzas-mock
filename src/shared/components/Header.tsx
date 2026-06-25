/**
 * @file Header.tsx
 * Componente global de cabecera (Header) para el App Shell de la aplicación.
 * Muestra el saludo al usuario autenticado y las acciones rápidas del panel.
 */
"use client" ;

import { useProfileContext } from "@/features/profile/context/ProfileContext" ;

export function Header() {
  const { profile } = useProfileContext() ;

  const primerNombre = profile.name ? profile.name.split( " " )[0] : "Usuario" ;

  return(
    <header className="global-header">
      <div>
        <h1 className="header-greeting">Hola, {primerNombre}</h1>
        <p className="header-subtitle">Bienvenido de vuelta a tu panel de control.</p>
      </div>
      <div className="header-actions">
        <div className="header-datepicker">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Este Mes</span>
        </div>
        <button className="notification-btn">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="notification-badge">2</span>
        </button>
      </div>
    </header>
  ) ;
}
