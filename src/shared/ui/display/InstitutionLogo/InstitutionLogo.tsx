/**
 * @file InstitutionLogo.tsx
 * Componente genérico reutilizable para obtener y renderizar logotipos de marcas.
 * Realiza búsquedas asíncronas dinámicas mediante la Brand Search API de Brandfetch en tiempo real,
 * cacheando resultados en memoria para evitar redundancias de red.
 */
"use client" ;

// Librerías externas
import React , { useState , useEffect } from "react" ;

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

export function InstitutionLogo( {institution , logoUrl: propLogoUrl , className = "" , size = 36}: InstitutionLogoProps ) {
  const [ logoUrl , setLogoUrl ] = useState< string | null >( null ) ;
  const [ loading , setLoading ] = useState( true ) ;
  const [ error , setError ]     = useState( false ) ;

  useEffect( () => {
    if( propLogoUrl ) {
      if( propLogoUrl.startsWith( "http://" ) || propLogoUrl.startsWith( "https://" ) ) {
        setLogoUrl( propLogoUrl ) ;
        setLoading( false ) ;
        setError( false ) ;
        return ;
      }
      if( propLogoUrl.includes( "." ) ) {
        const cdnUrl = `https://cdn.brandfetch.io/${propLogoUrl.trim().toLowerCase()}?c=brandfetch` ;
        setLogoUrl( cdnUrl ) ;
        setLoading( false ) ;
        setError( false ) ;
        return ;
      }
    }

    const instLower = institution.toLowerCase() ;

    // Si es dinero físico o contabilidad pura, usar fallback directamente
    if( instLower.includes( "efectivo" ) || instLower.includes( "billetera" ) || instLower.includes( "cash" ) || instLower.includes( "contabilidad" ) ) {
      setLoading( false ) ;
      setError( true ) ;
      return ;
    }

    // ATAJO: Si la institución ingresada es un dominio (ej: mercadopago.com.ar)
    if( institution.includes( "." ) ) {
      const directUrl = getBrandLogoUrl( institution ) ;
      logoCache[institution] = directUrl ;
      setLogoUrl( directUrl ) ;
      setLoading( false ) ;
      return ;
    }

    // Comprobar si ya existe en la caché
    if( logoCache[institution] !== undefined ) {
      setLogoUrl( logoCache[institution] ) ;
      setLoading( false ) ;
      if( !logoCache[institution] ) {
        setError( true ) ;
      }
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
            setLogoUrl( iconUrl ) ;
          } else {
            logoCache[institution] = null ;
            setError( true ) ;
          }
        }
      } catch( e ) {
        if( isMounted ) {
          logoCache[institution] = null ;
          setError( true ) ;
        }
      } finally {
        if( isMounted ) {
          setLoading( false ) ;
        }
      }
    } ;

    fetchLogo() ;
    return( () => { isMounted = false ; } ) ;
  } , [ institution ] ) ;

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

  if( loading ) {
    return( <div className={ `${styles.logoDefault} ${styles.pulse} ${className}` } style={sizeStyle} /> ) ;
  }

  if( error || !logoUrl ) {
    return( renderLocalFallback() ) ;
  }

  return(
    <div className={ `${styles.logoImageWrapper} ${className}` } style={sizeStyle}>
      <img
        src={logoUrl}
        alt={`Logo of ${institution}`}
        className={styles.logoImage}
        onError={ () => setError( true ) }
      />
    </div>
  ) ;
}
