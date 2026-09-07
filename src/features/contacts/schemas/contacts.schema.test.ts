/**
 * @file contacts.schema.test.ts
 * Pruebas unitarias para esquemas Zod de Contactos y Métodos de Cobro.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Contacts
import { contactFormSchema , paymentMethodFormSchema } from "./contacts.schema" ;


describe( "contacts.schema.ts — Validación de Formularios Zod" , () => {
  describe( "contactFormSchema" , () => {
    it( "valida correctamente datos válidos" , () => {
      const res = contactFormSchema.safeParse( {
        name:  "Lionel Messi" ,
        email: "lio@afa.com.ar" ,
        phone: "+5491112345678" ,
        notes: "Capitán" ,
      } ) ;
      expect( res.success ).toBe( true ) ;
    } ) ;

    it( "rechaza nombre menor a 2 caracteres" , () => {
      const res = contactFormSchema.safeParse( { name: "L" } ) ;
      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "rechaza email con formato inválido" , () => {
      const res = contactFormSchema.safeParse( { name: "Lionel" , email: "no-es-email" } ) ;
      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "acepta campos opcionales vacíos" , () => {
      const res = contactFormSchema.safeParse( { name: "Lionel" , email: "" , phone: "" , notes: "" } ) ;
      expect( res.success ).toBe( true ) ;
    } ) ;
  } ) ;

  describe( "paymentMethodFormSchema" , () => {
    const VALID_ENTITY_UUID = "11111111-1111-4111-8111-111111111111" ;
    const VALID_CBU         = "0110002040000000000015" ;
    const VALID_CUIT        = "33-69345023-9" ;

    it( "valida método de cobro con CBU válido" , () => {
      const res = paymentMethodFormSchema.safeParse( {
        financialEntityId: VALID_ENTITY_UUID ,
        type:              "bank_account" ,
        cbuCvu:            VALID_CBU ,
      } ) ;
      expect( res.success ).toBe( true ) ;
    } ) ;

    it( "valida método de cobro con Alias válido" , () => {
      const res = paymentMethodFormSchema.safeParse( {
        financialEntityId: VALID_ENTITY_UUID ,
        type:              "wallet" ,
        alias:             "pedro.mp" ,
      } ) ;
      expect( res.success ).toBe( true ) ;
    } ) ;

    it( "rechaza si no se ingresa ni CBU ni Alias" , () => {
      const res = paymentMethodFormSchema.safeParse( {
        financialEntityId: VALID_ENTITY_UUID ,
        type:              "wallet" ,
      } ) ;
      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "rechaza CBU con dígito verificador inválido" , () => {
      const res = paymentMethodFormSchema.safeParse( {
        financialEntityId: VALID_ENTITY_UUID ,
        type:              "bank_account" ,
        cbuCvu:            "0110002040000000000019" , // DV2 erróneo
      } ) ;
      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "rechaza CUIT de titular con módulo 11 inválido" , () => {
      const res = paymentMethodFormSchema.safeParse( {
        financialEntityId: VALID_ENTITY_UUID ,
        type:              "wallet" ,
        alias:             "pedro.mp" ,
        holderTaxId:       "33-69345023-1" , // DV erróneo
      } ) ;
      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "acepta CUIT válido de titular y lo normaliza sin guiones" , () => {
      const res = paymentMethodFormSchema.safeParse( {
        financialEntityId: VALID_ENTITY_UUID ,
        type:              "wallet" ,
        alias:             "pedro.mp" ,
        holderTaxId:       VALID_CUIT ,
      } ) ;
      expect( res.success ).toBe( true ) ;
      if( res.success ) {
        expect( res.data.holderTaxId ).toBe( "33693450239" ) ;
      }
    } ) ;
  } ) ;
} ) ;
