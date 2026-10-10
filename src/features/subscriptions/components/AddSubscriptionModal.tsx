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
import { buscarMarcas }                      from "@/shared/services/brand/brandSearch" ;
import { readStorage , writeStorage }        from "@/shared/lib/safeStorage" ;
import { FormSelect }                        from "@/shared/ui/forms/Form/FormSelect" ;
import { FormInput }                         from "@/shared/ui/forms/Form/FormInput" ;
import type { getDictionary }                from "@/shared/lib/dictionary" ;
import { Button }                            from "@/shared/ui/display/Button/Button" ;
import { Modal }                             from "@/shared/ui/feedback/Modal/Modal" ;

// Feature: Accounting
import { Category , CategoryTreeNode } from "@/features/accounting/types" ;
import { getCategoryTreeAction }        from "@/features/accounting/actions/categoryActions" ;
import { iconoDeCategoria }             from "@/features/accounting/utils/categoryIcons" ;

// Feature: Subscriptions
import { SubscriptionFormData , SubscriptionFrequency , SubscriptionWithStats } from "../types" ;
import countriesData                                                            from "../data/countries.json" ;
import { SubscriptionIcon }                                                     from "./SubscriptionIcon" ;
import { getLogoConfig }                                                        from "../utils/logoMap" ;
import styles                                                                   from "./AddSubscriptionModal.module.css" ;


type SubscriptionsDict = Awaited< ReturnType< typeof getDictionary > >["subscriptionsPage"] ;

interface Country {
  code:  string ;
  label: string ;
  name:  string ;
  tld:   string ;
}

interface BrandSuggestion {
  kind:          "brand" ;
  name:          string ;
  domain:        string ;
  logoKey?:      string ;
  color?:        string ;
  categoryCode?: string ;
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
  { kind: "brand" , name: "Netflix"              , domain: "netflix.com"    , color: "#E50914" , logoKey: "https://logo.clearbit.com/netflix.com"    , categoryCode: "5.1.09.01" } ,
  { kind: "brand" , name: "Spotify"              , domain: "spotify.com"    , color: "#1DB954" , logoKey: "https://logo.clearbit.com/spotify.com"    , categoryCode: "5.1.09.01" } ,
  { kind: "brand" , name: "YouTube Premium"      , domain: "youtube.com"    , color: "#FF0000" , logoKey: "https://logo.clearbit.com/youtube.com"    , categoryCode: "5.1.09.01" } ,
  { kind: "brand" , name: "Disney+"              , domain: "disneyplus.com" , color: "#113CCF" , logoKey: "https://logo.clearbit.com/disneyplus.com" , categoryCode: "5.1.09.01" } ,
  { kind: "brand" , name: "Amazon Prime"         , domain: "amazon.com"     , color: "#FF9900" , logoKey: "https://logo.clearbit.com/amazon.com"     , categoryCode: "5.1.09.01" } ,
  { kind: "brand" , name: "ChatGPT Plus"         , domain: "openai.com"     , color: "#10A37F" , logoKey: "https://logo.clearbit.com/openai.com"     , categoryCode: "5.1.09.02" } ,
  { kind: "brand" , name: "Adobe Creative Cloud" , domain: "adobe.com"      , color: "#FF0000" , logoKey: "https://logo.clearbit.com/adobe.com"      , categoryCode: "5.1.09.03" } ,
  { kind: "brand" , name: "Figma"                , domain: "figma.com"      , color: "#F24E1E" , logoKey: "https://logo.clearbit.com/figma.com"      , categoryCode: "5.1.09.03" } ,
  { kind: "brand" , name: "Notion"               , domain: "notion.so"      , color: "#000000" , logoKey: "https://logo.clearbit.com/notion.so"      , categoryCode: "5.1.09.02" } ,
  { kind: "brand" , name: "iCloud+"              , domain: "apple.com"      , color: "#000000" , logoKey: "https://logo.clearbit.com/apple.com"      , categoryCode: "5.1.09.06" } ,
  { kind: "brand" , name: "NordVPN"              , domain: "nordvpn.com"    , color: "#4687FF" , logoKey: "https://logo.clearbit.com/nordvpn.com"    , categoryCode: "5.1.09.05" } ,
  { kind: "brand" , name: "GitHub"               , domain: "github.com"     , color: "#000000" , logoKey: "https://logo.clearbit.com/github.com"     , categoryCode: "5.1.09.02" } ,
  { kind: "brand" , name: "Slack"                , domain: "slack.com"      , color: "#4A154B" , logoKey: "https://logo.clearbit.com/slack.com"      , categoryCode: "5.1.09.02" } ,
  { kind: "brand" , name: "Canva"                , domain: "canva.com"      , color: "#00C4CC" , logoKey: "https://logo.clearbit.com/canva.com"      , categoryCode: "5.1.09.03" } ,
] ;

/**
 * Resuelve el país inicial del buscador: preferencia guardada → zona horaria → Argentina.
 * Solo corre en cliente (el modal se carga con ssr: false).
 */
function resolveInitialCountry(): Country {
  const countries = countriesData as Country[] ;

  const savedCode = readStorage( COUNTRY_STORAGE_KEY ) ;
  if( savedCode ){
    const found = countries.find( ( c ) => c.code === savedCode ) ;
    if( found ){ return( found ) ; }
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
      name:        editingData.name ,
      amount:      editingData.amount ,
      frequency:   editingData.frequency as SubscriptionFrequency ,
      logoKey:     editingData.logoKey ,
      color:       editingData.color ,
      categoryId:  editingData.categoryId ,
    } : {
      name:        "" ,
      amount:      0 ,
      frequency:   "monthly" ,
      logoKey:     "default" ,
      color:       CUSTOM_COLORS[0] ,
      categoryId:  null ,
    } ) ;
  } ) ;

  const [ categoryTree , setCategoryTree ] = useState< CategoryTreeNode[] >( [] ) ;

  useEffect( () => {
    let active = true ;
    getCategoryTreeAction().then( ( res ) => {
      if( active && res.success ){
        setCategoryTree( res.value ) ;
      }
    } ) ;
    return () => {
      active = false ;
    } ;
  } , [] ) ;

  const expenseCategories = useMemo( () => {
    return( categoryTree.filter( ( cat ) => cat.type === "expense" ) ) ;
  } , [ categoryTree ] ) ;

  // El precio se edita como texto en pesos y se convierte a centavos al enviar
  const [ priceInput , setPriceInput ] = useState( () => (
    isEditing && editingData ? String( editingData.amount / 100 ) : ""
  ) ) ;

  const [ errors , setErrors ]                       = useState< Partial< Record<"name" | "price" , string> > >( {} ) ;
  const [ searchTerm , setSearchTerm ]               = useState( "" ) ;
  const [ showSuggestions , setShowSuggestions ]     = useState( false ) ;
  const [ isSearching , setIsSearching ]             = useState( false ) ;
  const [ isOnlineResults , setIsOnlineResults ]     = useState( false ) ;
  const [ onlineSuggestions , setOnlineSuggestions ] = useState< Suggestion[] >( [] ) ;
  const [ selectedCountry , setSelectedCountry ]     = useState< Country >( resolveInitialCountry ) ;

  const countries = countriesData as Country[] ;

  const isBrand        = ( form.logoKey.startsWith( "http://" ) || form.logoKey.startsWith( "https://" ) ) ;
  const activeColor    = ( form.color || "#6B7280" ) ;
  const selectedConfig = getLogoConfig( form.logoKey ) ;

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
          icon:     s.logoKey
            // eslint-disable-next-line @next/next/no-img-element -- Logo externo dinámico de Brandfetch/CDN sin dimensiones fijas conocidas
            ? <img src={s.logoKey} alt="" />
            : <span>🌐</span> ,
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
   * Aplica una marca seleccionada consultando su identidad visual en /api/brand/identidad.
   */
  async function selectBrand( brand: BrandSuggestion ) {
    setIsSearching( true ) ;
    setShowSuggestions( false ) ;
    setSearchTerm( "" ) ;
    setIsOnlineResults( false ) ;

    let matchedCategoryId: string | null = null ;
    if( brand.categoryCode ){
      for( const parent of categoryTree ){
        if( parent.accountCode === brand.categoryCode ){
          matchedCategoryId = parent.id ;
          break ;
        }
        const found = parent.children.find( ( c: Category ) => c.accountCode === brand.categoryCode ) ;
        if( found ){
          matchedCategoryId = found.id ;
          break ;
        }
      }
    }

    try {
      const res = await fetch( `/api/brand/identidad?domain=${encodeURIComponent( brand.domain || brand.name )}` ) ;
      const identidad = ( res.ok ? await res.json() : null ) ;

      const logo  = ( identidad?.icono?.dataUri || brand.logoKey || "default" ) ;
      const color = ( identidad?.color || brand.color || CUSTOM_COLORS[0] ) ;
      const name  = ( identidad?.nombre || brand.name ) ;

      setForm( ( f ) => ( {
        ...f ,
        name ,
        logoKey:    logo ,
        color ,
        categoryId: ( matchedCategoryId || f.categoryId ) ,
      } ) ) ;
    } catch {
      setForm( ( f ) => ( {
        ...f ,
        name:       brand.name ,
        logoKey:    brand.logoKey || "default" ,
        color:      brand.color || CUSTOM_COLORS[0] ,
        categoryId: ( matchedCategoryId || f.categoryId ) ,
      } ) ) ;
    } finally {
      setIsSearching( false ) ;
    }
  }

  /**
   * Busca marcas en la web priorizando el ccTLD del país elegido.
   */
  async function selectSearchOnline( query: string ) {
    setIsSearching( true ) ;

    try {
      const cleanQuery = query.trim() ;

      const sufijos = ( selectedCountry.tld && (selectedCountry.tld !== ".com") )
        ? [ ".com" , selectedCountry.tld ]
        : [ ".com" ] ;

      const marcasEncontradas = await buscarMarcas( cleanQuery , {
        sufijos ,
        paisPrioritario: selectedCountry.code.toLowerCase() ,
      } ) ;

      const next: Suggestion[] = [] ;

      for( const marca of marcasEncontradas ){
        next.push( {
          kind:    "brand" ,
          name:    marca.name ,
          domain:  marca.domain ,
          logoKey: marca.icon ,
        } ) ;
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
      writeStorage( COUNTRY_STORAGE_KEY , found.code ) ;
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
            value={form.categoryId || ""}
            onChange={ ( e ) => setForm( ( f ) => ( {...f , categoryId: ( e.target.value ? e.target.value : null )} ) ) }
            disabled={isSearching}
          >
            <option value="">{ dict.categoryOther || "Sin categoría" }</option>
            {expenseCategories.map( ( parent: CategoryTreeNode ) => {
              const visibleChildren = parent.children.filter( ( c: Category ) => !c.isSystemLeaf ) ;
              return(
                <optgroup
                  key={parent.id}
                  label={ `${iconoDeCategoria( parent.icon )} ${parent.name}` }
                >
                  {visibleChildren.length > 0 ? (
                    visibleChildren.map( ( child: Category ) => (
                      <option key={child.id} value={child.id}>
                        {iconoDeCategoria( child.icon )} {child.name}
                      </option>
                    ) )
                  ) : (
                    <option value={parent.id}>
                      {iconoDeCategoria( parent.icon )} {parent.name}
                    </option>
                  )}
                </optgroup>
              ) ;
            } )}
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
