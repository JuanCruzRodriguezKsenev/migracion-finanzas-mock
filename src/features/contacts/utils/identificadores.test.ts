/**
 * @file identificadores.test.ts
 * Pruebas unitarias para validadores puros de CBU/CVU, Alias y CUIT/CUIL.
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Contacts
import {
  validarCbu ,
  validarAlias ,
  validarCuit ,
  normalizarCbu ,
  normalizarAlias ,
  normalizarCuit
} from "./identificadores" ;


describe( "identificadores.ts — Validadores Puros" , () => {
  describe( "validarCbu" , () => {
    // CBU sintético válido con doble dígito verificador BCRA verificado
    const CBU_VALIDO = "0110002040000000000015" ;

    it( "valida correctamente un CBU con ambos dígitos verificadores correctos" , () => {
      expect( validarCbu( CBU_VALIDO ) ).toBe( true ) ;
    } ) ;

    it( "rechaza CBUs con longitud distinta de 22 dígitos" , () => {
      expect( validarCbu( "01100020400000000001" ) ).toBe( false ) ;
      expect( validarCbu( "01100020400000000000150" ) ).toBe( false ) ;
      expect( validarCbu( "" ) ).toBe( false ) ;
    } ) ;

    it( "rechaza CBUs con caracteres no numéricos" , () => {
      expect( validarCbu( "011000204000000000001A" ) ).toBe( false ) ;
    } ) ;

    it( "rechaza CBU cuando falla el primer dígito verificador (bloque 1)" , () => {
      // Alteramos el dígito 7 (DV1) de 0 a 9
      const cbuDv1Invalido = "0110002940000000000015" ;
      expect( validarCbu( cbuDv1Invalido ) ).toBe( false ) ;
    } ) ;

    it( "rechaza CBU cuando falla el segundo dígito verificador (bloque 2)" , () => {
      // Alteramos el dígito 21 (DV2) de 5 a 2
      const cbuDv2Invalido = "0110002040000000000012" ;
      expect( validarCbu( cbuDv2Invalido ) ).toBe( false ) ;
    } ) ;

    it( "normaliza CBU eliminando espacios y guiones intermedios" , () => {
      expect( normalizarCbu( " 011-0002-0 40000000000015 " ) ).toBe( "0110002040000000000015" ) ;
    } ) ;
  } ) ;

  describe( "validarAlias" , () => {
    it( "acepta alias válidos entre 6 y 20 caracteres con formato alfanumérico, puntos y guiones" , () => {
      expect( validarAlias( "pedro.mp" ) ).toBe( true ) ;
      expect( validarAlias( "juan-rodriguez" ) ).toBe( true ) ;
      expect( validarAlias( "BANCO.GALICIA.01" ) ).toBe( true ) ;
      expect( validarAlias( "cuenta123" ) ).toBe( true ) ;
    } ) ;

    it( "rechaza alias menores a 6 caracteres o mayores a 20" , () => {
      expect( validarAlias( "cbu" ) ).toBe( false ) ;
      expect( validarAlias( "alias" ) ).toBe( false ) ;
      expect( validarAlias( "este.es.un.alias.demasiado.largo.para.afip" ) ).toBe( false ) ;
    } ) ;

    it( "rechaza caracteres fuera del charset permitido (espacios, arrobas, barras, etc.)" , () => {
      expect( validarAlias( "mi alias" ) ).toBe( false ) ;
      expect( validarAlias( "usuario@mp" ) ).toBe( false ) ;
      expect( validarAlias( "cuenta/banco" ) ).toBe( false ) ;
      expect( validarAlias( "alias_invalido" ) ).toBe( false ) ;
    } ) ;

    it( "normaliza el alias a minúsculas y sin espacios" , () => {
      expect( normalizarAlias( "  PEDRO.MP  " ) ).toBe( "pedro.mp" ) ;
    } ) ;
  } ) ;

  describe( "validarCuit" , () => {
    it( "valida CUITs reales y sintéticos con módulo 11 correcto" , () => {
      expect( validarCuit( "33-69345023-9" ) ).toBe( true ) ;
      expect( validarCuit( "33693450239" ) ).toBe( true ) ;
      expect( validarCuit( "20-12345678-6" ) ).toBe( true ) ;
    } ) ;

    it( "rechaza CUIT con dígito verificador erróneo" , () => {
      expect( validarCuit( "33-69345023-4" ) ).toBe( false ) ;
      expect( validarCuit( "20-12345678-0" ) ).toBe( false ) ;
    } ) ;

    it( "rechaza CUIT con prefijo de tipo de persona inexistente" , () => {
      expect( validarCuit( "50-12345678-6" ) ).toBe( false ) ;
      expect( validarCuit( "10-12345678-6" ) ).toBe( false ) ;
    } ) ;

    it( "rechaza CUIT con longitud incorrecta" , () => {
      expect( validarCuit( "2012345678" ) ).toBe( false ) ;
      expect( validarCuit( "201234567890" ) ).toBe( false ) ;
    } ) ;

    it( "normaliza CUIT eliminando guiones y espacios" , () => {
      expect( normalizarCuit( " 33 - 69345023 - 9 " ) ).toBe( "33693450239" ) ;
    } ) ;
  } ) ;
} ) ;
