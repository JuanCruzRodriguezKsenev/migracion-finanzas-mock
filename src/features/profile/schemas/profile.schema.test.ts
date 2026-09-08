/**
 * @file profile.schema.test.ts
 * Pruebas unitarias para el esquema de validación Zod de perfil de usuario.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Profile
import { updateProfileSchema } from "./profile.schema" ;


describe( "profile.schema.ts — Validación Zod de actualización de perfil" , () => {
  describe( "updateProfileSchema" , () => {
    it( "acepta una actualización parcial con códigos canónicos válidos" , () => {
      const res = updateProfileSchema.safeParse( {
        currency:         "ARS" ,
        timezone:         "America/Argentina/Buenos_Aires" ,
        numberFormat:     "es-AR" ,
        weeklyStart:      "monday" ,
        defaultView:      "dashboard" ,
        theme:            "dark" ,
        roundAmounts:     true ,
        includeTransfers: false ,
        fastLogin:        true ,
        phone:            "+54 9 11 1234 5678" ,
        bio:              "Financista" ,
        dateFormat:       "DD/MM/YYYY" ,
        defaultAccount:   "Caja de Ahorro" ,
      } ) ;

      expect( res.success ).toBe( true ) ;
    } ) ;

    it( "acepta objeto vacío al ser todos los campos opcionales" , () => {
      const res = updateProfileSchema.safeParse( {} ) ;
      expect( res.success ).toBe( true ) ;
    } ) ;

    it( "rechaza planName impidiendo que el cliente modifique su suscripción comercial" , () => {
      const res = updateProfileSchema.safeParse( {
        planName: "Premium" ,
      } ) ;

      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "rechaza planBilling impidiendo alterar la frecuencia de facturación" , () => {
      const res = updateProfileSchema.safeParse( {
        planBilling: "Anual" ,
      } ) ;

      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "rechaza planNextCharge impidiendo manipular la fecha de cobro" , () => {
      const res = updateProfileSchema.safeParse( {
        planNextCharge: "2099-01-01" ,
      } ) ;

      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "rechaza una etiqueta en español donde espera un código canónico de divisa" , () => {
      const invalido = updateProfileSchema.safeParse( {
        currency: "Peso argentino (ARS)" ,
      } ) ;
      expect( invalido.success ).toBe( false ) ;

      const valido = updateProfileSchema.safeParse( {
        currency: "ARS" ,
      } ) ;
      expect( valido.success ).toBe( true ) ;
    } ) ;

    it( "rechaza una etiqueta en español donde espera un identificador IANA de zona horaria" , () => {
      const invalido = updateProfileSchema.safeParse( {
        timezone: "(GMT-03:00) Buenos Aires" ,
      } ) ;
      expect( invalido.success ).toBe( false ) ;

      const valido = updateProfileSchema.safeParse( {
        timezone: "America/Argentina/Buenos_Aires" ,
      } ) ;
      expect( valido.success ).toBe( true ) ;
    } ) ;

    it( "rechaza una etiqueta donde espera un locale canónico para formato de números" , () => {
      const invalido = updateProfileSchema.safeParse( {
        numberFormat: "1.234,56" ,
      } ) ;
      expect( invalido.success ).toBe( false ) ;

      const valido = updateProfileSchema.safeParse( {
        numberFormat: "es-AR" ,
      } ) ;
      expect( valido.success ).toBe( true ) ;
    } ) ;

    it( "rechaza días en español donde espera códigos canónicos de día semanal" , () => {
      const invalido = updateProfileSchema.safeParse( {
        weeklyStart: "Lunes" ,
      } ) ;
      expect( invalido.success ).toBe( false ) ;

      const valido = updateProfileSchema.safeParse( {
        weeklyStart: "monday" ,
      } ) ;
      expect( valido.success ).toBe( true ) ;
    } ) ;

    it( "rechaza vistas con mayúsculas donde espera códigos canónicos" , () => {
      const invalido = updateProfileSchema.safeParse( {
        defaultView: "Dashboard" ,
      } ) ;
      expect( invalido.success ).toBe( false ) ;

      const valido = updateProfileSchema.safeParse( {
        defaultView: "dashboard" ,
      } ) ;
      expect( valido.success ).toBe( true ) ;
    } ) ;
  } ) ;
} ) ;
