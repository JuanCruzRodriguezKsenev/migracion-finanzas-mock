// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Accounting
import { etiquetaDeCuenta } from "./types" ;


describe( "etiquetaDeCuenta (RN-15)" , () => {
  it( "una cuenta sin titular es de la organización, aunque traiga comparticiones" , () => {
    expect( etiquetaDeCuenta( {ownerUserId: null} , [] ) ).toEqual( {tipo: "organizacion"} ) ;
  } ) ;

  it( "una personal sin comparticiones es privada" , () => {
    expect( etiquetaDeCuenta( {ownerUserId: "u1"} , [] ) ).toEqual( {tipo: "privada"} ) ;
  } ) ;

  it( "una personal compartida lista las organizaciones" , () => {
    const orgs = [ {id: "o1" , nombre: "Casa"} , {id: "o2" , nombre: "Taller"} ] ;

    expect( etiquetaDeCuenta( {ownerUserId: "u1"} , orgs ) ).toEqual( {tipo: "compartida" , organizaciones: orgs} ) ;
  } ) ;
} ) ;
