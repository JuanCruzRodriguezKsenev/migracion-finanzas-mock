/**
 * @file cardsRepository.test.ts
 * Pruebas de integración del DAL de Tarjetas y agregación de saldos acotados por fecha.
 * Verifica aislamiento multi-tenant estricto y partición de saldo (facturado vs en curso, excluyendo reversados).
 */
// Librerías externas
import { describe , it , expect , beforeEach , afterEach , afterAll } from "vitest" ;

// Shared
import { db } from "@/shared/db/client" ;

// Feature: Accounting
import { accounts , ledgerTransactions , ledgerEntries , financialEntities } from "@/features/accounting/schema.db" ;
import { ledgerRepository }                                                 from "@/features/accounting/repositories/ledgerRepository" ;
import { accountRepository }                                                from "@/features/accounting/repositories/accountRepository" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Cards
import { cardsRepository }       from "./cardsRepository" ;
import { cards , cardAccounts } from "../schema.db" ;


describe( "cardsRepository — DAL de Tarjetas y Partición de Saldos por Fecha" , () => {
  let org1Id: string ;
  let org2Id: string ;

  const cleanDb = async () => {
    await db.delete( cardAccounts ) ;
    await db.delete( cards ) ;
    await db.delete( ledgerEntries ) ;
    await db.delete( ledgerTransactions ) ;
    await db.delete( accounts ) ;
    await db.delete( financialEntities ) ;
    await db.delete( organizations ) ;
  } ;

  beforeEach( async () => {
    await cleanDb() ;

    const [ org1 ] = await db
      .insert( organizations )
      .values( { name: "Org Alfa" , slug: "org-alfa" } )
      .returning() ;
    org1Id = org1.id ;

    const [ org2 ] = await db
      .insert( organizations )
      .values( { name: "Org Beta" , slug: "org-beta" } )
      .returning() ;
    org2Id = org2.id ;
  } ) ;

  afterEach( async () => {
    await cleanDb() ;
  } ) ;

  afterAll( async () => {
    await cleanDb() ;
  } ) ;

  describe( "Aislamiento Multi-Tenant Estricto" , () => {
    it( "una tarjeta de org1 no es visible ni consultable por org2" , async () => {
      const card = await cardsRepository.create( {
        organizationId:        org1Id ,
        label:                 "Visa Oro Alfa" ,
        type:                  "credit" ,
        network:               "visa" ,
        lastFour:              "1111" ,
        expiryMonth:           10 ,
        expiryYear:            2029 ,
        creditLimit:           100000000 ,
        closingDay:            20 ,
        dueDay:                5 ,
        monthlyMaintenanceFee: 0 ,
        annualRenewalFee:      0 ,
      } ) ;

      // 1. findAll para org2 no debe listar la tarjeta de org1
      const listOrg2 = await cardsRepository.findAll( org2Id ) ;
      expect( listOrg2.length ).toBe( 0 ) ;

      // 2. findById desde org2 debe retornar null
      const foundOrg2 = await cardsRepository.findById( card.id , org2Id ) ;
      expect( foundOrg2 ).toBeNull() ;

      // 3. findById desde org1 sí la encuentra
      const foundOrg1 = await cardsRepository.findById( card.id , org1Id ) ;
      expect( foundOrg1 ).not.toBeNull() ;
      expect( foundOrg1?.label ).toBe( "Visa Oro Alfa" ) ;
    } ) ;
  } ) ;

  describe( "Partición de Saldo con sumEntriesByAccountInRange" , () => {
    it( "discrimina consumos a un lado y al otro del cierre y excluye transacciones reversadas" , async () => {
      // 1. Crear cuenta contable de pasivo para la tarjeta
      const cardAccount = await accountRepository.create( {
        organizationId: org1Id ,
        code:           "2.1.01.01" ,
        name:           "Tarjeta Visa Test" ,
        type:           "liability" ,
        balance:        0 ,
        currency:       "ARS" ,
      } ) ;

      const cierreAnterior = new Date( "2026-01-25T23:59:59.999Z" ) ;
      const cierreActual   = new Date( "2026-02-25T23:59:59.999Z" ) ;

      // 2. Consumo A: 2026-02-10 (entra en el período facturado: cierreAnterior < fecha <= cierreActual)
      const [ txA ] = await db
        .insert( ledgerTransactions )
        .values( {
          organizationId: org1Id ,
          description:    "Supermercado (Facturado)" ,
          occurredAt:     new Date( "2026-02-10T14:00:00.000Z" ) ,
        } )
        .returning() ;

      await db.insert( ledgerEntries ).values( {
        transactionId: txA.id ,
        accountId:     cardAccount.id ,
        debit:         0 ,
        credit:        1000000 , // $10.000 ARS en centavos
        currency:      "ARS" ,
      } ) ;

      // 3. Consumo B: 2026-03-05 (entra en el período en curso: fecha > cierreActual)
      const [ txB ] = await db
        .insert( ledgerTransactions )
        .values( {
          organizationId: org1Id ,
          description:    "Combustible (En curso)" ,
          occurredAt:     new Date( "2026-03-05T18:00:00.000Z" ) ,
        } )
        .returning() ;

      await db.insert( ledgerEntries ).values( {
        transactionId: txB.id ,
        accountId:     cardAccount.id ,
        debit:         0 ,
        credit:        1500000 , // $15.000 ARS
        currency:      "ARS" ,
      } ) ;

      // 4. Consumo C: 2026-02-18 (en el período facturado, pero reversado con reversedAt set)
      const [ txC ] = await db
        .insert( ledgerTransactions )
        .values( {
          organizationId: org1Id ,
          description:    "Compra cancelada" ,
          occurredAt:     new Date( "2026-02-18T10:00:00.000Z" ) ,
          reversedAt:     new Date() , // Reversada
        } )
        .returning() ;

      await db.insert( ledgerEntries ).values( {
        transactionId: txC.id ,
        accountId:     cardAccount.id ,
        debit:         0 ,
        credit:        500000 , // $5.000 ARS
        currency:      "ARS" ,
      } ) ;

      // Verificación de Saldo Facturado: (cierreAnterior, cierreActual]
      const facturado = await ledgerRepository.sumEntriesByAccountInRange(
        cardAccount.id ,
        org1Id ,
        cierreAnterior ,
        cierreActual
      ) ;

      // Sólo debe contar Consumo A ($10.000). Consumo C fue reversado y no suma
      expect( facturado.credit ).toBe( 1000000 ) ;
      expect( facturado.debit ).toBe( 0 ) ;

      // Verificación de Saldo en Curso: > cierreActual
      const enCurso = await ledgerRepository.sumEntriesByAccountInRange(
        cardAccount.id ,
        org1Id ,
        cierreActual ,
        null
      ) ;

      // Sólo debe contar Consumo B ($15.000)
      expect( enCurso.credit ).toBe( 1500000 ) ;
      expect( enCurso.debit ).toBe( 0 ) ;

      // Aislamiento multi-tenant: la consulta sobre org2 no ve los consumos de org1
      const consultaOrg2 = await ledgerRepository.sumEntriesByAccountInRange(
        cardAccount.id ,
        org2Id ,
        cierreAnterior ,
        cierreActual
      ) ;
      expect( consultaOrg2.credit ).toBe( 0 ) ;
      expect( consultaOrg2.debit ).toBe( 0 ) ;
    } ) ;
  } ) ;
} ) ;
