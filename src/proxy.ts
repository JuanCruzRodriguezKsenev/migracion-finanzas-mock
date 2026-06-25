/**
 * @file proxy.ts
 * Proxy de enrutamiento unificado para Next.js 16 (anteriormente middleware).
 * Gestiona:
 * 1. Internacionalización (i18n): Redirección al locale por defecto ('es') si falta el prefijo.
 * 2. Guardias de Autenticación: Protección de rutas privadas mediante verificación de JWT.
 */
import { NextResponse } from "next/server" ;
import type { NextRequest } from "next/server" ;
import { getToken } from "next-auth/jwt" ;

const LOCALES = [ "br" , "en" , "es" ] ;
const DEFAULT_LOCALE = "en" ;

// Rutas públicas que no requieren autenticación
const PUBLIC_PATHS = [
  "/auth/signin" ,
  "/api/auth" ,
] ;

/**
 * Obtiene el locale desde el inicio del pathname de la URL.
 * 
 * @param pathname - Ruta actual solicitada por el usuario.
 * @returns El idioma detectado en la ruta o null si no tiene prefijo de locale válido.
 */
function getLocaleFromPathname( pathname: string ): string | null {
  const segments = pathname.split( "/" ) ;
  const locale   = segments[1] ;
  return( LOCALES.includes(locale) ? locale : null ) ;
}

/**
 * Función proxy principal que se ejecuta en el Edge Runtime de Next.js.
 * Centraliza la validación de internacionalización (i18n) y políticas de autenticación.
 * 
 * @param req - Objeto de petición entrante de Next.js.
 * @returns Un objeto NextResponse que redirige o permite el paso.
 */
export default async function proxy( req: NextRequest ) {
  const { pathname } = req.nextUrl ;

  // Excluir assets estáticos, archivos públicos y llamadas internas de Next.js
  if(
    (pathname.startsWith("/_next")) ||
    (pathname.includes("."))        ||
    (pathname.startsWith("/api/auth"))
  ){
    return( NextResponse.next() ) ;
  }

  // 1. Internacionalización (i18n)
  const currentLocale = getLocaleFromPathname( pathname ) ;

  if( !currentLocale ){
    const url    = req.nextUrl.clone() ;
    url.pathname = `/${DEFAULT_LOCALE}${pathname}` ;
    
    return( NextResponse.redirect(url) ) ;
  }

  const pathWithoutLocale = pathname.replace( `/${currentLocale}` , "" ) || "/" ;

  // 2. Guardias de Autenticación (Auth Guards)
  const token           = await getToken( {req} ) ;
  const isAuthenticated = !!token ;
  const isPublicPath    = PUBLIC_PATHS.some( (path) => pathWithoutLocale.startsWith(path) ) ;

  if( !(isAuthenticated) && !(isPublicPath) ){
    // Redirigir al login correspondiente
    const loginUrl = new URL( `/${currentLocale}/auth/signin` , req.url ) ;

    loginUrl.searchParams.set( "callbackUrl" , req.url ) ;
    
    return( NextResponse.redirect(loginUrl) ) ;
  }

  if( (isAuthenticated) && (isPublicPath) ){
    // Redirigir al inicio si ya está autenticado
    return( NextResponse.redirect(new URL(`/${currentLocale}` , req.url)) ) ;
  }

  return( NextResponse.next() ) ;
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)" ,
  ] ,
} ;