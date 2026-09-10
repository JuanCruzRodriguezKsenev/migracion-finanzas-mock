// Librerías externas
import { describe , it , expect , beforeEach , afterEach , afterAll , vi } from "vitest" ;
import { eq }                                                             from "drizzle-orm" ;

// Shared
import { executeIdempotent } from "./idempotencyService" ;
import { db }                from "@/shared/db/client" ;
import { limpiarBase }       from "@/shared/db/testCleanup" ;

// Feature: Accounting
import { idempotencyKeys } from "@/features/accounting/schema.db" ;


/**
 * Suite de pruebas de integración para el servicio de idempotencia.
 * Cubre los casos borde no ejercitados por las pruebas de accountingService:
 * ejecución sin key, reclamo de claves PROCESSING huérfanas (TTL) y liberación
 * de la clave ante fallos de guardado o de la operación de negocio.
 */
describe( "idempotencyService" , () => {
  beforeEach( async () => {
    await limpiarBase() ;
  } ) ;

  afterEach( async () => {
    vi.restoreAllMocks() ;
    await limpiarBase() ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "debería ejecutar el callback directamente sin registrar clave cuando no se provee key" , async () => {
    let llamadas = 0 ;
    const callback = async () => {
      llamadas++ ;
      return( "resultado" ) ;
    } ;

    const res1 = await executeIdempotent( "" , callback ) ;
    const res2 = await executeIdempotent( "" , callback ) ;

    expect( res1.success ).toBe( true ) ;
    expect( res2.success ).toBe( true ) ;
    expect( llamadas ).toBe( 2 ) ; // Sin key, no hay caché: se ejecuta ambas veces

    const registros = await db.select().from( idempotencyKeys ) ;
    expect( registros.length ).toBe( 0 ) ;
  } ) ;

  it( "debería reclamar una clave PROCESSING vencida (TTL) y ejecutar la operación" , async () => {
    const key = "key-vencida" ;
    const fechaVencida = new Date( Date.now() - ( 10 * 60 * 1000 ) ) ; // 10 minutos atrás (TTL es 5 minutos)

    await db.insert( idempotencyKeys ).values( {
      key ,
      status:    "PROCESSING" ,
      createdAt: fechaVencida ,
    } ) ;

    let llamadas = 0 ;
    const callback = async () => {
      llamadas++ ;
      return( "recuperado" ) ;
    } ;

    const resultado = await executeIdempotent( key , callback ) ;

    expect( resultado.success ).toBe( true ) ;
    expect( llamadas ).toBe( 1 ) ;

    const [ registro ] = await db.select().from( idempotencyKeys ).where( eq(idempotencyKeys.key , key) ) ;
    expect( registro.status ).toBe( "COMPLETED" ) ;
  } ) ;

  it( "no debería reclamar una clave PROCESSING reciente (dentro del TTL)" , async () => {
    const key = "key-reciente" ;

    await db.insert( idempotencyKeys ).values( {
      key ,
      status: "PROCESSING" ,
    } ) ;

    const resultado = await executeIdempotent( key , async () => "no debería ejecutarse" ) ;

    expect( resultado.success ).toBe( false ) ;
    expect( resultado.error ).toBe( "CONFLICT_PROCESSING" ) ;
  } ) ;

  it( "debería liberar la clave si falla el guardado de la respuesta COMPLETED" , async () => {
    const key = "key-fallo-update" ;

    // Forzar que el UPDATE final (marcar COMPLETED) falle una sola vez
    const updateSpy = vi.spyOn( db , "update" ).mockImplementationOnce( () => {
      throw new Error( "Fallo simulado de escritura" ) ;
    } ) ;

    const resultado = await executeIdempotent( key , async () => "resultado-negocio" ) ;

    // La operación de negocio se considera exitosa aunque el registro de idempotencia no se haya podido persistir
    expect( resultado.success ).toBe( true ) ;

    updateSpy.mockRestore() ;

    const registros = await db.select().from( idempotencyKeys ).where( eq(idempotencyKeys.key , key) ) ;
    expect( registros.length ).toBe( 0 ) ; // La clave fue liberada, no quedó atascada en PROCESSING
  } ) ;

  it( "debería limpiar la clave PROCESSING si la operación de negocio falla" , async () => {
    const key = "key-fallo-negocio" ;

    const resultado = await executeIdempotent( key , async () => {
      throw new Error( "Error de negocio simulado" ) ;
    } ) ;

    expect( resultado.success ).toBe( false ) ;

    const registros = await db.select().from( idempotencyKeys ).where( eq(idempotencyKeys.key , key) ) ;
    expect( registros.length ).toBe( 0 ) ; // Permite reintentar con la misma key

    // Un reintento posterior con la misma key debe poder ejecutarse normalmente
    const reintento = await executeIdempotent( key , async () => "ok-en-reintento" ) ;
    expect( reintento.success ).toBe( true ) ;
  } ) ;
} ) ;
