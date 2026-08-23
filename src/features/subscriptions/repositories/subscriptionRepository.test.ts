// Librerías externas
import { describe , it , expect , beforeEach , afterEach } from "vitest" ;

// Shared
import { db } from "@/shared/db/client" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { accounts , ledgerEntries , ledgerTransactions , monthlySummaries , idempotencyKeys , outboxEvents } from "@/features/accounting/schema.db" ;

// Feature: Subscriptions
import { subscriptionRepository } from "./subscriptionRepository" ;
import { subscriptions }          from "../schema.db" ;


/**
 * Suite de pruebas de integración para el repositorio de suscripciones.
 * Verifica el CRUD completo y el aislamiento multi-tenant por organización.
 */
describe( "subscriptionRepository" , () => {
  let orgId:      string ;
  let otherOrgId: string ;

  const cleanDatabase = async () => {
    await db.delete( subscriptions ) ;
    await db.delete( outboxEvents ) ;
    await db.delete( idempotencyKeys ) ;
    await db.delete( ledgerEntries ) ;
    await db.delete( ledgerTransactions ) ;
    await db.delete( monthlySummaries ) ;
    await db.delete( accounts ) ;
    await db.delete( organizations ) ;
  } ;

  beforeEach( async () => {
    await cleanDatabase() ;

    const [ org ] = await db
      .insert( organizations )
      .values( {name: "Org Subs Test" , slug: "org-subs-test"} )
      .returning() ;
    orgId = org.id ;

    const [ otherOrg ] = await db
      .insert( organizations )
      .values( {name: "Org Ajena" , slug: "org-ajena-test"} )
      .returning() ;
    otherOrgId = otherOrg.id ;
  } ) ;

  afterEach( async () => {
    await cleanDatabase() ;
  } ) ;

  const baseData = () => ( {
    organizationId:  orgId ,
    name:            "Netflix" ,
    amount:          1599000 ,
    frequency:       "monthly" ,
    startDate:       new Date() ,
    nextPaymentDate: new Date() ,
  } ) ;

  it( "debería crear y recuperar una suscripción de la organización" , async () => {
    const creada = await subscriptionRepository.create( baseData() ) ;

    expect( creada.id ).toBeDefined() ;
    expect( creada.amount ).toBe( 1599000 ) ;
    expect( creada.currency ).toBe( "ARS" ) ;
    expect( creada.status ).toBe( "active" ) ;

    const listado = await subscriptionRepository.findAll( orgId ) ;
    expect( listado.length ).toBe( 1 ) ;
    expect( listado[0].name ).toBe( "Netflix" ) ;
  } ) ;

  it( "debería ordenar el listado por monto descendente" , async () => {
    await subscriptionRepository.create( { ...baseData() , name: "Barata" , amount: 100000 } ) ;
    await subscriptionRepository.create( { ...baseData() , name: "Cara"   , amount: 900000 } ) ;

    const listado = await subscriptionRepository.findAll( orgId ) ;

    expect( listado[0].name ).toBe( "Cara" ) ;
    expect( listado[1].name ).toBe( "Barata" ) ;
  } ) ;

  it( "no debería exponer suscripciones de otra organización" , async () => {
    const ajena = await subscriptionRepository.create( { ...baseData() , organizationId: otherOrgId } ) ;

    const listado = await subscriptionRepository.findAll( orgId ) ;
    expect( listado.length ).toBe( 0 ) ;

    const porId = await subscriptionRepository.findById( ajena.id , orgId ) ;
    expect( porId ).toBeNull() ;
  } ) ;

  it( "debería actualizar solo suscripciones de la organización" , async () => {
    const creada = await subscriptionRepository.create( baseData() ) ;

    const actualizada = await subscriptionRepository.update( creada.id , orgId , {amount: 2000000} ) ;
    expect( actualizada?.amount ).toBe( 2000000 ) ;

    // Intento cruzado con otra organización: no debe afectar
    const cruzada = await subscriptionRepository.update( creada.id , otherOrgId , {amount: 1} ) ;
    expect( cruzada ).toBeNull() ;

    const verificada = await subscriptionRepository.findById( creada.id , orgId ) ;
    expect( verificada?.amount ).toBe( 2000000 ) ;
  } ) ;

  it( "debería eliminar solo suscripciones de la organización" , async () => {
    const creada = await subscriptionRepository.create( baseData() ) ;

    // Intento cruzado: no debe borrar
    const cruzado = await subscriptionRepository.remove( creada.id , otherOrgId ) ;
    expect( cruzado ).toBe( false ) ;

    const propio = await subscriptionRepository.remove( creada.id , orgId ) ;
    expect( propio ).toBe( true ) ;

    const listado = await subscriptionRepository.findAll( orgId ) ;
    expect( listado.length ).toBe( 0 ) ;
  } ) ;
} ) ;
