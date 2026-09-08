/**
 * @file preferences.ts
 * Catálogo canónico de opciones de preferencias de perfil y resolución de etiquetas.
 */

/**
 * Grupos de preferencias configurables en el perfil del usuario.
 */
export type PreferenceGroup = "currency" | "timezone" | "numberFormat" | "weeklyStart" | "defaultView" ;

/**
 * Estructura de una opción de preferencia con código canónico y etiqueta para interfaz.
 */
export interface PreferenceOption {
  code:  string ;
  label: string ;
}

/** Códigos canónicos para divisas soportadas en el perfil. */
export const CURRENCY_CODES = [ "ARS" , "USD" , "EUR" , "BRL" , "CLP" , "UYU" ] as const ;

/** Códigos canónicos para husos horarios soportados en el perfil. */
export const TIMEZONE_CODES = [
  "America/Argentina/Buenos_Aires" ,
  "America/Montevideo" ,
  "America/Santiago" ,
  "America/Sao_Paulo" ,
  "America/New_York" ,
  "UTC" ,
] as const ;

/** Códigos canónicos (locales BCP 47) para formato numérico. */
export const NUMBER_FORMAT_CODES = [ "es-AR" , "en-US" ] as const ;

/** Códigos canónicos para día de inicio semanal. */
export const WEEKLY_START_CODES = [ "monday" , "sunday" ] as const ;

/** Códigos canónicos para vista por defecto del panel. */
export const DEFAULT_VIEW_CODES = [ "dashboard" , "transactions" , "subscriptions" , "accounts" ] as const ;

/** Opciones de divisas disponibles para el perfil. */
export const CURRENCY_OPTIONS: readonly PreferenceOption[] = [
  { code: "ARS" , label: "Peso argentino (ARS)" } ,
  { code: "USD" , label: "Dólar estadounidense (USD)" } ,
  { code: "EUR" , label: "Euro (EUR)" } ,
  { code: "BRL" , label: "Real brasileño (BRL)" } ,
  { code: "CLP" , label: "Peso chileno (CLP)" } ,
  { code: "UYU" , label: "Peso uruguayo (UYU)" } ,
] ;

/** Opciones de husos horarios disponibles para el perfil. */
export const TIMEZONE_OPTIONS: readonly PreferenceOption[] = [
  { code: "America/Argentina/Buenos_Aires" , label: "(GMT-03:00) Buenos Aires" } ,
  { code: "America/Montevideo"             , label: "(GMT-03:00) Montevideo" } ,
  { code: "America/Santiago"               , label: "(GMT-04:00) Santiago" } ,
  { code: "America/Sao_Paulo"              , label: "(GMT-03:00) São Paulo" } ,
  { code: "America/New_York"               , label: "(GMT-05:00) Nueva York" } ,
  { code: "UTC"                            , label: "(GMT+00:00) Tiempo Universal Coordinado (UTC)" } ,
] ;

/** Opciones de formatos numéricos disponibles para el perfil. */
export const NUMBER_FORMAT_OPTIONS: readonly PreferenceOption[] = [
  { code: "es-AR" , label: "1.234,56" } ,
  { code: "en-US" , label: "1,234.56" } ,
] ;

/** Opciones de inicio de semana disponibles para el perfil. */
export const WEEKLY_START_OPTIONS: readonly PreferenceOption[] = [
  { code: "monday" , label: "Lunes" } ,
  { code: "sunday" , label: "Domingo" } ,
] ;

/** Opciones de vista predeterminada disponibles para el perfil. */
export const DEFAULT_VIEW_OPTIONS: readonly PreferenceOption[] = [
  { code: "dashboard"     , label: "Dashboard" } ,
  { code: "transactions"  , label: "Transacciones" } ,
  { code: "subscriptions" , label: "Suscripciones" } ,
  { code: "accounts"      , label: "Cuentas" } ,
] ;

/** Diccionario que agrupa las listas de opciones por grupo de preferencia. */
export const PREFERENCE_CATALOG: Record< PreferenceGroup , readonly PreferenceOption[] > = {
  currency:     CURRENCY_OPTIONS ,
  timezone:     TIMEZONE_OPTIONS ,
  numberFormat: NUMBER_FORMAT_OPTIONS ,
  weeklyStart:  WEEKLY_START_OPTIONS ,
  defaultView:  DEFAULT_VIEW_OPTIONS ,
} ;

/**
 * Mapa inverso de etiquetas históricas a códigos canónicos.
 * Permite migrar datos heredados de interfaz hacia valores normalizados.
 */
export const LABEL_TO_CODE_MAP: Record< string , string > = {
  "Peso argentino (ARS)":                          "ARS" ,
  "Dólar estadounidense (USD)":                    "USD" ,
  "Euro (EUR)":                                    "EUR" ,
  "Real brasileño (BRL)":                          "BRL" ,
  "Peso chileno (CLP)":                            "CLP" ,
  "Peso uruguayo (UYU)":                           "UYU" ,
  "(GMT-03:00) Buenos Aires":                      "America/Argentina/Buenos_Aires" ,
  "(GMT-03:00) Montevideo":                        "America/Montevideo" ,
  "(GMT-04:00) Santiago":                          "America/Santiago" ,
  "(GMT-03:00) São Paulo":                         "America/Sao_Paulo" ,
  "(GMT-05:00) Nueva York":                        "America/New_York" ,
  "(GMT+00:00) Tiempo Universal Coordinado (UTC)": "UTC" ,
  "1.234,56":                                      "es-AR" ,
  "1,234.56":                                      "en-US" ,
  "Lunes":                                         "monday" ,
  "Domingo":                                       "sunday" ,
  "Dashboard":                                     "dashboard" ,
  "Transacciones":                                 "transactions" ,
  "Suscripciones":                                 "subscriptions" ,
  "Cuentas":                                       "accounts" ,
} ;

/**
 * Devuelve la etiqueta legible en español para un código canónico dentro de un grupo de preferencia.
 * Si el código no está registrado en el catálogo, retorna el propio código como respaldo seguro.
 * 
 * @param grupo - Grupo de preferencia al que pertenece el valor.
 * @param code - Código canónico de la opción.
 * @returns La etiqueta legible en español o el código recibido como fallback.
 */
export function etiquetaDe( grupo: PreferenceGroup , code: string ): string {
  const opciones   = PREFERENCE_CATALOG[grupo] ;
  const encontrada = opciones?.find( ( opt ) => (opt.code === code) ) ;

  return( encontrada ? encontrada.label : code ) ;
}
