// Librerías externas
import { describe , it , expect , beforeEach , afterEach , afterAll } from "vitest" ;

// Shared
import { db }          from "@/shared/db/client" ;
import { limpiarBase } from "@/shared/db/testCleanup" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { accounts , categories , categoryAccounts , ledgerEntries , ledgerTransactions , monthlySummaries , idempotencyKeys , outboxEvents } from "@/features/accounting/schema.db" ;

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
    await limpiarBase() ;
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

  it( "debería persistir y vincular la suscripción con una categoría contable (RFC 022)" , async () => {
    const [ cat ] = await db
      .insert( categories )
      .values( {
        organizationId: orgId ,
        name:           "Entretenimiento" ,
        type:           "expense" ,
        accountCode:    "5.1.09.01" ,
      } )
      .returning() ;

    const creada = await subscriptionRepository.create( {
      ...baseData() ,
      categoryId: cat.id ,
    } ) ;

    expect( creada.categoryId ).toBe( cat.id ) ;

    const recuperada = await subscriptionRepository.findById( creada.id , orgId ) ;
    expect( recuperada?.categoryId ).toBe( cat.id ) ;
  } ) ;

  it( "debería asociar las categorías contables esperadas según los códigos del catálogo (backfill RFC 022)" , async () => {
    // Padre 5.1.09
    const [ parentCat ] = await db
      .insert( categories )
      .values( {
        organizationId: orgId ,
        name:           "Suscripciones y servicios digitales" ,
        type:           "expense" ,
        accountCode:    "5.1.09" ,
      } )
      .returning() ;

    // Hojas
    const [ entCat ] = await db
      .insert( categories )
      .values( {
        organizationId: orgId ,
        parentId:       parentCat.id ,
        name:           "Entretenimiento" ,
        type:           "expense" ,
        accountCode:    "5.1.09.01" ,
      } )
      .returning() ;

    const [ genCat ] = await db
      .insert( categories )
      .values( {
        organizationId: orgId ,
        parentId:       parentCat.id ,
        name:           "General" ,
        type:           "expense" ,
        accountCode:    "5.1.09.99" ,
        isSystemLeaf:   true ,
      } )
      .returning() ;

    // Suscripción con entretenimiento
    const subEnt = await subscriptionRepository.create( {
      ...baseData() ,
      name:       "Spotify" ,
      categoryId: entCat.id ,
    } ) ;

    // Suscripción con hoja general (other / Sin detallar)
    const subOther = await subscriptionRepository.create( {
      ...baseData() ,
      name:       "Servicio Raro" ,
      categoryId: genCat.id ,
    } ) ;

    expect( subEnt.categoryId ).toBe( entCat.id ) ;
    expect( subOther.categoryId ).toBe( genCat.id ) ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;
} ) ;
