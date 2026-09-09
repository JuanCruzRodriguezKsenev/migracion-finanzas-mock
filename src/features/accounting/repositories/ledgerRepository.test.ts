// Librerías externas
import { describe , it , expect , beforeEach } from "vitest" ;

// Shared
import { db } from "@/shared/db/client" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { ledgerRepository }                                                                                 from "./ledgerRepository" ;
import { accounts , categories , categoryAccounts , ledgerTransactions , ledgerEntries , outboxEvents }       from "../schema.db" ;


describe( "ledgerRepository" , () => {
  let orgId:      string ;
  let accountId:  string ;
  let account2Id: string ;
  let categoryId: string ;

  beforeEach( async () => {
    // 1. Limpiar base de datos
    await db.delete( outboxEvents       ) ;
    await db.delete( ledgerEntries      ) ;
    await db.delete( ledgerTransactions ) ;
    await db.delete( categoryAccounts   ) ;
    await db.delete( categories         ) ;
    await db.delete( accounts           ) ;
    await db.delete( organizations      ) ;

    // 2. Crear Organización
    const [ org ] = await db
      .insert( organizations )
      .values( {
        name: "Org Repo Test" ,
        slug: "org-repo-test" ,
      } )
      .returning() ;

    orgId = org.id ;

    // 3. Crear Cuentas
    const [ acc1 ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "1.1.01.01" ,
        name:           "Banco Galicia" ,
        type:           "asset" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    const [ acc2 ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "1.1.01.02" ,
        name:           "Efectivo" ,
        type:           "asset" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    accountId  = acc1.id ;
    account2Id = acc2.id ;

    // 4. Crear Categoría
    const [ cat ] = await db
      .insert( categories )
      .values( {
        organizationId: orgId ,
        name:           "Supermercado" ,
        type:           "expense" ,
        accountCode:    "5.1.01.01" ,
      } )
      .returning() ;

    categoryId = cat.id ;
  } ) ;

  describe( "findTransactionsPage" , () => {
    it( "debería paginar correctamente por cursor determinístico sobre (occurred_at, id)" , async () => {
      // Insertar 5 transacciones en orden temporal
      await ledgerRepository.createTransaction( {
        organizationId: orgId ,
        description:    "Tx 1" ,
        occurredAt:     new Date( "2026-06-01T10:00:00Z" ) ,
      } ) ;
      await ledgerRepository.createTransaction( {
        organizationId: orgId ,
        description:    "Tx 2" ,
        occurredAt:     new Date( "2026-06-02T10:00:00Z" ) ,
      } ) ;
      await ledgerRepository.createTransaction( {
        organizationId: orgId ,
        description:    "Tx 3" ,
        occurredAt:     new Date( "2026-06-03T10:00:00Z" ) ,
      } ) ;

      // Primera página: limit 2 -> debe retornar t3 y t2
      const page1 = await ledgerRepository.findTransactionsPage( {
        organizationId: orgId ,
        limit:          2 ,
      } ) ;

      expect( page1.items.length ).toBe( 2 ) ;
      expect( page1.items[0].description ).toBe( "Tx 3" ) ;
      expect( page1.items[1].description ).toBe( "Tx 2" ) ;
      expect( page1.hasMore ).toBe( true ) ;
      expect( page1.nextCursor ).toBeDefined() ;

      // Segunda página usando cursor
      const cursorObj = {
        occurredAt: new Date( page1.nextCursor!.occurredAt ) ,
        id:         page1.nextCursor!.id ,
      } ;

      const page2 = await ledgerRepository.findTransactionsPage( {
        organizationId: orgId ,
        cursor:         cursorObj ,
        limit:          2 ,
      } ) ;

      expect( page2.items.length ).toBe( 1 ) ;
      expect( page2.items[0].description ).toBe( "Tx 1" ) ;
      expect( page2.hasMore ).toBe( false ) ;
      expect( page2.nextCursor ).toBeNull() ;
    } ) ;

    it( "debería filtrar por texto de búsqueda en description o merchantName" , async () => {
      await ledgerRepository.createTransaction( {
        organizationId: orgId ,
        description:    "Compra semanal Carrefour" ,
        merchantName:   "Carrefour Argentina" ,
      } ) ;

      await ledgerRepository.createTransaction( {
        organizationId: orgId ,
        description:    "Pago de Internet" ,
        merchantName:   "Fibertel" ,
      } ) ;

      const searchRes = await ledgerRepository.findTransactionsPage( {
        organizationId: orgId ,
        search:         "carrefour" ,
      } ) ;

      expect( searchRes.items.length ).toBe( 1 ) ;
      expect( searchRes.items[0].description ).toBe( "Compra semanal Carrefour" ) ;
    } ) ;

    it( "debería filtrar por accountId mediante las entradas contables asociadas" , async () => {
      const txA = await ledgerRepository.createTransaction( {
        organizationId: orgId ,
        description:    "Movimiento Cuenta 1" ,
      } ) ;
      await ledgerRepository.createEntries( [
        { transactionId: txA.id , accountId: accountId , debit: 1000 , credit: 0 } ,
        { transactionId: txA.id , accountId: account2Id , debit: 0 , credit: 1000 } ,
      ] ) ;

      const txB = await ledgerRepository.createTransaction( {
        organizationId: orgId ,
        description:    "Movimiento Solo Cuenta 2" ,
      } ) ;
      await ledgerRepository.createEntries( [
        { transactionId: txB.id , accountId: account2Id , debit: 500 , credit: 0 } ,
        { transactionId: txB.id , accountId: account2Id , debit: 0 , credit: 500 } ,
      ] ) ;

      const res = await ledgerRepository.findTransactionsPage( {
        organizationId: orgId ,
        accountId:      accountId ,
      } ) ;

      expect( res.items.length ).toBe( 1 ) ;
      expect( res.items[0].id ).toBe( txA.id ) ;
    } ) ;

    it( "debería filtrar por categoryId" , async () => {
      await ledgerRepository.createTransaction( {
        organizationId: orgId ,
        categoryId:     categoryId ,
        description:    "Con categoría" ,
      } ) ;

      await ledgerRepository.createTransaction( {
        organizationId: orgId ,
        categoryId:     null ,
        description:    "Sin categoría" ,
      } ) ;

      const res = await ledgerRepository.findTransactionsPage( {
        organizationId: orgId ,
        categoryId:     categoryId ,
      } ) ;

      expect( res.items.length ).toBe( 1 ) ;
      expect( res.items[0].description ).toBe( "Con categoría" ) ;
    } ) ;
  } ) ;

  describe( "updateTransactionMetadata" , () => {
    it( "debería actualizar campos de metadatos correctamente" , async () => {
      const tx = await ledgerRepository.createTransaction( {
        organizationId: orgId ,
        description:    "Original" ,
      } ) ;

      const updated = await ledgerRepository.updateTransactionMetadata( tx.id , orgId , {
        description:  "Actualizada" ,
        merchantName: "Nuevo Comercio" ,
      } ) ;

      expect( updated ).toBeDefined() ;
      expect( updated!.description ).toBe( "Actualizada" ) ;
      expect( updated!.merchantName ).toBe( "Nuevo Comercio" ) ;
    } ) ;
  } ) ;
} ) ;
