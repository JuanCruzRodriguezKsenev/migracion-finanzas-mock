// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , afterEach } from "vitest" ;
import { vi }                                 from "vitest" ;

// Shared
import { readStorage , writeStorage } from "./safeStorage" ;


function createMemoryStorage() {
  const m = new Map< string , string >() ;

  return( {
    getItem: ( k: string ) => ( m.has( k ) ? m.get( k )! : null ) ,
    setItem: ( k: string , v: string ) => { m.set( k , v ) ; } ,
  } ) ;
}

describe( "safeStorage" , () => {
  afterEach( () => {
    vi.unstubAllGlobals() ;
  } ) ;

  it( "readStorage devuelve el valor guardado cuando el Storage funciona" , () => {
    const storage = createMemoryStorage() ;
    storage.setItem( "pref" , "dark" ) ;
    vi.stubGlobal( "localStorage" , storage ) ;

    expect( readStorage( "pref" ) ).toBe( "dark" ) ;
  } ) ;

  it( "readStorage devuelve null para una clave ausente" , () => {
    vi.stubGlobal( "localStorage" , createMemoryStorage() ) ;

    expect( readStorage( "missing" ) ).toBeNull() ;
  } ) ;

  it( "readStorage devuelve null cuando el getter de localStorage lanza" , () => {
    Object.defineProperty( globalThis , "localStorage" , {
      configurable: true ,
      get() {
        throw new Error( "SecurityError" ) ;
      } ,
    } ) ;

    expect( readStorage( "pref" ) ).toBeNull() ;
  } ) ;

  it( "readStorage devuelve null cuando localStorage es undefined" , () => {
    vi.stubGlobal( "localStorage" , undefined ) ;

    expect( readStorage( "pref" ) ).toBeNull() ;
  } ) ;

  it( "writeStorage persiste y devuelve true con Storage disponible" , () => {
    vi.stubGlobal( "localStorage" , createMemoryStorage() ) ;

    const result = writeStorage( "pref" , "light" ) ;

    expect( result ).toBe( true ) ;
    expect( readStorage( "pref" ) ).toBe( "light" ) ;
  } ) ;

  it( "writeStorage devuelve false sin lanzar cuando el setItem lanza (cuota excedida)" , () => {
    vi.stubGlobal( "localStorage" , {
      getItem: () => null ,
      setItem: () => {
        throw new Error( "QuotaExceededError" ) ;
      } ,
    } ) ;

    expect( writeStorage( "pref" , "light" ) ).toBe( false ) ;
  } ) ;
} ) ;
