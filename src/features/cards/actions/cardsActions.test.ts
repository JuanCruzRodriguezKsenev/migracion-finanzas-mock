/**
 * @file cardsActions.test.ts
 * Pruebas para Server Actions de Tarjetas (RFC 007).
 * Verifica la ramificación contable: débito no emite asiento, crédito con deuda emite Debe Patrimonio / Haber Tarjeta.
 */
// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach , afterAll } from "vitest" ;
import { eq , and }                                                         from "drizzle-orm" ;
import { getServerSession }                                                 from "next-auth" ;
import type { Session }                                                     from "next-auth" ;

// Shared
import { db }                       from "@/shared/db/client" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;

// Feature: Accounting & Auth
import { accounts , ledgerTransactions , ledgerEntries } from "@/features/accounting/schema.db" ;
import { organizations }                                 from "@/features/auth/schema.db" ;

// Feature: Cards
import { createCardAction } from "./cardsActions" ;
import { cardAccounts }     from "../schema.db" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

describe( "cardsActions.ts — Server Actions de Tarjetas" , () => {
  let orgId: string ;

  const cleanDb = async () => {
    await limpiarBase() ;
  } ;

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await cleanDb() ;

    const [ org ] = await db
      .insert( organizations )
      .values( { name: "Org Tarjetas Test" , slug: "org-tarjetas-test" } )
      .returning() ;
    orgId = org.id ;

    // El autor del asiento (created_by_user_id) tiene FK a users: la sesión simulada usa un usuario real
    const usuario = await crearUsuarioConMembresia( { organizationId: orgId , role: "owner" } ) ;

    vi.mocked( getServerSession ).mockResolvedValue( {
      user: { organizationId: orgId , id: usuario.id } ,
    } as unknown as Session ) ;
  } ) ;

  afterEach( async () => {
    await cleanDb() ;
  } ) ;

  afterAll( async () => {
    await cleanDb() ;
  } ) ;

  describe( "Alta de Tarjeta de Débito" , () => {
    it( "crea el plástico en cards sin generar cuenta de pasivo ni emitir asientos contables" , async () => {
      // Crear cuenta bancaria de activo a ser espejada
      const [ ctaBanco ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "1.1.01.01" ,
          name:           "Caja de Ahorro Santander" ,
          type:           "asset" ,
          balance:        5000000 , // $50.000 ARS
          currency:       "ARS" ,
        } )
        .returning() ;

      const res = await createCardAction( {
        label:           "Débito Santander" ,
        type:            "debit" ,
        network:         "visa" ,
        linkedAccountId: ctaBanco.id ,
        lastFour:        "1234" ,
        expiryMonth:     10 ,
        expiryYear:      2029 ,
        currency:        "ARS" ,
      } ) ;

      expect( res.success ).toBe( true ) ;
      if( !res.success ) { return ; }

      expect( res.value.type ).toBe( "debit" ) ;
      expect( res.value.linkedAccountId ).toBe( ctaBanco.id ) ;

      // 1. Verificar que NO haya filas en card_accounts
      const cardAccRows = await db.select().from( cardAccounts ) ;
      expect( cardAccRows.length ).toBe( 0 ) ;

      // 2. Verificar que NO haya transacciones contables emitidas
      const txRows = await db.select().from( ledgerTransactions ) ;
      expect( txRows.length ).toBe( 0 ) ;
    } ) ;
  } ) ;

  describe( "Alta de Tarjeta de Crédito y Asiento de Apertura" , () => {
    it( "crédito con deuda inicial emite asiento invertido: Debe Patrimonio / Haber Tarjeta" , async () => {
      // 1. Crear cuenta de patrimonio neto necesaria para el asiento de apertura
      const [ ctaPatrimonio ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "3.1.01.01" ,
          name:           "Patrimonio Neto Inicial" ,
          type:           "equity" ,
          balance:        100000000 , // $1.000.000 ARS
          currency:       "ARS" ,
        } )
        .returning() ;

      const deudaCentavos = 2500000 ; // $25.000,00 ARS adeudados previamente

      const res = await createCardAction( {
        label:                 "Visa Galicia Gold" ,
        type:                  "credit" ,
        network:               "visa" ,
        lastFour:              "5555" ,
        expiryMonth:           12 ,
        expiryYear:            2029 ,
        creditLimit:           50000000 ,
        closingDay:            25 ,
        dueDay:                5 ,
        currency:              "ARS" ,
        deudaInicial:          deudaCentavos ,
        monthlyMaintenanceFee: 0 ,
        annualRenewalFee:      0 ,
      } ) ;

      expect( res.success ).toBe( true ) ;
      if( !res.success ) { return ; }

      // 2. Verificar que se haya creado la cuenta de pasivo en accounts
      const cuentasPasivo = await db
        .select()
        .from( accounts )
        .where(
          and(
            eq( accounts.type , "liability" ) ,
            eq( accounts.organizationId , orgId ) ,
          )
        ) ;

      expect( cuentasPasivo.length ).toBe( 1 ) ;
      const ctaPasivo = cuentasPasivo[0] ;
      expect( ctaPasivo.type ).toBe( "liability" ) ;
      expect( ctaPasivo.currency ).toBe( "ARS" ) ;

      // 3. Verificar que card_accounts vincule la tarjeta con la cuenta
      const cardAccRows = await db.select().from( cardAccounts ) ;
      expect( cardAccRows.length ).toBe( 1 ) ;
      expect( cardAccRows[0].cardId ).toBe( res.value.id ) ;
      expect( cardAccRows[0].accountId ).toBe( ctaPasivo.id ) ;

      // 4. Verificar el asiento contable de apertura: Debe Patrimonio / Haber Tarjeta
      const txRows = await db.select().from( ledgerTransactions ) ;
      expect( txRows.length ).toBe( 1 ) ;
      expect( txRows[0].description ).toBe( "Apertura Visa Galicia Gold" ) ;

      const entries = await db.select().from( ledgerEntries ) ;
      expect( entries.length ).toBe( 2 ) ;

      const entryPatrimonio = entries.find( ( e ) => e.accountId === ctaPatrimonio.id ) ;
      const entryTarjeta    = entries.find( ( e ) => e.accountId === ctaPasivo.id ) ;

      expect( entryPatrimonio ).toBeDefined() ;
      expect( entryTarjeta ).toBeDefined() ;

      // Debe Patrimonio Neto: reduce patrimonio por el monto de la deuda preexistente
      expect( entryPatrimonio?.debit ).toBe( deudaCentavos ) ;
      expect( entryPatrimonio?.credit ).toBe( 0 ) ;

      // Haber Tarjeta de Crédito: incrementa el pasivo adeudado
      expect( entryTarjeta?.debit ).toBe( 0 ) ;
      expect( entryTarjeta?.credit ).toBe( deudaCentavos ) ;
    } ) ;

    it( "crédito con deuda 0 crea cuenta de pasivo pero no emite transacción contable" , async () => {
      const res = await createCardAction( {
        label:                 "Mastercard Cero" ,
        type:                  "credit" ,
        network:               "mastercard" ,
        lastFour:              "9999" ,
        expiryMonth:           11 ,
        expiryYear:            2029 ,
        closingDay:            20 ,
        dueDay:                10 ,
        currency:              "ARS" ,
        deudaInicial:          0 ,
        monthlyMaintenanceFee: 0 ,
        annualRenewalFee:      0 ,
      } ) ;

      expect( res.success ).toBe( true ) ;

      // Cero transacciones
      const txRows = await db.select().from( ledgerTransactions ) ;
      expect( txRows.length ).toBe( 0 ) ;

      // Pero sí existe cuenta de pasivo vinculada
      const cardAccRows = await db.select().from( cardAccounts ) ;
      expect( cardAccRows.length ).toBe( 1 ) ;
    } ) ;
  } ) ;
} ) ;
