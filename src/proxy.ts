/**
 * @file proxy.ts
 * Proxy de enrutamiento unificado para Next.js 16 (anteriormente middleware).
 * Gestiona:
 * 1. Internacionalización (i18n): Redirección al locale por defecto ('es') si falta el prefijo.
 * 2. Guardias de Autenticación: Protección de rutas privadas mediante verificación de JWT.
 */
// Librerías externas
import type { NextRequest } from "next/server" ;
import { NextResponse } from "next/server" ;
import { getToken } from "next-auth/jwt" ;

const LOCALES        = [ "br" , "en" , "es" ] ;
const DEFAULT_LOCALE = "es" ;

// Cookie donde se recuerda el idioma con el que navega el usuario. Existe para que una redirección
// a una ruta sin prefijo de locale —la que arma NextAuth con `pages.signIn`, que es estática y no
// puede llevar idioma— no devuelva al usuario al castellano por defecto.
const LOCALE_COOKIE = "NEXT_LOCALE" ;

// Rutas públicas que no requieren autenticación
const PUBLIC_PATHS = [
  "/auth/signin" ,
  "/api/auth" ,
] ;

// Cookies donde NextAuth guarda el JWT de sesión. La variante `__Secure-` es la que emite sobre
// HTTPS; se borran las dos porque el proxy no sabe bajo qué esquema se emitió la que trae el usuario.
const COOKIES_SESION = [
  "next-auth.session-token" ,
  "__Secure-next-auth.session-token" ,
] ;

// Marca que el layout privado agrega al mandar a alguien al login por sesión caducada.
const PARAM_SESION_CADUCADA = "expired" ;

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
 * Determina con qué idioma servir una ruta que llegó sin prefijo de locale.
 *
 * @param req - Petición entrante.
 * @returns El idioma recordado en la cookie, el primero aceptable de `Accept-Language`, o el de por defecto.
 */
function resolverLocalePreferido( req: NextRequest ): string {
  const recordado = req.cookies.get( LOCALE_COOKIE )?.value ;

  if( recordado && LOCALES.includes( recordado ) ) {
    return( recordado ) ;
  }

  const aceptados = ( req.headers.get( "accept-language" ) || "" ) ;

  for( const parte of aceptados.split( "," ) ) {
    // "es-AR;q=0.9" → "es": basta el idioma base para elegir entre los tres diccionarios.
    const idioma = parte.split( ";" )[0].trim().toLowerCase().split( "-" )[0] ;

    if( LOCALES.includes( idioma ) ) {
      return( idioma ) ;
    }
  }

  return( DEFAULT_LOCALE ) ;
}

/**
 * Comprueba si una ruta pertenece al conjunto público.
 *
 * La comparación exige que el prefijo termine donde termina el segmento: con un `startsWith` a
 * secas, una ruta como `/auth/signinCualquierCosa` también quedaría fuera del guardia.
 *
 * @param pathWithoutLocale - Ruta ya despojada del prefijo de idioma.
 * @returns `true` si la ruta no requiere autenticación.
 */
function esRutaPublica( pathWithoutLocale: string ): boolean {
  return( PUBLIC_PATHS.some( ( publica ) => (
    (pathWithoutLocale === publica) || pathWithoutLocale.startsWith( `${publica}/` )
  ) ) ) ;
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

  // Excluir assets estáticos, archivos públicos, llamadas internas de Next.js
  // y TODAS las rutas de API: las API no se localizan (redirigir /api/x a /es/api/x
  // produce 404) y cada route handler valida su propia sesión.
  if(
    (pathname.startsWith("/_next")) ||
    (/\.[^/]+$/.test(pathname))     ||
    (pathname.startsWith("/api/"))
  ){
    return( NextResponse.next() ) ;
  }

  // 1. Internacionalización (i18n)
  const currentLocale = getLocaleFromPathname( pathname ) ;

  if( !currentLocale ){
    const url    = req.nextUrl.clone() ;
    url.pathname = `/${resolverLocalePreferido( req )}${pathname}` ;

    return( NextResponse.redirect(url) ) ;
  }

  const pathWithoutLocale = ( pathname.replace(`/${currentLocale}` , "") || "/" ) ;

  // 2. Guardias de Autenticación (Auth Guards)
  const token           = await getToken( {req} ) ;
  const isAuthenticated = ( !!token && !token.invalid && !!token.organizationId ) ;
  const isPublicPath    = esRutaPublica( pathWithoutLocale ) ;

  // Sesión caducada: el layout privado manda acá cuando `getServerSession` no devolvió sesión.
  //
  // Hay que borrar la cookie, no sólo dejar pasar. `getToken()` decodifica el JWT sin ejecutar los
  // callbacks de NextAuth, así que el proxy sigue viendo la organización del token aunque el
  // callback `jwt` ya lo haya marcado inválido — y esa invalidación sólo se persiste en la cookie
  // cuando la petición pasa por `/api/auth/session`, cosa que una navegación normal no hace. Sin
  // este borrado, el layout redirige acá, el proxy ve "autenticado en ruta pública" y devuelve al
  // inicio: bucle infinito de 307 con la cookie zombi intacta.
  if( isPublicPath && (req.nextUrl.searchParams.get( PARAM_SESION_CADUCADA ) !== null) ){
    const respuesta = NextResponse.next() ;

    for( const cookie of COOKIES_SESION ) {
      respuesta.cookies.delete( cookie ) ;
    }

    return( recordarLocale( respuesta , currentLocale ) ) ;
  }

  if( !(isAuthenticated) && !(isPublicPath) ){
    // Redirigir al login correspondiente
    const loginUrl = new URL( `/${currentLocale}/auth/signin` , req.url ) ;

    loginUrl.searchParams.set( "callbackUrl" , req.url ) ;

    return( recordarLocale( NextResponse.redirect(loginUrl) , currentLocale ) ) ;
  }

  if( (isAuthenticated) && (isPublicPath) ){
    // Redirigir al inicio si ya está autenticado
    return( recordarLocale( NextResponse.redirect(new URL(`/${currentLocale}` , req.url)) , currentLocale ) ) ;
  }

  return( recordarLocale( NextResponse.next() , currentLocale ) ) ;
}

/**
 * Deja constancia del idioma con el que se está navegando, para que las redirecciones posteriores
 * a rutas sin prefijo lo respeten.
 *
 * @param response - Respuesta a la que adjuntar la cookie.
 * @param locale - Idioma vigente en la ruta.
 * @returns La misma respuesta, con la cookie de idioma establecida.
 */
function recordarLocale( response: NextResponse , locale: string ): NextResponse {
  response.cookies.set( LOCALE_COOKIE , locale , {
    path:     "/" ,
    sameSite: "lax" ,
    maxAge:   ( 60 * 60 * 24 * 365 )
  } ) ;

  return( response ) ;
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)" ,
  ] ,
} ;