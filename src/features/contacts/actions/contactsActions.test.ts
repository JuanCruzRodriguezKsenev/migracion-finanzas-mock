/**
 * @file contactsActions.test.ts
 * Pruebas unitarias y de integración para las Server Actions de Contactos y Métodos de Cobro.
 */
// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach , afterAll } from "vitest" ;
import { getServerSession }                         from "next-auth" ;
import type { Session }                             from "next-auth" ;

// Shared
import { db } from "@/shared/db/client" ;

// Feature: Accounting & Auth
import { financialEntities } from "@/features/accounting/schema.db" ;
import { organizations }     from "@/features/auth/schema.db" ;

// Feature: Contacts
import {
  getContactsAction ,
  getContactByIdAction ,
  createContactAction ,
  updateContactAction ,
  archiveContactAction ,
  unarchiveContactAction ,
  addPaymentMethodAction ,
  deletePaymentMethodAction ,
  setDefaultPaymentMethodAction
} from "./contactsActions" ;
import { contacts , contactPaymentMethods } from "../schema.db" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

vi.mock( "next/cache" , () => ( {
  revalidatePath: vi.fn() ,
} ) ) ;

describe( "contactsActions.ts — Server Actions" , () => {
  let orgId:    string ;
  let otherOrg: string ;
  let entityId: string ;

  const cleanDb = async() => {
    await db.delete( contactPaymentMethods ) ;
    await db.delete( contacts ) ;
    await db.delete( financialEntities ) ;
    await db.delete( organizations ) ;
  } ;

  beforeEach( async() => {
    vi.clearAllMocks() ;

    await cleanDb() ;

    const [ org1 ] = await db
      .insert( organizations )
      .values( { name: "Org Principal" , slug: "org-principal" } )
      .returning() ;
    orgId = org1.id ;

    const [ org2 ] = await db
      .insert( organizations )
      .values( { name: "Org Otra" , slug: "org-otra" } )
      .returning() ;
    otherOrg = org2.id ;

    const [ entity ] = await db
      .insert( financialEntities )
      .values( {
        organizationId: orgId ,
        name:           "Banco Galicia" ,
        logo:           "galicia" ,
        color:          "#FF4500" ,
      } )
      .returning() ;
    entityId = entity.id ;

    // Mock de sesión por defecto para orgId
    vi.mocked( getServerSession ).mockResolvedValue( {
      user: { id: "user-1" , organizationId: orgId , name: "Test User" } ,
      expires: "9999-12-31" ,
    } as unknown as Session ) ;
  } ) ;

  afterEach( async() => {
    await cleanDb() ;
  } ) ;

  afterAll( async() => {
    await cleanDb() ;
  } ) ;

  it( "falla si el usuario no tiene sesión activa" , async() => {
    vi.mocked( getServerSession ).mockResolvedValue( null ) ;

    const res = await createContactAction( { name: "Sin Sesión" } ) ;
    expect( res.success ).toBe( false ) ;
    if( !res.success ) {
      expect( res.error ).toContain( "No autorizado" ) ;
    }
  } ) ;

  it( "crea un contacto y lo devuelve mediante getContactsAction" , async() => {
    const createRes = await createContactAction( {
      name:  "Mariana López" ,
      email: "mariana@test.com" ,
      phone: "+5411223344" ,
      notes: "Cliente VIP" ,
    } ) ;

    expect( createRes.success ).toBe( true ) ;
    if( createRes.success ) {
      expect( createRes.value.name ).toBe( "Mariana López" ) ;
      expect( createRes.value.organizationId ).toBe( orgId ) ;
    }

    const listRes = await getContactsAction() ;
    expect( listRes.success ).toBe( true ) ;
    if( listRes.success ) {
      expect( listRes.value ).toHaveLength( 1 ) ;
      expect( listRes.value[0].name ).toBe( "Mariana López" ) ;
    }
  } ) ;

  it( "actualiza y archiva un contacto mediante acciones" , async() => {
    const createRes = await createContactAction( { name: "Carlos Menem" } ) ;
    expect( createRes.success ).toBe( true ) ;
    if( !createRes.success ) { return ; }
    const contactId = createRes.value.id ;

    const updateRes = await updateContactAction( contactId , { name: "Carlos Saúl Menem" } ) ;
    expect( updateRes.success ).toBe( true ) ;
    if( updateRes.success ) {
      expect( updateRes.value.name ).toBe( "Carlos Saúl Menem" ) ;
    }

    const archiveRes = await archiveContactAction( contactId ) ;
    expect( archiveRes.success ).toBe( true ) ;

    // Comprobar que en listado activo ya no aparece
    const listRes = await getContactsAction() ;
    expect( listRes.success ).toBe( true ) ;
    if( listRes.success ) {
      expect( listRes.value ).toHaveLength( 0 ) ;
    }

    // Restaurar
    const unarchiveRes = await unarchiveContactAction( contactId ) ;
    expect( unarchiveRes.success ).toBe( true ) ;
    const listAgain = await getContactsAction() ;
    expect( listAgain.success ).toBe( true ) ;
    if( listAgain.success ) {
      expect( listAgain.value ).toHaveLength( 1 ) ;
    }
  } ) ;

  it( "agrega y administra métodos de cobro para un contacto" , async() => {
    const createRes = await createContactAction( { name: "Destinatario" } ) ;
    expect( createRes.success ).toBe( true ) ;
    if( !createRes.success ) { return ; }
    const contactId = createRes.value.id ;

    // 1. Agregar método CBU
    const addMethodRes = await addPaymentMethodAction( contactId , {
      financialEntityId: entityId ,
      type:              "bank_account" ,
      cbuCvu:            "0110002040000000000015" ,
      holderName:        "Destinatario SA" ,
      holderTaxId:       "33-69345023-9" ,
      isDefault:         true ,
    } ) ;

    expect( addMethodRes.success ).toBe( true ) ;
    if( addMethodRes.success ) {
      expect( addMethodRes.value.cbuCvu ).toBe( "0110002040000000000015" ) ;
      expect( addMethodRes.value.financialEntity.name ).toBe( "Banco Galicia" ) ;
      expect( addMethodRes.value.isDefault ).toBe( true ) ;
    }

    // 2. Agregar segundo método con Alias
    const addAliasRes = await addPaymentMethodAction( contactId , {
      financialEntityId: entityId ,
      type:              "wallet" ,
      alias:             "destinatario.mp" ,
      isDefault:         true ,
    } ) ;
    expect( addAliasRes.success ).toBe( true ) ;

    // 3. Consultar contacto completo
    const contactRes = await getContactByIdAction( contactId ) ;
    expect( contactRes.success ).toBe( true ) ;
    if( contactRes.success ) {
      expect( contactRes.value.paymentMethods ).toHaveLength( 2 ) ;
      // El alias debe ser el default ahora
      const aliasMethod = contactRes.value.paymentMethods.find( ( m ) => m.alias === "destinatario.mp" ) ;
      expect( aliasMethod?.isDefault ).toBe( true ) ;
    }

    // 4. Cambiar default de vuelta al primero
    if( !addMethodRes.success ) { return ; }
    const m1Id = addMethodRes.value.id ;
    const setDefaultRes = await setDefaultPaymentMethodAction( m1Id ) ;
    expect( setDefaultRes.success ).toBe( true ) ;

    // 5. Eliminar el segundo método
    if( !addAliasRes.success ) { return ; }
    const m2Id = addAliasRes.value.id ;
    const deleteRes = await deletePaymentMethodAction( m2Id ) ;
    expect( deleteRes.success ).toBe( true ) ;

    const finalContact = await getContactByIdAction( contactId ) ;
    expect( finalContact.success ).toBe( true ) ;
    if( finalContact.success ) {
      expect( finalContact.value.paymentMethods ).toHaveLength( 1 ) ;
      expect( finalContact.value.paymentMethods[0].id ).toBe( m1Id ) ;
    }
  } ) ;

  it( "rechaza mutaciones si el contacto o método pertenece a otra organización" , async() => {
    // Creamos contacto en otra organización
    const [ contactoAjeno ] = await db
      .insert( contacts )
      .values( {
        organizationId: otherOrg ,
        name:           "Contacto de otra empresa" ,
      } )
      .returning() ;

    // Intentamos actualizarlo desde sesión de orgId
    const updateRes = await updateContactAction( contactoAjeno.id , { name: "Hack" } ) ;
    expect( updateRes.success ).toBe( false ) ;

    // Intentamos archivar
    const archiveRes = await archiveContactAction( contactoAjeno.id ) ;
    expect( archiveRes.success ).toBe( false ) ;

    // Intentamos agregar método de pago
    const addMethodRes = await addPaymentMethodAction( contactoAjeno.id , {
      financialEntityId: entityId ,
      type:              "wallet" ,
      alias:             "hack.mp" ,
      isDefault:         true ,
    } ) ;
    expect( addMethodRes.success ).toBe( false ) ;
  } ) ;
} ) ;
