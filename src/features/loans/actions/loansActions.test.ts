/**
 * @file loansActions.test.ts
 * Pruebas de integración para las Server Actions de préstamos (RFC 008).
 * Valida los casos obligatorios §8.1 a §8.7: balance Debe/Haber, signo de deuda,
 * idempotencia, orden secuencial, divisa cruzada, invariante XOR de contraparte y amortización tasa cero.
 */
// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach , afterAll } from "vitest" ;
import { eq }                                                               from "drizzle-orm" ;
import { getServerSession }                                                 from "next-auth" ;
import type { Session }                                                     from "next-auth" ;

// Shared
import { db }                       from "@/shared/db/client" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import {
  accounts ,
  categories ,
  ledgerTransactions ,
  ledgerEntries ,
  financialEntities
} from "@/features/accounting/schema.db" ;
import { deudaDe } from "@/features/cards/utils/ciclo" ;

// Feature: Contacts
import { contacts } from "@/features/contacts/schema.db" ;

// Feature: Loans
import {
  createLoanAction ,
  payLoanInstallmentAction ,
  getLoansAction ,
  archiveLoanAction
} from "./loansActions" ;
import { loansRepository } from "../repositories/loansRepository" ;
import { loans }           from "../schema.db" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn()
} ) ) ;

vi.mock( "next/cache" , () => ( {
  revalidatePath: vi.fn()
} ) ) ;

describe( "loansActions.ts — Server Actions de Préstamos (RFC 008)" , () => {
  let orgId:     string ;
  let bankEntId: string ;
  let contactId: string ;

  const cleanDb = async () => {
    await limpiarBase() ;
  } ;

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await cleanDb() ;

    const [ org ] = await db
      .insert( organizations )
      .values( { name: "Org Loans Test" , slug: "org-loans-test" } )
      .returning() ;
    orgId = org.id ;

    const [ fe ] = await db
      .insert( financialEntities )
      .values( {
        organizationId: orgId ,
        name:           "Banco Galicia" ,
        logo:           "bank" ,
        color:          "#FF0000"
      } )
      .returning() ;
    bankEntId = fe.id ;

    const [ ct ] = await db
      .insert( contacts )
      .values( {
        organizationId: orgId ,
        name:           "Pedro Perez"
      } )
      .returning() ;
    contactId = ct.id ;

    // El autor del asiento (created_by_user_id) tiene FK a users: la sesión simulada usa un usuario real
    const usuario = await crearUsuarioConMembresia( { organizationId: orgId , role: "owner" } ) ;

    vi.mocked( getServerSession ).mockResolvedValue( {
      user: { organizationId: orgId , id: usuario.id }
    } as unknown as Session ) ;
  } ) ;

  afterEach( async () => {
    await cleanDb() ;
  } ) ;

  afterAll( async () => {
    await cleanDb() ;
  } ) ;

  describe( "§8.1 Debe = Haber por divisa en los cinco asientos de §5" , () => {
    it( "cumple Debe = Haber en §5A (borrowed con desembolso)" , async () => {
      const [ ctaBanco ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "1.1.01.01" ,
          name:           "Caja de Ahorro ARS" ,
          type:           "asset" ,
          balance:        0 ,
          currency:       "ARS"
        } )
        .returning() ;

      const res = await createLoanAction( {
        name:                   "Préstamo Galicia Desembolso" ,
        direction:              "borrowed" ,
        entityId:               bankEntId ,
        principalAmount:        1000000 , // $10.000,00
        currency:               "ARS" ,
        interestRateAnnual:     5000 ,
        totalInstallments:      12 ,
        frequency:              "monthly" ,
        intervalCount:          1 ,
        startDate:              new Date( "2026-09-01T12:00:00Z" ) ,
        firstInstallmentDate:   "2026-10-10" ,
        disbursementAccountId: ctaBanco.id
      } ) ;

      expect( res.success ).toBe( true ) ;

      const txs = await db.select().from( ledgerTransactions ) ;
      expect( txs ).toHaveLength( 1 ) ;

      const entries = await db.select().from( ledgerEntries ) ;
      expect( entries ).toHaveLength( 2 ) ;

      const sumDebit  = entries.reduce( ( acc , e ) => acc + e.debit , 0 ) ;
      const sumCredit = entries.reduce( ( acc , e ) => acc + e.credit , 0 ) ;
      expect( sumDebit ).toBe( 1000000 ) ;
      expect( sumCredit ).toBe( 1000000 ) ;
    } ) ;

    it( "cumple Debe = Haber en §5B (lent con desembolso)" , async () => {
      const [ ctaBanco ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "1.1.01.01" ,
          name:           "Caja de Ahorro ARS" ,
          type:           "asset" ,
          balance:        5000000 ,
          currency:       "ARS"
        } )
        .returning() ;

      const res = await createLoanAction( {
        name:                   "Préstamo a Pedro" ,
        direction:              "lent" ,
        contactId ,
        principalAmount:        2000000 , // $20.000,00
        currency:               "ARS" ,
        interestRateAnnual:     3000 ,
        totalInstallments:      6 ,
        frequency:              "monthly" ,
        intervalCount:          1 ,
        startDate:              new Date( "2026-09-01T12:00:00Z" ) ,
        firstInstallmentDate:   "2026-10-10" ,
        disbursementAccountId: ctaBanco.id
      } ) ;

      expect( res.success ).toBe( true ) ;

      const entries = await db.select().from( ledgerEntries ) ;
      const sumDebit  = entries.reduce( ( acc , e ) => acc + e.debit , 0 ) ;
      const sumCredit = entries.reduce( ( acc , e ) => acc + e.credit , 0 ) ;
      expect( sumDebit ).toBe( 2000000 ) ;
      expect( sumCredit ).toBe( 2000000 ) ;
    } ) ;

    it( "cumple Debe = Haber en §5C (preexistente borrowed y lent contra PN)" , async () => {
      // Cuenta de patrimonio neto
      await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "3.1.01.01" ,
          name:           "Patrimonio Neto" ,
          type:           "equity" ,
          balance:        10000000 ,
          currency:       "ARS"
        } ) ;

      // 1. borrowed preexistente
      const resBorrowed = await createLoanAction( {
        name:                 "Préstamo Viejo Galicia" ,
        direction:            "borrowed" ,
        entityId:             bankEntId ,
        principalAmount:      500000 ,
        currency:             "ARS" ,
        interestRateAnnual:   0 ,
        totalInstallments:    5 ,
        frequency:            "monthly" ,
        intervalCount:        1 ,
        startDate:            new Date( "2026-01-01T12:00:00Z" ) ,
        firstInstallmentDate: "2026-02-10"
      } ) ;
      expect( resBorrowed.success ).toBe( true ) ;

      // 2. lent preexistente
      const resLent = await createLoanAction( {
        name:                 "Préstamo Viejo Pedro" ,
        direction:            "lent" ,
        contactId ,
        principalAmount:      300000 ,
        currency:             "ARS" ,
        interestRateAnnual:   0 ,
        totalInstallments:    3 ,
        frequency:            "monthly" ,
        intervalCount:        1 ,
        startDate:            new Date( "2026-01-01T12:00:00Z" ) ,
        firstInstallmentDate: "2026-02-10"
      } ) ;
      expect( resLent.success ).toBe( true ) ;

      const entries = await db.select().from( ledgerEntries ) ;
      const sumDebit  = entries.reduce( ( acc , e ) => acc + e.debit , 0 ) ;
      const sumCredit = entries.reduce( ( acc , e ) => acc + e.credit , 0 ) ;
      expect( sumDebit ).toBe( 800000 ) ;
      expect( sumCredit ).toBe( 800000 ) ;
    } ) ;

    it( "cumple Debe = Haber por divisa en §5D (pago borrowed con 3 patas: capital, interes y cuota)" , async () => {
      // Cuenta bancaria para pagar
      const [ ctaBanco ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "1.1.01.01" ,
          name:           "Caja de Ahorro ARS" ,
          type:           "asset" ,
          balance:        5000000 ,
          currency:       "ARS"
        } )
        .returning() ;

      // Categoría de intereses del catálogo: 5.1.11.02
      await db
        .insert( categories )
        .values( {
          organizationId: orgId ,
          name:           "Intereses" ,
          type:           "expense" ,
          accountCode:    "5.1.11.02" ,
          isSystemLeaf:   true
        } ) ;

      const resAlta = await createLoanAction( {
        name:                   "Préstamo Galicia 3 Patas" ,
        direction:              "borrowed" ,
        entityId:               bankEntId ,
        principalAmount:        1000000 ,
        currency:               "ARS" ,
        interestRateAnnual:     6000 , // 60% TNA
        totalInstallments:      12 ,
        frequency:              "monthly" ,
        intervalCount:          1 ,
        startDate:              new Date( "2026-09-01T12:00:00Z" ) ,
        firstInstallmentDate:   "2026-10-10" ,
        disbursementAccountId: ctaBanco.id
      } ) ;
      expect( resAlta.success ).toBe( true ) ;
      if( !resAlta.success ) { return ; }

      const loanId = resAlta.value.id ;

      // Pagar cuota 1 parada en 2026-10-15
      const resPago = await payLoanInstallmentAction( {
        loanId ,
        paymentAccountId:  ctaBanco.id ,
        installmentNumber: 1 ,
        hoyCivil:          "2026-10-15"
      } ) ;
      expect( resPago.success ).toBe( true ) ;
      if( !resPago.success ) { return ; }

      // Inspeccionar las entradas del asiento del pago (la segunda transacción)
      const txId = resPago.value.transactionId ;
      const entriesPago = await db
        .select()
        .from( ledgerEntries )
        .where( eq( ledgerEntries.transactionId , txId ) ) ;

      expect( entriesPago ).toHaveLength( 3 ) ; // 3 patas: préstamo, intereses, banco
      const debit  = entriesPago.reduce( ( acc , e ) => acc + e.debit , 0 ) ;
      const credit = entriesPago.reduce( ( acc , e ) => acc + e.credit , 0 ) ;
      expect( debit ).toBe( credit ) ;
      expect( entriesPago.every( ( e ) => e.currency === "ARS" ) ).toBe( true ) ;
    } ) ;

    it( "cumple Debe = Haber por divisa en §5E (cobro lent con 3 patas: cuota, capital e interes)" , async () => {
      const [ ctaBanco ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "1.1.01.01" ,
          name:           "Caja de Ahorro ARS" ,
          type:           "asset" ,
          balance:        5000000 ,
          currency:       "ARS"
        } )
        .returning() ;

      // Categoría padre del catálogo: 4.1.04
      await db
        .insert( categories )
        .values( {
          organizationId: orgId ,
          name:           "Intereses y rendimientos" ,
          type:           "revenue" ,
          accountCode:    "4.1.04" ,
          isSystemLeaf:   false
        } ) ;

      const resAlta = await createLoanAction( {
        name:                   "Préstamo a Pedro con Interés" ,
        direction:              "lent" ,
        contactId ,
        principalAmount:        1000000 ,
        currency:               "ARS" ,
        interestRateAnnual:     4000 ,
        totalInstallments:      6 ,
        frequency:              "monthly" ,
        intervalCount:          1 ,
        startDate:              new Date( "2026-09-01T12:00:00Z" ) ,
        firstInstallmentDate:   "2026-10-10" ,
        disbursementAccountId: ctaBanco.id
      } ) ;
      expect( resAlta.success ).toBe( true ) ;
      if( !resAlta.success ) { return ; }

      const resCobro = await payLoanInstallmentAction( {
        loanId:            resAlta.value.id ,
        paymentAccountId:  ctaBanco.id ,
        installmentNumber: 1 ,
        hoyCivil:          "2026-10-15"
      } ) ;
      expect( resCobro.success ).toBe( true ) ;
      if( !resCobro.success ) { return ; }

      const entriesCobro = await db
        .select()
        .from( ledgerEntries )
        .where( eq( ledgerEntries.transactionId , resCobro.value.transactionId ) ) ;

      expect( entriesCobro ).toHaveLength( 3 ) ;
      const debit  = entriesCobro.reduce( ( acc , e ) => acc + e.debit , 0 ) ;
      const credit = entriesCobro.reduce( ( acc , e ) => acc + e.credit , 0 ) ;
      expect( debit ).toBe( credit ) ;
      expect( entriesCobro.every( ( e ) => e.currency === "ARS" ) ).toBe( true ) ;
    } ) ;
  } ) ;

  describe( "§8.2 Signo contable de la deuda y deudas exigibles" , () => {
    it( "un borrowed recién dado de alta tiene balance negativo y deudaDe() positivo; un lent tiene los dos positivos" , async () => {
      const [ ctaBanco ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "1.1.01.01" ,
          name:           "Caja de Ahorro ARS" ,
          type:           "asset" ,
          balance:        5000000 ,
          currency:       "ARS"
        } )
        .returning() ;

      // 1. Borrowed
      const resBorrowed = await createLoanAction( {
        name:                   "Préstamo Borrowed Signo" ,
        direction:              "borrowed" ,
        entityId:               bankEntId ,
        principalAmount:        1000000 , // 10.000 ARS
        currency:               "ARS" ,
        interestRateAnnual:     0 ,
        totalInstallments:      10 ,
        frequency:              "monthly" ,
        intervalCount:          1 ,
        startDate:              new Date( "2026-09-01T12:00:00Z" ) ,
        firstInstallmentDate:   "2026-10-10" ,
        disbursementAccountId: ctaBanco.id
      } ) ;
      expect( resBorrowed.success ).toBe( true ) ;
      if( !resBorrowed.success ) { return ; }

      const cuentasB = await loansRepository.findAccountsByLoanId( resBorrowed.value.id , orgId ) ;
      const ctaEspejoB = cuentasB[ 0 ].account ;
      expect( ctaEspejoB.balance ).toBe( -1000000 ) ;
      expect( deudaDe( ctaEspejoB ) ).toBe( 1000000 ) ;

      // 2. Lent
      const resLent = await createLoanAction( {
        name:                   "Préstamo Lent Signo" ,
        direction:              "lent" ,
        contactId ,
        principalAmount:        2000000 , // 20.000 ARS
        currency:               "ARS" ,
        interestRateAnnual:     0 ,
        totalInstallments:      10 ,
        frequency:              "monthly" ,
        intervalCount:          1 ,
        startDate:              new Date( "2026-09-01T12:00:00Z" ) ,
        firstInstallmentDate:   "2026-10-10" ,
        disbursementAccountId: ctaBanco.id
      } ) ;
      expect( resLent.success ).toBe( true ) ;
      if( !resLent.success ) { return ; }

      const cuentasL = await loansRepository.findAccountsByLoanId( resLent.value.id , orgId ) ;
      const ctaEspejoL = cuentasL[ 0 ].account ;
      expect( ctaEspejoL.balance ).toBe( 2000000 ) ;
      expect( ctaEspejoL.balance > 0 ).toBe( true ) ;
    } ) ;
  } ) ;

  describe( "§8.3 Idempotencia" , () => {
    it( "confirmar dos veces la misma cuota escribe un solo asiento y la segunda falla" , async () => {
      const [ ctaBanco ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "1.1.01.01" ,
          name:           "Caja ARS" ,
          type:           "asset" ,
          balance:        5000000 ,
          currency:       "ARS"
        } )
        .returning() ;

      const resAlta = await createLoanAction( {
        name:                   "Préstamo Idempotente" ,
        direction:              "borrowed" ,
        entityId:               bankEntId ,
        principalAmount:        120000 ,
        currency:               "ARS" ,
        interestRateAnnual:     0 ,
        totalInstallments:      3 ,
        frequency:              "monthly" ,
        intervalCount:          1 ,
        startDate:              new Date( "2026-09-01T12:00:00Z" ) ,
        firstInstallmentDate:   "2026-10-10" ,
        disbursementAccountId: ctaBanco.id
      } ) ;
      expect( resAlta.success ).toBe( true ) ;
      if( !resAlta.success ) { return ; }

      const loanId = resAlta.value.id ;

      // Primera confirmación
      const intento1 = await payLoanInstallmentAction( {
        loanId ,
        paymentAccountId:  ctaBanco.id ,
        installmentNumber: 1 ,
        hoyCivil:          "2026-10-15"
      } ) ;
      expect( intento1.success ).toBe( true ) ;

      const txCount1 = ( await db.select().from( ledgerTransactions ) ).length ;

      // Segunda confirmación repetida de la misma cuota
      const intento2 = await payLoanInstallmentAction( {
        loanId ,
        paymentAccountId:  ctaBanco.id ,
        installmentNumber: 1 ,
        hoyCivil:          "2026-10-15"
      } ) ;
      expect( intento2.success ).toBe( false ) ;

      // No se agregó ningún asiento nuevo
      const txCount2 = ( await db.select().from( ledgerTransactions ) ).length ;
      expect( txCount2 ).toBe( txCount1 ) ;
    } ) ;
  } ) ;

  describe( "§8.4 Orden secuencial estricto" , () => {
    it( "confirmar una cuota que no es la más antigua pendiente falla sin escribir nada" , async () => {
      const [ ctaBanco ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "1.1.01.01" ,
          name:           "Caja ARS" ,
          type:           "asset" ,
          balance:        5000000 ,
          currency:       "ARS"
        } )
        .returning() ;

      const resAlta = await createLoanAction( {
        name:                   "Préstamo Orden" ,
        direction:              "borrowed" ,
        entityId:               bankEntId ,
        principalAmount:        300000 ,
        currency:               "ARS" ,
        interestRateAnnual:     0 ,
        totalInstallments:      3 ,
        frequency:              "monthly" ,
        intervalCount:          1 ,
        startDate:              new Date( "2026-09-01T12:00:00Z" ) ,
        firstInstallmentDate:   "2026-10-10" ,
        disbursementAccountId: ctaBanco.id
      } ) ;
      expect( resAlta.success ).toBe( true ) ;
      if( !resAlta.success ) { return ; }

      const loanId = resAlta.value.id ;
      const txCountAntes = ( await db.select().from( ledgerTransactions ) ).length ;

      // Intentar pagar directamente la cuota 2 estando pendiente la 1
      const resPagoCuota2 = await payLoanInstallmentAction( {
        loanId ,
        paymentAccountId:  ctaBanco.id ,
        installmentNumber: 2 ,
        hoyCivil:          "2026-11-15"
      } ) ;

      expect( resPagoCuota2.success ).toBe( false ) ;
      expect( resPagoCuota2.error ).toContain( "no es la más antigua" ) ;

      const txCountDespues = ( await db.select().from( ledgerTransactions ) ).length ;
      expect( txCountDespues ).toBe( txCountAntes ) ;
    } ) ;
  } ) ;

  describe( "§8.5 Divisa cruzada" , () => {
    it( "pagar una cuota de un préstamo en USD desde una cuenta en ARS se rechaza" , async () => {
      const [ ctaARS ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "1.1.01.01" ,
          name:           "Caja ARS" ,
          type:           "asset" ,
          balance:        5000000 ,
          currency:       "ARS"
        } )
        .returning() ;

      const [ ctaUSD ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "1.1.01.02" ,
          name:           "Caja USD" ,
          type:           "asset" ,
          balance:        1000000 ,
          currency:       "USD"
        } )
        .returning() ;

      const resAlta = await createLoanAction( {
        name:                   "Préstamo en Dólares" ,
        direction:              "borrowed" ,
        entityId:               bankEntId ,
        principalAmount:        500000 , // $5.000 USD
        currency:               "USD" ,
        interestRateAnnual:     1000 ,
        totalInstallments:      5 ,
        frequency:              "monthly" ,
        intervalCount:          1 ,
        startDate:              new Date( "2026-09-01T12:00:00Z" ) ,
        firstInstallmentDate:   "2026-10-10" ,
        disbursementAccountId: ctaUSD.id
      } ) ;
      expect( resAlta.success ).toBe( true ) ;
      if( !resAlta.success ) { return ; }

      // Intentar pagar desde la cuenta en ARS
      const resPagoCruzado = await payLoanInstallmentAction( {
        loanId:            resAlta.value.id ,
        paymentAccountId:  ctaARS.id ,
        installmentNumber: 1 ,
        hoyCivil:          "2026-10-15"
      } ) ;

      expect( resPagoCruzado.success ).toBe( false ) ;
      expect( resPagoCruzado.error ).toContain( "no coincide con la del préstamo" ) ;
    } ) ;
  } ) ;

  describe( "§8.6 Contraparte XOR" , () => {
    it( "un alta con entityId y contactId, y otra con ninguno, se rechazan" , async () => {
      // 1. Ambos provistos
      const conAmbos = await createLoanAction( {
        name:                 "Préstamo Ambos" ,
        direction:            "borrowed" ,
        entityId:             bankEntId ,
        contactId ,
        principalAmount:      100000 ,
        currency:             "ARS" ,
        startDate:            new Date( "2026-09-01T12:00:00Z" ) ,
        firstInstallmentDate: "2026-10-10"
      } ) ;
      expect( conAmbos.success ).toBe( false ) ;
      expect( conAmbos.error ).toContain( "exactamente una contraparte" ) ;

      // 2. Ninguno provisto
      const conNinguno = await createLoanAction( {
        name:                 "Préstamo Ninguno" ,
        direction:            "borrowed" ,
        principalAmount:      100000 ,
        currency:             "ARS" ,
        startDate:            new Date( "2026-09-01T12:00:00Z" ) ,
        firstInstallmentDate: "2026-10-10"
      } ) ;
      expect( conNinguno.success ).toBe( false ) ;
      expect( conNinguno.error ).toContain( "exactamente una contraparte" ) ;
    } ) ;
  } ) ;

  describe( "§8.7 Amortización con tasa cero y asientos de dos patas" , () => {
    it( "con interestRateAnnual = 0 la cuota es capital puro y el asiento tiene dos patas, no tres" , async () => {
      const [ ctaBanco ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "1.1.01.01" ,
          name:           "Caja ARS" ,
          type:           "asset" ,
          balance:        5000000 ,
          currency:       "ARS"
        } )
        .returning() ;

      const resAlta = await createLoanAction( {
        name:                   "Préstamo Tasa Cero" ,
        direction:              "borrowed" ,
        contactId ,
        principalAmount:        300000 , // $3.000,00
        currency:               "ARS" ,
        interestRateAnnual:     0 ,
        totalInstallments:      3 ,
        frequency:              "monthly" ,
        intervalCount:          1 ,
        startDate:              new Date( "2026-09-01T12:00:00Z" ) ,
        firstInstallmentDate:   "2026-10-10" ,
        disbursementAccountId: ctaBanco.id
      } ) ;
      expect( resAlta.success ).toBe( true ) ;
      if( !resAlta.success ) { return ; }

      const resPago = await payLoanInstallmentAction( {
        loanId:            resAlta.value.id ,
        paymentAccountId:  ctaBanco.id ,
        installmentNumber: 1 ,
        hoyCivil:          "2026-10-15"
      } ) ;
      expect( resPago.success ).toBe( true ) ;
      if( !resPago.success ) { return ; }

      const entriesPago = await db
        .select()
        .from( ledgerEntries )
        .where( eq( ledgerEntries.transactionId , resPago.value.transactionId ) ) ;

      // Dos patas estrictas (sin pata de interés en cero)
      expect( entriesPago ).toHaveLength( 2 ) ;
      const sumDebit  = entriesPago.reduce( ( acc , e ) => acc + e.debit , 0 ) ;
      const sumCredit = entriesPago.reduce( ( acc , e ) => acc + e.credit , 0 ) ;
      expect( sumDebit ).toBe( 100000 ) ;
      expect( sumCredit ).toBe( 100000 ) ;
    } ) ;
  } ) ;

  describe( "getLoansAction y archiveLoanAction" , () => {
    it( "getLoansAction devuelve el préstamo con saldoPendiente positivo tras el alta con desembolso" , async () => {
      const [ ctaBanco ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "1.1.01.99" ,
          name:           "Banco Galicia CC" ,
          type:           "asset" ,
          balance:        0 ,
          currency:       "ARS"
        } )
        .returning() ;

      const resAlta = await createLoanAction( {
        name:                   "Préstamo Personal Galicia" ,
        direction:              "borrowed" ,
        entityId:               bankEntId ,
        principalAmount:        500000 ,
        currency:               "ARS" ,
        interestRateAnnual:     0 ,
        totalInstallments:      5 ,
        frequency:              "monthly" ,
        intervalCount:          1 ,
        startDate:              new Date( "2026-09-01T12:00:00Z" ) ,
        firstInstallmentDate:   "2026-10-10" ,
        disbursementAccountId: ctaBanco.id
      } ) ;
      expect( resAlta.success ).toBe( true ) ;

      const resList = await getLoansAction() ;
      expect( resList.success ).toBe( true ) ;
      if( !resList.success ) { return ; }

      expect( resList.value ).toHaveLength( 1 ) ;
      expect( resList.value[ 0 ].saldoPendiente ).toBe( 500000 ) ;
      expect( resList.value[ 0 ].entity?.name ).toBe( "Banco Galicia" ) ;
    } ) ;

    it( "archiveLoanAction marca el préstamo como archivado y lo saca de getLoansAction" , async () => {
      const [ ctaBanco ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "1.1.01.98" ,
          name:           "Banco Galicia Caja" ,
          type:           "asset" ,
          balance:        0 ,
          currency:       "ARS"
        } )
        .returning() ;

      const resAlta = await createLoanAction( {
        name:                   "Préstamo a Archivar" ,
        direction:              "borrowed" ,
        entityId:               bankEntId ,
        principalAmount:        200000 ,
        currency:               "ARS" ,
        interestRateAnnual:     0 ,
        totalInstallments:      6 ,
        frequency:              "monthly" ,
        intervalCount:          1 ,
        startDate:              new Date( "2026-09-01T12:00:00Z" ) ,
        firstInstallmentDate:   "2026-10-10" ,
        disbursementAccountId: ctaBanco.id
      } ) ;
      expect( resAlta.success ).toBe( true ) ;
      if( !resAlta.success ) { return ; }

      const resArchive = await archiveLoanAction( resAlta.value.id ) ;
      expect( resArchive.success ).toBe( true ) ;

      const resList = await getLoansAction() ;
      expect( resList.success ).toBe( true ) ;
      if( !resList.success ) { return ; }

      expect( resList.value ).toHaveLength( 0 ) ;
    } ) ;
  } ) ;
  describe( "Idempotencia del alta (plan 46)" , () => {
    it( "crea un solo préstamo si se repite el envío con la misma clave" , async () => {
      await db.insert( accounts ).values( {
        organizationId: orgId ,
        code:           "3.1.01.01" ,
        name:           "Patrimonio Neto" ,
        type:           "equity" ,
        balance:        10000000 ,
        currency:       "ARS"
      } ) ;

      const clave = "3f2b8c1e-9d4a-4b6f-8a1c-2e7d5f0a9b31" ;
      const datos = {
        name:                 "Préstamo reintentado" ,
        direction:            "borrowed" as const ,
        entityId:             bankEntId ,
        principalAmount:      500000 ,
        currency:             "ARS" ,
        interestRateAnnual:   0 ,
        totalInstallments:    3 ,
        frequency:            "monthly" as const ,
        intervalCount:        1 ,
        startDate:            new Date( "2026-09-01T12:00:00Z" ) ,
        firstInstallmentDate: "2026-10-10"
      } ;

      const r1 = await createLoanAction( datos , clave ) ;
      const r2 = await createLoanAction( datos , clave ) ;

      expect( r1.success ).toBe( true ) ;
      expect( r2.success ).toBe( true ) ;
      expect( (await db.select().from( loans ).where( eq(loans.organizationId , orgId) )).length ).toBe( 1 ) ;
      expect( (await db.select().from( ledgerTransactions ).where( eq(ledgerTransactions.organizationId , orgId) )).length ).toBe( 1 ) ;
    } ) ;
  } ) ;
} ) ;
