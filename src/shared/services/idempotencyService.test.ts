// Librerías externas
import { describe , it , expect , beforeEach , afterEach , afterAll , vi } from "vitest" ;
import { eq }                                                             from "drizzle-orm" ;

// Shared
import { executeIdempotent , armarClaveIdempotencia , conIdempotencia } from "./idempotencyService" ;
import { ok , fail , Result } from "@/shared/lib/result" ;
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
  describe( "armarClaveIdempotencia" , () => {
    const UUID_A = "3f2b8c1e-9d4a-4b6f-8a1c-2e7d5f0a9b31" ;
    const UUID_B = "7a1d4e92-0c3b-4f58-9e26-b8c0d1a2f345" ;
    const base   = { userId: "u-1" , accion: "crearMovimiento" , claveCliente: UUID_A , datos: { monto: 100 } } ;

    it( "debería dar la misma clave para los mismos datos y otra si cambia userId, acción o datos" , () => {
      const k = armarClaveIdempotencia( base ) ;

      expect( armarClaveIdempotencia( base ) ).toBe( k ) ;
      expect( armarClaveIdempotencia( {...base , userId: "u-2"} ) ).not.toBe( k ) ;
      expect( armarClaveIdempotencia( {...base , accion: "crearPrestamo"} ) ).not.toBe( k ) ;
      expect( armarClaveIdempotencia( {...base , datos: {monto: 101}} ) ).not.toBe( k ) ;
      expect( armarClaveIdempotencia( {...base , claveCliente: UUID_B} ) ).not.toBe( k ) ;
    } ) ;

    it( "debería devolver null sin clave de cliente y lanzar si no es un UUID" , () => {
      expect( armarClaveIdempotencia( {...base , claveCliente: undefined} ) ).toBeNull() ;
      expect( () => armarClaveIdempotencia( {...base , claveCliente: "abc"} ) ).toThrow( "Clave de envío inválida." ) ;
    } ) ;

    it( "debería mantener el largo bajo el límite de 255 con UUIDs reales" , () => {
      const userId = "11111111-2222-4333-8444-555555555555" ;
      const k      = armarClaveIdempotencia( {...base , userId , accion: "registrarAporteCaja"} ) ;

      expect( k!.length ).toBeLessThanOrEqual( 255 ) ;
    } ) ;
  } ) ;

  describe( "conIdempotencia" , () => {
    const clave = "u-1:accion:3f2b8c1e-9d4a-4b6f-8a1c-2e7d5f0a9b31:0123456789abcdef" ;

    it( "debería ejecutar la operación una vez y no escribir fila con clave null" , async () => {
      let llamadas = 0 ;
      const res = await conIdempotencia( null , async () => {
        llamadas++ ;
        return( ok( {n: llamadas} ) ) ;
      } ) ;

      expect( res.success ).toBe( true ) ;
      expect( llamadas ).toBe( 1 ) ;
      expect( (await db.select().from( idempotencyKeys )).length ).toBe( 0 ) ;
    } ) ;

    it( "debería ejecutar la operación una sola vez con la misma clave y devolver respuestas iguales" , async () => {
      let llamadas = 0 ;
      const op = async () => {
        llamadas++ ;
        return( ok( {n: llamadas} ) ) ;
      } ;

      const r1 = await conIdempotencia( clave , op ) ;
      const r2 = await conIdempotencia( clave , op ) ;

      expect( llamadas ).toBe( 1 ) ;
      expect( r1 ).toEqual( r2 ) ;
    } ) ;

    it( "debería convertir un fail en error sin dejar fila y volver a ejecutar en el reintento" , async () => {
      let llamadas = 0 ;
      const op = async (): Promise< Result<{n: number} , string> > => {
        llamadas++ ;
        return( fail( "x" ) ) ;
      } ;

      const r1 = await conIdempotencia( clave , op ) ;

      expect( r1 ).toEqual( fail( "x" ) ) ;
      expect( (await db.select().from( idempotencyKeys )).length ).toBe( 0 ) ;

      await conIdempotencia( clave , op ) ;
      expect( llamadas ).toBe( 2 ) ;
    } ) ;

    it( "debería traducir CONFLICT_PROCESSING a un mensaje legible" , async () => {
      await db.insert( idempotencyKeys ).values( { key: clave , status: "PROCESSING" } ) ;

      const res = await conIdempotencia( clave , async () => ok( 1 ) ) ;

      expect( res ).toEqual( fail( "Ese envío todavía se está procesando. Esperá unos segundos y revisá antes de reintentar." ) ) ;
    } ) ;
  } ) ;
} ) ;
