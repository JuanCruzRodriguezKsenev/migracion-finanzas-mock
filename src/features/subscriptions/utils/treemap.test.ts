// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Subscriptions
import { computeTreemap , TreemapNode } from "./treemap" ;


function makeNode( id: string , weight: number ): TreemapNode {
  return( {id , name: id , price: weight , weight} ) ;
}

/**
 * Suite de pruebas unitarias para el algoritmo de treemap squarified.
 */
describe( "computeTreemap" , () => {
  it( "debería retornar un arreglo vacío cuando el peso total es cero" , () => {
    expect( computeTreemap( [] ) ).toEqual( [] ) ;
    expect( computeTreemap( [ makeNode( "a" , 0 ) ] ) ).toEqual( [] ) ;
  } ) ;

  it( "debería asignar todo el lienzo a un único nodo" , () => {
    const [ rect ] = computeTreemap( [ makeNode( "a" , 10 ) ] , 100 , 100 ) ;

    expect( rect.x ).toBe( 0 ) ;
    expect( rect.y ).toBe( 0 ) ;
    expect( rect.width * rect.height ).toBeCloseTo( 10000 , 0 ) ;
  } ) ;

  it( "debería producir un rectángulo por nodo" , () => {
    const nodes = [ makeNode( "a" , 5 ) , makeNode( "b" , 3 ) , makeNode( "c" , 2 ) ] ;
    const rects = computeTreemap( nodes , 100 , 100 ) ;

    expect( rects.length ).toBe( 3 ) ;
    expect( new Set( rects.map( ( r ) => r.id ) ).size ).toBe( 3 ) ;
  } ) ;

  it( "debería asignar áreas proporcionales al peso de cada nodo" , () => {
    const nodes = [ makeNode( "grande" , 75 ) , makeNode( "chico" , 25 ) ] ;
    const rects = computeTreemap( nodes , 100 , 100 ) ;

    const grande = rects.find( ( r ) => r.id === "grande" ) ;
    const chico  = rects.find( ( r ) => r.id === "chico" ) ;

    expect( grande ).toBeDefined() ;
    expect( chico ).toBeDefined() ;
    expect( (grande!.width * grande!.height) ).toBeCloseTo( 7500 , 0 ) ;
    expect( (chico!.width * chico!.height) ).toBeCloseTo( 2500 , 0 ) ;
  } ) ;

  it( "debería cubrir el área total del lienzo con la suma de los rectángulos" , () => {
    const nodes = [ makeNode( "a" , 8 ) , makeNode( "b" , 5 ) , makeNode( "c" , 3 ) , makeNode( "d" , 2 ) , makeNode( "e" , 1 ) ] ;
    const rects = computeTreemap( nodes , 200 , 120 ) ;

    const totalArea = rects.reduce( ( acc , r ) => acc + (r.width * r.height) , 0 ) ;

    expect( totalArea ).toBeCloseTo( 200 * 120 , 0 ) ;
  } ) ;

  it( "debería mantener todos los rectángulos dentro de los límites del lienzo" , () => {
    const nodes = [ makeNode( "a" , 8 ) , makeNode( "b" , 5 ) , makeNode( "c" , 3 ) , makeNode( "d" , 1 ) ] ;
    const rects = computeTreemap( nodes , 100 , 100 ) ;

    for( const r of rects ){
      expect( r.x ).toBeGreaterThanOrEqual( 0 ) ;
      expect( r.y ).toBeGreaterThanOrEqual( 0 ) ;
      expect( r.x + r.width ).toBeLessThanOrEqual( 100.01 ) ;  // tolerancia de redondeo a 4 decimales
      expect( r.y + r.height ).toBeLessThanOrEqual( 100.01 ) ;
    }
  } ) ;

  it( "no debería mutar el arreglo de nodos de entrada" , () => {
    const nodes = [ makeNode( "a" , 1 ) , makeNode( "b" , 9 ) ] ;
    computeTreemap( nodes , 100 , 100 ) ;

    expect( nodes[0].id ).toBe( "a" ) ;
  } ) ;
} ) ;
