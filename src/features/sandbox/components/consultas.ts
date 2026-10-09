/**
 * @file consultas.ts
 * Consultas de usuario y dominios esperados para la batería «nombre → ícono».
 */

export interface ConsultaBateria {
  consulta:  string ;
  esperados: string[] ;
  parcial?:  boolean ;
}

/**
 * Batería de consultas tipadas por el usuario y sus dominios esperados.
 *
 * Los esperados son hipótesis de tanda, verificadas a mano sólo en parte;
 * si un esperado está mal, se corrige acá y la batería lo refleja.
 */
export const CONSULTAS: ConsultaBateria[] = [
  { consulta: "bbva" ,            esperados: [ "bbva.com" , "bbva.com.ar" ] } ,
  { consulta: "galicia" ,         esperados: [ "galicia.ar" , "bancogalicia.com" , "bancogalicia.com.ar" ] } ,
  { consulta: "santander" ,       esperados: [ "santander.com.ar" , "santander.com" ] } ,
  { consulta: "baxar" ,           esperados: [ "baxar.com.ar" ] } ,
  { consulta: "coto" ,            esperados: [ "coto.com.ar" ] } ,
  { consulta: "mercado pago" ,    esperados: [ "mercadopago.com" , "mercadopago.com.ar" ] } ,
  { consulta: "naranja x" ,       esperados: [ "naranjax.com" ] } ,
  { consulta: "banco nacion" ,    esperados: [ "bna.com.ar" ] } ,
  { consulta: "brubank" ,         esperados: [ "brubank.com" , "brubank.com.ar" ] } ,
  { consulta: "uala" ,            esperados: [ "uala.com.ar" ] } ,
  { consulta: "belo" ,            esperados: [ "belo.app" ] } ,
  { consulta: "banco provincia" , esperados: [ "bancoprovincia.com.ar" ] } ,
  { consulta: "netflix" ,         esperados: [ "netflix.com" , "netflix.com.ar" ] } ,
  { consulta: "spotify" ,         esperados: [ "spotify.com" , "spotify.com.ar" ] } ,
  { consulta: "chatgpt" ,         esperados: [ "chatgpt.com" , "openai.com" ] } ,
  { consulta: "github" ,          esperados: [ "github.com" ] } ,
  { consulta: "notion" ,          esperados: [ "notion.so" , "notion.com" ] } ,
  { consulta: "edesur" ,          esperados: [ "edesur.com.ar" ] } ,
  { consulta: "fibertel" ,        esperados: [ "fibertel.com.ar" , "personal.com.ar" ] } ,
  { consulta: "telecentro" ,      esperados: [ "telecentro.com.ar" ] } ,
  { consulta: "gali" ,            esperados: [ "galicia.ar" , "bancogalicia.com" ] , parcial: true } ,
  { consulta: "merc" ,            esperados: [ "mercadopago.com" , "mercadolibre.com.ar" ] , parcial: true }
] ;
