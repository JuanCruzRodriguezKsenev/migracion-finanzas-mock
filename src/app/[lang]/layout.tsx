/**
 * @file layout.tsx
 * Layout raíz internacionalizado y protegido.
 * Provee la estructura HTML base y el proveedor global de perfiles hidratado en el servidor.
 */

// Librerías externas
import { Inter , Outfit }   from "next/font/google" ;
import { getServerSession } from "next-auth" ;
import type { Metadata }    from "next" ;

// Shared
import { SessionProvider } from "@/shared/providers/SessionProvider" ;
import { authOptions }     from "@/shared/lib/auth" ;

// Feature: Profile
import { profileRepository } from "@/features/profile/repositories/profileRepository" ;
import { ProfileProvider }   from "@/features/profile/context/ProfileContext" ;
import { ProfileData }       from "@/features/profile/types" ;

// Feature: Notifications
import { listarNotificacionesAction , marcarLeidasAction } from "@/features/notifications/actions/notificationsActions" ;
import { NotificationsProvider }                           from "@/features/notifications/context/NotificationsContext" ;

// Estilos
import "../globals.css" ;


const inter = Inter( {
  variable: "--font-inter" ,
  subsets: ["latin"] ,
} ) ;

const outfit = Outfit( {
  variable: "--font-outfit" ,
  subsets: ["latin"] ,
} ) ;

export const metadata: Metadata = {
  title:       "Finanzas Multi-tenant" ,
  description: "Plataforma financiera SaaS" ,
} ;

interface RootLayoutProps {
  children: React.ReactNode ;
  params:   Promise< {lang: string} > ;
}

// Configuración de perfil por defecto para sesiones no autenticadas
const DEFAULT_PROFILE: ProfileData = {
  userId:           "" ,
  phone:            "" ,
  currency:         "ARS" ,
  timezone:         "America/Argentina/Buenos_Aires" ,
  bio:              "" ,
  theme:            "system" ,
  defaultView:      "dashboard" ,
  fastLogin:        true ,
  weeklyStart:      "monday" ,
  dateFormat:       "DD/MM/YYYY" ,
  numberFormat:     "es-AR" ,
  roundAmounts:     false ,
  includeTransfers: true ,
  defaultAccount:   "" ,
  planName:         "Básico" ,
  planBilling:      "Mensual" ,
  planNextCharge:   "" ,
} ;

export default async function RootLayout( {children , params}: RootLayoutProps ) {
  const { lang } = await params ;
  const session  = await getServerSession( authOptions ) ;
  
  let initialProfile = DEFAULT_PROFILE ;

  // Hidratar síncronamente el perfil desde la base de datos en el servidor si hay sesión activa
  if( session?.user?.id ){
    const dbProfile = await profileRepository.findByUserId( session.user.id ) ;
      
    if( dbProfile ){
      initialProfile = dbProfile ;
    }
  }

  return(
    <html lang={lang} className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={ {
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'system';
                  var activeTheme = theme;
                  if (theme === 'system') {
                    activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.setAttribute('data-theme', activeTheme);
                } catch (e) {}
              })()
            `
          } }
        />
      </head>
      <body>
        <SessionProvider>
          <ProfileProvider initialProfile={initialProfile}>
            <NotificationsProvider listar={listarNotificacionesAction} marcarLeidas={marcarLeidasAction}>
              {children}
            </NotificationsProvider>
          </ProfileProvider>
        </SessionProvider>
      </body>
    </html>
  ) ;
}
