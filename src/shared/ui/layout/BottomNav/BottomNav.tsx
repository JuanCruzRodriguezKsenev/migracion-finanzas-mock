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
import {
  IconDashboard ,
  IconAccounts ,
  IconCreditCard ,
  IconRepeat ,
  IconContacts ,
  IconSettings ,
  IconStats ,
  IconCalendar ,
  IconMenu
} from "@/shared/ui/display/Icons/Icons" ;
import styles from "./BottomNav.module.css" ;

interface BottomNavProps {
  onMenuClick: () => void ;
  dict: {
    dashboard:     string ;
    accounts:      string ;
    subscriptions: string ;
    contacts?:     string ;
    cards?:        string ;
    budgets?:      string ;
    settings?:     string ;
    stats?:        string ;
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
  const isReportsActive       = ( pathname.includes("/reports") ) ;
  const isCardsActive         = ( pathname.includes("/cards") ) ;
  const isBudgetsActive       = ( pathname.includes("/budgets") ) ;
  const isSubscriptionsActive = ( pathname.includes("/subscriptions") ) ;
  const isContactsActive      = ( pathname.includes("/contacts") ) ;
  const isSettingsActive      = ( pathname.includes("/settings") ) ;

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
        href={ `/${lang}/reports` }
        className={ `${styles.bottomNavLink} ${isReportsActive ? styles.active : ""}` }
      >
        <IconStats size={20} />
        <span>{dict.stats || "Estadísticas"}</span>
      </Link>

      <Link
        href={ `/${lang}/budgets` }
        className={ `${styles.bottomNavLink} ${isBudgetsActive ? styles.active : ""}` }
      >
        <IconCalendar size={20} />
        <span>{dict.budgets || "Presupuestos"}</span>
      </Link>

      <Link
        href={ `/${lang}/accounts` }
        className={ `${styles.bottomNavLink} ${isAccountsActive ? styles.active : ""}` }
      >
        <IconAccounts size={20} />
        <span>{dict.accounts}</span>
      </Link>

      <Link
        href={ `/${lang}/cards` }
        className={ `${styles.bottomNavLink} ${isCardsActive ? styles.active : ""}` }
      >
        <IconCreditCard size={20} />
        <span>{dict.cards || "Tarjetas"}</span>
      </Link>

      <Link
        href={ `/${lang}/subscriptions` }
        className={ `${styles.bottomNavLink} ${isSubscriptionsActive ? styles.active : ""}` }
      >
        <IconRepeat size={20} />
        <span>{dict.subscriptions}</span>
      </Link>

      <Link
        href={ `/${lang}/contacts` }
        className={ `${styles.bottomNavLink} ${isContactsActive ? styles.active : ""}` }
      >
        <IconContacts size={20} />
        <span>{dict.contacts || "Contactos"}</span>
      </Link>

      <Link
        href={ `/${lang}/settings` }
        className={ `${styles.bottomNavLink} ${isSettingsActive ? styles.active : ""}` }
      >
        <IconSettings size={20} />
        <span>{dict.settings || "Ajustes"}</span>
      </Link>

      <button className={styles.bottomNavLink} onClick={onMenuClick}>
        <IconMenu size={20} />
        <span>Menu</span>
      </button>
    </nav>
  ) ;
}
