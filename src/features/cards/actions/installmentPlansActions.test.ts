/**
 * @file installmentPlansActions.test.ts
 * Pruebas de integración para las acciones y el ciclo contable de planes de cuotas (RFC 025).
 * Valida los casos de prueba exigidos por el RFC §9: partida doble, no emisión en alta,
 * idempotencia, orden, ciclo de facturación, multidivisa, disponible, aislamiento y limpiarBase.
 */
// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach , afterAll } from "vitest" ;
import { eq }                                                              from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { db }                       from "@/shared/db/client" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;

// Feature: Auth
import { organizations , memberships } from "@/features/auth/schema.db" ;

// Feature: Profile
import { profiles } from "@/features/profile/schema.db" ;

// Feature: Accounting
import {
  accounts ,
  categories ,
  ledgerEntries ,
  ledgerTransactions
} from "@/features/accounting/schema.db" ;

// Feature: Cards
import {
  createInstallmentPlanAction ,
  resolveInstallmentAction ,
  archiveInstallmentPlanAction ,
  getInstallmentPlansAction
} from "./installmentPlansActions" ;
import { installmentPlansRepository } from "../repositories/installmentPlansRepository" ;
import { calcularCicloDeTarjeta }     from "../services/cardCycleService" ;
import { cards , cardAccounts , cardInstallmentPlans } from "../schema.db" ;
import { CardWithAccountsAndEntity }                   from "../types" ;
import { deudaDe }                                     from "../utils/ciclo" ;


let activeSessionUser: { id: string ; organizationId: string } | null = null ;

vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn( () => Promise.resolve( activeSessionUser ? { user: activeSessionUser } : null ) ) ,
} ) ) ;

describe( "installmentPlansActions (RFC 025 Integration Suite)" , () => {
  let orgId:      string ;
  let userId:     string ;
  let cardId:     string ;
  let cardAccId:  string ;
  let catHijaId:  string ;

  const cleanAll = async () => {
    await limpiarBase() ;
  } ;

  beforeEach( async () => {
    vi.clearAllMocks() ;
    vi.useRealTimers() ;
    await cleanAll() ;

    // 1. Crear Organización
    const [ org ] = await db
      .insert( organizations )
      .values( { name: "Org Cuotas Test" , slug: "org-cuotas-test" } )
      .returning() ;
    orgId = org.id ;

    // 2. Crear Usuario y Perfil
    const usr = await crearUsuarioConMembresia( {
      organizationId: orgId ,
      email:          "cuotas@ejemplo.com" ,
      name:           "Tester Cuotas" ,
      passwordHash:   "hash-mock" ,
      salt:           "salt-mock" ,
      role:           "owner" ,
    } ) ;
    userId = usr.id ;

    await db.insert( profiles ).values( {
      userId ,
      timezone:     "America/Argentina/Buenos_Aires" ,
      currency:     "ARS" ,
      numberFormat: "es-AR" ,
    } ) ;

    activeSessionUser = { id: userId , organizationId: orgId } ;

    // 3. Crear Categoría padre e hija
    const [ catPadre ] = await db
      .insert( categories )
      .values( {
        organizationId: orgId ,
        name:           "Hogar" ,
        type:           "expense" ,
        accountCode:    "5.1.01" ,
        isSystemLeaf:   false ,
      } )
      .returning() ;

    const [ catHija ] = await db
      .insert( categories )
      .values( {
        organizationId: orgId ,
        name:           "Electrodomésticos" ,
        type:           "expense" ,
        accountCode:    "5.1.01.01" ,
        parentId:       catPadre.id ,
        isSystemLeaf:   false ,
      } )
      .returning() ;
    catHijaId = catHija.id ;

    // 4. Crear Tarjeta de Crédito con límite de $200.000 y cierre el 25
    const [ cardRecord ] = await db
      .insert( cards )
      .values( {
        organizationId: orgId ,
        label:          "Visa Test" ,
        type:           "credit" ,
        network:        "visa" ,
        lastFour:       "9988" ,
        expiryMonth:    12 ,
        expiryYear:     2030 ,
        creditLimit:    20000000 , // $200.000 en centavos
        closingDay:     25 ,
        dueDay:         10 ,
      } )
      .returning() ;
    cardId = cardRecord.id ;

    // 5. Crear Cuenta contable de pasivo para la tarjeta en ARS
    const [ cardAccRecord ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "2.1.01.01" ,
        name:           "Tarjeta Visa Test" ,
        type:           "liability" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;
    cardAccId = cardAccRecord.id ;

    await db.insert( cardAccounts ).values( {
      cardId ,
      accountId: cardAccId ,
      currency:  "ARS" ,
    } ) ;
  } ) ;

  afterEach( () => {
    vi.useRealTimers() ;
  } ) ;

  afterAll( async () => {
    await cleanAll() ;
  } ) ;

  it( "§9.2 El alta no emite ningún asiento: dar de alta un plan deja ledger_transactions sin filas nuevas" , async () => {
    const txAntes = await db.select().from( ledgerTransactions ) ;
    expect( txAntes ).toHaveLength( 0 ) ;

    const result = await createInstallmentPlanAction( {
      cardId ,
      description:          "Heladera Samsung" ,
      merchantName:         "Fravega" ,
      categoryId:           catHijaId ,
      installmentAmount:    1000000 , // $10.000 en centavos
      totalInstallments:    12 ,
      currency:             "ARS" ,
      purchasedAt:          new Date( "2026-09-20T12:00:00.000Z" ) ,
      firstInstallmentDate: "2026-10-10" ,
    } ) ;

    expect( result.success ).toBe( true ) ;
    if( !result.success ) return ;

    const txDespues = await db.select().from( ledgerTransactions ) ;
    expect( txDespues ).toHaveLength( 0 ) ;

    const planEnDb = await installmentPlansRepository.findById( result.value.id , orgId ) ;
    expect( planEnDb ).not.toBeNull() ;
    expect( planEnDb?.description ).toBe( "Heladera Samsung" ) ;
    expect( planEnDb?.resolvedThrough ).not.toBeNull() ;
  } ) ;

  it( "§9.1 y §5B Debe = Haber por divisa en el asiento de imputación" , async () => {
    // Fijar tiempo para que la cuota de octubre esté con ventana abierta
    vi.setSystemTime( new Date( "2026-10-05T12:00:00.000Z" ) ) ;

    const alta = await createInstallmentPlanAction( {
      cardId ,
      description:          "Lavarropas LG" ,
      merchantName:         "Rodo" ,
      categoryId:           catHijaId ,
      installmentAmount:    1500000 , // $15.000
      totalInstallments:    6 ,
      currency:             "ARS" ,
      purchasedAt:          new Date( "2026-09-20T12:00:00.000Z" ) ,
      firstInstallmentDate: "2026-10-10" ,
    } ) ;

    expect( alta.success ).toBe( true ) ;
    if( !alta.success ) return ;

    const res = await resolveInstallmentAction( {
      planId:         alta.value.id ,
      occurrenceDate: "2026-10-10" ,
      action:         "confirm" ,
    } ) ;

    expect( res.success ).toBe( true ) ;
    if( !res.success ) return ;

    expect( res.value.transactionId ).toBeDefined() ;

    // Verificar asiento contable de partida doble
    const entries = await db
      .select()
      .from( ledgerEntries )
      .where( eq( ledgerEntries.transactionId , res.value.transactionId! ) ) ;

    expect( entries ).toHaveLength( 2 ) ;

    const totalDebito  = entries.reduce( ( sum , e ) => sum + e.debit  , 0 ) ;
    const totalCredito = entries.reduce( ( sum , e ) => sum + e.credit , 0 ) ;

    expect( totalDebito ).toBe( 1500000 ) ;
    expect( totalCredito ).toBe( 1500000 ) ;
    expect( entries[0].currency ).toBe( "ARS" ) ;
    expect( entries[1].currency ).toBe( "ARS" ) ;

    // Debe en gasto, Haber en tarjeta
    const entryGasto   = entries.find( ( e ) => e.debit > 0 ) ;
    const entryTarjeta = entries.find( ( e ) => e.credit > 0 ) ;

    expect( entryGasto?.accountId ).not.toBe( cardAccId ) ;
    expect( entryTarjeta?.accountId ).toBe( cardAccId ) ;
  } ) ;

  it( "§9.3 Idempotencia: imputar dos veces la misma cuota escribe un solo asiento y falla la segunda" , async () => {
    vi.setSystemTime( new Date( "2026-10-05T12:00:00.000Z" ) ) ;

    const alta = await createInstallmentPlanAction( {
      cardId ,
      description:          "Microondas BGH" ,
      categoryId:           catHijaId ,
      installmentAmount:    500000 ,
      totalInstallments:    3 ,
      currency:             "ARS" ,
      purchasedAt:          new Date( "2026-09-20T12:00:00.000Z" ) ,
      firstInstallmentDate: "2026-10-10" ,
    } ) ;

    expect( alta.success ).toBe( true ) ;
    if( !alta.success ) return ;

    const primera = await resolveInstallmentAction( {
      planId:         alta.value.id ,
      occurrenceDate: "2026-10-10" ,
      action:         "confirm" ,
    } ) ;
    expect( primera.success ).toBe( true ) ;

    const segunda = await resolveInstallmentAction( {
      planId:         alta.value.id ,
      occurrenceDate: "2026-10-10" ,
      action:         "confirm" ,
    } ) ;
    expect( segunda.success ).toBe( false ) ;

    // Un único asiento en total
    const txs = await db.select().from( ledgerTransactions ) ;
    expect( txs ).toHaveLength( 1 ) ;
  } ) ;

  it( "§9.4 Orden: imputar una cuota que no es la más antigua pendiente falla sin escribir" , async () => {
    vi.setSystemTime( new Date( "2026-09-25T12:00:00.000Z" ) ) ;

    const alta = await createInstallmentPlanAction( {
      cardId ,
      description:          "Televisor Sony" ,
      categoryId:           catHijaId ,
      installmentAmount:    2000000 ,
      totalInstallments:    6 ,
      currency:             "ARS" ,
      purchasedAt:          new Date( "2026-09-20T12:00:00.000Z" ) ,
      firstInstallmentDate: "2026-10-10" ,
    } ) ;

    expect( alta.success ).toBe( true ) ;
    if( !alta.success ) return ;

    // En noviembre hay dos cuotas pendientes (octubre y noviembre); intentar resolver noviembre primero falla
    vi.setSystemTime( new Date( "2026-11-05T12:00:00.000Z" ) ) ;

    const res = await resolveInstallmentAction( {
      planId:         alta.value.id ,
      occurrenceDate: "2026-11-10" ,
      action:         "confirm" ,
    } ) ;

    expect( res.success ).toBe( false ) ;
    expect( res.error ).toContain( "no es la más antigua" ) ;

    const txs = await db.select().from( ledgerTransactions ) ;
    expect( txs ).toHaveLength( 0 ) ;
  } ) ;

  it( "§9.8 La cuota cae en el ciclo correcto según occurredAt" , async () => {
    vi.setSystemTime( new Date( "2026-01-20T12:00:00.000Z" ) ) ;

    const altaFacturado = await createInstallmentPlanAction( {
      cardId ,
      description:          "Compra Enero" ,
      categoryId:           catHijaId ,
      installmentAmount:    1000000 ,
      totalInstallments:    3 ,
      currency:             "ARS" ,
      purchasedAt:          new Date( "2026-01-15T12:00:00.000Z" ) ,
      firstInstallmentDate: "2026-02-10" ,
    } ) ;
    expect( altaFacturado.success ).toBe( true ) ;
    if( !altaFacturado.success ) return ;

    vi.setSystemTime( new Date( "2026-02-15T12:00:00.000Z" ) ) ;
    const r1 = await resolveInstallmentAction( {
      planId:         altaFacturado.value.id ,
      occurrenceDate: "2026-02-10" ,
      action:         "confirm" ,
    } ) ;
    expect( r1.success ).toBe( true ) ;

    // Ahora avanzamos a marzo
    vi.setSystemTime( new Date( "2026-03-10T12:00:00.000Z" ) ) ;
    const r2 = await resolveInstallmentAction( {
      planId:         altaFacturado.value.id ,
      occurrenceDate: "2026-03-10" ,
      action:         "confirm" ,
    } ) ;
    expect( r2.success ).toBe( true ) ;

    // Reconstruir la tarjeta con su cuenta para calcular el ciclo
    const [ cRow ] = await db.select().from( cards ).where( eq( cards.id , cardId ) ) ;
    const [ aRow ] = await db.select().from( accounts ).where( eq( accounts.id , cardAccId ) ) ;
    const cardObj: CardWithAccountsAndEntity = {
      ...cRow ,
      accounts: [ { cardId , accountId: cardAccId , currency: "ARS" , createdAt: new Date() , id: "v1" , account: aRow } ] ,
    } ;

    const ciclo = await calcularCicloDeTarjeta( cardObj , orgId , "America/Argentina/Buenos_Aires" ) ;

    expect( ciclo ).not.toBeNull() ;
    expect( ciclo?.facturado ).toBe( 1000000 ) ; // cuota del 10/02
    expect( ciclo?.enCurso ).toBe( 1000000 ) ;   // cuota del 10/03
  } ) ;

  it( "§9.9 Divisa: un plan en USD sobre tarjeta sin cuenta en USD la crea y el asiento no se mezcla" , async () => {
    vi.setSystemTime( new Date( "2026-10-05T12:00:00.000Z" ) ) ;

    const altaUsd = await createInstallmentPlanAction( {
      cardId ,
      description:          "Licencia JetBrains" ,
      categoryId:           catHijaId ,
      installmentAmount:    2500 , // USD 25.00
      totalInstallments:    12 ,
      currency:             "USD" ,
      purchasedAt:          new Date( "2026-09-20T12:00:00.000Z" ) ,
      firstInstallmentDate: "2026-10-10" ,
    } ) ;

    expect( altaUsd.success ).toBe( true ) ;
    if( !altaUsd.success ) return ;

    // Verificar que se creó el vínculo en card_accounts para USD
    const vinculos = await db
      .select()
      .from( cardAccounts )
      .where( eq( cardAccounts.cardId , cardId ) ) ;

    expect( vinculos.some( ( v ) => v.currency === "USD" ) ).toBe( true ) ;

    // Imputar la cuota en USD
    const res = await resolveInstallmentAction( {
      planId:         altaUsd.value.id ,
      occurrenceDate: "2026-10-10" ,
      action:         "confirm" ,
    } ) ;

    expect( res.success ).toBe( true ) ;
    if( !res.success ) return ;

    const entriesUsd = await db
      .select()
      .from( ledgerEntries )
      .where( eq( ledgerEntries.transactionId , res.value.transactionId! ) ) ;

    expect( entriesUsd ).toHaveLength( 2 ) ;
    expect( entriesUsd[0].currency ).toBe( "USD" ) ;
    expect( entriesUsd[1].currency ).toBe( "USD" ) ;
    expect( entriesUsd[0].debit || entriesUsd[0].credit ).toBe( 2500 ) ;
  } ) ;

  it( "§9.10 Disponible: plan de 12 cuotas de $10.000 con 1 imputada tiene $110.000 en cuotas futuras y $10.000 en deuda" , async () => {
    vi.setSystemTime( new Date( "2026-10-05T12:00:00.000Z" ) ) ;

    const alta = await createInstallmentPlanAction( {
      cardId ,
      description:          "Notebook Dell" ,
      categoryId:           catHijaId ,
      installmentAmount:    1000000 , // $10.000
      totalInstallments:    12 ,
      currency:             "ARS" ,
      purchasedAt:          new Date( "2026-09-20T12:00:00.000Z" ) ,
      firstInstallmentDate: "2026-10-10" ,
    } ) ;

    expect( alta.success ).toBe( true ) ;
    if( !alta.success ) return ;

    await resolveInstallmentAction( {
      planId:         alta.value.id ,
      occurrenceDate: "2026-10-10" ,
      action:         "confirm" ,
    } ) ;

    const [ cRow ] = await db.select().from( cards ).where( eq( cards.id , cardId ) ) ;
    const [ aRow ] = await db.select().from( accounts ).where( eq( accounts.id , cardAccId ) ) ;

    const cardObj: CardWithAccountsAndEntity = {
      ...cRow ,
      accounts: [ { cardId , accountId: cardAccId , currency: "ARS" , createdAt: new Date() , id: "v1" , account: aRow } ] ,
    } ;

    const ciclo = await calcularCicloDeTarjeta( cardObj , orgId , "America/Argentina/Buenos_Aires" ) ;

    expect( ciclo?.cuotasFuturas.ARS ).toBe( 11000000 ) ; // 11 x $10.000
    expect( deudaDe( aRow ) ).toBe( 1000000 ) ;          // $10.000 de deuda contable
  } ) ;

  it( "§9.11 Aislamiento multi-tenant: ninguna consulta o acción opera con otra organización" , async () => {
    // Crear Org B
    const [ orgB ] = await db
      .insert( organizations )
      .values( { name: "Org Invasora" , slug: "org-invasora" } )
      .returning() ;

    const alta = await createInstallmentPlanAction( {
      cardId ,
      description:          "Item Org A" ,
      categoryId:           catHijaId ,
      installmentAmount:    100000 ,
      totalInstallments:    3 ,
      currency:             "ARS" ,
      purchasedAt:          new Date( "2026-09-20T12:00:00.000Z" ) ,
      firstInstallmentDate: "2026-10-10" ,
    } ) ;
    expect( alta.success ).toBe( true ) ;
    if( !alta.success ) return ;

    // Buscar con Org B en DAL
    const desdeB = await installmentPlansRepository.findById( alta.value.id , orgB.id ) ;
    expect( desdeB ).toBeNull() ;

    const listaB = await installmentPlansRepository.findByCard( cardId , orgB.id ) ;
    expect( listaB ).toHaveLength( 0 ) ;

    const activosB = await installmentPlansRepository.findActiveByOrganization( orgB.id ) ;
    expect( activosB ).toHaveLength( 0 ) ;

    // Intentar resolver desde una sesión de Org B (el usuario es `member` real de B: la guarda de escritura lo exige)
    await db.insert( memberships ).values( { userId , organizationId: orgB.id , role: "member" } ) ;
    activeSessionUser = { id: userId , organizationId: orgB.id } ;

    const resolveDesdeB = await resolveInstallmentAction( {
      planId:         alta.value.id ,
      occurrenceDate: "2026-10-10" ,
      action:         "confirm" ,
    } ) ;
    expect( resolveDesdeB.success ).toBe( false ) ;
    expect( resolveDesdeB.error ).toContain( "no encontrado" ) ;
  } ) ;

  it( "§9.12 limpiarBase() deja card_installment_plans vacía sin romper integridad referencial" , async () => {
    await createInstallmentPlanAction( {
      cardId ,
      description:          "Plan para vaciar" ,
      categoryId:           catHijaId ,
      installmentAmount:    100000 ,
      totalInstallments:    3 ,
      currency:             "ARS" ,
      purchasedAt:          new Date( "2026-09-20T12:00:00.000Z" ) ,
      firstInstallmentDate: "2026-10-10" ,
    } ) ;

    const antes = await db.select().from( cardInstallmentPlans ) ;
    expect( antes.length ).toBeGreaterThan( 0 ) ;

    await limpiarBase() ;

    const despues = await db.select().from( cardInstallmentPlans ) ;
    expect( despues ).toHaveLength( 0 ) ;
  } ) ;

  it( "archiveInstallmentPlanAction y getInstallmentPlansAction gestionan el ciclo de vida" , async () => {
    vi.setSystemTime( new Date( "2026-10-05T12:00:00.000Z" ) ) ;

    const alta = await createInstallmentPlanAction( {
      cardId ,
      description:          "Tablet Lenovo" ,
      categoryId:           catHijaId ,
      installmentAmount:    800000 ,
      totalInstallments:    6 ,
      currency:             "ARS" ,
      purchasedAt:          new Date( "2026-09-20T12:00:00.000Z" ) ,
      firstInstallmentDate: "2026-10-10" ,
    } ) ;
    expect( alta.success ).toBe( true ) ;
    if( !alta.success ) return ;

    const list1 = await getInstallmentPlansAction( cardId ) ;
    expect( list1.success ).toBe( true ) ;
    if( !list1.success ) return ;
    expect( list1.value ).toHaveLength( 1 ) ;
    expect( list1.value[0].cuotasImputadas ).toBe( 0 ) ;
    expect( list1.value[0].pendientes ).toHaveLength( 1 ) ;

    const arch = await archiveInstallmentPlanAction( alta.value.id ) ;
    expect( arch.success ).toBe( true ) ;

    const list2 = await getInstallmentPlansAction( cardId ) ;
    expect( list2.success ).toBe( true ) ;
    if( !list2.success ) return ;
    expect( list2.value ).toHaveLength( 0 ) ; // Ya no figura entre los activos
  } ) ;
} ) ;
