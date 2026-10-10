"use client" ;

// Librerías externas
import { useRouter }                                           from "next/navigation" ;
import React , { useState , useTransition , useEffect } from "react" ;

// Shared
import { Autocomplete , AutocompleteOption }                 from "@/shared/ui/forms/Autocomplete/Autocomplete" ;
import { buscarMarcas , banderaDeDominio , MarcaEncontrada } from "@/shared/services/brand/brandSearch" ;
import type { getDictionary }                                from "@/shared/lib/dictionary" ;
import { FormSelect }                                        from "@/shared/ui/forms/Form/FormSelect" ;
import { Button }                                            from "@/shared/ui/display/Button/Button" ;
import { FormInput }                                         from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }                                         from "@/shared/ui/forms/Form/FormError" ;

// Feature: Accounting
import { createFinancialEntityAction } from "../actions/accountingActions" ;
import styles                          from "./CreateAccountForm.module.css" ;


/** Entidad recién creada, tal como se la devuelve a quien abrió el formulario. */
export interface EntidadCreada {
  id:   string ;
  name: string ;
}

interface CreateFinancialEntityFormProps {
  dict:            Awaited< ReturnType< typeof getDictionary > >["accountsPage"] ;
  /** Se llama con la entidad creada; quien no la necesita puede ignorarla. */
  onSuccess?:      ( entidad: EntidadCreada ) => void ;
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
 * Detecta dinámicamente el país del usuario priorizando la zona horaria (ubicación física),
 * luego el idioma del navegador si figura en las opciones disponibles (COUNTRIES), y
 * finalmente "ar" por defecto.
 */
function detectUserCountry(): string {
  if( typeof navigator === "undefined" ) { return( "ar" ) ; }

  // 1. Intentar obtener de Zona Horaria
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

  // 2. Intentar obtener de navigator.languages (sólo si el código resultante está en COUNTRIES)
  const langs = navigator.languages || [ navigator.language ] ;
  for( const l of langs ) {
    const parts = l.split( "-" ) ;
    if( parts.length > 1 ) {
      const code = parts[1].toLowerCase() ;
      if( ( code.length === 2 ) && isNaN( Number( code ) ) && COUNTRIES.some( ( c ) => c.code === code ) ) {
        return( code ) ;
      }
    }
  }

  return( "ar" ) ;
}

export function CreateFinancialEntityForm( { dict , onSuccess }: CreateFinancialEntityFormProps ) {
  const router                           = useRouter() ;
  const [ isTransitioning , startTrans ] = useTransition() ;
  const [ error , setError ]             = useState< string | null >( null ) ;

  const [ name , setName ]               = useState( "" ) ;
  const [ logo , setLogo ]               = useState( "bank" ) ;
  const [ brandDomain , setBrandDomain ] = useState< string | null >( null ) ;
  const [ color , setColor ]             = useState( "#6366f1" ) ;
  const [ notice , setNotice ]           = useState< string | null >( null ) ;

  const [ selectedCountry , setSelectedCountry ] = useState( () => detectUserCountry() ) ;

  const [ suggestions , setSuggestions ]       = useState< MarcaEncontrada[] >( [] ) ;
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
          const encontradas = await buscarMarcas( name , { paisPrioritario: selectedCountry , limite: 5 } ) ;

          setSuggestions( encontradas ) ;
          setShowDropdown( encontradas.length > 0 ) ;
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
    setBrandDomain( sugg.domain ) ;
    setSuggestions( [] ) ;
    setShowDropdown( false ) ;
    setIsBrandFromApi( true ) ;
    setNotice( null ) ;

    // Obtener color corporativo oficial en segundo plano consultando nuestra API interna
    try {
      const res = await fetch( `/api/brand/identidad?domain=${encodeURIComponent( sugg.domain )}` ) ;
      if( res.ok ) {
        const identidad = await res.json() ;
        if( identidad.color ) {
          setColor( identidad.color ) ;
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
    setBrandDomain( null ) ;
    setLogo( "bank" ) ;
    setColor( "#6366f1" ) ;
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
      // eslint-disable-next-line @next/next/no-img-element -- Icono de marca sin dimensiones fijas conocidas
      ? <img src={sugg.icon} alt={sugg.name} />
      : <span>🌐</span> ,
    trailing: <span>{ banderaDeDominio( sugg.domain ) }</span>
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
      const res = await createFinancialEntityAction( {
        name:        name.trim() ,
        logo:        isBrandFromApi ? "bank" : logo ,
        brandDomain: isBrandFromApi ? brandDomain : null ,
        color ,
      } ) ;

      if( !res.success ) {
        setError( res.error ) ;
        return ;
      }

      setName( "" ) ;
      setBrandDomain( null ) ;
      setLogo( "bank" ) ;
      setColor( "#6366f1" ) ;
      setIsBrandFromApi( false ) ;
      setSuggestions( [] ) ;
      setShowDropdown( false ) ;
      router.refresh() ;
      if( onSuccess ) {
        onSuccess( {id: res.value.id , name: res.value.name} ) ;
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
            ✨ Marca vinculada: <strong>{ name }</strong> <span className={styles.brandLinkedDomain}>({ brandDomain })</span> { brandDomain ? banderaDeDominio( brandDomain ) : "" }
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

      {!isBrandFromApi && (
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

          <FormInput
            label="Color de la Entidad"
            type="color"
            value={color}
            onChange={ ( e ) => setColor( e.target.value ) }
            disabled={isTransitioning}
            required
            containerStyle={{width: "100px"}}
          />
        </div>
      )}

      <Button type="submit" isLoading={isTransitioning} className={styles.submitBtn}>
        { isTransitioning ? "Procesando..." : "Crear Entidad" }
      </Button>
    </form>
  ) ;
}
