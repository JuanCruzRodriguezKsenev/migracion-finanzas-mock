// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach } from "vitest" ;

// Shared
import { CircuitBreaker } from "./circuitBreaker" ;


/**
 * Suite de pruebas unitarias para el patrón Circuit Breaker.
 * Verifica las transiciones de estado CLOSED -> OPEN -> HALF_OPEN -> CLOSED
 * y el comportamiento de fallback ante fallas del servicio protegido.
 */
describe( "CircuitBreaker" , () => {
  beforeEach( () => {
    vi.useFakeTimers( {toFake: ["Date"]} ) ;
  } ) ;

  afterEach( () => {
    vi.useRealTimers() ;
  } ) ;

  it( "debería retornar el resultado de la función subyacente cuando tiene éxito" , async () => {
    const requestFn = vi.fn().mockResolvedValue( "ok" ) ;
    const breaker    = new CircuitBreaker( requestFn , "fallback" ) ;

    const resultado = await breaker.execute() ;

    expect( resultado ).toBe( "ok" ) ;
    expect( requestFn ).toHaveBeenCalledTimes( 1 ) ;
  } ) ;

  it( "debería pasar a OPEN y retornar el fallback tras alcanzar el umbral de fallos" , async () => {
    const requestFn = vi.fn().mockRejectedValue( new Error("falla") ) ;
    const breaker    = new CircuitBreaker( requestFn , "fallback" , 30000 , 3 ) ;

    // Consumir el umbral de 3 fallos
    await breaker.execute() ;
    await breaker.execute() ;
    const tercerResultado = await breaker.execute() ;

    expect( tercerResultado ).toBe( "fallback" ) ;

    // El circuito ya debería estar OPEN: una cuarta llamada no debe invocar requestFn
    const cuartoResultado = await breaker.execute() ;

    expect( cuartoResultado ).toBe( "fallback" ) ;
    expect( requestFn ).toHaveBeenCalledTimes( 3 ) ;
  } ) ;

  it( "debería permanecer en OPEN sin invocar la función subyacente mientras dure el cooldown" , async () => {
    const requestFn = vi.fn().mockRejectedValue( new Error("falla") ) ;
    const breaker    = new CircuitBreaker( requestFn , "fallback" , 30000 , 1 ) ;

    await breaker.execute() ; // 1 fallo alcanza el umbral -> OPEN

    vi.setSystemTime( new Date( Date.now() + 10000 ) ) ; // Avanzar 10s, dentro del cooldown de 30s

    const resultado = await breaker.execute() ;

    expect( resultado ).toBe( "fallback" ) ;
    expect( requestFn ).toHaveBeenCalledTimes( 1 ) ; // No se reintentó
  } ) ;

  it( "debería pasar a HALF_OPEN y reintentar la función subyacente tras superar el cooldown" , async () => {
    const requestFn = vi.fn()
      .mockRejectedValueOnce( new Error("falla") )
      .mockResolvedValueOnce( "recuperado" ) ;
    const breaker = new CircuitBreaker( requestFn , "fallback" , 30000 , 1 ) ;

    await breaker.execute() ; // 1 fallo alcanza el umbral -> OPEN

    vi.setSystemTime( new Date( Date.now() + 30001 ) ) ; // Superar el cooldown de 30s

    const resultado = await breaker.execute() ;

    expect( resultado ).toBe( "recuperado" ) ;
    expect( requestFn ).toHaveBeenCalledTimes( 2 ) ;
  } ) ;

  it( "debería resetear el conteo de fallos tras una ejecución exitosa" , async () => {
    const requestFn = vi.fn()
      .mockRejectedValueOnce( new Error("falla") )
      .mockResolvedValueOnce( "ok" )
      .mockRejectedValueOnce( new Error("falla") ) ;
    const breaker = new CircuitBreaker( requestFn , "fallback" , 30000 , 2 ) ;

    await breaker.execute() ; // 1er fallo (no alcanza umbral de 2)
    await breaker.execute() ; // Éxito -> resetea failureCount a 0
    const resultado = await breaker.execute() ; // 1 nuevo fallo (no alcanza umbral de 2 nuevamente)

    expect( resultado ).toBe( "fallback" ) ;
    expect( requestFn ).toHaveBeenCalledTimes( 3 ) ;
  } ) ;
} ) ;
