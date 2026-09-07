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
      BRANDFETCH_API_KEY: "test-api-key" ,
      NEXT_PUBLIC_BRANDFETCH_CLIENT_ID: "custom-client"
    } ;

    const env = obtenerEnv( validConfig ) ;
    expect( env.NODE_ENV ).toBe( "development" ) ;
    expect( env.DATABASE_URL ).toBe( "postgresql://postgres:pwd@localhost:5432/finanzas_db" ) ;
    expect( env.NEXTAUTH_SECRET ).toBe( "super-secret-key-12345" ) ;
    expect( env.NEXTAUTH_URL ).toBe( "http://localhost:3000" ) ;
    expect( env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID ).toBe( "custom-client" ) ;
  } ) ;

  it( "debería asignar valores por defecto a campos opcionales" , () => {
    const minimalConfig = {
      DATABASE_URL: "postgresql://postgres:pwd@localhost:5432/finanzas_db"
    } ;

    const env = obtenerEnv( minimalConfig ) ;
    expect( env.NODE_ENV ).toBe( "development" ) ;
    expect( env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID ).toBe( "brandfetch" ) ;
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
} ) ;
