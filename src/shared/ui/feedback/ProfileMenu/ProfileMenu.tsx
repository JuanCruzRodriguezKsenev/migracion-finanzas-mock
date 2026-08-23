/**
 * @file ProfileMenu.tsx
 * Menú desplegable del perfil de usuario.
 * Usa el componente genérico <Popup> para el posicionamiento y portal.
 */
"use client" ;

// Librerías externas
import { useSession , signOut } from "next-auth/react" ;
import { useRef , useState }    from "react" ;

// Feature: Profile
import { useProfileContext } from "@/features/profile/context/ProfileContext" ;

// Shared
import { IconChevronDown , IconSettings , IconLogout } from "@/shared/ui/display/Icons/Icons" ;
import { Popup }                                       from "@/shared/ui/feedback/Popup/Popup" ;
import styles                                          from "./ProfileMenu.module.css" ;

interface ProfileMenuProps {
  dict: {
    settings:    string ;
    logout:      string ;
    loading:     string ;
    planTag:     string ;
    planBasic:   string ;
    planPremium: string ;
    upgradePlan: string ;
    user:        string ;
  } ;
}

/**
 * Menú desplegable de perfil de usuario basado en portal.
 */
export function ProfileMenu( {dict}: ProfileMenuProps ) {
  const { data: session }  = useSession() ;
  const { profile }        = useProfileContext() ;
  const [ open , setOpen ] = useState( false ) ;
  const triggerRef         = useRef<HTMLButtonElement>( null ) ;

  const userName  = ( session?.user?.name || dict.user ) ;
  const userEmail = ( session?.user?.email || dict.loading ) ;

  const rawPlanName   = ( profile.planName || "" ).toLowerCase() ;
  const planTraducido = ( rawPlanName.includes("básico") || rawPlanName.includes("basic") ) ? dict.planBasic : dict.planPremium ;

  const handleLogout = async () => {
    await signOut( {callbackUrl: "/auth/signin"} ) ;
  } ;

  return(
    <div className={styles.wrap}>
      {/* Trigger — botón de perfil en el sidebar */}
      <button
        ref={triggerRef}
        className={ `${styles.trigger} ${open ? styles.open : ""}` }
        onClick={ () => setOpen( prev => !prev ) }
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className={styles.avatar} />
        <div className={styles.info}>
          <span className={styles.name}>{userName}</span>
          <span className={styles.email}>{userEmail}</span>
        </div>
        <IconChevronDown
          className={styles.chevron}
          size={12}
        />
      </button>

      {/* Popup genérico con el contenido del menú */}
      <Popup
        anchor={triggerRef}
        open={open}
        onClose={ () => setOpen( false ) }
        placement="top-start"
        offset={8}
      >
        <div className={styles.popupContent}>

          {/* Header con info del usuario (en 2 filas) */}
          <div className={styles.header}>
            {/* Fila Superior: Avatar + Datos */}
            <div className={styles.headerTop}>
              <div className={styles.headerAvatar} />
              <div className={styles.headerMeta}>
                <div className={styles.headerName}>{userName}</div>
                <div className={styles.headerEmail}>{userEmail}</div>
              </div>
            </div>

            {/* Fila Inferior: Plan + Link de Mejora */}
            <div className={styles.planRow}>
              <span className={styles.planName}>{planTraducido}</span>
              <button className={styles.upgradeLink} onClick={ () => alert("¡Próximamente! Redirigiendo a pasarela...") }>
                {dict.upgradePlan} ↗
              </button>
            </div>
          </div>

          {/* Items del menú */}
          <ul className={styles.menu} role="menu">
            <li role="none">
              <button className={styles.menuItem} role="menuitem">
                <IconSettings size={14} />
                <span>{dict.settings}</span>
              </button>
            </li>
            <li role="none">
              <button className={ `${styles.menuItem} ${styles.danger}` } onClick={handleLogout} role="menuitem">
                <IconLogout size={14} />
                <span>{dict.logout}</span>
              </button>
            </li>
          </ul>

        </div>
      </Popup>
    </div>
  ) ;
}
