/**
 * @file cards.schema.test.ts
 * Pruebas unitarias para el esquema Zod de creación de tarjetas (RFC 007).
 * Valida modo strict de salvaguarda PCI (rechazo de cvv, pan, cardNumber) y reglas por tipo.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Cards
import { createCardSchema } from "./cards.schema" ;


describe( "cards.schema.ts — Validación Zod de Tarjetas y Salvaguarda PCI" , () => {
  const payloadBaseCredito = {
    label:                 "Visa Galicia Signature" ,
    type:                  "credit" as const ,
    network:               "visa" as const ,
    lastFour:              "4242" ,
    expiryMonth:           12 ,
    expiryYear:            2029 ,
    creditLimit:           500000000 ,
    closingDay:            25 ,
    dueDay:                5 ,
    interestRateFinancing: 8550 ,
    interestRatePenalty:   12000 ,
    monthlyMaintenanceFee: 0 ,
    annualRenewalFee:      0 ,
    deudaInicial:          0 ,
  } ;

  it( "acepta un payload válido de tarjeta de crédito" , () => {
    const res = createCardSchema.safeParse( payloadBaseCredito ) ;
    expect( res.success ).toBe( true ) ;
  } ) ;

  it( "rechaza lastFour no numérico" , () => {
    const res = createCardSchema.safeParse( {
      ...payloadBaseCredito ,
      lastFour: "abcd" ,
    } ) ;
    expect( res.success ).toBe( false ) ;
  } ) ;

  it( "rechaza lastFour con longitud diferente a 4 dígitos" , () => {
    const res = createCardSchema.safeParse( {
      ...payloadBaseCredito ,
      lastFour: "123" ,
    } ) ;
    expect( res.success ).toBe( false ) ;
  } ) ;

  describe( "Salvaguarda PCI-DSS por modo .strict() (rechazo expreso en runtime)" , () => {
    it( "rechaza payload que contenga 'cvv' (Defensa PCI 1)" , () => {
      const res = createCardSchema.safeParse( {
        ...payloadBaseCredito ,
        cvv: "123" ,
      } ) ;
      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "rechaza payload que contenga 'pan' (Defensa PCI 2)" , () => {
      const res = createCardSchema.safeParse( {
        ...payloadBaseCredito ,
        pan: "4509123456789012" ,
      } ) ;
      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "rechaza payload que contenga 'cardNumber' (Defensa PCI 3)" , () => {
      const res = createCardSchema.safeParse( {
        ...payloadBaseCredito ,
        cardNumber: "4509123456789012" ,
      } ) ;
      expect( res.success ).toBe( false ) ;
    } ) ;
  } ) ;

  describe( "Reglas condicionales por tipo de tarjeta (crédito vs débito)" , () => {
    it( "rechaza día de cierre en una tarjeta de débito" , () => {
      const res = createCardSchema.safeParse( {
        label:       "Débito Galicia" ,
        type:        "debit" ,
        network:     "visa" ,
        lastFour:    "1234" ,
        expiryMonth: 10 ,
        expiryYear:  2029 ,
        closingDay:  25 , // Inválido para débito
      } ) ;

      expect( res.success ).toBe( false ) ;
      if( !res.success ) {
        const errorPath = res.error.issues[0]?.path[0] ;
        expect( errorPath ).toBe( "closingDay" ) ;
      }
    } ) ;

    it( "rechaza día de vencimiento en una tarjeta de débito" , () => {
      const res = createCardSchema.safeParse( {
        label:       "Débito Santander" ,
        type:        "debit" ,
        network:     "visa" ,
        lastFour:    "1234" ,
        expiryMonth: 10 ,
        expiryYear:  2029 ,
        dueDay:      5 , // Inválido para débito
      } ) ;

      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "exige día de cierre y vencimiento para tarjetas de crédito" , () => {
      const res = createCardSchema.safeParse( {
        label:       "Crédito Incompleto" ,
        type:        "credit" ,
        network:     "mastercard" ,
        lastFour:    "9999" ,
        expiryMonth: 10 ,
        expiryYear:  2029 ,
      } ) ;

      expect( res.success ).toBe( false ) ;
    } ) ;

    it( "rechaza tarjeta vencida" , () => {
      const res = createCardSchema.safeParse( {
        ...payloadBaseCredito ,
        expiryYear:  2020 ,
        expiryMonth: 1 ,
      } ) ;

      expect( res.success ).toBe( false ) ;
    } ) ;
  } ) ;
} ) ;
