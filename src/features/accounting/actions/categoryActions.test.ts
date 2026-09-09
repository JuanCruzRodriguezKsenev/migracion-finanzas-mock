// Librerías externas
import { describe , it , expect , vi , beforeEach } from "vitest" ;
import { getServerSession }                         from "next-auth" ;
import type { Session }                             from "next-auth" ;
import { eq }                                       from "drizzle-orm" ;

// Shared
import { db } from "@/shared/db/client" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import {
  accounts ,
  categories ,
  categoryAccounts ,
  ledgerEntries ,
  ledgerTransactions ,
  idempotencyKeys ,
  outboxEvents ,
  monthlySummaries
} from "../schema.db" ;
import {
  createCategoryAction ,
  updateCategoryAction ,
  archiveCategoryAction ,
  unarchiveCategoryAction ,
  getCategoryTreeAction
} from "./categoryActions" ;
import { categoryRepository }     from "../repositories/categoryRepository" ;
import { createLedgerTransaction } from "../services/accountingService" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

describe( "categoryActions — Reglas del RFC 022 (R3, R4, R5)" , () => {
  let orgId:      string ;
  let cajaArsId:  string ;

  beforeEach( async () => {
    vi.clearAllMocks() ;

    await db.delete( outboxEvents       ) ;
    await db.delete( idempotencyKeys    ) ;
    await db.delete( ledgerEntries      ) ;
    await db.delete( ledgerTransactions ) ;
    await db.delete( monthlySummaries   ) ;
    await db.delete( categoryAccounts   ) ;
    await db.delete( categories         ) ;
    await db.delete( accounts           ) ;
    await db.delete( organizations      ) ;

    const [ org ] = await db
      .insert( organizations )
      .values( { name: "Org Categorias Test" , slug: "org-cat-test" } )
      .returning() ;

    orgId = org.id ;

    const [ cajaArs ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "1.1.01.01" ,
        name:           "Caja ARS" ,
        type:           "asset" ,
        balance:        50000000 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    cajaArsId = cajaArs.id ;

    vi.mocked( getServerSession ).mockResolvedValue( {
      user:    { id: "user-cat-1" , organizationId: orgId , role: "owner" } ,
      expires: new Date().toISOString() ,
    } as unknown as Session ) ;
  } ) ;

  describe( "R3 — Mudanza de movimientos a la hoja General al crear la primera subcategoría" , () => {
    it( "debería mover los asientos y el saldo del padre a la hoja General al crear la primera subcategoría" , async () => {
      // 1. Crear categoría padre "Alimentación"
      const resParent = await createCategoryAction( {
        name: "Alimentación" ,
        type: "expense" ,
      } ) ;

      expect( resParent.success ).toBe( true ) ;
      if( !resParent.success ) { return ; }
      const parentCat = resParent.value ;

      // Obtener cuenta ARS del padre
      const parentAcc = await categoryRepository.findOrCreateAccountForCurrency( parentCat.id , "ARS" ) ;

      // 2. Registrar movimiento directo sobre el padre
      const txResult = await createLedgerTransaction( {
        organizationId: orgId ,
        categoryId:     parentCat.id ,
        description:    "Gasto directo en Alimentación" ,
        entries: [
          { accountId: parentAcc.id , debit: 10000 , credit: 0 , currency: "ARS" } ,
          { accountId: cajaArsId    , debit: 0 , credit: 10000 , currency: "ARS" } ,
        ] ,
      } ) ;

      expect( txResult.success ).toBe( true ) ;

      // Verificar que el asiento está en la cuenta del padre
      const [ asientoPrevio ] = await db
        .select()
        .from( ledgerEntries )
        .where( eq(ledgerEntries.accountId , parentAcc.id) ) ;
      expect( asientoPrevio ).toBeDefined() ;
      expect( asientoPrevio.debit ).toBe( 10000 ) ;

      // 3. Crear primera subcategoría "Supermercado" bajo "Alimentación"
      const resChild = await createCategoryAction( {
        name:     "Supermercado" ,
        type:     "expense" ,
        parentId: parentCat.id ,
      } ) ;

      expect( resChild.success ).toBe( true ) ;

      // 4. Verificar que R3 movió el asiento a la hoja General (5.1.01.99-ARS)
      const [ generalLeaf ] = await db
        .select()
        .from( categories )
        .where( eq(categories.accountCode , `${parentCat.accountCode}.99`) ) ;

      expect( generalLeaf ).toBeDefined() ;
      expect( generalLeaf.isSystemLeaf ).toBe( true ) ;

      const [ generalAcc ] = await db
        .select()
        .from( accounts )
        .where( eq(accounts.code , `${generalLeaf.accountCode}-ARS`) ) ;

      expect( generalAcc ).toBeDefined() ;
      expect( generalAcc.balance ).toBe( 10000 ) ;

      // El asiento ya no debe estar en parentAcc.id, sino en generalAcc.id
      const [ asientoMovido ] = await db
        .select()
        .from( ledgerEntries )
        .where( eq(ledgerEntries.accountId , generalAcc.id) ) ;

      expect( asientoMovido ).toBeDefined() ;
      expect( asientoMovido.debit ).toBe( 10000 ) ;

      // La cuenta original del padre quedó en balance 0
      const [ parentAccFinal ] = await db
        .select()
        .from( accounts )
        .where( eq(accounts.id , parentAcc.id) ) ;
      expect( parentAccFinal.balance ).toBe( 0 ) ;
    } ) ;
  } ) ;

  describe( "R4 — No se borra: se archiva (inmutabilidad del libro)" , () => {
    it( "archivar una categoría con movimientos funciona y borrado físico es rechazado por FK restrict" , async () => {
      // 1. Crear categoría y movimiento
      const resCat = await createCategoryAction( {
        name: "Servicios" ,
        type: "expense" ,
      } ) ;

      expect( resCat.success ).toBe( true ) ;
      if( !resCat.success ) { return ; }
      const cat = resCat.value ;

      const acc = await categoryRepository.findOrCreateAccountForCurrency( cat.id , "ARS" ) ;

      await createLedgerTransaction( {
        organizationId: orgId ,
        categoryId:     cat.id ,
        description:    "Luz" ,
        entries: [
          { accountId: acc.id    , debit: 5000 , credit: 0 , currency: "ARS" } ,
          { accountId: cajaArsId , debit: 0 , credit: 5000 , currency: "ARS" } ,
        ] ,
      } ) ;

      // 2. Archivar funciona correctamente
      const resArchive = await archiveCategoryAction( { id: cat.id } ) ;
      expect( resArchive.success ).toBe( true ) ;

      const [ catArchived ] = await db
        .select()
        .from( categories )
        .where( eq(categories.id , cat.id) ) ;
      expect( catArchived.archivedAt ).not.toBeNull() ;

      // 3. Borrado físico directo en la DB es imposible (onDelete: restrict)
      await expect(
        db.delete( categories ).where( eq(categories.id , cat.id) )
      ).rejects.toThrow() ;

      // 4. Desarchivar la regresa al estado activo
      const resUnarchive = await unarchiveCategoryAction( { id: cat.id } ) ;
      expect( resUnarchive.success ).toBe( true ) ;

      const [ catRestored ] = await db
        .select()
        .from( categories )
        .where( eq(categories.id , cat.id) ) ;
      expect( catRestored.archivedAt ).toBeNull() ;
    } ) ;
  } ) ;

  describe( "R5 — Cuenta por divisa sin duplicar la categoría" , () => {
    it( "gastar en USD sobre una categoría que sólo tenía cuenta ARS crea la segunda cuenta y su vínculo" , async () => {
      // 1. Crear categoría
      const resCat = await createCategoryAction( {
        name: "Educación" ,
        type: "expense" ,
      } ) ;

      expect( resCat.success ).toBe( true ) ;
      if( !resCat.success ) { return ; }
      const cat = resCat.value ;

      // Inicialmente tiene cuenta en ARS
      const [ linkArs ] = await db
        .select()
        .from( categoryAccounts )
        .where( eq(categoryAccounts.categoryId , cat.id) ) ;
      expect( linkArs.currency ).toBe( "ARS" ) ;

      // 2. Resolver cuenta en USD
      const usdAcc = await categoryRepository.findOrCreateAccountForCurrency( cat.id , "USD" ) ;
      expect( usdAcc.currency ).toBe( "USD" ) ;
      expect( usdAcc.code ).toBe( `${cat.accountCode}-USD` ) ;

      // 3. Verificar que existen 2 vínculos pero UNA sola categoría
      const links = await db
        .select()
        .from( categoryAccounts )
        .where( eq(categoryAccounts.categoryId , cat.id) ) ;
      expect( links.length ).toBe( 2 ) ;
      expect( links.map( ( l ) => l.currency ).sort() ).toEqual( [ "ARS" , "USD" ] ) ;

      const allCatsWithName = await db
        .select()
        .from( categories )
        .where( eq(categories.name , "Educación") ) ;
      expect( allCatsWithName.length ).toBe( 1 ) ;
    } ) ;
  } ) ;

  describe( "Árbol y actualización" , () => {
    it( "debería devolver el árbol jerárquico correctamente con getCategoryTreeAction" , async () => {
      const p1 = await createCategoryAction( { name: "Vivienda" , type: "expense" } ) ;
      expect( p1.success ).toBe( true ) ;
      if( !p1.success ) { return ; }

      const c1 = await createCategoryAction( { name: "Alquiler" , type: "expense" , parentId: p1.value.id } ) ;
      expect( c1.success ).toBe( true ) ;

      const treeRes = await getCategoryTreeAction() ;
      expect( treeRes.success ).toBe( true ) ;
      if( !treeRes.success ) { return ; }

      const parentNode = treeRes.value.find( ( p ) => p.id === p1.value.id ) ;
      expect( parentNode ).toBeDefined() ;
      expect( parentNode!.children.some( ( c ) => c.name === "Alquiler" ) ).toBe( true ) ;
    } ) ;

    it( "debería actualizar el nombre de la categoría y renombrar sus cuentas" , async () => {
      const created = await createCategoryAction( { name: "Salidas" , type: "expense" } ) ;
      expect( created.success ).toBe( true ) ;
      if( !created.success ) { return ; }

      const updateRes = await updateCategoryAction( {
        id:   created.value.id ,
        name: "Entretenimiento y Salidas" ,
      } ) ;
      expect( updateRes.success ).toBe( true ) ;

      const [ acc ] = await db
        .select()
        .from( accounts )
        .where( eq(accounts.code , `${created.value.accountCode}-ARS`) ) ;
      expect( acc.name ).toBe( "Entretenimiento y Salidas (ARS)" ) ;
    } ) ;
  } ) ;
} ) ;
