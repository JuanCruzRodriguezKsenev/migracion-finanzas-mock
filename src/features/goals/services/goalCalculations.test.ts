/**
 * @file goalCalculations.test.ts
 * Pruebas unitarias de las funciones puras de Metas (RFC 011 §3, AC-8, AC-9, AC-11).
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Goals
import {
  porcentaje ,
  porcentajeParaBarra ,
  mesesRestantes ,
  aporteSugerido ,
  estaVencida ,
  transicionDeEstado
} from "./goalCalculations" ;


const ZONA = "America/Argentina/Buenos_Aires" ;

describe( "goalCalculations - porcentaje" , () => {
  it( "es el real, sin tope, y la barra se topa en 100" , () => {
    expect( porcentaje( 5000 , 10000 ) ).toBe( 50 ) ;
    expect( porcentaje( 15000 , 10000 ) ).toBe( 150 ) ;
    expect( porcentajeParaBarra( 15000 , 10000 ) ).toBe( 100 ) ;
    expect( porcentajeParaBarra( 3333 , 10000 ) ).toBe( 33 ) ;
  } ) ;

  it( "no se rompe con objetivo cero ni con ahorrado negativo" , () => {
    expect( porcentaje( 100 , 0 ) ).toBe( 0 ) ;
    expect( porcentaje( -100 , 1000 ) ).toBe( 0 ) ;
  } ) ;
} ) ;

describe( "goalCalculations - mesesRestantes y sugerido (AC-11)" , () => {
  const hoy = new Date( "2026-10-15T15:00:00Z" ) ;

  it( "fecha dentro del mes de hoy cuenta como 1, no 0" , () => {
    expect( mesesRestantes( hoy , "2026-10-30" , ZONA ) ).toBe( 1 ) ;
    expect( mesesRestantes( hoy , "2026-10-01" , ZONA ) ).toBe( 1 ) ;
  } ) ;

  it( "cuenta meses calendario entre claves de mes" , () => {
    expect( mesesRestantes( hoy , "2027-08-20" , ZONA ) ).toBe( 10 ) ;
    expect( mesesRestantes( hoy , "2026-11-01" , ZONA ) ).toBe( 1 ) ;
    expect( mesesRestantes( hoy , "2027-10-01" , ZONA ) ).toBe( 12 ) ;
  } ) ;

  it( "usa la zona del usuario, no la del servidor (borde de mes)" , () => {
    // 2026-11-01T01:00Z sigue siendo 31 de octubre en Buenos Aires
    const borde = new Date( "2026-11-01T01:00:00Z" ) ;
    expect( mesesRestantes( borde , "2026-12-10" , ZONA ) ).toBe( 2 ) ;
    expect( mesesRestantes( borde , "2026-12-10" , "Asia/Tokyo" ) ).toBe( 1 ) ;
  } ) ;

  it( "aporteSugerido usa ceil entero y no sugiere negativo" , () => {
    expect( aporteSugerido( 10000000 , 10 ) ).toBe( 1000000 ) ;
    expect( aporteSugerido( 10000001 , 10 ) ).toBe( 1000001 ) ;
    expect( aporteSugerido( 100 , 0 ) ).toBe( 100 ) ;
    expect( aporteSugerido( 0 , 3 ) ).toBe( 0 ) ;
    expect( aporteSugerido( -500 , 3 ) ).toBe( 0 ) ;
  } ) ;
} ) ;

describe( "goalCalculations - estaVencida" , () => {
  const hoy = new Date( "2026-10-15T15:00:00Z" ) ;

  it( "vencida sólo si la fecha es anterior al día de hoy" , () => {
    expect( estaVencida( hoy , "2026-10-14" , ZONA ) ).toBe( true ) ;
    expect( estaVencida( hoy , "2026-10-15" , ZONA ) ).toBe( false ) ;
    expect( estaVencida( hoy , "2026-12-31" , ZONA ) ).toBe( false ) ;
  } ) ;
} ) ;

describe( "goalCalculations - transicionDeEstado (AC-8, AC-9)" , () => {
  it( "active → completed al alcanzar el objetivo" , () => {
    expect( transicionDeEstado( "active" , 1000 , 1000 ) ).toBe( "completed" ) ;
    expect( transicionDeEstado( "active" , 999 , 1000 ) ).toBe( "active" ) ;
  } ) ;

  it( "completed → active si baja del objetivo" , () => {
    expect( transicionDeEstado( "completed" , 999 , 1000 ) ).toBe( "active" ) ;
    expect( transicionDeEstado( "completed" , 1500 , 1000 ) ).toBe( "completed" ) ;
  } ) ;

  it( "abandoned no cambia nunca" , () => {
    expect( transicionDeEstado( "abandoned" , 5000 , 1000 ) ).toBe( "abandoned" ) ;
    expect( transicionDeEstado( "abandoned" , 0 , 1000 ) ).toBe( "abandoned" ) ;
  } ) ;
} ) ;
