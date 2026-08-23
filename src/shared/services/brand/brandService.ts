/**
 * @file brandService.ts
 * Servicio de backend para resolver identidades corporativas de marcas en tiempo real.
 * Provee metadatos enriquecidos de Brandfetch (Brand + Context APIs) y enlaces de CDN directos.
 */
// Shared
import { logger } from "@/shared/lib/logger" ;

export interface BrandColor {
  hex:   string ;
  name?: string ;
}

/**
 * Variante de logotipo oficial resuelta por Brandfetch, con su tema recomendado.
 */
export interface BrandLogoVariant {
  src:   string ;
  type:  string ; // 'icon' | 'logo' | 'symbol' | ...
  theme: string ; // 'light' | 'dark'
}

export interface BrandMetadata {
  domain:            string ;
  name:              string ;
  logoUrl:           string ;
  primaryColor:      string ;
  accentColor?:      string ;
  tagline?:          string ;
  description?:      string ;
  qualityScore?:     number ;
  industry?:         string ;
  logos?:            BrandLogoVariant[] ;
  longDescription?:  string ;
  companySize?:      string ;
  foundedYear?:      number ;
  location?:         string ;
  colors?:           BrandColor[] ;
  socialLinks?:      { type: string ; url: string ; handle?: string }[] ;
  mission?:          string ;
  valueProposition?: string ;
  targetAudience?:   { segment: string ; focus: string }[] ;
  products?:         { name: string ; type: string ; description: string }[] ;
  brandVoice?:       { attributes: string[] ; avoid?: string } ;
  brandStyle?:       { attributes: string[] ; description?: string } ;
}

/**
 * Limpia y normaliza una consulta para obtener un formato de dominio válido.
 * 
 * @param query - Consulta cruda de dominio o nombre.
 */
export function cleanDomain( query: string ): string {
  let domain = query.trim().toLowerCase() ;
  if( !domain.includes( "." ) ) {
    domain = `${domain}.com` ;
  }
  return( domain.replace( /^(https?:\/\/)?(www\.)?/ , "" ) ) ;
}

/**
 * Genera la URL directa del CDN de Brandfetch para un dominio dado.
 * Útil para inyecciones rápidas en etiquetas <img> sin consumir peticiones REST.
 * 
 * @param domain - Dominio web de la marca.
 * @param clientId - Identificador de cliente público de Brandfetch.
 */
export function getBrandLogoUrl( domain: string , clientId: string = "brandfetch" ): string {
  const clean = cleanDomain( domain ) ;
  return( `https://cdn.brandfetch.io/${clean}?c=${clientId}` ) ;
}

/**
 * Obtiene los metadatos completos y de posicionamiento de una marca consultando Brandfetch.
 * Ejecuta en paralelo consultas a la Brand API y a la Context API para enriquecer los datos.
 * 
 * @param query - Nombre o dominio de la marca a buscar.
 */
export async function getBrandMetadata( query: string ): Promise< BrandMetadata | null > {
  const domain = cleanDomain( query ) ;
  const apiKey = process.env.BRANDFETCH_API_KEY ;

  if( !apiKey ) {
    return( {
      domain ,
      name:         query.charAt( 0 ).toUpperCase() + query.slice( 1 ) ,
      logoUrl:      `https://logo.clearbit.com/${domain}` ,
      primaryColor: "#6b7280"
    } ) ;
  }

  const brandUrl   = `https://api.brandfetch.io/v2/brands/${domain}` ;
  const contextUrl = `https://api.brandfetch.io/v2/context/${domain}` ;
  const headers    = { Authorization: `Bearer ${apiKey}` } ;

  try {
    const [ brandRes , contextRes ] = await Promise.all( [
      fetch( brandUrl , { headers , next: { revalidate: 86400 } } ) ,
      fetch( contextUrl , { headers , next: { revalidate: 86400 } } ).catch( () => null )
    ] ) ;

    if( !brandRes.ok ) {
      return( {
        domain ,
        name:         query.charAt( 0 ).toUpperCase() + query.slice( 1 ) ,
        logoUrl:      `https://logo.clearbit.com/${domain}` ,
        primaryColor: "#6b7280"
      } ) ;
    }

    const brandData = await brandRes.json() ;

    interface ContextData {
      identity?: {
        tagline?:     string ;
        description?: string ;
        mission?:     string ;
      } ;
      positioning?: {
        value_proposition?:   string ;
        target_audience?:     { segment?: string ; description?: string }[] ;
        products_and_services?: { name?: string ; type?: string ; description?: string }[] ;
      } ;
      brand?: {
        voice?: { attributes?: string[] ; avoid?: string[] } ;
        style?: { attributes?: string[] ; summary?: string } ;
      } ;
    }

    let contextData: ContextData | null = null ;
    if( contextRes && contextRes.ok ) {
      try {
        contextData = await contextRes.json() ;
      } catch {
        logger.warn( "No se pudo parsear el JSON de contexto de Brandfetch." , {domain} ) ;
      }
    }

    interface LogoFormat { src?: string }
    interface BrandLogo { type?: string ; theme?: string ; formats?: LogoFormat[] }

    const logos   = brandData.logos as BrandLogo[] | undefined ;
    const logoUrl = logos?.find( ( l ) => ( l.type === "icon" ) || ( l.type === "symbol" ) )?.formats?.[0]?.src
      || logos?.find( ( l ) => l.type === "logo" )?.formats?.[0]?.src
      || logos?.[0]?.formats?.[0]?.src
      || `https://logo.clearbit.com/${domain}` ;

    // Variantes de logotipo con su tema (light/dark) para selectores de UI
    const logoVariants: BrandLogoVariant[] = ( logos || [] )
      .map( ( l ) => ( {
        src:   l.formats?.[0]?.src || "" ,
        type:  l.type || "logo" ,
        theme: l.theme || "light" ,
      } ) )
      .filter( ( l ) => l.src !== "" ) ;

    interface ColorRes { type?: string ; hex?: string }
    const colorsArr = brandData.colors as ColorRes[] | undefined ;

    const primaryColorObj = colorsArr?.find( ( c ) => ( c.type === "primary" ) || ( c.type === "accent" ) || ( c.type === "brand" ) ) 
      || colorsArr?.find( ( c ) => ( c.hex !== "#000000" ) && ( c.hex?.toUpperCase() !== "#FFFFFF" ) ) 
      || colorsArr?.[0] ;
    const primaryColor = primaryColorObj?.hex || "#6b7280" ;

    const colors: BrandColor[] = colorsArr?.map( ( c ) => ( {
      hex:  c.hex || "#6b7280" ,
      name: c.type || "brand"
    } ) ) || [ { hex: primaryColor , name: "primary" } ] ;

    interface BrandLink { name?: string ; url?: string }
    const links = brandData.links as BrandLink[] | undefined ;

    const socialLinks = links?.map( ( l ) => ( {
      type:   l.name || "website" ,
      url:    l.url || "" ,
      handle: l.url ? l.url.substring( l.url.lastIndexOf( "/" ) + 1 ) : undefined
    } ) ) || [] ;

    const company     = brandData.company ;
    const foundedYear = company?.foundedYear || undefined ;
    const companySize = company?.employees ? `${company.employees} empleados` : undefined ;
    const location    = company?.location 
      ? [ company.location.city , company.location.state , company.location.country ].filter( Boolean ).join( ", " ) 
      : undefined ;

    const industryObj = company?.industries?.[0] ;
    const industry    = ( typeof industryObj === "object" ) ? industryObj?.name : ( industryObj || undefined ) ;
    const qualityScore = ( brandData.qualityScore !== undefined ) ? Math.round( brandData.qualityScore * 100 ) : undefined ;

    const tagline          = contextData?.identity?.tagline || brandData.tagline || undefined ;
    const description      = contextData?.identity?.description || brandData.description || undefined ;
    const mission          = contextData?.identity?.mission || undefined ;
    const valueProposition = contextData?.positioning?.value_proposition || undefined ;

    const targetAudience = contextData?.positioning?.target_audience?.map( ( ta ) => ( {
      segment: ta.segment || "" ,
      focus:   ta.description || ""
    } ) ) || undefined ;

    const products = contextData?.positioning?.products_and_services?.map( ( p ) => ( {
      name:        p.name || "" ,
      type:        p.type || "" ,
      description: p.description || ""
    } ) ) || undefined ;

    const brandVoice = contextData?.brand?.voice ? {
      attributes: contextData.brand.voice.attributes || [] ,
      avoid:      contextData.brand.voice.avoid?.join( ", " ) || undefined
    } : undefined ;

    const brandStyle = contextData?.brand?.style ? {
      attributes: contextData.brand.style.attributes || [] ,
      description: contextData.brand.style.summary || undefined
    } : undefined ;

    return( {
      domain ,
      name:            brandData.name || query ,
      logoUrl ,
      logos:           logoVariants ,
      primaryColor ,
      colors ,
      socialLinks ,
      companySize ,
      foundedYear ,
      location ,
      industry ,
      qualityScore ,
      tagline ,
      description ,
      longDescription: brandData.longDescription || undefined ,
      mission ,
      valueProposition ,
      targetAudience ,
      products ,
      brandVoice ,
      brandStyle
    } ) ;
  } catch( error ) {
    logger.error( "Error al obtener datos de marca en Brandfetch." , {domain , error: String(error)} ) ;
    return( {
      domain ,
      name:         query ,
      logoUrl:      `https://logo.clearbit.com/${domain}` ,
      primaryColor: "#6b7280"
    } ) ;
  }
}
