/**
 * @file circuitBreaker.ts
 * Implementación del patrón Circuit Breaker (Cortocircuito) para proteger el sistema de caídas en APIs externas.
 */

/**
 * Clase que envuelve llamadas a servicios externos inestables.
 * Evita la sobrecarga del servidor fallando rápido si el servicio acumula fallas.
 */
export class CircuitBreaker< T , Args extends unknown[] > {
  private state:           "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED" ;
  private failureCount:    number                          = 0 ;
  private lastFailureTime: number | null                   = null ;
  
  constructor(
    private requestFn:        ( ...args: Args ) => Promise< T > ,
    private cooldownMs:       number = 30000 ,
    private fallbackValue:    T ,
    private failureThreshold: number = 5 ,
  ) {}

  /**
   * Ejecuta la función externa provista o retorna el valor de fallback si el circuito está abierto.
   * 
   * @param args - Los argumentos a pasar a la función ejecutora.
   * @returns El resultado de la función o el valor de fallback.
   */
  async execute( ...args: Args ): Promise< T > {
    const now = Date.now() ;
    
    // Verificar transición de OPEN a HALF_OPEN tras transcurrir el cooldown
    if( (this.state === "OPEN") && this.lastFailureTime && (this.cooldownMs < (now - this.lastFailureTime)) ){
      this.state = "HALF_OPEN" ;
    }

    if( this.state === "OPEN" ){
      return( this.fallbackValue ) ;
    }

    try {
      const result = await this.requestFn( ...args ) ;
      this.reset() ;

      return( result ) ;

    } catch( error ) {
      this.handleFailure() ;
      
      return( this.fallbackValue ) ;
    }
  }

  private handleFailure() {
    this.failureCount++ ;
    this.lastFailureTime = Date.now() ;

    if( this.failureThreshold <= this.failureCount ){
      this.state = "OPEN" ;
    }
  }

  private reset() {
    this.state           = "CLOSED" ;
    this.failureCount    = 0 ;
    this.lastFailureTime = null ;
  }
}
