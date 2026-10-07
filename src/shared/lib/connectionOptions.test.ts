/**
 * @file connectionOptions.test.ts
 * Tests unitarios de las opciones de conexión según el destino (local, Neon directo, Neon con pooler).
 */
import { describe , it , expect } from "vitest" ;
import { opcionesDeConexion }     from "@/shared/db/connectionOptions" ;

describe( "opcionesDeConexion" , () => {
  it( "URL local: sentencias preparadas y max 5" , () => {
    expect( opcionesDeConexion( "postgresql://postgres:pwd@localhost:5432/finanzas_db" ) ).toEqual( {max: 5 , prepare: true} ) ;
  } ) ;

  it( "endpoint directo de Neon (sin -pooler): prepare true" , () => {
    expect( opcionesDeConexion( "postgresql://u:pwd@ep-cool-name-123456.sa-east-1.aws.neon.tech/neondb?sslmode=require" ).prepare ).toBe( true ) ;
  } ) ;

  it( "endpoint con -pooler: prepare false y max 5" , () => {
    expect( opcionesDeConexion( "postgresql://u:pwd@ep-cool-name-123456-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require" ) ).toEqual( {max: 5 , prepare: false} ) ;
  } ) ;

  it( "contraseña con caracteres especiales y sslmode no rompen el parseo" , () => {
    const url = "postgresql://u:p%40ss%2Fw%3Ard@ep-x-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require" ;
    expect( opcionesDeConexion( url ).prepare ).toBe( false ) ;
  } ) ;

  it( "-pooler en la contraseña o en la ruta no cuenta: sólo el host" , () => {
    expect( opcionesDeConexion( "postgresql://u:x-pooler@localhost:5432/db-pooler" ).prepare ).toBe( true ) ;
  } ) ;

  it( "URL inválida: valores por defecto" , () => {
    expect( opcionesDeConexion( "esto no es una url" ) ).toEqual( {max: 5 , prepare: true} ) ;
  } ) ;
} ) ;
