/**
 * @file InstitutionLogo.tsx
 * Componente genérico reutilizable para obtener y renderizar logotipos de marcas.
 * Realiza búsquedas asíncronas dinámicas mediante la Brand Search API de Brandfetch en tiempo real,
 * cacheando resultados en memoria para evitar redundancias de red.
 */
"use client" ;

// Librerías externas
import React , { useState , useEffect , useMemo } from "react" ;

// Shared
import { getBrandLogoUrl } from "@/shared/services/brand/brandService" ;
import styles              from "./InstitutionLogo.module.css" ;


interface InstitutionLogoProps {
  institution: string ;
  logoUrl?:    string | null ;
  className?:  string ;
  size?:       number ;
}

// Caché en memoria para evitar llamadas redundantes de red por la misma marca en la misma sesión
const logoCache: Record< string , string | null > = {} ;

/**
 * Resuelve sincrónicamente la URL directa del logo si se puede deducir sin llamadas de red.
 */
function resolveDirectLogo( propLogoUrl?: string | null , institution?: string ): { url: string | null ; isFallback: boolean } | null {
  if( propLogoUrl ) {
    if( propLogoUrl.startsWith( "http://" ) || propLogoUrl.startsWith( "https://" ) ) {
      return( { url: propLogoUrl , isFallback: false } ) ;
    }
    if( propLogoUrl.includes( "." ) ) {
      return( { url: `https://cdn.brandfetch.io/${propLogoUrl.trim().toLowerCase()}?c=brandfetch` , isFallback: false } ) ;
    }
  }

  if( !institution ) {
    return( { url: null , isFallback: true } ) ;
  }

  const instLower = institution.toLowerCase() ;

  // Si es dinero físico o contabilidad pura, usar fallback directamente
  if( instLower.includes( "efectivo" ) || instLower.includes( "billetera" ) || instLower.includes( "cash" ) || instLower.includes( "contabilidad" ) ) {
    return( { url: null , isFallback: true } ) ;
  }

  // Si la institución ingresada es un dominio (ej: mercadopago.com.ar)
  if( institution.includes( "." ) ) {
    const directUrl = getBrandLogoUrl( institution ) ;
    logoCache[institution] = directUrl ;
    return( { url: directUrl , isFallback: false } ) ;
  }

  // Comprobar si ya existe en la caché en memoria
  if( logoCache[institution] !== undefined ) {
    const cached = logoCache[institution] ;
    return( { url: cached , isFallback: !cached } ) ;
  }

  return( null ) ;
}

export function InstitutionLogo( {institution , logoUrl: propLogoUrl , className = "" , size = 36}: InstitutionLogoProps ) {
  // 1. Derivar sincrónicamente la URL o fallback si es estático o está en caché
  const direct = useMemo(
    () => resolveDirectLogo( propLogoUrl , institution ) ,
    [ propLogoUrl , institution ]
  ) ;

  // 2. Estado exclusivo para resultados asíncronos de la API Brandfetch
  const [ asyncState , setAsyncState ] = useState<{ url: string | null ; loading: boolean ; error: boolean }>( () => ( {
    url:     null ,
    loading: direct === null ,
    error:   false
  } ) ) ;

  const [ imgError , setImgError ] = useState( false ) ;

  useEffect( () => {
    if( direct !== null ) {
      return ;
    }

    let isMounted = true ;
    const fetchLogo = async () => {
      try {
        const clientId = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID || "brandfetch" ;
        const url = `https://api.brandfetch.io/v2/search/${encodeURIComponent( institution )}?c=${clientId}` ;

        const res = await fetch( url ) ;
        if( !res.ok ) {
          throw new Error( "Search API failed" ) ;
        }

        const data = await res.json() ;
        if( isMounted ) {
          if( data && ( data.length > 0 ) && data[0].icon ) {
            const iconUrl = data[0].icon ;
            logoCache[institution] = iconUrl ;
            setAsyncState( { url: iconUrl , loading: false , error: false } ) ;
          } else {
            logoCache[institution] = null ;
            setAsyncState( { url: null , loading: false , error: true } ) ;
          }
        }
      } catch {
        if( isMounted ) {
          logoCache[institution] = null ;
          setAsyncState( { url: null , loading: false , error: true } ) ;
        }
      }
    } ;

    fetchLogo() ;
    return( () => { isMounted = false ; } ) ;
  } , [ institution , direct ] ) ;

  const sizeStyle = {
    width:  `${size}px` ,
    height: `${size}px`
  } ;

  const renderLocalFallback = () => {
    const inst = institution.toLowerCase() ;
    if( inst.includes( "galicia" ) ) {
      return( <div className={ `${styles.logoGalicia} ${className}` } style={sizeStyle}>G</div> ) ;
    }
    if( inst.includes( "mercado" ) || inst.includes( "pago" ) ) {
      return( <div className={ `${styles.logoMercadoPago} ${className}` } style={sizeStyle}>MP</div> ) ;
    }
    if( inst.includes( "efectivo" ) || inst.includes( "billetera" ) || inst.includes( "cash" ) ) {
      return( <div className={ `${styles.logoCash} ${className}` } style={sizeStyle}>$</div> ) ;
    }
    return(
      <div className={ `${styles.logoDefault} ${className}` } style={sizeStyle}>
        { institution.substring( 0 , 2 ).toUpperCase() }
      </div>
    ) ;
  } ;

  const loading = direct ? false : asyncState.loading ;
  const error   = direct ? direct.isFallback : asyncState.error ;
  const logoUrl = direct ? direct.url : asyncState.url ;

  if( loading ) {
    return( <div className={ `${styles.logoDefault} ${styles.pulse} ${className}` } style={sizeStyle} /> ) ;
  }

  if( error || !logoUrl || imgError ) {
    return( renderLocalFallback() ) ;
  }

  return(
    <div className={ `${styles.logoImageWrapper} ${className}` } style={sizeStyle}>
      <img
        src={logoUrl}
        alt={`Logo of ${institution}`}
        className={styles.logoImage}
        onError={ () => setImgError( true ) }
      />
    </div>
  ) ;
}
