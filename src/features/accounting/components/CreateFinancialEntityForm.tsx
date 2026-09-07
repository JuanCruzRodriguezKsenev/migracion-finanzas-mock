"use client" ;

// Librerías externas
import { useRouter }                                           from "next/navigation" ;
import React , { useState , useTransition , useEffect } from "react" ;

// Shared
import type { getDictionary }                from "@/shared/lib/dictionary" ;
import { Autocomplete , AutocompleteOption } from "@/shared/ui/forms/Autocomplete/Autocomplete" ;
import { FormSelect }                        from "@/shared/ui/forms/Form/FormSelect" ;
import { Button }                            from "@/shared/ui/display/Button/Button" ;
import { FormInput }                         from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }                         from "@/shared/ui/forms/Form/FormError" ;

// Feature: Accounting
import { createFinancialEntityAction } from "../actions/accountingActions" ;
import styles                          from "./CreateAccountForm.module.css" ;


interface CreateFinancialEntityFormProps {
  dict:       Awaited< ReturnType< typeof getDictionary > >["accountsPage"] ;
  onSuccess?: () => void ;
}

const COUNTRIES = [
  { code: "ar" , name: "Argentina" , flag: "🇦🇷" } ,
  { code: "br" , name: "Brasil" , flag: "🇧🇷" } ,
  { code: "cl" , name: "Chile" , flag: "🇨🇱" } ,
  { code: "uy" , name: "Uruguay" , flag: "🇺🇾" } ,
  { code: "mx" , name: "México" , flag: "🇲🇽" } ,
  { code: "co" , name: "Colombia" , flag: "🇨🇴" } ,
  { code: "pe" , name: "Perú" , flag: "🇵🇪" } ,
  { code: "es" , name: "España" , flag: "🇪🇸" } ,
  { code: "us" , name: "Estados Unidos" , flag: "🇺🇸" } ,
  { code: ""   , name: "Global / Todos" , flag: "🌐" }
] ;

/**
 * Detecta dinámicamente el país del usuario mediante navigator y zona horaria.
 */
function detectUserCountry(): string {
  if( typeof navigator === "undefined" ) { return( "ar" ) ; }

  // 1. Intentar obtener de navigator.languages
  const langs = navigator.languages || [ navigator.language ] ;
  for( const l of langs ) {
    const parts = l.split( "-" ) ;
    if( parts.length > 1 ) {
      const code = parts[1].toLowerCase() ;
      if( ( code.length === 2 ) && isNaN( Number( code ) ) ) {
        return( code ) ;
      }
    }
  }

  // 2. Intentar obtener de Zona Horaria
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "" ;
    const tzLower = tz.toLowerCase() ;
    if( tzLower.includes( "argentina" ) || tzLower.includes( "buenos_aires" ) ) { return( "ar" ) ; }
    if( tzLower.includes( "santiago" ) ) { return( "cl" ) ; }
    if( tzLower.includes( "montevideo" ) ) { return( "uy" ) ; }
    if( tzLower.includes( "bogota" ) ) { return( "co" ) ; }
    if( tzLower.includes( "lima" ) ) { return( "pe" ) ; }
    if( tzLower.includes( "mexico" ) ) { return( "mx" ) ; }
    if( tzLower.includes( "sao_paulo" ) || tzLower.includes( "brazil" ) ) { return( "br" ) ; }
    if( tzLower.includes( "madrid" ) ) { return( "es" ) ; }
  } catch {}

  return( "ar" ) ;
}

/**
 * Resuelve la bandera del país en base a la extensión de dominio.
 * Método 100% dinámico basado en Unicode Offset.
 */
function getDomainCountryFlag( domain: string ): string {
  const parts = domain.toLowerCase().split( "." ) ;
  const tld   = parts[parts.length - 1] ;

  if( tld && ( tld.length === 2 ) ) {
    try {
      const codePoints = tld
        .toUpperCase()
        .split( "" )
        .map( ( char ) => 127397 + char.charCodeAt( 0 ) ) ;
      return( String.fromCodePoint( ...codePoints ) ) ;
    } catch {
      return( "🌐" ) ;
    }
  }

  return( "🌐" ) ;
}

export function CreateFinancialEntityForm( { dict , onSuccess }: CreateFinancialEntityFormProps ) {
  const router                           = useRouter() ;
  const [ isTransitioning , startTrans ] = useTransition() ;
  const [ error , setError ]             = useState< string | null >( null ) ;

  const [ name , setName ]               = useState( "" ) ;
  const [ logo , setLogo ]               = useState( "bank" ) ;
  const [ color , setColor ]             = useState( "#6366f1" ) ;
  const [ balance , setBalance ]         = useState( "" ) ;
  const [ notice , setNotice ]           = useState< string | null >( null ) ;

  const [ selectedCountry , setSelectedCountry ] = useState( () => detectUserCountry() ) ;

  const [ suggestions , setSuggestions ]       = useState< { name: string ; domain: string ; icon?: string }[] >( [] ) ;
  const [ showDropdown , setShowDropdown ]     = useState( false ) ;
  const [ isBrandFromApi , setIsBrandFromApi ] = useState( false ) ;

  // Autocompletado de Marcas con Debounce, Multiconsulta y Filtro Prioritario del País Seleccionado
  useEffect( () => {
    if( (name.trim().length < 3) || isBrandFromApi ) {
      return ;
    }

    const delayDebounceFn = setTimeout( () => {
      const searchBrand = async () => {
        try {
          const clientId = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID || "brandfetch" ;
          const cleanQuery = name.trim() ;

          // Generar consultas concurrentes para jalar variaciones locales y genéricas de la API
          const queries = [ cleanQuery ] ;
          if( !cleanQuery.includes( "." ) ) {
            queries.push( `${cleanQuery}.com` ) ;
            if( selectedCountry ) {
              queries.push( `${cleanQuery}.com.${selectedCountry}` ) ;
              queries.push( `${cleanQuery}.${selectedCountry}` ) ;
            }
          }

          // Ejecutar búsquedas en paralelo
          const responses = await Promise.all(
            queries.map( ( q ) =>
              fetch( `https://api.brandfetch.io/v2/search/${encodeURIComponent( q )}?c=${clientId}` )
                .then( ( r ) => ( r.ok ? r.json() : [] ) )
                .catch( () => [] )
            )
          ) ;

          // Generar placeholders locales y comerciales por defecto basados en el query
          const localPlaceholders = [
            {
              name:   cleanQuery.charAt( 0 ).toUpperCase() + cleanQuery.slice( 1 ) ,
              domain: `${cleanQuery.toLowerCase()}.com`
            }
          ] ;

          if( selectedCountry ) {
            localPlaceholders.push(
              {
                name:   cleanQuery.charAt( 0 ).toUpperCase() + cleanQuery.slice( 1 ) ,
                domain: `${cleanQuery.toLowerCase()}.com.${selectedCountry}`
              } ,
              {
                name:   cleanQuery.charAt( 0 ).toUpperCase() + cleanQuery.slice( 1 ) ,
                domain: `${cleanQuery.toLowerCase()}.${selectedCountry}`
              }
            ) ;
          }

          const combined = [ ...localPlaceholders , ...responses.flat() ] ;

          // Eliminar duplicados por domain (enriqueciendo placeholders si la API devuelve iconos o nombres reales)
          const unique: { name: string ; domain: string ; icon?: string }[] = [] ;
          const seen = new Set< string >() ;
          for( const item of combined ) {
            if( item && item.domain ) {
              const domLower = item.domain.toLowerCase() ;
              if( !seen.has( domLower ) ) {
                seen.add( domLower ) ;
                unique.push( item ) ;
              } else {
                const existingIdx = unique.findIndex( ( u ) => u.domain.toLowerCase() === domLower ) ;
                if( ( existingIdx !== -1 ) && item.icon && !unique[existingIdx].icon ) {
                  unique[existingIdx] = item ;
                }
              }
            }
          }

          // Ordenar priorizando dominios con ccTLD del país seleccionado en el selector
          const sorted = unique.sort( ( a , b ) => {
            const aIsLocal = ( selectedCountry && a.domain.toLowerCase().endsWith( `.${selectedCountry}` ) ) ? 1 : 0 ;
            const bIsLocal = ( selectedCountry && b.domain.toLowerCase().endsWith( `.${selectedCountry}` ) ) ? 1 : 0 ;
            return( bIsLocal - aIsLocal ) ;
          } ) ;

          setSuggestions( sorted.slice( 0 , 5 ) ) ;
          setShowDropdown( sorted.length > 0 ) ;
        } catch( err ) {
          console.error( "Error querying brand search:" , err ) ;
        }
      } ;
      searchBrand() ;
    } , 500 ) ;

    return( () => clearTimeout( delayDebounceFn ) ) ;
  } , [ name , selectedCountry , isBrandFromApi ] ) ;

  const handleSelectSuggestion = async ( sugg: { name: string ; domain: string } ) => {
    setName( sugg.name ) ;
    setLogo( sugg.domain ) ; // Guardamos el dominio en la columna 'logo'
    setSuggestions( [] ) ;
    setShowDropdown( false ) ;
    setIsBrandFromApi( true ) ;
    setNotice( null ) ;

    // Obtener color corporativo oficial en segundo plano consultando nuestra API interna
    try {
      const res = await fetch( `/api/brand?domain=${encodeURIComponent( sugg.domain )}` ) ;
      if( res.ok ) {
        const brandData = await res.json() ;
        if( brandData.primaryColor ) {
          setColor( brandData.primaryColor ) ;
        } else {
          setNotice( dict.brandColorFetchError ) ;
        }
      } else {
        setNotice( dict.brandColorFetchError ) ;
      }
    } catch( err ) {
      console.error( "Error fetching brand color details:" , err ) ;
      setNotice( dict.brandColorFetchError ) ;
    }
  } ;

  const handleNameChange = ( val: string ) => {
    setName( val ) ;
    if( isBrandFromApi ) {
      setIsBrandFromApi( false ) ;
    }
    if( val.trim().length < 3 ) {
      setSuggestions( [] ) ;
      setShowDropdown( false ) ;
    }
  } ;

  const handleClearBrandLink = () => {
    setIsBrandFromApi( false ) ;
    setName( "" ) ;
    setLogo( "bank" ) ;
    setColor( "#6366f1" ) ;
    setBalance( "" ) ;
    setNotice( null ) ;
    setSuggestions( [] ) ;
    setShowDropdown( false ) ;
  } ;

  // Adaptar las sugerencias de marca al contrato genérico de Autocomplete
  const autocompleteOptions: AutocompleteOption[] = suggestions.map( ( sugg ) => ( {
    key:      sugg.domain ,
    label:    sugg.name ,
    sublabel: sugg.domain ,
    icon:     sugg.icon
      // eslint-disable-next-line @next/next/no-img-element -- Icono externo de CDN/Brandfetch sin dimensiones fijas conocidas
      ? <img src={sugg.icon} alt={sugg.name} />
      : <span>🌐</span> ,
    trailing: <span>{ getDomainCountryFlag( sugg.domain ) }</span>
  } ) ) ;

  const handleAutocompleteSelect = ( option: AutocompleteOption ) => {
    const sugg = suggestions.find( ( s ) => s.domain === option.key ) ;
    if( sugg ) { handleSelectSuggestion( sugg ) ; }
  } ;

  const handleSubmit = ( e: React.FormEvent ) => {
    e.preventDefault() ;
    setError( null ) ;

    if( !name.trim() ) {
      setError( dict.entityRequiredError ) ;
      return ;
    }

    startTrans( async () => {
      const rawCents = Math.floor( ( Number( balance ) || 0 ) * 100 ) ;
      const res = await createFinancialEntityAction( {
        name:    name.trim() ,
        logo ,
        color ,
        balance: rawCents
      } ) ;

      if( res.success ) {
        setName( "" ) ;
        setLogo( "bank" ) ;
        setColor( "#6366f1" ) ;
        setBalance( "" ) ;
        setIsBrandFromApi( false ) ;
        setSuggestions( [] ) ;
        setShowDropdown( false ) ;
        router.refresh() ;
        if( onSuccess ) {
          onSuccess() ;
        }
      } else {
        setError( res.error ) ;
      }
    } ) ;
  } ;

  return(
    <form className={styles.form} onSubmit={handleSubmit} autoComplete="off">
      <h3 className={styles.formTitle}>Registrar Entidad Financiera</h3>

      <FormError error={error || ""} />

      {isBrandFromApi ? (
        <div className={styles.brandLinkedBanner}>
          <span>
            ✨ Marca vinculada: <strong>{ name }</strong> <span className={styles.brandLinkedDomain}>({ logo })</span> { getDomainCountryFlag( logo ) }
          </span>
          <button
            type="button"
            onClick={handleClearBrandLink}
            className={styles.brandLinkedChangeBtn}
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div className={styles.brandSearchRow}>
          <div className={styles.nameField}>
            <Autocomplete
              label="Nombre o Dominio de la Entidad"
              placeholder="Ej: galicia.com.ar, itau.com.br, Mercado Pago"
              value={name}
              onChange={handleNameChange}
              options={autocompleteOptions}
              onSelect={handleAutocompleteSelect}
              isOpen={showDropdown}
              onOpenChange={setShowDropdown}
              disabled={isTransitioning}
              required
            />
          </div>

          <div className={styles.countryField}>
            <FormSelect
              label="País de Búsqueda"
              value={selectedCountry}
              onChange={ ( e ) => setSelectedCountry( e.target.value ) }
              disabled={isTransitioning}
              required
            >
              {COUNTRIES.map( ( c ) => (
                <option key={c.code} value={c.code}>
                  { c.flag } { c.name }
                </option>
              ) )}
            </FormSelect>
          </div>
        </div>
      )}

      {notice && (
        <div className={styles.notice}>
          ⚠️ {notice}
        </div>
      )}

      <div className={styles.row}>
        <FormInput
          label="Saldo Inicial de la Cuenta por Defecto"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={balance}
          onChange={ ( e ) => setBalance( e.target.value ) }
          disabled={isTransitioning}
          required
        />
      </div>

      <div className={styles.row}>
        <FormSelect
          label="Icono / Logo de Respaldo"
          value={logo}
          onChange={ ( e ) => setLogo( e.target.value ) }
          disabled={isTransitioning}
          required
        >
          <option value="bank">Banco / Entidad Financiera</option>
          <option value="wallet">Billetera Virtual</option>
          <option value="cash">Efectivo / Caja</option>
          <option value="credit-card">Tarjeta de Crédito</option>
        </FormSelect>

        {!isBrandFromApi && (
          <FormInput
            label="Color de la Entidad"
            type="color"
            value={color}
            onChange={ ( e ) => setColor( e.target.value ) }
            disabled={isTransitioning}
            required
            containerStyle={{width: "100px"}}
          />
        )}
      </div>

      <Button type="submit" isLoading={isTransitioning} className={styles.submitBtn}>
        { isTransitioning ? "Procesando..." : "Crear Entidad" }
      </Button>
    </form>
  ) ;
}
