/**
 * @file AddSubscriptionModal.tsx
 * Modal de alta/edición de suscripciones con buscador de marcas (Brandfetch),
 * selector de país, vista previa de la tarjeta del treemap y panel de información
 * enriquecida de la marca en pestañas (info, paleta, contexto y productos).
 * El precio se ingresa en pesos y se convierte a centavos enteros al enviar.
 */
"use client" ;

// Librerías externas
import React , { useState , useMemo , useEffect } from "react" ;

// Shared
import { Autocomplete , AutocompleteOption } from "@/shared/ui/forms/Autocomplete/Autocomplete" ;
import type { BrandMetadata }                from "@/shared/services/brand/brandService" ;
import type { getDictionary }                from "@/shared/lib/dictionary" ;
import { FormSelect }                        from "@/shared/ui/forms/Form/FormSelect" ;
import { FormInput }                         from "@/shared/ui/forms/Form/FormInput" ;
import { Button }                            from "@/shared/ui/display/Button/Button" ;
import { Modal }                             from "@/shared/ui/feedback/Modal/Modal" ;

// Feature: Subscriptions
import { SubscriptionFormData , SubscriptionCategory , SubscriptionFrequency , SubscriptionWithStats } from "../types" ;
import countriesData                                                                                   from "../data/countries.json" ;
import { SubscriptionIcon }                                                                            from "./SubscriptionIcon" ;
import { getLogoConfig }                                                                               from "../utils/logoMap" ;
import styles                                                                                          from "./AddSubscriptionModal.module.css" ;


type SubscriptionsDict = Awaited< ReturnType< typeof getDictionary > >["subscriptionsPage"] ;

interface Country {
  code:  string ;
  label: string ;
  name:  string ;
  tld:   string ;
}

interface BrandSuggestion {
  kind:      "brand" ;
  name:      string ;
  domain:    string ;
  logoKey?:  string ;
  color?:    string ;
  category?: SubscriptionCategory ;
}

interface ActionSuggestion {
  kind:  "search-online" | "custom" ;
  query: string ;
}

type Suggestion = BrandSuggestion | ActionSuggestion ;

interface AddSubscriptionModalProps {
  open:        boolean ;
  onClose:     () => void ;
  onAdd:       ( data: SubscriptionFormData ) => void ;
  onUpdate?:   ( id: string , data: Partial<SubscriptionFormData> ) => void ;
  editingData?: SubscriptionWithStats ;
  dict:        SubscriptionsDict ;
}

const COUNTRY_STORAGE_KEY = "finanzia-subscriptions-country" ;

const CUSTOM_COLORS = [
  "#DBEAFE" , // Celeste
  "#FFE4E6" , // Rosa
  "#FEF9C3" , // Amarillo
  "#EDE9FE" , // Violeta
  "#FDE8D8" , // Naranja
  "#E0F2FE" , // Cielo
  "#FCE7F3" , // Rosado
  "#FEF3C7" , // Ámbar
  "#D1FAE5" , // Verde
  "#F3F4F6" , // Gris
] ;

const CUSTOM_ICON_KEYS = [ "gym" , "home" , "bolt" , "book" , "coffee" , "car" , "heart" , "gift" , "default" ] ;

const POPULAR_BRANDS: BrandSuggestion[] = [
  { kind: "brand" , name: "Netflix"              , domain: "netflix.com"    , color: "#E50914" , logoKey: "https://logo.clearbit.com/netflix.com"    , category: "entertainment" } ,
  { kind: "brand" , name: "Spotify"              , domain: "spotify.com"    , color: "#1DB954" , logoKey: "https://logo.clearbit.com/spotify.com"    , category: "entertainment" } ,
  { kind: "brand" , name: "YouTube Premium"      , domain: "youtube.com"    , color: "#FF0000" , logoKey: "https://logo.clearbit.com/youtube.com"    , category: "entertainment" } ,
  { kind: "brand" , name: "Disney+"              , domain: "disneyplus.com" , color: "#113CCF" , logoKey: "https://logo.clearbit.com/disneyplus.com" , category: "entertainment" } ,
  { kind: "brand" , name: "Amazon Prime"         , domain: "amazon.com"     , color: "#FF9900" , logoKey: "https://logo.clearbit.com/amazon.com"     , category: "entertainment" } ,
  { kind: "brand" , name: "ChatGPT Plus"         , domain: "openai.com"     , color: "#10A37F" , logoKey: "https://logo.clearbit.com/openai.com"     , category: "productivity"  } ,
  { kind: "brand" , name: "Adobe Creative Cloud" , domain: "adobe.com"      , color: "#FF0000" , logoKey: "https://logo.clearbit.com/adobe.com"      , category: "design"        } ,
  { kind: "brand" , name: "Figma"                , domain: "figma.com"      , color: "#F24E1E" , logoKey: "https://logo.clearbit.com/figma.com"      , category: "design"        } ,
  { kind: "brand" , name: "Notion"               , domain: "notion.so"      , color: "#000000" , logoKey: "https://logo.clearbit.com/notion.so"      , category: "productivity"  } ,
  { kind: "brand" , name: "iCloud+"              , domain: "apple.com"      , color: "#000000" , logoKey: "https://logo.clearbit.com/apple.com"      , category: "storage"       } ,
  { kind: "brand" , name: "NordVPN"              , domain: "nordvpn.com"    , color: "#4687FF" , logoKey: "https://logo.clearbit.com/nordvpn.com"    , category: "security"      } ,
  { kind: "brand" , name: "GitHub"               , domain: "github.com"     , color: "#000000" , logoKey: "https://logo.clearbit.com/github.com"     , category: "other"         } ,
  { kind: "brand" , name: "Slack"                , domain: "slack.com"      , color: "#4A154B" , logoKey: "https://logo.clearbit.com/slack.com"      , category: "productivity"  } ,
  { kind: "brand" , name: "Canva"                , domain: "canva.com"      , color: "#00C4CC" , logoKey: "https://logo.clearbit.com/canva.com"      , category: "design"        } ,
] ;

const SOCIAL_ICONS: Record< string , string > = {
  youtube:   "📺" ,
  twitter:   "🐦" ,
  instagram: "📸" ,
  linkedin:  "💼" ,
  facebook:  "👥" ,
  github:    "🐙" ,
} ;

/**
 * Resuelve el país inicial del buscador: preferencia guardada → zona horaria → Argentina.
 * Solo corre en cliente (el modal se carga con ssr: false).
 */
function resolveInitialCountry(): Country {
  const countries = countriesData as Country[] ;

  try {
    const savedCode = localStorage.getItem( COUNTRY_STORAGE_KEY ) ;
    if( savedCode ){
      const found = countries.find( ( c ) => c.code === savedCode ) ;
      if( found ){ return( found ) ; }
    }
  } catch {
    // localStorage bloqueado — continuar con la detección por zona horaria
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.toLowerCase() ;

    const tzMap: [ string , string ][] = [
      [ "buenos_aires" , "AR" ] ,
      [ "argentina"    , "AR" ] ,
      [ "sao_paulo"    , "BR" ] ,
      [ "brazil"       , "BR" ] ,
      [ "madrid"       , "ES" ] ,
      [ "mexico"       , "MX" ] ,
      [ "bogota"       , "CO" ] ,
      [ "santiago"     , "CL" ] ,
      [ "lima"         , "PE" ] ,
      [ "montevideo"   , "UY" ] ,
      [ "new_york"     , "US" ] ,
      [ "los_angeles"  , "US" ] ,
      [ "chicago"      , "US" ] ,
    ] ;

    const match = tzMap.find( ( [ fragment ] ) => tz.includes( fragment ) ) ;
    if( match ){
      const found = countries.find( ( c ) => c.code === match[1] ) ;
      if( found ){ return( found ) ; }
    }
  } catch {
    // Intl no disponible — usar el default
  }

  return( countries[0] ) ;
}

/**
 * Extrae el dominio de un logoKey remoto para reconsultar los metadatos de la marca.
 */
function extractDomain( logoKey: string , fallbackName: string ): string {
  const cleanKey = logoKey.includes( "|" ) ? logoKey.split( "|" )[0] : logoKey ;

  try {
    if( cleanKey.includes( "logo.clearbit.com/" ) ){
      return( cleanKey.split( "logo.clearbit.com/" )[1] ) ;
    }
    return( new URL( cleanKey ).hostname ) ;
  } catch {
    return( `${fallbackName.toLowerCase().replace( /\s+/g , "" )}.com` ) ;
  }
}

/**
 * Modal de alta y edición de suscripciones con integración de marcas Brandfetch.
 */
export function AddSubscriptionModal( {
  open ,
  onClose ,
  onAdd ,
  onUpdate ,
  editingData ,
  dict ,
}: AddSubscriptionModalProps ) {
  const isEditing = !!editingData ;

  const [ form , setForm ] = useState< SubscriptionFormData >( () => {
    return( isEditing && editingData ? {
      name:      editingData.name ,
      amount:    editingData.amount ,
      frequency: editingData.frequency as SubscriptionFrequency ,
      logoKey:   editingData.logoKey ,
      color:     editingData.color ,
      category:  editingData.category as SubscriptionCategory ,
    } : {
      name:      "" ,
      amount:    0 ,
      frequency: "monthly" ,
      logoKey:   "default" ,
      color:     CUSTOM_COLORS[0] ,
      category:  "other" ,
    } ) ;
  } ) ;

  // El precio se edita como texto en pesos y se convierte a centavos al enviar
  const [ priceInput , setPriceInput ] = useState( () => (
    isEditing && editingData ? String( editingData.amount / 100 ) : ""
  ) ) ;

  const [ errors , setErrors ]                     = useState< Partial< Record<"name" | "price" , string> > >( {} ) ;
  const [ searchTerm , setSearchTerm ]             = useState( "" ) ;
  const [ showSuggestions , setShowSuggestions ]   = useState( false ) ;
  const [ isSearching , setIsSearching ]           = useState( false ) ;
  const [ isOnlineResults , setIsOnlineResults ]   = useState( false ) ;
  const [ onlineSuggestions , setOnlineSuggestions ] = useState< Suggestion[] >( [] ) ;
  const [ brandDetails , setBrandDetails ]         = useState< BrandMetadata | null >( null ) ;
  const [ activeBrandTab , setActiveBrandTab ]     = useState< "info" | "colors" | "context" | "products" >( "info" ) ;
  const [ selectedCountry , setSelectedCountry ]   = useState< Country >( resolveInitialCountry ) ;

  const countries = countriesData as Country[] ;

  const isBrand        = ( form.logoKey.startsWith( "http://" ) || form.logoKey.startsWith( "https://" ) ) ;
  const activeColor    = ( form.color || "#6B7280" ) ;
  const selectedConfig = getLogoConfig( form.logoKey ) ;

  // Cargar detalles de marca al montar cuando se edita una suscripción con logo remoto
  useEffect( () => {
    if( isEditing && editingData ){
      const isBrandLogo = ( editingData.logoKey.startsWith( "http://" ) || editingData.logoKey.startsWith( "https://" ) ) ;

      if( isBrandLogo ){
        const domain = extractDomain( editingData.logoKey , editingData.name ) ;

        fetch( `/api/brand?domain=${encodeURIComponent( domain )}` )
          .then( ( res ) => ( res.ok ? res.json() : null ) )
          .then( ( data: BrandMetadata | null ) => {
            if( data ){ setBrandDetails( data ) ; }
          } )
          .catch( () => {
            // Sin detalles de marca: el formulario sigue siendo editable
          } ) ;
      }
    }
  } , [ isEditing , editingData ] ) ;

  // Sugerencias visibles: resultados online (si los hay) o filtro local + acciones
  const suggestions = useMemo< Suggestion[] >( () => {
    if( isOnlineResults ){ return( onlineSuggestions ) ; }

    const query = searchTerm.trim().toLowerCase() ;
    if( !query ){ return( [] ) ; }

    const filtered = POPULAR_BRANDS.filter(
      ( b ) => b.name.toLowerCase().includes( query ) || b.domain.toLowerCase().includes( query )
    ) ;

    return( [
      ...filtered ,
      { kind: "search-online" , query: searchTerm } ,
      { kind: "custom"        , query: searchTerm } ,
    ] ) ;
  } , [ searchTerm , isOnlineResults , onlineSuggestions ] ) ;

  const autocompleteOptions = useMemo< AutocompleteOption[] >( () => (
    suggestions.map( ( s ) => {
      if( s.kind === "brand" ){
        return( {
          key:      `brand:${s.domain}` ,
          label:    ( s.name.toLowerCase() === s.domain.toLowerCase() ) ? s.domain : s.name ,
          sublabel: s.domain ,
          icon:     s.logoKey ? <img src={s.logoKey} alt="" /> : <span>🌐</span> ,
        } ) ;
      }

      const prefix = ( s.kind === "search-online" ) ? dict.searchOnlinePrefix : dict.customOptionPrefix ;

      return( {
        key:   `${s.kind}:${s.query}` ,
        label: `${prefix} "${s.query}"` ,
        icon:  <span>{ s.kind === "search-online" ? "🔍" : "✏️" }</span> ,
      } ) ;
    } )
  ) , [ suggestions , dict.searchOnlinePrefix , dict.customOptionPrefix ] ) ;

  /**
   * Aplica una marca seleccionada consultando sus metadatos completos en /api/brand.
   */
  async function selectBrand( brand: BrandSuggestion ) {
    setIsSearching( true ) ;
    setShowSuggestions( false ) ;
    setSearchTerm( "" ) ;
    setIsOnlineResults( false ) ;

    try {
      const res  = await fetch( `/api/brand?domain=${encodeURIComponent( brand.domain || brand.name )}` ) ;
      const data: BrandMetadata | null = ( res.ok ? await res.json() : null ) ;

      if( data ){
        const lightLogo = data.logos?.find( ( l ) => l.theme === "light" ) ;
        const darkLogo  = data.logos?.find( ( l ) => l.theme === "dark" ) ;

        const defaultLogoKey = ( lightLogo && darkLogo )
          ? `${lightLogo.src}|${darkLogo.src}`
          : data.logoUrl ;

        setForm( ( f ) => ( {
          ...f ,
          name:     data.name ,
          logoKey:  defaultLogoKey ,
          color:    data.primaryColor ,
          category: ( brand.category || f.category ) ,
        } ) ) ;
        setBrandDetails( data ) ;
      } else {
        setForm( ( f ) => ( {
          ...f ,
          name:     brand.name ,
          logoKey:  brand.logoKey || "default" ,
          color:    brand.color || CUSTOM_COLORS[0] ,
          category: ( brand.category || f.category ) ,
        } ) ) ;
        setBrandDetails( null ) ;
      }
    } catch {
      setBrandDetails( null ) ;
    } finally {
      setIsSearching( false ) ;
    }
  }

  /**
   * Busca marcas en la web (Brandfetch Search API) priorizando el ccTLD del país elegido.
   */
  async function selectSearchOnline( query: string ) {
    setIsSearching( true ) ;

    try {
      const clientId   = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID || "brandfetch" ;
      const cleanQuery = query.trim() ;
      const hasSpaces  = cleanQuery.includes( " " ) ;

      // Variaciones de búsqueda: literal, .com y ccTLD del país seleccionado
      const queries = [ cleanQuery ] ;
      if( !cleanQuery.includes( "." ) ){
        queries.push( `${cleanQuery}.com` ) ;
        if( selectedCountry.tld && (selectedCountry.tld !== ".com") ){
          queries.push( `${cleanQuery}${selectedCountry.tld}` ) ;
        }
      }

      interface SearchResult { name?: string ; domain?: string ; icon?: string }

      const [ responses , directMatch ] = await Promise.all( [
        Promise.all(
          queries.map( ( q ) =>
            fetch( `https://api.brandfetch.io/v2/search/${encodeURIComponent( q )}?c=${clientId}` )
              .then( ( r ) => ( r.ok ? r.json() : [] ) )
              .catch( () => [] )
          )
        ) ,
        hasSpaces
          ? Promise.resolve( null )
          : fetch( `/api/brand?domain=${encodeURIComponent( cleanQuery )}` )
              .then( ( r ) => ( r.ok ? r.json() as Promise<BrandMetadata> : null ) )
              .catch( () => null ) ,
      ] ) ;

      const next: Suggestion[] = [] ;

      // 1. Coincidencia directa de dominio primero (ej: "bbva" → bbva.com)
      if( directMatch && directMatch.name ){
        next.push( {
          kind:    "brand" ,
          name:    directMatch.name ,
          domain:  directMatch.domain ,
          logoKey: directMatch.logoUrl ,
          color:   directMatch.primaryColor ,
        } ) ;
      }

      // 2. Resultados de búsqueda, evitando duplicados por dominio
      const seen = new Set< string >( directMatch ? [ directMatch.domain.toLowerCase() ] : [] ) ;

      for( const result of (responses.flat() as SearchResult[]) ){
        if( result && result.domain && !seen.has( result.domain.toLowerCase() ) ){
          seen.add( result.domain.toLowerCase() ) ;
          next.push( {
            kind:    "brand" ,
            name:    result.name || result.domain ,
            domain:  result.domain ,
            logoKey: result.icon ,
          } ) ;
        }
      }

      if( next.length > 0 ){
        next.push( { kind: "custom" , query: cleanQuery } ) ;

        setOnlineSuggestions( next ) ;
        setIsOnlineResults( true ) ;
        setShowSuggestions( true ) ;
      } else {
        // Sin resultados: caer directamente a la opción personalizada
        selectCustom( cleanQuery ) ;
      }
    } finally {
      setIsSearching( false ) ;
    }
  }

  /**
   * Configura el formulario para una suscripción personalizada sin marca.
   */
  function selectCustom( query: string ) {
    setForm( ( f ) => ( {
      ...f ,
      name:    query ,
      logoKey: "gym" ,
      color:   CUSTOM_COLORS[0] ,
    } ) ) ;
    setBrandDetails( null ) ;
    setSearchTerm( "" ) ;
    setShowSuggestions( false ) ;
    setIsOnlineResults( false ) ;
  }

  function handleAutocompleteSelect( option: AutocompleteOption ) {
    const [ kind ] = option.key.split( ":" ) ;

    if( kind === "brand" ){
      const domain = option.key.slice( "brand:".length ) ;
      const brand  = suggestions.find( ( s ) => (s.kind === "brand") && (s.domain === domain) ) as BrandSuggestion | undefined ;
      if( brand ){ selectBrand( brand ) ; }
    } else if( kind === "search-online" ){
      selectSearchOnline( option.key.slice( "search-online:".length ) ) ;
    } else if( kind === "custom" ){
      selectCustom( option.key.slice( "custom:".length ) ) ;
    }
  }

  function handleSearchChange( value: string ) {
    setSearchTerm( value ) ;
    setIsOnlineResults( false ) ;
    setShowSuggestions( true ) ;
  }

  function handleCountryChange( code: string ) {
    const found = countries.find( ( c ) => c.code === code ) ;
    if( found ){
      setSelectedCountry( found ) ;
      try {
        localStorage.setItem( COUNTRY_STORAGE_KEY , found.code ) ;
      } catch {
        // localStorage bloqueado — la preferencia no se persiste
      }
    }
  }

  function validate(): boolean {
    const next: typeof errors = {} ;
    const parsedPrice = parseFloat( priceInput ) ;

    if( !form.name.trim() ){ next.name = dict.errorNameRequired ; }
    if( !(parsedPrice > 0) ){ next.price = dict.errorPriceRequired ; }

    setErrors( next ) ;
    return( Object.keys( next ).length === 0 ) ;
  }

  function handleSubmit() {
    if( !validate() ){ return ; }

    const data: SubscriptionFormData = {
      ...form ,
      name:   form.name.trim() ,
      amount: Math.round( parseFloat( priceInput ) * 100 ) ,
    } ;

    if( isEditing && editingData && onUpdate ){
      onUpdate( editingData.id , data ) ;
    } else {
      onAdd( data ) ;
    }
    onClose() ;
  }

  const previewPrice = ( parseFloat( priceInput ) || 0 ).toFixed( 2 ) ;

  const cycleLabels: Record< SubscriptionFrequency , string > = {
    weekly:    dict.cycleWeekly ,
    monthly:   dict.cycleMonthly ,
    quarterly: dict.cycleQuarterly ,
    yearly:    dict.cycleYearly ,
    custom:    dict.cycleMonthly ,
  } ;

  const categoryOptions: { value: SubscriptionCategory ; label: string }[] = [
    { value: "design"        , label: dict.categoryDesign        } ,
    { value: "productivity"  , label: dict.categoryProductivity  } ,
    { value: "entertainment" , label: dict.categoryEntertainment } ,
    { value: "fitness"       , label: dict.categoryFitness       } ,
    { value: "security"      , label: dict.categorySecurity      } ,
    { value: "storage"       , label: dict.categoryStorage       } ,
    { value: "other"         , label: dict.categoryOther         } ,
  ] ;

  const footer = (
    <div className={styles.modalFooter}>
      <Button
        type="button"
        variant="secondary"
        onClick={onClose}
        disabled={isSearching}
      >
        { dict.cancelBtn }
      </Button>
      <Button
        type="submit"
        variant="primary"
        form="add-subscription-form"
        disabled={isSearching}
      >
        { isEditing ? dict.saveBtn : dict.createBtn }
      </Button>
    </div>
  ) ;

  return(
    <Modal
      isOpen={open}
      onClose={onClose}
      title={ isEditing ? dict.modalTitleEdit : dict.modalTitleNew }
      size="large"
      footer={footer}
    >
      <form
        id="add-subscription-form"
        onSubmit={ ( e ) => {
          e.preventDefault() ;
          handleSubmit() ;
        } }
        className={styles.gridContainer}
      >
        {/* COLUMNA IZQUIERDA: buscador, vista previa y detalles de marca */}
        <div className={styles.leftCol}>
          <div className={styles.searchContainer}>
            <span className={styles.fieldLabel}>{ dict.searchLabel }</span>
            <div className={styles.searchRow}>
              <select
                className={styles.countrySelect}
                value={selectedCountry.code}
                onChange={ ( e ) => handleCountryChange( e.target.value ) }
                disabled={isSearching}
                aria-label={dict.countryLabel}
              >
                {countries.map( ( c ) => (
                  <option key={c.code} value={c.code}>
                    { c.label }
                  </option>
                ) )}
              </select>
              <div className={styles.searchField}>
                <Autocomplete
                  placeholder={dict.searchPlaceholder}
                  value={searchTerm}
                  onChange={handleSearchChange}
                  options={autocompleteOptions}
                  onSelect={handleAutocompleteSelect}
                  isOpen={ showSuggestions && (autocompleteOptions.length > 0) }
                  onOpenChange={setShowSuggestions}
                  disabled={isSearching}
                />
              </div>
            </div>
            <span className={styles.searchHelperText}>
              { dict.searchHelper }
            </span>
          </div>

          {/* Vista previa de la tarjeta */}
          <div className={styles.previewContainer}>
            <span className={ `${styles.fieldLabel} ${styles.fieldLabelLeft}` }>
              { dict.previewLabel }
            </span>
            <div
              className={ `${styles.treemapPreviewCard} brand-adaptive-surface` }
              style={ {
                "--user-brand-color": activeColor ,
                color:                activeColor ,
              } as React.CSSProperties }
            >
              <div className={styles.previewCardHeader}>
                <div className={styles.previewIconWrapper}>
                  <SubscriptionIcon logoKey={form.logoKey} size={18} />
                </div>
                {isBrand && (
                  <span className={styles.previewBrandPill}>
                    { dict.brandPill }
                  </span>
                )}
              </div>
              <div className={styles.previewCardBody}>
                <p className={styles.previewCardName}>
                  { form.name || dict.previewNoName }
                </p>
                <p className={styles.previewCardPrice}>
                  ${ previewPrice }
                </p>
                <p className={styles.previewCardPeriod}>
                  { cycleLabels[form.frequency] }
                </p>
              </div>
            </div>
          </div>

          {/* Detalles enriquecidos de la marca (Brandfetch) */}
          {brandDetails && (
            <div className={styles.brandDetailsBox}>
              <div className={styles.brandTabs}>
                <button
                  type="button"
                  className={ `${styles.brandTabBtn} ${activeBrandTab === "info" ? styles.brandTabBtnActive : ""}` }
                  onClick={ () => setActiveBrandTab( "info" ) }
                >
                  { dict.tabInfo }
                </button>
                <button
                  type="button"
                  className={ `${styles.brandTabBtn} ${activeBrandTab === "colors" ? styles.brandTabBtnActive : ""}` }
                  onClick={ () => setActiveBrandTab( "colors" ) }
                >
                  { dict.tabColors }
                </button>
                <button
                  type="button"
                  className={ `${styles.brandTabBtn} ${activeBrandTab === "context" ? styles.brandTabBtnActive : ""}` }
                  onClick={ () => setActiveBrandTab( "context" ) }
                >
                  { dict.tabContext }
                </button>
                <button
                  type="button"
                  className={ `${styles.brandTabBtn} ${activeBrandTab === "products" ? styles.brandTabBtnActive : ""}` }
                  onClick={ () => setActiveBrandTab( "products" ) }
                >
                  { dict.tabProducts }
                </button>
              </div>

              {activeBrandTab === "info" && (
                <div className={styles.brandTabContent}>
                  {brandDetails.tagline && (
                    <p className={styles.detailTagline}>“{ brandDetails.tagline }”</p>
                  )}
                  {brandDetails.description && (
                    <p className={styles.detailDesc}>{ brandDetails.description }</p>
                  )}
                  {brandDetails.longDescription && (brandDetails.longDescription !== brandDetails.description) && (
                    <p className={ `${styles.detailDesc} ${styles.brandDetailsOpacity}` }>{ brandDetails.longDescription }</p>
                  )}

                  <div className={styles.detailsGrid}>
                    {brandDetails.industry && (
                      <div className={styles.detailGridItem}>
                        <span className={styles.detailItemLabel}>{ dict.industryLabel }</span>
                        <span className={styles.detailItemValue}>{ brandDetails.industry }</span>
                      </div>
                    )}
                    {brandDetails.location && (
                      <div className={styles.detailGridItem}>
                        <span className={styles.detailItemLabel}>{ dict.hqLabel }</span>
                        <span className={styles.detailItemValue}>{ brandDetails.location }</span>
                      </div>
                    )}
                    {brandDetails.foundedYear && (
                      <div className={styles.detailGridItem}>
                        <span className={styles.detailItemLabel}>{ dict.foundedLabel }</span>
                        <span className={styles.detailItemValue}>{ brandDetails.foundedYear }</span>
                      </div>
                    )}
                    {brandDetails.companySize && (
                      <div className={styles.detailGridItem}>
                        <span className={styles.detailItemLabel}>{ dict.sizeLabel }</span>
                        <span className={styles.detailItemValue}>{ brandDetails.companySize }</span>
                      </div>
                    )}
                    {brandDetails.qualityScore !== undefined && (
                      <div className={ `${styles.detailGridItem} ${styles.qualityDetailsContainer}` }>
                        <div className={styles.qualityRowHeader}>
                          <span className={styles.detailItemLabel}>{ dict.qualityLabel }</span>
                          <span className={styles.detailItemValue}>{ brandDetails.qualityScore }%</span>
                        </div>
                        <div className={styles.qualityBarContainer}>
                          <div className={styles.qualityBar} style={ {width: `${brandDetails.qualityScore}%`} } />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeBrandTab === "colors" && (
                <div className={styles.brandTabContent}>
                  <p className={ `${styles.detailDesc} ${styles.boldHeading}` }>
                    { dict.paletteTitle }
                  </p>
                  <p className={ `${styles.detailDesc} ${styles.opacityMuted}` }>
                    { dict.paletteHint }
                  </p>
                  <div className={styles.colorSwatchGrid}>
                    {brandDetails.colors?.map( ( c ) => {
                      const isActive = ( form.color === c.hex ) ;
                      return(
                        <button
                          key={ `${c.hex}-${c.name}` }
                          type="button"
                          className={ `${styles.colorSwatchCard} ${isActive ? styles.colorSwatchCardActive : ""}` }
                          onClick={ () => setForm( ( f ) => ( {...f , color: c.hex} ) ) }
                        >
                          <div className={styles.colorSwatchBox} style={ {backgroundColor: c.hex} } />
                          <div className={styles.colorSwatchInfo}>
                            <span className={styles.colorSwatchName}>{ c.name || "brand" }</span>
                            <span className={styles.colorSwatchHex}>{ c.hex }</span>
                          </div>
                        </button>
                      ) ;
                    } )}
                  </div>

                  {/* Selector de logotipos oficiales + icono genérico */}
                  {brandDetails.logos && (brandDetails.logos.length > 0) && (
                    <div className={styles.logoPickerSection}>
                      <p className={ `${styles.detailDesc} ${styles.boldHeading}` }>
                        { dict.logoPickerTitle }
                      </p>
                      <div className={styles.logoPickerGrid}>
                        {( () => {
                          const lightLogo = brandDetails.logos.find( ( l ) => l.theme === "light" ) ;
                          const darkLogo  = brandDetails.logos.find( ( l ) => l.theme === "dark" ) ;

                          if( lightLogo && darkLogo && (brandDetails.logos.length > 1) ){
                            const combinedKey = `${lightLogo.src}|${darkLogo.src}` ;
                            const isSelected  = ( form.logoKey === combinedKey ) ;
                            return(
                              <button
                                type="button"
                                className={ `${styles.logoPickerBtn} ${isSelected ? styles.logoPickerBtnActive : ""}` }
                                onClick={ () => setForm( ( f ) => ( {...f , logoKey: combinedKey} ) ) }
                                title={dict.logoAutoTitle}
                              >
                                <div className={styles.logoPickerIconWrapper}>
                                  <span className={styles.logoPickerEmoji}>🌓</span>
                                  <span className={styles.logoPickerCaption}>{ dict.logoAutoLabel }</span>
                                </div>
                              </button>
                            ) ;
                          }
                          return( null ) ;
                        } )()}

                        {brandDetails.logos.map( ( logo , index ) => {
                          const isSelected = ( form.logoKey === logo.src ) ;
                          return(
                            <button
                              key={index}
                              type="button"
                              className={ `${styles.logoPickerBtn} ${isSelected ? styles.logoPickerBtnActive : ""}` }
                              onClick={ () => setForm( ( f ) => ( {...f , logoKey: logo.src} ) ) }
                              title={ `${logo.type} (${logo.theme})` }
                            >
                              <img
                                src={logo.src}
                                alt=""
                                width={24}
                                height={24}
                                className={styles.logoPickerImg}
                                onError={ ( e ) => {
                                  ( e.target as HTMLElement ).style.display = "none" ;
                                } }
                              />
                              <span className={styles.logoPickerBadge}>
                                { logo.theme === "dark" ? "🌙" : "☀️" }
                              </span>
                            </button>
                          ) ;
                        } )}

                        {( () => {
                          const isSelected = ( form.logoKey === "default" ) ;
                          return(
                            <button
                              type="button"
                              className={ `${styles.logoPickerBtn} ${isSelected ? styles.logoPickerBtnActive : ""}` }
                              onClick={ () => setForm( ( f ) => ( {...f , logoKey: "default"} ) ) }
                              title={dict.logoGenericTitle}
                            >
                              <div className={styles.logoPickerIconWrapper}>
                                <span className={styles.logoPickerEmoji}>🌐</span>
                                <span className={styles.logoPickerCaption}>{ dict.logoGenericLabel }</span>
                              </div>
                            </button>
                          ) ;
                        } )()}
                      </div>
                    </div>
                  )}

                  {(brandDetails.brandVoice?.attributes || brandDetails.brandStyle?.attributes) && (
                    <div className={ `${styles.voiceStyleGrid} ${styles.voiceStyleGridDetails}` }>
                      {brandDetails.brandVoice?.attributes && (
                        <div>
                          <span className={styles.detailItemLabel}>{ dict.voiceLabel }</span>
                          <div className={ `${styles.tagGroup} ${styles.tagGroupDetails}` }>
                            {brandDetails.brandVoice.attributes.map( ( a ) => (
                              <span key={a} className={styles.attributeTag}>{ a }</span>
                            ) )}
                            {brandDetails.brandVoice.avoid && (
                              <span className={ `${styles.attributeTag} ${styles.attributeTagAvoid}` } title={dict.avoidLabel}>
                                🚫 { dict.avoidLabel }: { brandDetails.brandVoice.avoid }
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {brandDetails.brandStyle?.attributes && (
                        <div className={styles.tagGroupDetails}>
                          <span className={styles.detailItemLabel}>{ dict.styleLabel }</span>
                          <div className={ `${styles.tagGroup} ${styles.tagGroupDetails}` }>
                            {brandDetails.brandStyle.attributes.map( ( a ) => (
                              <span key={a} className={ `${styles.attributeTag} ${styles.visualStyleTag}` }>{ a }</span>
                            ) )}
                          </div>
                          {brandDetails.brandStyle.description && (
                            <p className={ `${styles.detailDesc} ${styles.styleDescText}` }>
                              { brandDetails.brandStyle.description }
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeBrandTab === "context" && (
                <div className={styles.brandTabContent}>
                  {brandDetails.mission && (
                    <div className={styles.missionValPropText}>
                      <span className={styles.detailItemLabel}>{ dict.missionLabel }</span>
                      <p className={ `${styles.detailDesc} ${styles.missionValPropBox}` }>
                        { brandDetails.mission }
                      </p>
                    </div>
                  )}
                  {brandDetails.valueProposition && (
                    <div className={styles.missionValPropText}>
                      <span className={styles.detailItemLabel}>{ dict.valuePropLabel }</span>
                      <p className={ `${styles.detailDesc} ${styles.missionValPropBox}` }>
                        { brandDetails.valueProposition }
                      </p>
                    </div>
                  )}
                  {brandDetails.targetAudience && (brandDetails.targetAudience.length > 0) && (
                    <div className={styles.missionValPropText}>
                      <span className={styles.detailItemLabel}>{ dict.audienceLabel }</span>
                      <div className={styles.audienceList}>
                        {brandDetails.targetAudience.map( ( ta , i ) => (
                          <div key={i} className={styles.audienceItem}>
                            <span className={styles.audienceSegment}>{ ta.segment }</span>
                            <span className={styles.audienceFocus}>{ ta.focus }</span>
                          </div>
                        ) )}
                      </div>
                    </div>
                  )}
                  {!brandDetails.mission && !brandDetails.valueProposition && !brandDetails.targetAudience && (
                    <p className={ `${styles.detailDesc} ${styles.italicMutedCenter}` }>
                      { dict.noContext }
                    </p>
                  )}
                </div>
              )}

              {activeBrandTab === "products" && (
                <div className={styles.brandTabContent}>
                  {brandDetails.products && (brandDetails.products.length > 0) && (
                    <div className={styles.missionValPropText}>
                      <span className={styles.detailItemLabel}>{ dict.productsLabel }</span>
                      <div className={styles.productGrid}>
                        {brandDetails.products.map( ( p , i ) => (
                          <div key={i} className={styles.productCard}>
                            <div className={styles.productHeader}>
                              <span className={styles.productName}>{ p.name }</span>
                              {p.type && <span className={styles.productType}>{ p.type }</span>}
                            </div>
                            <span className={styles.productDesc}>{ p.description }</span>
                          </div>
                        ) )}
                      </div>
                    </div>
                  )}

                  {brandDetails.socialLinks && (brandDetails.socialLinks.length > 0) && (
                    <div className={styles.socialGridDetails}>
                      <span className={styles.detailItemLabel}>{ dict.socialLabel }</span>
                      <div className={styles.socialGrid}>
                        {brandDetails.socialLinks.map( ( s ) => (
                          <a
                            key={s.type}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.socialBtn}
                          >
                            <span>{ SOCIAL_ICONS[s.type] || "🔗" }</span>
                            <span>{ s.type.toUpperCase() }</span>
                            {s.handle && <span className={styles.opacityMutedText}>({ s.handle })</span>}
                          </a>
                        ) )}
                      </div>
                    </div>
                  )}

                  {!brandDetails.products && (!brandDetails.socialLinks || (brandDetails.socialLinks.length === 0)) && (
                    <p className={ `${styles.detailDesc} ${styles.italicMutedCenter}` }>
                      { dict.noProducts }
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: campos del formulario */}
        <div className={styles.rightCol}>
          <FormInput
            label={dict.nameLabel}
            placeholder={dict.namePlaceholder}
            value={form.name}
            onChange={ ( e ) => setForm( ( f ) => ( {...f , name: e.target.value} ) ) }
            error={errors.name}
            required
            disabled={isSearching}
          />

          <div className={styles.row}>
            <FormInput
              label={dict.priceLabel}
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={priceInput}
              onChange={ ( e ) => setPriceInput( e.target.value ) }
              error={errors.price}
              required
              containerStyle={ {flex: 1} }
              disabled={isSearching}
            />
            <FormSelect
              label={dict.cycleLabel}
              value={form.frequency}
              onChange={ ( e ) => setForm( ( f ) => ( {...f , frequency: e.target.value as SubscriptionFrequency} ) ) }
              containerStyle={ {flex: 1} }
              disabled={isSearching}
            >
              <option value="weekly">{ dict.cycleWeekly }</option>
              <option value="monthly">{ dict.cycleMonthly }</option>
              <option value="quarterly">{ dict.cycleQuarterly }</option>
              <option value="yearly">{ dict.cycleYearly }</option>
            </FormSelect>
          </div>

          <FormSelect
            label={dict.categoryLabel}
            value={form.category}
            onChange={ ( e ) => setForm( ( f ) => ( {...f , category: e.target.value as SubscriptionCategory} ) ) }
            disabled={isSearching}
          >
            {categoryOptions.map( ( c ) => (
              <option key={c.value} value={c.value}>{ c.label }</option>
            ) )}
          </FormSelect>

          {/* Icono y color personalizados: solo cuando NO es una marca de la API */}
          {!isBrand && (
            <>
              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>{ dict.customIconLabel }</span>
                <div className={styles.iconPickerGrid}>
                  {CUSTOM_ICON_KEYS.map( ( iconKey ) => {
                    const isSelected = ( form.logoKey === iconKey ) ;
                    return(
                      <button
                        key={iconKey}
                        type="button"
                        className={styles.iconPickerBtn}
                        data-selected={isSelected}
                        style={ isSelected ? {
                          borderColor:     selectedConfig.textColor ,
                          backgroundColor: selectedConfig.bgColor ,
                        } : undefined }
                        onClick={ () => setForm( ( f ) => ( {...f , logoKey: iconKey} ) ) }
                        title={iconKey}
                      >
                        <SubscriptionIcon logoKey={iconKey} size={18} />
                      </button>
                    ) ;
                  } )}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>{ dict.customColorLabel }</span>
                <div className={styles.colorRow}>
                  {CUSTOM_COLORS.map( ( color ) => (
                    <button
                      key={color}
                      type="button"
                      onClick={ () => setForm( ( f ) => ( {...f , color} ) ) }
                      className={styles.colorDot}
                      data-selected={form.color === color}
                      style={ {backgroundColor: color} }
                      title={color}
                    />
                  ) )}
                </div>
              </div>
            </>
          )}
        </div>
      </form>
    </Modal>
  ) ;
}
