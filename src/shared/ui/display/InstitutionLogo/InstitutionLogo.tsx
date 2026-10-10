/**
 * @file InstitutionLogo.tsx
 * Componente genérico reutilizable para obtener y renderizar logotipos de marcas.
 * Consulta la identidad de marcas en tiempo real y cachea resultados en memoria.
 */
"use client" ;

// Librerías externas
import React , { useState , useEffect , useMemo } from "react" ;

// Shared
import { getBrandLogoUrl } from "@/shared/services/brand/brandService" ;
import styles              from "./InstitutionLogo.module.css" ;


interface InstitutionLogoProps {
  institution:  string ;
  logoUrl?:     string | null ;
  brandDomain?: string | null ;
  className?:   string ;
  size?:        number ;
}

// Caché en memoria para evitar llamadas redundantes de red por la misma marca en la misma sesión
const logoCache: Record< string , string | null > = {} ;

/**
 * Resuelve sincrónicamente la URL directa del logo si se puede deducir sin llamadas de red.
 * Si se provee brandDomain explícito, resuelve directamente sin recurrir a heurísticas de texto.
 */
function resolveDirectLogo(
  propLogoUrl?: string | null ,
  institution?: string ,
  brandDomain?: string | null
): { url: string | null ; isFallback: boolean } | null {
  if( brandDomain ) {
    const directUrl = getBrandLogoUrl( brandDomain ) ;
    return( { url: directUrl , isFallback: false } ) ;
  }

  if( propLogoUrl ) {
    if( propLogoUrl.startsWith( "http://" ) || propLogoUrl.startsWith( "https://" ) ) {
      return( { url: propLogoUrl , isFallback: false } ) ;
    }
    // Respaldo para filas o llamadas históricas que pasen el dominio en logoUrl
    if( propLogoUrl.includes( "." ) ) {
      return( { url: getBrandLogoUrl( propLogoUrl ) , isFallback: false } ) ;
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

export function InstitutionLogo( {
  institution ,
  logoUrl: propLogoUrl ,
  brandDomain ,
  className = "" ,
  size = 36
}: InstitutionLogoProps ) {
  // 1. Derivar sincrónicamente la URL o fallback si es estático o está en caché
  const direct = useMemo(
    () => resolveDirectLogo( propLogoUrl , institution , brandDomain ) ,
    [ propLogoUrl , institution , brandDomain ]
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
        if( brandDomain ) {
          const url = `/api/brand/identidad?domain=${encodeURIComponent( brandDomain )}` ;
          const res = await fetch( url ) ;
          if( !res.ok ) {
            throw new Error( "Identidad API failed" ) ;
          }

          const data = await res.json() ;
          if( isMounted ) {
            const dataUri = data?.icono?.dataUri || null ;
            logoCache[brandDomain] = dataUri ;
            if( dataUri ) {
              setAsyncState( { url: dataUri , loading: false , error: false } ) ;
            } else {
              setAsyncState( { url: null , loading: false , error: true } ) ;
            }
          }
          return ;
        }

        if( isMounted ) {
          setAsyncState( { url: null , loading: false , error: true } ) ;
        }
      } catch {
        if( isMounted ) {
          if( brandDomain ) {
            logoCache[brandDomain] = null ;
          }
          setAsyncState( { url: null , loading: false , error: true } ) ;
        }
      }
    } ;

    fetchLogo() ;
    return( () => { isMounted = false ; } ) ;
  } , [ institution , brandDomain , direct ] ) ;

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
      {/* eslint-disable-next-line @next/next/no-img-element -- Logo de institución dinámico cargado vía API o CDN externo */}
      <img
        src={logoUrl}
        alt={`Logo of ${institution}`}
        className={styles.logoImage}
        onError={ () => setImgError( true ) }
      />
    </div>
  ) ;
}
