/**
 * @file brandService.ts
 * Servicio para resolver logotipos y metadatos básicos de marcas.
 * Provee integración desacoplada con Google S2 favicons sin dependencias de Node.js en cliente.
 */

export interface BrandColor {
  hex:   string ;
  name?: string ;
}

/**
 * Variante de logotipo de marca, con su tema recomendado.
 */
export interface BrandLogoVariant {
  src:   string ;
  type:  string ;
  theme: string ;
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
 * Genera la URL del favicon oficial desde el servicio público de Google S2 para un dominio dado.
 * 
 * @param domain - Dominio web de la marca.
 */
export function getBrandLogoUrl( domain: string ): string {
  return( "https://www.google.com/s2/favicons?domain=" + cleanDomain( domain ) + "&sz=128" ) ;
}

/**
 * Obtiene los metadatos básicos de una marca retornando un objeto sintético compatible.
 * 
 * @deprecated Utilizar el endpoint /api/brand/identidad directamente.
 * @param query - Nombre o dominio de la marca a buscar.
 */
export async function getBrandMetadata( query: string ): Promise< BrandMetadata | null > {
  const domain = cleanDomain( query ) ;

  return( {
    domain ,
    name:         query.charAt( 0 ).toUpperCase() + query.slice( 1 ) ,
    logoUrl:      getBrandLogoUrl( domain ) ,
    primaryColor: "#6b7280" ,
  } ) ;
}

