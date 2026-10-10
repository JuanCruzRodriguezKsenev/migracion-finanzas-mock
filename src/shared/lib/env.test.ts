/**
 * @file env.test.ts
 * Tests unitarios para la validación estricta de variables de entorno con Zod.
 */
import { describe , it , expect , beforeEach } from "vitest" ;
import { obtenerEnv , resetEnvCache } from "./env" ;

describe( "env validation (obtenerEnv)" , () => {
  beforeEach( () => {
    resetEnvCache() ;
  } ) ;

  it( "debería validar exitosamente una configuración completa y válida" , () => {
    const validConfig = {
      NODE_ENV: "development" ,
      DATABASE_URL: "postgresql://postgres:pwd@localhost:5432/finanzas_db" ,
      NEXTAUTH_SECRET: "super-secret-key-12345" ,
      NEXTAUTH_URL: "http://localhost:3000" ,
    } ;

    const env = obtenerEnv( validConfig ) ;
    expect( env.NODE_ENV ).toBe( "development" ) ;
    expect( env.DATABASE_URL ).toBe( "postgresql://postgres:pwd@localhost:5432/finanzas_db" ) ;
    expect( env.NEXTAUTH_SECRET ).toBe( "super-secret-key-12345" ) ;
    expect( env.NEXTAUTH_URL ).toBe( "http://localhost:3000" ) ;
  } ) ;

  it( "debería asignar valores por defecto a campos opcionales" , () => {
    const minimalConfig = {
      DATABASE_URL: "postgresql://postgres:pwd@localhost:5432/finanzas_db"
    } ;

    const env = obtenerEnv( minimalConfig ) ;
    expect( env.NODE_ENV ).toBe( "development" ) ;
    expect( env.NEXTAUTH_SECRET ).toBeUndefined() ;
  } ) ;

  it( "debería lanzar error si DATABASE_URL no está definida" , () => {
    const invalidConfig = {
      NODE_ENV: "development"
    } ;

    expect( () => obtenerEnv( invalidConfig ) ).toThrow( "DATABASE_URL es obligatoria." ) ;
  } ) ;

  it( "debería lanzar error si DATABASE_URL no tiene protocolo postgres/postgresql" , () => {
    const invalidConfig = {
      DATABASE_URL: "mysql://root:pwd@localhost:3306/db"
    } ;

    expect( () => obtenerEnv( invalidConfig ) ).toThrow( "DATABASE_URL debe ser una URL de PostgreSQL válida" ) ;
  } ) ;

  it( "debería exigir NEXTAUTH_SECRET obligatoriamente en entorno de producción" , () => {
    const prodWithoutSecret = {
      NODE_ENV: "production" ,
      DATABASE_URL: "postgresql://postgres:pwd@neon.tech/finanzas_db"
    } ;

    expect( () => obtenerEnv( prodWithoutSecret ) ).toThrow( "NEXTAUTH_SECRET es obligatoria en entorno de producción." ) ;
  } ) ;

  it( "debería permitir NEXTAUTH_SECRET ausente en entorno de desarrollo" , () => {
    const devWithoutSecret = {
      NODE_ENV: "development" ,
      DATABASE_URL: "postgresql://postgres:pwd@localhost:5432/finanzas_db"
    } ;

    const env = obtenerEnv( devWithoutSecret ) ;
    expect( env.NEXTAUTH_SECRET ).toBeUndefined() ;
  } ) ;

  it( "debería lanzar error si NEXTAUTH_URL no es una URL válida" , () => {
    const invalidUrlConfig = {
      DATABASE_URL: "postgresql://postgres:pwd@localhost:5432/finanzas_db" ,
      NEXTAUTH_URL: "not-a-url"
    } ;

    expect( () => obtenerEnv( invalidUrlConfig ) ).toThrow( "NEXTAUTH_URL debe ser una URL válida" ) ;
  } ) ;

  it( "debería permitir configuración válida con ambas variables de Google OAuth presentes" , () => {
    const configConGoogle = {
      DATABASE_URL:         "postgresql://postgres:pwd@localhost:5432/finanzas_db" ,
      GOOGLE_CLIENT_ID:     "google-client-id" ,
      GOOGLE_CLIENT_SECRET: "google-client-secret"
    } ;

    const env = obtenerEnv( configConGoogle ) ;
    expect( env.GOOGLE_CLIENT_ID ).toBe( "google-client-id" ) ;
    expect( env.GOOGLE_CLIENT_SECRET ).toBe( "google-client-secret" ) ;
  } ) ;

  it( "debería lanzar error si sólo GOOGLE_CLIENT_ID está definida sin GOOGLE_CLIENT_SECRET" , () => {
    const configSoloId = {
      DATABASE_URL:     "postgresql://postgres:pwd@localhost:5432/finanzas_db" ,
      GOOGLE_CLIENT_ID: "google-client-id"
    } ;

    expect( () => obtenerEnv( configSoloId ) ).toThrow(
      "GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET deben definirse ambas o ninguna."
    ) ;
  } ) ;

  it( "debería lanzar error si sólo GOOGLE_CLIENT_SECRET está definida sin GOOGLE_CLIENT_ID" , () => {
    const configSoloSecret = {
      DATABASE_URL:         "postgresql://postgres:pwd@localhost:5432/finanzas_db" ,
      GOOGLE_CLIENT_SECRET: "google-client-secret"
    } ;

    expect( () => obtenerEnv( configSoloSecret ) ).toThrow(
      "GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET deben definirse ambas o ninguna."
    ) ;
  } ) ;
} ) ;
