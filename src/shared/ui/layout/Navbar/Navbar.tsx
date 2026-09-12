/**
 * @file Navbar.tsx
 * Barra de navegación lateral.
 * Compuesto de: marca, links de navegación y ProfileMenu.
 */
"use client" ;

// Librerías externas
import { useParams , usePathname } from "next/navigation" ;
import Link                        from "next/link" ;

// Shared
import {
  IconBrand ,
  IconDashboard ,
  IconTransactions ,
  IconAccounts ,
  IconCreditCard ,
  IconLoan ,
  IconRepeat ,
  IconContacts ,
  IconSandbox ,
  IconSettings ,
  IconClose
} from "@/shared/ui/display/Icons/Icons" ;
import { ProfileMenu } from "@/shared/ui/feedback/ProfileMenu/ProfileMenu" ;
import styles          from "./Navbar.module.css" ;

interface NavbarProps {
  isOpen?:  boolean ;
  onClose?: () => void ;
  dict: {
    dashboard:      string ;
    accounts:       string ;
    transactions?:  string ;
    cards?:         string ;
    loans?:         string ;
    subscriptions:  string ;
    contacts?:      string ;
    settings:       string ;
    sandbox:        string ;
    logout:         string ;
    user:           string ;
    loading:        string ;
    planTag:        string ;
    planBasic:      string ;
    planPremium:    string ;
    upgradePlan:    string ;
  } ;
}

/**
 * Componente principal de barra lateral (Navbar).
 */
export function Navbar( {dict , isOpen , onClose}: NavbarProps ) {
  const params               = useParams() ;
  const pathname             = usePathname() ;
  const lang                 = ( params?.lang || "es" ) ;
  const isDashboardActive    = ( pathname === `/${lang}` ) ;
  const isSandboxActive      = ( pathname === `/${lang}/sandbox` ) ;
  const isSettingsActive     = ( pathname === `/${lang}/settings` ) ;
  const isTransactionsActive = ( pathname === `/${lang}/transactions` ) ;
  const isAccountsActive      = ( pathname === `/${lang}/accounts` ) ;
  const isCardsActive         = ( pathname === `/${lang}/cards` ) ;
  const isLoansActive         = ( pathname === `/${lang}/loans` ) ;
  const isSubscriptionsActive = ( pathname === `/${lang}/subscriptions` ) ;
  const isContactsActive      = ( pathname === `/${lang}/contacts` ) ;

  return(
    <aside className={ `${styles.navbar} ${isOpen ? styles.open : ""}` }>

      {/* Botón cerrar — solo mobile */}
      <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar menú">
        <IconClose size={18} />
      </button>

      {/* Marca */}
      <div className={styles.brand}>
        <span className={styles.brandIcon}><IconBrand size={16} /></span>
        <span>FinanzIA</span>
      </div>

      {/* Navegación */}
      <nav className={styles.nav}>
        <div className={styles.section}>
          <span className={styles.sectionTitle}>General</span>
          <ul className={styles.menu}>
            <li>
              <Link href={ `/${lang}` } className={ `${styles.link} ${isDashboardActive ? styles.active : ""}` }>
                <IconDashboard size={15} />
                <span>{dict.dashboard}</span>
              </Link>
            </li>
            <li>
              <Link href={ `/${lang}/settings` } className={ `${styles.link} ${isSettingsActive ? styles.active : ""}` }>
                <IconSettings size={15} />
                <span>{dict.settings || "Configuración"}</span>
              </Link>
            </li>
            <li>
              <Link href={ `/${lang}/sandbox` } className={ `${styles.link} ${isSandboxActive ? styles.active : ""}` }>
                <IconSandbox size={15} />
                <span>{dict.sandbox}</span>
              </Link>
            </li>
          </ul>
        </div>

        <div className={styles.section}>
          <span className={styles.sectionTitle}>Finanzas</span>
          <ul className={styles.menu}>
            <li>
              <Link href={ `/${lang}/transactions` } className={ `${styles.link} ${isTransactionsActive ? styles.active : ""}` }>
                <IconTransactions size={15} />
                <span>{dict.transactions || "Transacciones"}</span>
              </Link>
            </li>
            <li>
              <Link href={ `/${lang}/accounts` } className={ `${styles.link} ${isAccountsActive ? styles.active : ""}` }>
                <IconAccounts size={15} />
                <span>{dict.accounts}</span>
              </Link>
            </li>
            <li>
              <Link href={ `/${lang}/cards` } className={ `${styles.link} ${isCardsActive ? styles.active : ""}` }>
                <IconCreditCard size={15} />
                <span>{dict.cards || "Tarjetas"}</span>
              </Link>
            </li>
            <li>
              <Link href={ `/${lang}/loans` } className={ `${styles.link} ${isLoansActive ? styles.active : ""}` }>
                <IconLoan size={15} />
                <span>{dict.loans || "Préstamos"}</span>
              </Link>
            </li>
            <li>
              <Link href={ `/${lang}/subscriptions` } className={ `${styles.link} ${isSubscriptionsActive ? styles.active : ""}` }>
                <IconRepeat size={15} />
                <span>{dict.subscriptions}</span>
              </Link>
            </li>
            <li>
              <Link href={ `/${lang}/contacts` } className={ `${styles.link} ${isContactsActive ? styles.active : ""}` }>
                <IconContacts size={15} />
                <span>{dict.contacts || "Contactos"}</span>
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      {/* Perfil — al fondo */}
      <ProfileMenu dict={dict} />

    </aside>
  ) ;
}
