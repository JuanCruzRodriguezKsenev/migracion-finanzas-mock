/**
 * @file dictionary.ts
 * Helper asíncrono para la carga dinámica de diccionarios de traducción.
 */

// Feature: i18n
const dictionaries = {
  es: () => import( "@/dictionaries/es.json" ).then( (module) => module.default ) ,
  en: () => import( "@/dictionaries/en.json" ).then( (module) => module.default ) ,
  br: () => import( "@/dictionaries/br.json" ).then( (module) => module.default ) ,
} ;

/**
 * Retorna las traducciones del locale correspondiente.
 * Respalda al idioma inglés ('en') si el locale provisto no está soportado.
 * 
 * @param locale - Código del idioma (es, en, br).
 * @returns Diccionario de traducciones JSON.
 */
export async function getDictionary( locale: string ) {
  const loadFn = ( dictionaries[locale as keyof typeof dictionaries] || dictionaries.en ) ;
  
  return( await loadFn() ) ;
}
