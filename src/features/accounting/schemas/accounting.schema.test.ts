// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Accounting
import { createTransactionSchema , createAccountSchema , createFinancialEntitySchema } from "./accounting.schema" ;


const UUID_A = "11111111-1111-4111-8111-111111111111" ;
const UUID_B = "22222222-2222-4222-8222-222222222222" ;

/**
 * Suite de pruebas unitarias para los esquemas Zod del módulo contable.
 * Pinea el invariante de partida doble (balance cero) en la primera línea de defensa
 * de validación en runtime, antes de llegar al servicio y a la base de datos.
 */
describe( "accounting.schema" , () => {
  describe( "createTransactionSchema" , () => {
    it( "debería aceptar una transacción balanceada válida" , () => {
      const resultado = createTransactionSchema.safeParse( {
        description: "Transacción válida" ,
        entries: [
          { accountId: UUID_A , debit: 1000 , credit: 0 } ,
          { accountId: UUID_B , debit: 0    , credit: 1000 } ,
        ] ,
      } ) ;

      expect( resultado.success ).toBe( true ) ;
    } ) ;

    it( "debería rechazar una transacción desbalanceada (débitos != créditos)" , () => {
      const resultado = createTransactionSchema.safeParse( {
        description: "Transacción desbalanceada" ,
        entries: [
          { accountId: UUID_A , debit: 1000 , credit: 0 } ,
          { accountId: UUID_B , debit: 0    , credit: 900 } ,
        ] ,
      } ) ;

      expect( resultado.success ).toBe( false ) ;
    } ) ;

    it( "debería rechazar una transacción con menos de dos entradas" , () => {
      const resultado = createTransactionSchema.safeParse( {
        description: "Transacción incompleta" ,
        entries: [
          { accountId: UUID_A , debit: 1000 , credit: 0 } ,
        ] ,
      } ) ;

      expect( resultado.success ).toBe( false ) ;
    } ) ;

    it( "debería rechazar entradas sin ninguna entrada (array vacío)" , () => {
      const resultado = createTransactionSchema.safeParse( {
        description: "Sin entradas" ,
        entries: [] ,
      } ) ;

      expect( resultado.success ).toBe( false ) ;
    } ) ;

    it( "debería rechazar un débito negativo" , () => {
      const resultado = createTransactionSchema.safeParse( {
        description: "Débito negativo" ,
        entries: [
          { accountId: UUID_A , debit: -1000 , credit: 0 } ,
          { accountId: UUID_B , debit: 0      , credit: -1000 } ,
        ] ,
      } ) ;

      expect( resultado.success ).toBe( false ) ;
    } ) ;

    it( "debería rechazar un accountId que no sea un UUID válido" , () => {
      const resultado = createTransactionSchema.safeParse( {
        description: "UUID inválido" ,
        entries: [
          { accountId: "no-es-un-uuid" , debit: 1000 , credit: 0 } ,
          { accountId: UUID_B          , debit: 0    , credit: 1000 } ,
        ] ,
      } ) ;

      expect( resultado.success ).toBe( false ) ;
    } ) ;

    it( "debería rechazar una descripción demasiado corta" , () => {
      const resultado = createTransactionSchema.safeParse( {
        description: "AB" ,
        entries: [
          { accountId: UUID_A , debit: 1000 , credit: 0 } ,
          { accountId: UUID_B , debit: 0    , credit: 1000 } ,
        ] ,
      } ) ;

      expect( resultado.success ).toBe( false ) ;
    } ) ;
  } ) ;

  describe( "createAccountSchema" , () => {
    it( "debería aceptar un tipo de cuenta válido" , () => {
      const resultado = createAccountSchema.safeParse( {name: "Banco" , type: "asset"} ) ;
      expect( resultado.success ).toBe( true ) ;
    } ) ;

    it( "debería rechazar un tipo de cuenta inválido" , () => {
      const resultado = createAccountSchema.safeParse( {name: "Banco" , type: "invalido"} ) ;
      expect( resultado.success ).toBe( false ) ;
    } ) ;

    it( "debería rechazar un saldo con decimales (no entero en centavos)" , () => {
      const resultado = createAccountSchema.safeParse( {name: "Banco" , type: "asset" , balance: 100.5} ) ;
      expect( resultado.success ).toBe( false ) ;
    } ) ;
  } ) ;

  describe( "createFinancialEntitySchema" , () => {
    it( "debería aceptar un color hexadecimal válido" , () => {
      const resultado = createFinancialEntitySchema.safeParse( {name: "Banco Galicia" , color: "#FF00AA"} ) ;
      expect( resultado.success ).toBe( true ) ;
    } ) ;

    it( "debería rechazar un color que no sea hexadecimal válido" , () => {
      const resultado = createFinancialEntitySchema.safeParse( {name: "Banco Galicia" , color: "rojo"} ) ;
      expect( resultado.success ).toBe( false ) ;
    } ) ;

    it( "debería rechazar un saldo inicial negativo" , () => {
      const resultado = createFinancialEntitySchema.safeParse( {name: "Banco Galicia" , balance: -100} ) ;
      expect( resultado.success ).toBe( false ) ;
    } ) ;
  } ) ;
} ) ;
