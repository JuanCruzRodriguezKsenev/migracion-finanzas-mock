// Librerías externas
import { describe , it , expect , afterEach , vi } from "vitest" ;

// Shared
import { nuevaClaveDeEnvio } from "./claveIdempotencia" ;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i ;

describe( "nuevaClaveDeEnvio" , () => {
  afterEach( () => {
    vi.unstubAllGlobals() ;
  } ) ;

  it( "debería devolver un UUID v4" , () => {
    expect( nuevaClaveDeEnvio() ).toMatch( UUID_V4 ) ;
  } ) ;

  it( "debería devolver valores distintos en dos llamadas" , () => {
    expect( nuevaClaveDeEnvio() ).not.toBe( nuevaClaveDeEnvio() ) ;
  } ) ;

  it( "debería seguir dando un UUID v4 sin randomUUID (contexto no seguro)" , () => {
    vi.stubGlobal( "crypto" , { getRandomValues: globalThis.crypto.getRandomValues.bind( globalThis.crypto ) } ) ;

    const k = nuevaClaveDeEnvio() ;

    expect( k ).toMatch( UUID_V4 ) ;
    expect( nuevaClaveDeEnvio() ).not.toBe( k ) ;
  } ) ;
} ) ;
