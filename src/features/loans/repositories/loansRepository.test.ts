/**
 * @file loansRepository.test.ts
 * Pruebas de integración para el DAL de préstamos (RFC 008).
 * Valida el aislamiento multi-tenant (§8.8), la limpieza de tablas (§8.10) y operaciones CRUD.
 */
// Librerías externas
import { describe , it , expect , beforeEach , afterEach , afterAll } from "vitest" ;

// Shared
import { db }          from "@/shared/db/client" ;
import { limpiarBase } from "@/shared/db/testCleanup" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { financialEntities } from "@/features/accounting/schema.db" ;

// Feature: Loans
import { loans , loanAccounts } from "../schema.db" ;
import { loansRepository }      from "./loansRepository" ;
import { insertTestLoan }       from "../testing/loanFactory" ;


describe( "loansRepository — DAL de Préstamos y Multi-Tenancy" , () => {
  let org1Id: string ;
  let org2Id: string ;

  const cleanDb = async () => {
    await limpiarBase() ;
  } ;

  beforeEach( async () => {
    await cleanDb() ;

    const [ org1 ] = await db
      .insert( organizations )
      .values( { name: "Org Alfa" , slug: "org-alfa" } )
      .returning() ;
    org1Id = org1.id ;

    const [ org2 ] = await db
      .insert( organizations )
      .values( { name: "Org Beta" , slug: "org-beta" } )
      .returning() ;
    org2Id = org2.id ;
  } ) ;

  afterEach( async () => {
    await cleanDb() ;
  } ) ;

  afterAll( async () => {
    await cleanDb() ;
  } ) ;

  describe( "§8.8 Aislamiento multi-tenant estricto" , () => {
    it( "ninguna consulta del repositorio devuelve filas de otra organización" , async () => {
      // Crear un préstamo en org1
      const loanOrg1 = await insertTestLoan( org1Id , { name: "Préstamo Org 1" } , "2.1.01.01" ) ;

      // 1. findAll para org2 no devuelve nada
      const listOrg2 = await loansRepository.findAll( org2Id ) ;
      expect( listOrg2 ).toHaveLength( 0 ) ;

      // 2. findById desde org2 retorna null
      const findOrg2 = await loansRepository.findById( loanOrg1.id , org2Id ) ;
      expect( findOrg2 ).toBeNull() ;

      // 3. findByIdForUpdate desde org2 retorna null
      const findUpdateOrg2 = await db.transaction( async ( tx ) => {
        return( await loansRepository.findByIdForUpdate( loanOrg1.id , org2Id , tx ) ) ;
      } ) ;
      expect( findUpdateOrg2 ).toBeNull() ;

      // 4. findAccountsByLoanId desde org2 retorna vacío
      const accountsOrg2 = await loansRepository.findAccountsByLoanId( loanOrg1.id , org2Id ) ;
      expect( accountsOrg2 ).toHaveLength( 0 ) ;

      // 5. Desde org1 sí es accesible
      const findOrg1 = await loansRepository.findById( loanOrg1.id , org1Id ) ;
      expect( findOrg1 ).not.toBeNull() ;
      expect( findOrg1?.name ).toBe( "Préstamo Org 1" ) ;

      const accountsOrg1 = await loansRepository.findAccountsByLoanId( loanOrg1.id , org1Id ) ;
      expect( accountsOrg1 ).toHaveLength( 1 ) ;
      expect( accountsOrg1[ 0 ].account.organizationId ).toBe( org1Id ) ;
    } ) ;
  } ) ;

  describe( "§8.10 Integración con limpiarBase()" , () => {
    it( "deja las dos tablas vacías y no rompe integridad referencial" , async () => {
      await insertTestLoan( org1Id , { name: "Préstamo A Limpiar" } , "2.1.01.01" ) ;

      // Verificar que existan registros
      const antesLoans = await db.select().from( loans ) ;
      const antesLoanAccs = await db.select().from( loanAccounts ) ;
      expect( antesLoans.length ).toBeGreaterThan( 0 ) ;
      expect( antesLoanAccs.length ).toBeGreaterThan( 0 ) ;

      // Ejecutar la limpieza
      await limpiarBase() ;

      // Verificar que quedaron vacías
      const despuesLoans = await db.select().from( loans ) ;
      const despuesLoanAccs = await db.select().from( loanAccounts ) ;
      expect( despuesLoans ).toHaveLength( 0 ) ;
      expect( despuesLoanAccs ).toHaveLength( 0 ) ;
    } ) ;
  } ) ;

  describe( "Operaciones CRUD y ciclo de vida" , () => {
    it( "actualiza datos y archiva correctamente" , async () => {
      const loan = await insertTestLoan( org1Id , { name: "Préstamo Original" } , "2.1.01.01" ) ;

      // Update
      const updated = await loansRepository.update( loan.id , org1Id , {
        name:            "Préstamo Modificado" ,
        resolvedThrough: "2026-10-10"
      } ) ;
      expect( updated?.name ).toBe( "Préstamo Modificado" ) ;
      expect( updated?.resolvedThrough ).toBe( "2026-10-10" ) ;

      // Archive
      const archived = await loansRepository.archive( loan.id , org1Id ) ;
      expect( archived?.archivedAt ).not.toBeNull() ;

      // findAll ya no lo lista
      const list = await loansRepository.findAll( org1Id ) ;
      expect( list ).toHaveLength( 0 ) ;
    } ) ;
  } ) ;

  describe( "findAllWithRelations" , () => {
    it( "devuelve entity cargado y contact en null cuando el préstamo tiene entityId" , async () => {
      const [ entity ] = await db
        .insert( financialEntities )
        .values( {
          organizationId: org1Id ,
          name:           "Banco Santander" ,
          logo:           "bank" ,
          color:          "#EC0000"
        } )
        .returning() ;

      await insertTestLoan(
        org1Id ,
        {
          name:     "Préstamo Santander" ,
          entityId: entity.id
        } ,
        "2.1.01.10"
      ) ;

      const results = await loansRepository.findAllWithRelations( org1Id ) ;
      expect( results ).toHaveLength( 1 ) ;
      expect( results[ 0 ].entity ).not.toBeNull() ;
      expect( results[ 0 ].entity?.id ).toBe( entity.id ) ;
      expect( results[ 0 ].entity?.name ).toBe( "Banco Santander" ) ;
      expect( results[ 0 ].contact ).toBeNull() ;
      expect( results[ 0 ].accounts ).toHaveLength( 1 ) ;
    } ) ;

    it( "un préstamo de otra organización no aparece (aislamiento)" , async () => {
      await insertTestLoan( org1Id , { name: "Préstamo Org 1" } , "2.1.01.20" ) ;

      const listOrg2 = await loansRepository.findAllWithRelations( org2Id ) ;
      expect( listOrg2 ).toHaveLength( 0 ) ;

      const listOrg1 = await loansRepository.findAllWithRelations( org1Id ) ;
      expect( listOrg1 ).toHaveLength( 1 ) ;
    } ) ;
  } ) ;
} ) ;
