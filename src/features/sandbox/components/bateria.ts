/**
 * @file bateria.ts
 * Batería de 18 marcas argentinas, regionales e internacionales para evaluación
 * del resolutor de identidad (logos oscuros, SVG declarados, marcas locales y redirecciones).
 */

export interface MarcaBateria {
  nombre:  string ;
  dominio: string ;
}

export const BATERIA: MarcaBateria[] = [
  { nombre: "Banco Galicia" ,   dominio: "galicia.ar" } ,                 // Banca tradicional argentina
  { nombre: "BBVA" ,            dominio: "bbva.com" } ,                   // Banca internacional / regional
  { nombre: "Santander" ,       dominio: "santander.com" } ,              // Banca internacional con SVG declarado
  { nombre: "Banco Nación" ,    dominio: "bna.com.ar" } ,                 // Banca pública argentina
  { nombre: "Mercado Pago" ,    dominio: "mercadopago.com" } ,            // Fintech regional líder con SVG
  { nombre: "Naranja X" ,       dominio: "naranjax.com" } ,               // Fintech argentina
  { nombre: "Brubank" ,         dominio: "brubank.com" } ,                // Neobanco argentino
  { nombre: "Netflix" ,         dominio: "netflix.com" } ,                // Servicio global de streaming
  { nombre: "Spotify" ,         dominio: "spotify.com" } ,                // Servicio global de streaming
  { nombre: "ChatGPT" ,         dominio: "chatgpt.com" } ,                // Servicio de IA global con SVG
  { nombre: "Edesur" ,          dominio: "edesur.com.ar" } ,              // Servicios públicos locales
  { nombre: "Fibertel" ,        dominio: "cablevisionfibertel.com.ar" } , // Telecomunicaciones con redirección (Personal)
  { nombre: "GitHub" ,          dominio: "github.com" } ,                 // Plataforma de desarrollo con logo oscuro
  { nombre: "Notion" ,          dominio: "notion.so" } ,                  // Productividad con logo oscuro monocromático
  { nombre: "Ualá" ,            dominio: "uala.com.ar" } ,                // Fintech argentina regional
  { nombre: "Belo" ,            dominio: "belo.app" } ,                   // Billetera cripto local
  { nombre: "Banco Provincia" , dominio: "bancoprovincia.com.ar" } ,     // Banca pública provincial
  { nombre: "Telecentro" ,      dominio: "telecentro.com.ar" }            // Telecomunicaciones locales
] ;
