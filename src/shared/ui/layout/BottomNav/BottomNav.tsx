/**
 * @file BottomNav.tsx
 * Barra de navegación inferior flotante exclusiva para dispositivos móviles (estilo SofaScore).
 * Utiliza CSS Modules para el encapsulamiento de estilos.
 */
"use client" ;

// Librerías externas
import { useParams , usePathname } from "next/navigation" ;
import Link from "next/link" ;

// Shared
import { IconDashboard , IconAccounts , IconRepeat , IconMenu } from "@/shared/ui/display/Icons/Icons" ;
import styles from "./BottomNav.module.css" ;

interface BottomNavProps {
  onMenuClick: () => void ;
  dict: {
    dashboard:     string ;
    accounts:      string ;
    subscriptions: string ;
  } ;
}

/**
 * Componente de barra inferior para móvil.
 * Ofrece acceso rápido a rutas principales y un activador para el Drawer lateral.
 */
export function BottomNav( {dict , onMenuClick}: BottomNavProps ) {
  const params   = useParams() ;
  const pathname = usePathname() ;

  const lang = ( params?.lang || "es" ) ;

  // Determinar ruta activa
  const isDashboardActive     = ( pathname === `/${lang}` ) ;
  const isAccountsActive      = ( pathname.includes("/accounts") ) ;
  const isSubscriptionsActive = ( pathname.includes("/subscriptions") ) ;

  return(
    <nav className={styles.bottomNav}>
      <Link
        href={ `/${lang}` }
        className={ `${styles.bottomNavLink} ${isDashboardActive ? styles.active : ""}` }
      >
        <IconDashboard size={20} />
        <span>{dict.dashboard}</span>
      </Link>

      <Link
        href={ `/${lang}/accounts` }
        className={ `${styles.bottomNavLink} ${isAccountsActive ? styles.active : ""}` }
      >
        <IconAccounts size={20} />
        <span>{dict.accounts}</span>
      </Link>

      <Link
        href={ `/${lang}/subscriptions` }
        className={ `${styles.bottomNavLink} ${isSubscriptionsActive ? styles.active : ""}` }
      >
        <IconRepeat size={20} />
        <span>{dict.subscriptions}</span>
      </Link>

      <button className={styles.bottomNavLink} onClick={onMenuClick}>
        <IconMenu size={20} />
        <span>Menu</span>
      </button>
    </nav>
  ) ;
}
