/**
 * @file monthlySummaryService.test.ts
 * Suite de pruebas unitarias y de integración para la derivación y relleno de resúmenes mensuales.
 */
// Librerías externas
import { describe , it , expect , beforeEach , afterEach } from "vitest" ;
import { eq , and }                                        from "drizzle-orm" ;

// Shared
import { db }          from "@/shared/db/client" ;
import { limpiarBase } from "@/shared/db/testCleanup" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { monthlySummaryRepository }                                                            from "../repositories/monthlySummaryRepository" ;
import { createLedgerTransaction , reverseLedgerTransaction , updateLedgerTransactionMetadata } from "./accountingService" ;
import { derivarResumenDeMes , rellenarResumenesFaltantes }                                    from "./monthlySummaryService" ;
import { accounts , monthlySummaries }                                                         from "../schema.db" ;


describe( "monthlySummaryService" , () => {
  let orgId:         string ;
  let ctaBancoId:    string ;
  let ctaIngresosId: string ;
  let ctaGastosId:   string ;
  let ctaTarjetaId:  string ;

  beforeEach( async () => {
    await limpiarBase() ;

    const [ org ] = await db
      .insert( organizations )
      .values( {
        name: "Test Resumenes Org" ,
        slug: "test-resumenes-org" ,
      } )
      .returning() ;

    orgId = org.id ;

    const [ ctaBanco ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "1.1.01.01" ,
        name:           "Caja de Ahorros" ,
        type:           "asset" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    ctaBancoId = ctaBanco.id ;

    const [ ctaIngresos ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "4.1.01.01" ,
        name:           "Sueldo" ,
        type:           "revenue" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    ctaIngresosId = ctaIngresos.id ;

    const [ ctaGastos ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "5.1.01.01" ,
        name:           "Alquiler" ,
        type:           "expense" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    ctaGastosId = ctaGastos.id ;

    const [ ctaTarjeta ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "2.1.01.01" ,
        name:           "Tarjeta de Crédito" ,
        type:           "liability" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    ctaTarjetaId = ctaTarjeta.id ;
  } ) ;

  afterEach( async () => {
    await limpiarBase() ;
  } ) ;

  it( "deriva ingresos y gastos del mes, y no de otro" , async () => {
    // Enero 2026: ingreso 100.000 y gasto 30.000
    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( 2026 , 0 , 10 , 10 , 0 ) ,
      description:    "Ingreso Enero" ,
      entries: [
        { accountId: ctaBancoId , debit: 100000 , credit: 0 } ,
        { accountId: ctaIngresosId , debit: 0 , credit: 100000 } ,
      ] ,
    } ) ;

    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( 2026 , 0 , 15 , 12 , 0 ) ,
      description:    "Gasto Enero" ,
      entries: [
        { accountId: ctaGastosId , debit: 30000 , credit: 0 } ,
        { accountId: ctaBancoId , debit: 0 , credit: 30000 } ,
      ] ,
    } ) ;

    // Febrero 2026: ingreso 200.000 y gasto 50.000
    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( 2026 , 1 , 10 , 10 , 0 ) ,
      description:    "Ingreso Febrero" ,
      entries: [
        { accountId: ctaBancoId , debit: 200000 , credit: 0 } ,
        { accountId: ctaIngresosId , debit: 0 , credit: 200000 } ,
      ] ,
    } ) ;

    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( 2026 , 1 , 20 , 14 , 0 ) ,
      description:    "Gasto Febrero" ,
      entries: [
        { accountId: ctaGastosId , debit: 50000 , credit: 0 } ,
        { accountId: ctaBancoId , debit: 0 , credit: 50000 } ,
      ] ,
    } ) ;

    const resumenEnero   = await derivarResumenDeMes( orgId , 2026 , 0 ) ;
    const resumenFebrero = await derivarResumenDeMes( orgId , 2026 , 1 ) ;

    expect( resumenEnero.totalRevenue ).toBe( 100000 ) ;
    expect( resumenEnero.totalExpense ).toBe( 30000 ) ;

    expect( resumenFebrero.totalRevenue ).toBe( 200000 ) ;
    expect( resumenFebrero.totalExpense ).toBe( 50000 ) ;
  } ) ;

  it( "el saldo es acumulado, no del mes" , async () => {
    // Enero 2026: ingreso 100.000 (saldo de activo queda en 100.000)
    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( 2026 , 0 , 10 ) ,
      description:    "Ingreso Enero" ,
      entries: [
        { accountId: ctaBancoId , debit: 100000 , credit: 0 } ,
        { accountId: ctaIngresosId , debit: 0 , credit: 100000 } ,
      ] ,
    } ) ;

    // Febrero 2026 sin movimientos
    // Rellenamos con fecha de referencia Marzo 2026
    const res = await rellenarResumenesFaltantes( orgId , new Date( 2026 , 2 , 15 ) ) ;
    expect( res.success ).toBe( true ) ;
    expect( res.value ).toBe( 2 ) ;

    const resumenFebrero = await derivarResumenDeMes( orgId , 2026 , 1 ) ;

    expect( resumenFebrero.totalRevenue ).toBe( 0 ) ;
    expect( resumenFebrero.totalExpense ).toBe( 0 ) ;
    expect( resumenFebrero.balanceSnapshot ).toBe( 100000 ) ;
    expect( resumenFebrero.assetsSnapshot ).toBe( 100000 ) ;
  } ) ;

  it( "el último día del mes entra" , async () => {
    // 31 de Enero a las 23:59:59.999
    const ultimoInstante = new Date( 2026 , 0 , 31 , 23 , 59 , 59 , 999 ) ;

    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     ultimoInstante ,
      description:    "Venta de cierre" ,
      entries: [
        { accountId: ctaBancoId , debit: 150000 , credit: 0 } ,
        { accountId: ctaIngresosId , debit: 0 , credit: 150000 } ,
      ] ,
    } ) ;

    const resumenEnero   = await derivarResumenDeMes( orgId , 2026 , 0 ) ;
    const resumenFebrero = await derivarResumenDeMes( orgId , 2026 , 1 ) ;

    expect( resumenEnero.totalRevenue ).toBe( 150000 ) ;
    expect( resumenEnero.balanceSnapshot ).toBe( 150000 ) ;
    expect( resumenFebrero.totalRevenue ).toBe( 0 ) ;
  } ) ;

  it( "una transacción retroactiva cambia el mes que toca" , async () => {
    // 1. Alta inicial en Enero y primer relleno hasta Febrero
    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( 2026 , 0 , 10 ) ,
      description:    "Ingreso inicial Enero" ,
      entries: [
        { accountId: ctaBancoId , debit: 100000 , credit: 0 } ,
        { accountId: ctaIngresosId , debit: 0 , credit: 100000 } ,
      ] ,
    } ) ;

    const fechaReferencia = new Date( 2026 , 2 , 1 ) ; // Marzo 2026
    await rellenarResumenesFaltantes( orgId , fechaReferencia ) ;

    const summariesPrev = await monthlySummaryRepository.findRecent( orgId , 12 , 2026 , 2 ) ;
    const prevEnero     = summariesPrev.find( ( s ) => (s.year === 2026) && (s.month === 0) ) ;
    expect( prevEnero?.totalRevenue ).toBe( 100000 ) ;

    // 2. Transacción retroactiva cargada con occurredAt en Enero
    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( 2026 , 0 , 20 ) ,
      description:    "Ingreso retroactivo Enero" ,
      entries: [
        { accountId: ctaBancoId , debit: 50000 , credit: 0 } ,
        { accountId: ctaIngresosId , debit: 0 , credit: 50000 } ,
      ] ,
    } ) ;

    // 3. Relleno posterior actualiza la fila existente
    await rellenarResumenesFaltantes( orgId , fechaReferencia ) ;

    const summariesPost = await monthlySummaryRepository.findRecent( orgId , 12 , 2026 , 2 ) ;
    const postEnero     = summariesPost.find( ( s ) => (s.year === 2026) && (s.month === 0) ) ;
    expect( postEnero?.totalRevenue ).toBe( 150000 ) ;
    expect( postEnero?.balanceSnapshot ).toBe( 150000 ) ;
  } ) ;

  it( "un contra-asiento revierte el resumen" , async () => {
    const fechaEnero = new Date( 2026 , 0 , 10 ) ;

    const txResult = await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     fechaEnero ,
      description:    "Cobro a reversar" ,
      entries: [
        { accountId: ctaBancoId , debit: 100000 , credit: 0 } ,
        { accountId: ctaIngresosId , debit: 0 , credit: 100000 } ,
      ] ,
    } ) ;
    expect( txResult.success ).toBe( true ) ;
    if( !txResult.success ) {
      return ;
    }

    const resumenInicial = await derivarResumenDeMes( orgId , 2026 , 0 ) ;
    expect( resumenInicial.totalRevenue ).toBe( 100000 ) ;

    // Reversar la transacción y ajustar la fecha de ocurrencia del contra-asiento al mismo mes
    const revResult = await reverseLedgerTransaction( txResult.value.id , orgId , "Cobro erróneo" ) ;
    expect( revResult.success ).toBe( true ) ;
    if( !revResult.success ) {
      return ;
    }

    await updateLedgerTransactionMetadata( {
      transactionId:  revResult.value.id ,
      organizationId: orgId ,
      occurredAt:     new Date( 2026 , 0 , 20 ) ,
    } ) ;

    const resumenReversado = await derivarResumenDeMes( orgId , 2026 , 0 ) ;
    expect( resumenReversado.totalRevenue ).toBe( 0 ) ;
    expect( resumenReversado.balanceSnapshot ).toBe( 0 ) ;
  } ) ;

  it( "los pasivos quedan negativos" , async () => {
    // Compra con tarjeta de crédito en Enero (gasto $50.000 financiado con pasivo)
    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( 2026 , 0 , 15 ) ,
      description:    "Consumo con tarjeta" ,
      entries: [
        { accountId: ctaGastosId , debit: 50000 , credit: 0 } ,
        { accountId: ctaTarjetaId , debit: 0 , credit: 50000 } ,
      ] ,
    } ) ;

    const resumen = await derivarResumenDeMes( orgId , 2026 , 0 ) ;

    expect( resumen.totalExpense ).toBe( 50000 ) ;
    expect( resumen.liabilitiesSnapshot ).toBe( -50000 ) ;
  } ) ;

  it( "no escribe el mes en curso" , async () => {
    // Transacciones en Enero, Febrero y Marzo
    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( 2026 , 0 , 15 ) ,
      description:    "Enero" ,
      entries: [
        { accountId: ctaBancoId , debit: 10000 , credit: 0 } ,
        { accountId: ctaIngresosId , debit: 0 , credit: 10000 } ,
      ] ,
    } ) ;

    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( 2026 , 1 , 15 ) ,
      description:    "Febrero" ,
      entries: [
        { accountId: ctaBancoId , debit: 10000 , credit: 0 } ,
        { accountId: ctaIngresosId , debit: 0 , credit: 10000 } ,
      ] ,
    } ) ;

    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( 2026 , 2 , 15 ) ,
      description:    "Marzo (en curso)" ,
      entries: [
        { accountId: ctaBancoId , debit: 10000 , credit: 0 } ,
        { accountId: ctaIngresosId , debit: 0 , credit: 10000 } ,
      ] ,
    } ) ;

    // Referencia Marzo 2026 (mes 2)
    const fechaReferencia = new Date( 2026 , 2 , 20 ) ;
    const res             = await rellenarResumenesFaltantes( orgId , fechaReferencia ) ;

    expect( res.success ).toBe( true ) ;
    expect( res.value ).toBe( 2 ) ; // Solo Enero y Febrero

    const mesEnCurso = await db
      .select()
      .from( monthlySummaries )
      .where(
        and(
          eq( monthlySummaries.organizationId , orgId ) ,
          eq( monthlySummaries.year , 2026 ) ,
          eq( monthlySummaries.month , 2 )
        )
      ) ;

    expect( mesEnCurso.length ).toBe( 0 ) ;
  } ) ;

  it( "es idempotente" , async () => {
    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( 2026 , 0 , 15 ) ,
      description:    "Enero" ,
      entries: [
        { accountId: ctaBancoId , debit: 10000 , credit: 0 } ,
        { accountId: ctaIngresosId , debit: 0 , credit: 10000 } ,
      ] ,
    } ) ;

    const fechaReferencia = new Date( 2026 , 2 , 1 ) ;

    const res1 = await rellenarResumenesFaltantes( orgId , fechaReferencia ) ;
    expect( res1.success ).toBe( true ) ;
    expect( res1.value ).toBe( 2 ) ;

    const res2 = await rellenarResumenesFaltantes( orgId , fechaReferencia ) ;
    expect( res2.success ).toBe( true ) ;
    expect( res2.value ).toBe( 2 ) ;

    const filas = await db
      .select()
      .from( monthlySummaries )
      .where( eq( monthlySummaries.organizationId , orgId ) ) ;

    expect( filas.length ).toBe( 2 ) ;
  } ) ;

  it( "organización sin transacciones" , async () => {
    const [ orgVacia ] = await db
      .insert( organizations )
      .values( {
        name: "Org Sin Movimientos" ,
        slug: "org-sin-movimientos" ,
      } )
      .returning() ;

    const res = await rellenarResumenesFaltantes( orgVacia.id ) ;
    expect( res.success ).toBe( true ) ;
    expect( res.value ).toBe( 0 ) ;

    const filas = await db
      .select()
      .from( monthlySummaries )
      .where( eq( monthlySummaries.organizationId , orgVacia.id ) ) ;

    expect( filas.length ).toBe( 0 ) ;
  } ) ;

  it( "aislamiento multi-tenant" , async () => {
    const [ org2 ] = await db
      .insert( organizations )
      .values( {
        name: "Org Inquilino 2" ,
        slug: "org-inquilino-2" ,
      } )
      .returning() ;

    const [ ctaBanco2 ] = await db
      .insert( accounts )
      .values( {
        organizationId: org2.id ,
        code:           "1.1.01.01" ,
        name:           "Banco Org 2" ,
        type:           "asset" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    const [ ctaIng2 ] = await db
      .insert( accounts )
      .values( {
        organizationId: org2.id ,
        code:           "4.1.01.01" ,
        name:           "Ingresos Org 2" ,
        type:           "revenue" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    // Transacción en Org 1
    await createLedgerTransaction( {
      organizationId: orgId ,
      occurredAt:     new Date( 2026 , 0 , 10 ) ,
      description:    "Ingreso Org 1" ,
      entries: [
        { accountId: ctaBancoId , debit: 100000 , credit: 0 } ,
        { accountId: ctaIngresosId , debit: 0 , credit: 100000 } ,
      ] ,
    } ) ;

    // Transacción en Org 2
    await createLedgerTransaction( {
      organizationId: org2.id ,
      occurredAt:     new Date( 2026 , 0 , 10 ) ,
      description:    "Ingreso Org 2" ,
      entries: [
        { accountId: ctaBanco2.id , debit: 750000 , credit: 0 } ,
        { accountId: ctaIng2.id , debit: 0 , credit: 750000 } ,
      ] ,
    } ) ;

    const resOrg1 = await derivarResumenDeMes( orgId , 2026 , 0 ) ;
    const resOrg2 = await derivarResumenDeMes( org2.id , 2026 , 0 ) ;

    expect( resOrg1.totalRevenue ).toBe( 100000 ) ;
    expect( resOrg2.totalRevenue ).toBe( 750000 ) ;
  } ) ;
} ) ;
