// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Accounting
import { getNextCategoryCode } from "./categoryCodes" ;


describe( "categoryCodes — getNextCategoryCode (RFC 022 §4)" , () => {
  describe( "Padres (Nivel 1)" , () => {
    it( "debería generar el primer código de padre para expense (5.1.01)" , () => {
      const code = getNextCategoryCode( {
        type:     "expense" ,
        siblings: [] ,
      } ) ;

      expect( code ).toBe( "5.1.01" ) ;
    } ) ;

    it( "debería generar el primer código de padre para revenue (4.1.01)" , () => {
      const code = getNextCategoryCode( {
        type:     "revenue" ,
        siblings: [] ,
      } ) ;

      expect( code ).toBe( "4.1.01" ) ;
    } ) ;

    it( "debería calcular el siguiente correlativo numérico de dos dígitos" , () => {
      const code = getNextCategoryCode( {
        type:     "expense" ,
        siblings: [ "5.1.01" , "5.1.02" , "5.1.05" ] ,
      } ) ;

      expect( code ).toBe( "5.1.06" ) ;
    } ) ;
  } ) ;

  describe( "Hojas y anidamiento (Nivel 2)" , () => {
    it( "debería anidar correctamente bajo el prefijo del padre" , () => {
      const code = getNextCategoryCode( {
        type:       "expense" ,
        parentCode: "5.1.03" ,
        siblings:   [] ,
      } ) ;

      expect( code ).toBe( "5.1.03.01" ) ;
    } ) ;

    it( "debería correlacionar hijos ignorando nietos o hermanos de otro padre" , () => {
      const code = getNextCategoryCode( {
        type:       "expense" ,
        parentCode: "5.1.03" ,
        siblings:   [
          { accountCode: "5.1.03.01" } ,
          { accountCode: "5.1.03.02" } ,
          { accountCode: "5.1.04.01" } , // Hermano de otro padre
        ] ,
      } ) ;

      expect( code ).toBe( "5.1.03.03" ) ;
    } ) ;
  } ) ;

  describe( "Reserva del 99 para la hoja General" , () => {
    it( "no debe considerar el 99 como correlativo para no empujar la numeración a 100" , () => {
      const code = getNextCategoryCode( {
        type:       "expense" ,
        parentCode: "5.1.01" ,
        siblings:   [
          "5.1.01.01" ,
          "5.1.01.02" ,
          "5.1.01.99" , // Hoja General reservada
        ] ,
      } ) ;

      expect( code ).toBe( "5.1.01.03" ) ;
    } ) ;

    it( "debería devolver .99 cuando se solicita explícitamente la hoja del sistema" , () => {
      const parentLeaf = getNextCategoryCode( {
        type:         "expense" ,
        parentCode:   "5.1.04" ,
        siblings:     [] ,
        isSystemLeaf: true ,
      } ) ;

      expect( parentLeaf ).toBe( "5.1.04.99" ) ;

      const rootLeaf = getNextCategoryCode( {
        type:         "expense" ,
        siblings:     [] ,
        isSystemLeaf: true ,
      } ) ;

      expect( rootLeaf ).toBe( "5.1.99" ) ;
    } ) ;
  } ) ;

  describe( "Límites y validación" , () => {
    it( "debería fallar con mensaje explícito al llegar al límite de 98 hermanos" , () => {
      const maxSiblings = Array.from( { length: 98 } , ( _ , i ) => {
        return( `5.1.01.${String( i + 1 ).padStart( 2 , "0" )}` ) ;
      } ) ;

      expect( () => {
        getNextCategoryCode( {
          type:       "expense" ,
          parentCode: "5.1.01" ,
          siblings:   maxSiblings ,
        } ) ;
      } ).toThrow( "Se alcanzó el límite máximo de 98 categorías en este nivel." ) ;
    } ) ;

    it( "debería rechazar tipos contables no autorizados (sólo expense y revenue)" , () => {
      expect( () => {
        getNextCategoryCode( {
          type:     "asset" as unknown as "expense" ,
          siblings: [] ,
        } ) ;
      } ).toThrow( "Tipo de categoría inválido" ) ;
    } ) ;
  } ) ;
} ) ;
