// Librerías externas
import { eq }                                                   from "drizzle-orm" ;
import { describe , it , expect , beforeEach , afterEach , vi } from "vitest" ;

// Shared
import { db } from "@/shared/db/client" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { monthlySummaryRepository } from "./monthlySummaryRepository" ;
import {
  accounts ,
  ledgerTransactions ,
  ledgerEntries ,
  idempotencyKeys ,
  outboxEvents ,
  monthlySummaries
} from "../schema.db" ;


describe( "monthlySummaryRepository" , () => {
  let orgId: string ;

  const cleanDatabase = async () => {
    // Eliminar registros en orden correcto de llaves foráneas para evitar violaciones de integridad
    await db.delete( outboxEvents ) ;
    await db.delete( idempotencyKeys ) ;
    await db.delete( ledgerEntries ) ;
    await db.delete( ledgerTransactions ) ;
    await db.delete( accounts ) ;
    await db.delete( monthlySummaries ) ;
    await db.delete( organizations ) ;
  } ;

  beforeEach( async () => {
    // Congelar el reloj del sistema en una fecha fija para independizar las pruebas del tiempo real
    vi.useFakeTimers( {toFake: ["Date"]} ) ;
    vi.setSystemTime( new Date(2026 , 5 , 29) ) ; // 29 de Junio de 2026 (5 = Junio)

    // 1. Limpiar base de datos
    await cleanDatabase() ;

    // 2. Crear Organización de prueba
    const [ org ] = await db
      .insert( organizations )
      .values( {
        name: "Test Repository Org" ,
        slug: "test-repository-org" ,
      } )
      .returning() ;

    orgId = org.id ;

    // 3. Sembrar datos históricos: 9 meses (de 2025-10 a 2026-06, en 0-indexed: 2025-09 a 2026-05)
    const testData = [
      { organizationId: orgId , year: 2025 , month: 9  , totalRevenue: 1000 , totalExpense: 800 , balanceSnapshot: 200 } ,
      { organizationId: orgId , year: 2025 , month: 10 , totalRevenue: 1100 , totalExpense: 900 , balanceSnapshot: 400 } ,
      { organizationId: orgId , year: 2025 , month: 11 , totalRevenue: 1200 , totalExpense: 950 , balanceSnapshot: 650 } ,
      { organizationId: orgId , year: 2026 , month: 0  , totalRevenue: 1300 , totalExpense: 1000 , balanceSnapshot: 950 } ,
      { organizationId: orgId , year: 2026 , month: 1  , totalRevenue: 1400 , totalExpense: 1100 , balanceSnapshot: 1250 } ,
      { organizationId: orgId , year: 2026 , month: 2  , totalRevenue: 1500 , totalExpense: 1150 , balanceSnapshot: 1600 } ,
      { organizationId: orgId , year: 2026 , month: 3  , totalRevenue: 1600 , totalExpense: 1200 , balanceSnapshot: 2000 } ,
      { organizationId: orgId , year: 2026 , month: 4  , totalRevenue: 1700 , totalExpense: 1300 , balanceSnapshot: 2400 } ,
      { organizationId: orgId , year: 2026 , month: 5  , totalRevenue: 1800 , totalExpense: 1400 , balanceSnapshot: 2800 }
    ] ;

    // Insertar registros
    for( const data of testData ) {
      await db.insert( monthlySummaries ).values( data ) ;
    }
  } ) ;

  afterEach( async () => {
    // Restaurar el reloj real del sistema al finalizar
    vi.useRealTimers() ;

    // Limpieza posterior de los registros de prueba
    await cleanDatabase() ;
  } ) ;

  it( "debe retornar los resúmenes más recientes ordenados descendente sin límites históricos" , async () => {
    const listado = await monthlySummaryRepository.findRecent( orgId , 6 ) ;

    expect( listado.length ).toBe( 6 ) ;

    // Verificar orden descendente: 2026-05 a 2026-00 (Junio a Enero)
    expect( listado[0].year ).toBe( 2026 ) ;
    expect( listado[0].month ).toBe( 5 ) ;

    expect( listado[1].year ).toBe( 2026 ) ;
    expect( listado[1].month ).toBe( 4 ) ;

    expect( listado[5].year ).toBe( 2026 ) ;
    expect( listado[5].month ).toBe( 0 ) ;
  } ) ;

  it( "debe filtrar correctamente trayendo registros previos a una fecha seleccionada (Ej: 2026-03)" , async () => {
    // Pedir 6 meses terminando en Marzo 2026 (1-indexed: 3; deberia traer 2026-02 al 2025-09, es decir, 0-indexed: 2, 1, 0, 11, 10, 9)
    const listado = await monthlySummaryRepository.findRecent( orgId , 6 , 2026 , 3 ) ;

    expect( listado.length ).toBe( 6 ) ;

    // Primer registro debe ser Marzo 2026 (0-indexed: 2)
    expect( listado[0].year ).toBe( 2026 ) ;
    expect( listado[0].month ).toBe( 2 ) ;

    // Segundo registro debe ser Febrero 2026 (0-indexed: 1)
    expect( listado[1].year ).toBe( 2026 ) ;
    expect( listado[1].month ).toBe( 1 ) ;

    // Último registro debe ser Octubre 2025 (0-indexed: 9)
    expect( listado[5].year ).toBe( 2025 ) ;
    expect( listado[5].month ).toBe( 9 ) ;
  } ) ;

  it( "debe retornar menos registros si el límite solicitado supera los datos disponibles históricos" , async () => {
    // Pedir 6 meses antes de Noviembre 2025 (1-indexed: 11; solo hay Noviembre y Octubre disponibles en la DB para ese rango, es decir, 0-indexed: 10 y 9)
    const listado = await monthlySummaryRepository.findRecent( orgId , 6 , 2025 , 11 ) ;

    expect( listado.length ).toBe( 2 ) ;

    expect( listado[0].year ).toBe( 2025 ) ;
    expect( listado[0].month ).toBe( 10 ) ;

    expect( listado[1].year ).toBe( 2025 ) ;
    expect( listado[1].month ).toBe( 9 ) ;
  } ) ;
} ) ;
