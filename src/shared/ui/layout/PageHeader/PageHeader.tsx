/**
 * @file PageHeader.tsx
 * Componente unificado de cabecera de página (PageHeader).
 * Compuesto por cada página individual, contiene el título de sección (h1), subtítulo,
 * acciones contextuales, selector de mes opcional y panel de notificaciones global.
 */
"use client" ;

// Librerías externas
import { useRouter , usePathname , useSearchParams }          from "next/navigation" ;
import React , { useState , useMemo , useTransition , useRef } from "react" ;

// Shared
import { MonthSelector }                     from "@/shared/ui/display/MonthSelector/MonthSelector" ;
import { IconCalendar , IconBell , IconMenu } from "@/shared/ui/display/Icons/Icons" ;
import type { getDictionary }                from "@/shared/lib/dictionary" ;
import { Popup }                             from "@/shared/ui/feedback/Popup/Popup" ;
import styles                                 from "./PageHeader.module.css" ;

// Feature: Notifications
import { NotificationsDropdown } from "@/features/notifications/components/NotificationsDropdown" ;
import { useNotifications }      from "@/features/notifications/context/NotificationsContext" ;

export interface PageHeaderProps {
  title:              string ;
  subtitle?:          string ;
  actions?:           React.ReactNode ;
  showMonthSelector?: boolean ;
  dict:               Awaited< ReturnType< typeof getDictionary > > ;
  lang?:              string ;
  currentMonthKey?:   string ;
  minKey?:            string ;
  onMenuClick?:       () => void ;
}

export function PageHeader( {
  title ,
  subtitle ,
  actions ,
  showMonthSelector = false ,
  dict ,
  lang = "es" ,
  currentMonthKey ,
  minKey ,
  onMenuClick
}: PageHeaderProps ) {
  const router       = useRouter() ;
  const pathname     = usePathname() ;
  const searchParams = useSearchParams() ;

  const [ isPending , startTransition ] = useTransition() ;
  const { unreadCount }                 = useNotifications() ;
  const [ open , setOpen ]              = useState( false ) ;
  const triggerRef                      = useRef<HTMLButtonElement>( null ) ;

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
        <h1 className={styles.headerGreeting}>{ title }</h1>
        {subtitle && (
          <p className={styles.headerSubtitle}>{ subtitle }</p>
        )}
      </div>

      <div className={styles.headerBrandMobile}>
        <span>FinanzIA</span>
      </div>

      <div className={styles.headerActions}>
        {actions}
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
