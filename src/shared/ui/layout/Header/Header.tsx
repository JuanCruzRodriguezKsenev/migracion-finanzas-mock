/**
 * @file Header.tsx
 * Componente global de cabecera (Header) para el App Shell de la aplicación.
 * Muestra el saludo al usuario autenticado y las acciones rápidas del panel con selector de mes interactivo.
 * Utiliza CSS Modules para el encapsulamiento de estilos.
 */
"use client" ;

// Librerías externas
import { useRouter , usePathname , useSearchParams }          from "next/navigation" ;
import React , { useState , useMemo , useTransition , useRef } from "react" ;
import { useSession }                                         from "next-auth/react" ;

// Shared
import { MonthSelector }                     from "@/shared/ui/display/MonthSelector/MonthSelector" ;
import { IconCalendar , IconBell , IconMenu } from "@/shared/ui/display/Icons/Icons" ;
import type { getDictionary }                from "@/shared/lib/dictionary" ;
import { Popup }                             from "@/shared/ui/feedback/Popup/Popup" ;
import styles                                 from "./Header.module.css" ;

// Feature: Notifications
import { NotificationsDropdown } from "@/features/notifications/components/NotificationsDropdown" ;
import { useNotifications }      from "@/features/notifications/context/NotificationsContext" ;

interface HeaderProps {
  onMenuClick?:     () => void ;
  dict:             Awaited< ReturnType< typeof getDictionary > > ;
  lang?:            string ;
  currentMonthKey?: string ;
  minKey?:          string ;
}

export function Header( {dict , onMenuClick , lang = "es" , currentMonthKey , minKey}: HeaderProps ) {
  const { data: session } = useSession() ;

  const router       = useRouter() ;
  const pathname     = usePathname() ;
  const searchParams = useSearchParams() ;

  const [ isPending , startTransition ] = useTransition() ;
  const { unreadCount }                 = useNotifications() ;
  const [ open , setOpen ]              = useState( false ) ;
  const triggerRef                      = useRef<HTMLButtonElement>( null ) ;

  const greetingKey   = ( dict.header?.greeting || "Hola" ) ;
  const nombreDefecto = ( greetingKey === "Hello" ? "User" : greetingKey === "Olá" ? "Usuário" : "Usuario" ) ;
  const nombreUsuario = session?.user?.name || nombreDefecto ;
  const primerNombre  = ( nombreUsuario.split( " " )[0] ) ;

  const isAccounts        = pathname.includes( "/accounts" ) ;
  const isSandbox         = pathname.includes( "/sandbox" ) ;
  const isSubscriptions   = pathname.includes( "/subscriptions" ) ;
  const isTransactions    = pathname.includes( "/transactions" ) ;
  const showMonthSelector = ( !isAccounts && !isSubscriptions ) ;

  const titleText = isAccounts
    ? ( dict.accountsPage?.title || "Cuentas Financieras" )
    : isSubscriptions
    ? dict.subscriptionsPage.title
    : isTransactions
    ? ( dict.transactionsPage?.title || "Libro Diario" )
    : isSandbox
    ? dict.sandboxPage.title
    : `${dict.header.greeting}, ${primerNombre}` ;

  const subtitleText = isAccounts
    ? ( dict.accountsPage?.subtitle || "Administra tus cuentas bancarias, billeteras virtuales y tarjetas." )
    : isSubscriptions
    ? dict.subscriptionsPage.subtitle
    : isTransactions
    ? ( dict.transactionsPage?.subtitle || "Consulta, busca y gestiona tus transacciones contables." )
    : isSandbox
    ? dict.sandboxPage.subtitle
    : dict.header.subtitle ;

  // Determinar la clave inicial (mes actual) y límites de futuro dinámicamente
  const [ currentKey , maxKey ] = useMemo( () => {
    if( currentMonthKey ) {
      return( [ currentMonthKey , currentMonthKey ] ) ;
    }
    const d = new Date() ;
    const max = `${d.getFullYear()}-${String( d.getMonth() + 1 ).padStart( 2 , "0" )}` ;
    return( [ max , max ] ) ;
  } , [ currentMonthKey ] ) ;

  // Sincronizar el mes seleccionado con la URL
  const selectedMonthKey = searchParams.get( "month" ) || currentKey ;

  // Manejar cambio de mes enviándolo a la URL usando transiciones no bloqueantes de React
  const handleMonthChange = ( key: string ) => {
    startTransition( () => {
      const params = new URLSearchParams( searchParams.toString() ) ;
      params.set( "month" , key ) ;
      router.push( `${pathname}?${params.toString()}` , {scroll: false} ) ;
    } ) ;
  } ;

  return(
    <header className={styles.globalHeader}>
      {/* Botón de menú hamburguesa exclusivo para móvil */}
      <button className={styles.mobileMenuBtn} onClick={onMenuClick}>
        <IconMenu size={20} />
      </button>

      <div className={styles.headerGreetingWrap}>
        <h1 className={styles.headerGreeting}>{ titleText }</h1>
        <p className={styles.headerSubtitle}>{ subtitleText }</p>
      </div>

      <div className={styles.headerBrandMobile}>
        <span>FinanzIA</span>
      </div>

      <div className={styles.headerActions}>
        {showMonthSelector && (
          <div className={ `${styles.monthSelectorWrap} ${isPending ? styles.pending : ""}` }>
            <MonthSelector
              selectedKey={selectedMonthKey}
              onChange={handleMonthChange}
              lang={lang}
              maxKey={maxKey}
              minKey={minKey}
              todayKey={currentKey}
              icon={<IconCalendar size={14} />}
              dict={dict.header?.monthSelector}
            />
          </div>
        )}
        <button
          ref={triggerRef}
          className={styles.notificationBtn}
          onClick={ () => setOpen( ( prev ) => !prev ) }
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={dict.notifications?.title || "Notificaciones"}
        >
          <IconBell size={16} />
          {unreadCount > 0 && (
            <span className={styles.notificationBadge}>{unreadCount}</span>
          )}
        </button>

        <Popup
          anchor={triggerRef}
          open={open}
          onClose={ () => setOpen( false ) }
          placement="bottom-end"
          offset={8}
        >
          <NotificationsDropdown dict={dict.notifications} />
        </Popup>
      </div>
    </header>
  ) ;
}
