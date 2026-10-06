import { describe , it , expect } from "vitest" ;

// Shared
import { claveDeMes , claveDeMesActual } from "./monthKey" ;

describe( "monthKey utility" , () => {
  it( "calcula correctamente el mes en Buenos Aires vs UTC para las 22:00 del 31 de mayo (AC-17)" , () => {
    // 2026-06-01T01:00:00Z corresponde a 2026-05-31T22:00:00 en America/Argentina/Buenos_Aires (UTC-3)
    const fecha = new Date( "2026-06-01T01:00:00Z" ) ;

    const mesBA  = claveDeMes( fecha , "America/Argentina/Buenos_Aires" ) ;
    const mesUTC = claveDeMes( fecha , "UTC" ) ;

    expect( mesBA ).toBe( "2026-05" ) ;
    expect( mesUTC ).toBe( "2026-06" ) ;
  } ) ;

  it( "formatea correctamente fechas de inicio y fin de mes" , () => {
    const inicio = new Date( "2026-01-01T03:00:00Z" ) ; // 00:00 en Buenos Aires
    expect( claveDeMes( inicio , "America/Argentina/Buenos_Aires" ) ).toBe( "2026-01" ) ;

    const fin = new Date( "2026-12-31T23:59:59Z" ) ;
    expect( claveDeMes( fin , "UTC" ) ).toBe( "2026-12" ) ;
  } ) ;

  it( "claveDeMesActual devuelve un formato YYYY-MM válido" , () => {
    const actual = claveDeMesActual( "America/Argentina/Buenos_Aires" ) ;
    expect( actual ).toMatch( /^\d{4}-\d{2}$/ ) ;
  } ) ;
} ) ;
