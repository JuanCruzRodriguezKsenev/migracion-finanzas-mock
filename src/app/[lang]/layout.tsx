/**
 * @file layout.tsx
 * Layout raíz internacionalizado y protegido.
 * Provee la estructura HTML base y el proveedor global de perfiles hidratado en el servidor.
 */
import type { Metadata } from "next" ;
import { Inter , Outfit } from "next/font/google" ;
import { getServerSession } from "next-auth" ;
import { authOptions } from "@/shared/lib/auth" ;
import { db } from "@/shared/db/client" ;
import { profiles } from "@/features/profile/schema.db" ;
import { eq } from "drizzle-orm" ;
import { ProfileProvider } from "@/features/profile/context/ProfileContext" ;
import { ProfileData } from "@/features/profile/types" ;
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
  currency:         "Peso argentino (ARS)" ,
  timezone:         "(GMT-03:00) Buenos Aires" ,
  bio:              "" ,
  theme:            "system" ,
  defaultView:      "Dashboard" ,
  fastLogin:        true ,
  weeklyStart:      "Lunes" ,
  dateFormat:       "DD/MM/YYYY" ,
  numberFormat:     "1.234,56" ,
  roundAmounts:     false ,
  includeTransfers: true ,
  defaultAccount:   "" ,
  planName:         "Básico" ,
  planBilling:      "Mensual" ,
  planNextCharge:   "" ,
} ;

export default async function RootLayout( {children , params}: RootLayoutProps ) {
  const { lang } = await params ;
  const session = await getServerSession( authOptions ) ;
  
  let initialProfile = DEFAULT_PROFILE ;

  // Hidratar síncronamente el perfil desde la base de datos en el servidor si hay sesión activa
  if( session?.user?.id ){
    const [ dbProfile ] = await db
      .select()
      .from( profiles )
      .where( eq(profiles.userId , session.user.id) )
      .limit( 1 ) ;
      
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
        <ProfileProvider initialProfile={initialProfile}>
          {children}
        </ProfileProvider>
      </body>
    </html>
  ) ;
}
