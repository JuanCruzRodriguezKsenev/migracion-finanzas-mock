/**
 * @file reportsService.test.ts
 * Suite de pruebas de integración contra la base real para reportsService (RFC 027 §9).
 */
// Librerías externas
import { describe , it , expect , beforeEach , afterEach } from "vitest" ;
import { eq }                                              from "drizzle-orm" ;

// Shared
import { db }          from "@/shared/db/client" ;
import { limpiarBase } from "@/shared/db/testCleanup" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Cards
import { cards , cardAccounts , cardInstallmentPlans } from "@/features/cards/schema.db" ;

// Feature: Accounting
import { accounts , categories , categoryAccounts , ledgerTransactions } from "@/features/accounting/schema.db" ;
import { createLedgerTransaction , reverseLedgerTransaction }            from "@/features/accounting/services/accountingService" ;

// Feature: Reports
import { reportsService } from "./reportsService" ;

describe( "reportsService - pruebas de integración (RFC 027 §9)" , () => {
  let orgId:         string ;
  let ctaBancoArs:   string ;
  let ctaIngresoArs: string ;
  let ctaGastoArs:   string ;
  let ctaPasivoArs:  string ;

  beforeEach( async () => {
    await limpiarBase() ;

    const [ org ] = await db
      .insert( organizations )
      .values( {
        name: "Org Test Estadisticas" ,
        slug: "org-test-estadisticas" ,
      } )
      .returning() ;

    orgId = org.id ;

    const [ bArs ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "1.1.01.01" ,
        name:           "Banco ARS" ,
        type:           "asset" ,
        balance:        1000000 ,
        currency:       "ARS" ,
      } )
      .returning() ;
    ctaBancoArs = bArs.id ;

    const [ iArs ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "4.1.01.01" ,
        name:           "Sueldos ARS" ,
        type:           "revenue" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;
    ctaIngresoArs = iArs.id ;

    const [ gArs ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "5.1.01.01" ,
        name:           "Alquiler ARS" ,
        type:           "expense" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;
    ctaGastoArs = gArs.id ;

    const [ pArs ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "2.1.01.01" ,
        name:           "Deuda ARS" ,
        type:           "liability" ,
        balance:        -200000 ,
        currency:       "ARS" ,
      } )
      .returning() ;
    ctaPasivoArs = pArs.id ;
  } ) ;

  afterEach( async () => {
    await limpiarBase() ;
  } ) ;

  it( "un asiento reversado no cuenta en flujos, top ni conteo (AC-1, AC-2, AC-4)" , async () => {
    // Mayo 2026: Ingreso $1.250.000 y Gasto $837.700
    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( "2026-05-10T14:00:00Z" ) ,
      description:    "Sueldo Mayo" ,
      entries: [
        { accountId: ctaBancoArs   , debit: 1250000 , credit: 0 } ,
        { accountId: ctaIngresoArs , debit: 0 , credit: 1250000 } ,
      ] ,
    } ) ;

    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( "2026-05-15T15:00:00Z" ) ,
      description:    "Gastos Varios Mayo" ,
      entries: [
        { accountId: ctaGastoArs , debit: 837700 , credit: 0 } ,
        { accountId: ctaBancoArs , debit: 0 , credit: 837700 } ,
      ] ,
    } ) ;

    // Asiento de $100.000 que luego se reversa en el mismo mes
    const txReversable = await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( "2026-05-20T16:00:00Z" ) ,
      description:    "Compra errónea" ,
      entries: [
        { accountId: ctaGastoArs , debit: 100000 , credit: 0 } ,
        { accountId: ctaBancoArs , debit: 0 , credit: 100000 } ,
      ] ,
    } ) ;

    await reverseLedgerTransaction(
      txReversable.value!.id ,
      orgId ,
      "Reversión de prueba"
    ) ;

    const reporte = await reportsService.armarReporte( {
      orgId ,
      monthKey: "2026-05" ,
      currency: "ARS" ,
    } ) ;

    expect( reporte.metrics.ingresos.value ).toBe( 1250000 ) ;
    expect( reporte.metrics.gastos.value ).toBe( 837700 ) ;
    expect( reporte.metrics.ahorroNeto.value ).toBe( 412300 ) ;
    expect( reporte.metrics.transacciones ).toBe( 2 ) ; // 2 transacciones válidas; la reversada y el contra-asiento excluidos
    expect( reporte.topGastos.some( ( t ) => { return( t.id === txReversable.value!.id ) ; } ) ).toBe( false ) ;
  } ) ;

  it( "reversa en otro mes: ni marzo ni abril cuentan el gasto en flujos, pero los saldos de marzo sí lo incluyen (AC-3)" , async () => {
    // Gasto en marzo
    const txMarzo = await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( "2026-03-15T12:00:00Z" ) ,
      description:    "Gasto Marzo" ,
      entries: [
        { accountId: ctaGastoArs , debit: 50000 , credit: 0 } ,
        { accountId: ctaBancoArs , debit: 0 , credit: 50000 } ,
      ] ,
    } ) ;

    // Reversa en abril
    const revResult = await reverseLedgerTransaction(
      txMarzo.value!.id ,
      orgId ,
      "Reversado en abril"
    ) ;

    // Fijar la fecha del contra-asiento en abril de 2026 para cumplir el escenario de la spec
    await db
      .update( ledgerTransactions )
      .set( { occurredAt: new Date( "2026-04-10T12:00:00Z" ) } )
      .where( eq( ledgerTransactions.id , revResult.value!.id ) ) ;

    const repMarzo = await reportsService.armarReporte( { orgId , monthKey: "2026-03" , currency: "ARS" } ) ;
    const repAbril = await reportsService.armarReporte( { orgId , monthKey: "2026-04" , currency: "ARS" } ) ;

    expect( repMarzo.metrics.gastos.value ).toBe( 0 ) ;
    expect( repAbril.metrics.gastos.value ).toBe( 0 ) ;

    // En la tendencia histórica de saldos de libro (Q2):
    // El punto de marzo acumula el débito/crédito original (-50000 en banco)
    const puntoMarzo = repAbril.tendencia.find( ( p ) => { return( p.monthKey === "2026-03" ) ; } ) ;
    expect( puntoMarzo?.patrimonioLibro ).toBe( -50000 ) ;

    // En abril, el contra-asiento anula el saldo
    const puntoAbril = repAbril.tendencia.find( ( p ) => { return( p.monthKey === "2026-04" ) ; } ) ;
    expect( puntoAbril?.patrimonioLibro ).toBe( 0 ) ;
  } ) ;

  it( "una divisa a la vez: cada selección suma sólo sus cuentas (AC-7)" , async () => {
    // Crear cuentas en USD
    const [ bUsd ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "1.1.01.02" ,
        name:           "Banco USD" ,
        type:           "asset" ,
        balance:        5000 ,
        currency:       "USD" ,
      } )
      .returning() ;

    const [ gUsd ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "5.1.01.02" ,
        name:           "Gasto USD" ,
        type:           "expense" ,
        balance:        0 ,
        currency:       "USD" ,
      } )
      .returning() ;

    // Gasto en ARS
    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( "2026-05-10T12:00:00Z" ) ,
      description:    "Gasto en pesos" ,
      entries: [
        { accountId: ctaGastoArs , debit: 20000 , credit: 0 , currency: "ARS" } ,
        { accountId: ctaBancoArs , debit: 0 , credit: 20000 , currency: "ARS" } ,
      ] ,
    } ) ;

    // Gasto en USD
    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( "2026-05-12T12:00:00Z" ) ,
      description:    "Gasto en dólares" ,
      entries: [
        { accountId: gUsd.id , debit: 150 , credit: 0 , currency: "USD" } ,
        { accountId: bUsd.id , debit: 0 , credit: 150 , currency: "USD" } ,
      ] ,
    } ) ;

    const repArs = await reportsService.armarReporte( { orgId , monthKey: "2026-05" , currency: "ARS" } ) ;
    const repUsd = await reportsService.armarReporte( { orgId , monthKey: "2026-05" , currency: "USD" } ) ;

    expect( repArs.metrics.gastos.value ).toBe( 20000 ) ;
    expect( repUsd.metrics.gastos.value ).toBe( 150 ) ;
  } ) ;

  it( "zona horaria: delimita meses por zona del parámetro y no por UTC (AC-17)" , async () => {
    // 22:00 del 31 de mayo en Buenos Aires = 01:00 UTC del 1 de junio
    const fecha = new Date( "2026-06-01T01:00:00Z" ) ;

    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     fecha ,
      description:    "Gasto fin de mes" ,
      entries: [
        { accountId: ctaGastoArs , debit: 35000 , credit: 0 } ,
        { accountId: ctaBancoArs , debit: 0 , credit: 35000 } ,
      ] ,
    } ) ;

    // En Buenos Aires cae en Mayo
    const repBA = await reportsService.armarReporte( { orgId , monthKey: "2026-05" , currency: "ARS" } ) ;
    expect( repBA.metrics.gastos.value ).toBe( 35000 ) ;

    // En junio para Buenos Aires no hay gastos
    const repBAJunio = await reportsService.armarReporte( { orgId , monthKey: "2026-06" , currency: "ARS" } ) ;
    expect( repBAJunio.metrics.gastos.value ).toBe( 0 ) ;
  } ) ;

  it( "tasa de ahorro sin ingresos es null (AC-5)" , async () => {
    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( "2026-05-05T10:00:00Z" ) ,
      description:    "Sólo gastos" ,
      entries: [
        { accountId: ctaGastoArs , debit: 12000 , credit: 0 } ,
        { accountId: ctaBancoArs , debit: 0 , credit: 12000 } ,
      ] ,
    } ) ;

    const rep = await reportsService.armarReporte( { orgId , monthKey: "2026-05" , currency: "ARS" } ) ;
    expect( rep.metrics.tasaAhorro.value ).toBeNull() ;
  } ) ;

  it( "variación sin base previa es null (AC-6)" , async () => {
    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( "2026-05-05T10:00:00Z" ) ,
      description:    "Gasto Mayo" ,
      entries: [
        { accountId: ctaGastoArs , debit: 15000 , credit: 0 } ,
        { accountId: ctaBancoArs , debit: 0 , credit: 15000 } ,
      ] ,
    } ) ;

    // Abril 2026 no tuvo movimientos
    const rep = await reportsService.armarReporte( { orgId , monthKey: "2026-05" , currency: "ARS" } ) ;
    expect( rep.metrics.gastos.variacionPct ).toBeNull() ;
    expect( rep.metrics.ingresos.variacionPct ).toBeNull() ;
  } ) ;

  it( "patrimonio neto a hoy suma activos, pasivos y resta cuotas futuras (AC-10)" , async () => {
    // Dar de alta tarjeta y plan de cuotas
    const [ card ] = await db
      .insert( cards )
      .values( {
        organizationId: orgId ,
        label:          "Visa Test" ,
        type:           "credit" ,
        network:        "visa" ,
        lastFour:       "1234" ,
        expiryMonth:    12 ,
        expiryYear:     2030 ,
      } )
      .returning() ;

    await db.insert( cardAccounts ).values( {
      cardId:    card.id ,
      accountId: ctaPasivoArs ,
      currency:  "ARS" ,
    } ) ;

    // Plan de 3 cuotas de 10.000 (total 30.000). 1 ya facturada -> 2 futuras = 20.000
    await db.insert( cardInstallmentPlans ).values( {
      organizationId:       orgId ,
      cardId:               card.id ,
      description:          "Compra cuotas" ,
      installmentAmount:    10000 ,
      totalInstallments:    3 ,
      currency:             "ARS" ,
      purchasedAt:          new Date( "2026-04-01T10:00:00Z" ) ,
      firstInstallmentDate: "2026-05-10" ,
      resolvedThrough:      "2026-05-10" , // 1 cuota resuelta
    } ) ;

    const rep = await reportsService.armarReporte( { orgId , monthKey: "2026-05" , currency: "ARS" } ) ;

    // Activos = 1.000.000, Pasivos = -200.000, Cuotas futuras = 20.000
    // Neto = 1.000.000 + (-200.000) - 20.000 = 780.000
    expect( rep.patrimonio.activos ).toBe( 1000000 ) ;
    expect( rep.patrimonio.pasivos ).toBe( -200000 ) ;
    expect( rep.patrimonio.cuotasPorPagar ).toBe( 20000 ) ;
    expect( rep.patrimonio.neto ).toBe( 780000 ) ;
  } ) ;

  it( "aislamiento entre organizaciones (NFR-2)" , async () => {
    const [ orgVacia ] = await db
      .insert( organizations )
      .values( {
        name: "Org Vacia" ,
        slug: "org-vacia" ,
      } )
      .returning() ;

    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( "2026-05-10T10:00:00Z" ) ,
      description:    "Gasto Org 1" ,
      entries: [
        { accountId: ctaGastoArs , debit: 50000 , credit: 0 } ,
        { accountId: ctaBancoArs , debit: 0 , credit: 50000 } ,
      ] ,
    } ) ;

    const repVacia = await reportsService.armarReporte( { orgId: orgVacia.id , monthKey: "2026-05" } ) ;
    expect( repVacia.metrics.gastos.value ).toBe( 0 ) ;
    expect( repVacia.hayMovimientos ).toBe( false ) ;
    expect( repVacia.minKey ).toBeUndefined() ;
  } ) ;

  it( "organización sin movimientos: vacío (AC-12)" , async () => {
    const rep = await reportsService.armarReporte( { orgId , monthKey: "2026-05" , currency: "ARS" } ) ;
    expect( rep.hayMovimientos ).toBe( false ) ;
    expect( rep.minKey ).toBeUndefined() ;
    expect( rep.metrics.transacciones ).toBe( 0 ) ;
  } ) ;

  it( "el top de gastos selecciona hasta 5 asientos ordenados y asigna la categoría de mayor débito" , async () => {
    // Crear categoría
    const [ catAlquiler ] = await db
      .insert( categories )
      .values( {
        organizationId: orgId ,
        name:           "Alquiler" ,
        accountCode:    "5.1.01" ,
        type:           "expense" ,
      } )
      .returning() ;

    await db.insert( categoryAccounts ).values( {
      categoryId: catAlquiler.id ,
      accountId:  ctaGastoArs ,
      currency:   "ARS" ,
    } ) ;

    // Crear 6 gastos de montos distintos
    for( let i = 1 ; i <= 6 ; i++ ) {
      await createLedgerTransaction( {
        organizationId: orgId ,
        occurredAt:     new Date( `2026-05-0${i}T10:00:00Z` ) ,
        description:    `Gasto ${i}` ,
        entries: [
          { accountId: ctaGastoArs , debit: i * 10000 , credit: 0 } ,
          { accountId: ctaBancoArs , debit: 0 , credit: i * 10000 } ,
        ] ,
      } ) ;
    }

    const rep = await reportsService.armarReporte( { orgId , monthKey: "2026-05" , currency: "ARS" } ) ;

    expect( rep.topGastos ).toHaveLength( 5 ) ;
    expect( rep.topGastos[ 0 ].monto ).toBe( 60000 ) ;
    expect( rep.topGastos[ 0 ].descripcion ).toBe( "Gasto 6" ) ;
    expect( rep.topGastos[ 0 ].categoria ).toBe( "Alquiler" ) ;
    expect( rep.topGastos[ 4 ].monto ).toBe( 20000 ) ;
  } ) ;
} ) ;
