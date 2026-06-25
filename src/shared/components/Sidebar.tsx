/**
 * @file Sidebar.tsx
 * Componente global de barra lateral (Sidebar) para el App Shell.
 * Provee accesos de navegación y el menú desplegable del perfil de usuario con logout.
 */
"use client" ;

import { useState } from "react" ;
import { signOut } from "next-auth/react" ;
import { useProfileContext } from "@/features/profile/context/ProfileContext" ;

export function Sidebar() {
  const { profile } = useProfileContext() ;
  const [ isOpen , setIsOpen ] = useState( false ) ;

  const handleLogout = async () => {
    await signOut( {callbackUrl: "/auth/signin"} ) ;
  } ;

  return(
    <aside className="sidebar-wrapper">
      {/* Marca de la aplicación */}
      <div className="sidebar-brand">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        <span>FinanzIA</span>
      </div>

      {/* Menú de Navegación */}
      <ul className="sidebar-menu">
        <li>
          <a href="#" className="sidebar-link active">
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
              <rect x="3" y="3" width="7" height="9" />
              <rect x="14" y="3" width="7" height="5" />
              <rect x="14" y="12" width="7" height="9" />
              <rect x="3" y="16" width="7" height="5" />
            </svg>
            <span>Dashboard</span>
          </a>
        </li>
        <li>
          <a href="#" className="sidebar-link">
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
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
              <line x1="12" y1="4" x2="12" y2="20" />
              <line x1="2" y1="12" x2="22" y2="12" />
            </svg>
            <span>Cuentas</span>
          </a>
        </li>
      </ul>

      {/* Perfil del Usuario y Dropdown */}
      <div className="sidebar-profile-wrap">
        <div
          className={`sidebar-profile ${isOpen ? "open" : ""}`}
          onClick={ () => setIsOpen(!isOpen) }
        >
          <div className="profile-meta">
            <div className="profile-avatar" style={ {backgroundColor: "var(--color-primary-light)"} } />
            <div className="profile-info">
              <div className="profile-name">{profile.name || "Usuario"}</div>
              <div className="profile-email">{profile.email || "cargando..."}</div>
            </div>
          </div>
          <svg
            className="profile-chevron"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Dropdown flotante */}
        <div className={`profile-dropdown ${isOpen ? "open" : ""}`}>
          <div className="profile-dropdown-header">
            <div className="profile-dropdown-avatar" style={ {backgroundColor: "var(--color-primary-light)"} } />
            <div>
              <div className="profile-dropdown-name">{profile.name || "Usuario"}</div>
              <div className="profile-dropdown-email">{profile.email}</div>
              <span className="profile-dropdown-plan-tag">Plan {profile.planName}</span>
            </div>
          </div>
          <ul className="profile-dropdown-menu">
            <li className="profile-dropdown-item">Ajustes</li>
            <li className="profile-dropdown-divider" />
            <li className="profile-dropdown-item danger" onClick={handleLogout}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={ {marginRight: "4px"} }
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Cerrar Sesión
            </li>
          </ul>
        </div>
      </div>
    </aside>
  ) ;
}
