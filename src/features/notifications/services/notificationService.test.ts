// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Notifications
import { destinatariosDeCarga , destinatariosDeReverso } from "./notificationService" ;


describe( "destinatariosDeCarga (RN-9a, RN-10)" , () => {
  it( "titular distinto del autor: avisa al titular" , () => {
    expect( destinatariosDeCarga( { autorId: "beto" , titularId: "ana" } ) ).toEqual( [ "ana" ] ) ;
  } ) ;

  it( "titular igual al autor: no avisa a nadie" , () => {
    expect( destinatariosDeCarga( { autorId: "ana" , titularId: "ana" } ) ).toEqual( [] ) ;
  } ) ;

  it( "sin titular: no avisa a nadie" , () => {
    expect( destinatariosDeCarga( { autorId: "beto" , titularId: null } ) ).toEqual( [] ) ;
    expect( destinatariosDeCarga( { autorId: null , titularId: undefined } ) ).toEqual( [] ) ;
  } ) ;
} ) ;

describe( "destinatariosDeReverso (RN-9f, S-K)" , () => {
  it( "avisa al titular y al autor de la original, sin el actor" , () => {
    expect( destinatariosDeReverso( { actorId: "carla" , titularId: "ana" , autorOriginalId: "beto" } ) ).toEqual( [ "ana" , "beto" ] ) ;
  } ) ;

  it( "no repite cuando titular y autor son la misma persona" , () => {
    expect( destinatariosDeReverso( { actorId: "carla" , titularId: "ana" , autorOriginalId: "ana" } ) ).toEqual( [ "ana" ] ) ;
  } ) ;

  it( "no incluye nulos" , () => {
    expect( destinatariosDeReverso( { actorId: "carla" , titularId: null , autorOriginalId: "beto" } ) ).toEqual( [ "beto" ] ) ;
    expect( destinatariosDeReverso( { actorId: "carla" , titularId: null , autorOriginalId: null } ) ).toEqual( [] ) ;
  } ) ;

  it( "no incluye al actor aunque sea titular o autor" , () => {
    expect( destinatariosDeReverso( { actorId: "ana" , titularId: "ana" , autorOriginalId: "beto" } ) ).toEqual( [ "beto" ] ) ;
    expect( destinatariosDeReverso( { actorId: "beto" , titularId: "ana" , autorOriginalId: "beto" } ) ).toEqual( [ "ana" ] ) ;
  } ) ;
} ) ;
