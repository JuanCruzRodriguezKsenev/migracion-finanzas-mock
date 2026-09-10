// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Subscriptions
import { createSubscriptionSchema , updateSubscriptionSchema } from "./subscriptions.schema" ;


const VALID_INPUT = {
  name:       "Netflix" ,
  amount:     1599000 ,
  frequency:  "monthly" ,
  logoKey:    "https://logo.clearbit.com/netflix.com" ,
  color:      "#E50914" ,
  categoryId: "123e4567-e89b-12d3-a456-426614174000" ,
} ;

/**
 * Suite de pruebas unitarias para los esquemas Zod del módulo de suscripciones.
 */
describe( "subscriptions.schema" , () => {
  describe( "createSubscriptionSchema" , () => {
    it( "debería aceptar una suscripción válida" , () => {
      expect( createSubscriptionSchema.safeParse( VALID_INPUT ).success ).toBe( true ) ;
    } ) ;

    it( "debería rechazar un nombre vacío" , () => {
      expect( createSubscriptionSchema.safeParse( {...VALID_INPUT , name: ""} ).success ).toBe( false ) ;
    } ) ;

    it( "debería rechazar un monto con decimales (no centavos enteros)" , () => {
      expect( createSubscriptionSchema.safeParse( {...VALID_INPUT , amount: 15.99} ).success ).toBe( false ) ;
    } ) ;

    it( "debería rechazar un monto de cero o negativo" , () => {
      expect( createSubscriptionSchema.safeParse( {...VALID_INPUT , amount: 0} ).success ).toBe( false ) ;
      expect( createSubscriptionSchema.safeParse( {...VALID_INPUT , amount: -100} ).success ).toBe( false ) ;
    } ) ;

    it( "debería rechazar una frecuencia desconocida" , () => {
      expect( createSubscriptionSchema.safeParse( {...VALID_INPUT , frequency: "daily"} ).success ).toBe( false ) ;
    } ) ;

    it( "debería rechazar un color que no sea hexadecimal #RRGGBB" , () => {
      expect( createSubscriptionSchema.safeParse( {...VALID_INPUT , color: "rojo"} ).success ).toBe( false ) ;
      expect( createSubscriptionSchema.safeParse( {...VALID_INPUT , color: "#FFF"} ).success ).toBe( false ) ;
    } ) ;

    it( "debería rechazar un identificador de categoría que no sea un UUID válido" , () => {
      expect( createSubscriptionSchema.safeParse( {...VALID_INPUT , categoryId: "gaming-no-uuid"} ).success ).toBe( false ) ;
    } ) ;
  } ) ;

  describe( "updateSubscriptionSchema" , () => {
    it( "debería aceptar actualizaciones parciales" , () => {
      expect( updateSubscriptionSchema.safeParse( {amount: 2000000} ).success ).toBe( true ) ;
      expect( updateSubscriptionSchema.safeParse( {} ).success ).toBe( true ) ;
    } ) ;

    it( "debería validar los campos presentes con las mismas reglas" , () => {
      expect( updateSubscriptionSchema.safeParse( {amount: -5} ).success ).toBe( false ) ;
      expect( updateSubscriptionSchema.safeParse( {color: "azul"} ).success ).toBe( false ) ;
    } ) ;
  } ) ;
} ) ;
