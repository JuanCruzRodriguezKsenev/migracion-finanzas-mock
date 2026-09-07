/**
 * @file contactsRepository.test.ts
 * Pruebas de integración del Repositorio de Contactos y Métodos de Cobro.
 * Verifica aislamiento multi-tenant transitivo, baja lógica y setDefault transaccional.
 */
// Librerías externas
import { describe , it , expect , beforeEach } from "vitest" ;

// Shared
import { db } from "@/shared/db/client" ;

// Feature: Accounting & Auth
import { financialEntities } from "@/features/accounting/schema.db" ;
import { organizations }     from "@/features/auth/schema.db" ;

// Feature: Contacts
import { contactsRepository }               from "./contactsRepository" ;
import { contacts , contactPaymentMethods } from "../schema.db" ;


describe( "contactsRepository — DAL de Contactos y Métodos de Cobro" , () => {
  let org1Id: string ;
  let org2Id: string ;
  let entityId: string ;

  beforeEach( async() => {
    // 1. Limpiar tablas
    await db.delete( contactPaymentMethods ) ;
    await db.delete( contacts ) ;
    await db.delete( financialEntities ) ;
    await db.delete( organizations ) ;

    // 2. Crear organizaciones para pruebas multi-tenant
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

    // 3. Crear entidad financiera para métodos de cobro
    const [ entity ] = await db
      .insert( financialEntities )
      .values( {
        organizationId: org1Id ,
        name:           "Mercado Pago" ,
        logo:           "mercadopago" ,
        color:          "#009EE3" ,
      } )
      .returning() ;
    entityId = entity.id ;
  } ) ;

  describe( "Gestión de Contactos (CRUD y Búsqueda)" , () => {
    it( "crea un contacto y lo recupera por ID y por listado" , async() => {
      const creado = await contactsRepository.create( {
        organizationId: org1Id ,
        name:           "Esteban Quito" ,
        email:          "esteban@ejemplo.com" ,
        phone:          "+5491112345678" ,
        notes:          "Contacto de soporte" ,
      } ) ;

      expect( creado.id ).toBeDefined() ;
      expect( creado.name ).toBe( "Esteban Quito" ) ;

      const encontrado = await contactsRepository.findById( creado.id , org1Id ) ;
      expect( encontrado ).not.toBeNull() ;
      expect( encontrado?.name ).toBe( "Esteban Quito" ) ;
      expect( encontrado?.paymentMethods ).toEqual( [] ) ;

      const todos = await contactsRepository.findAll( org1Id ) ;
      expect( todos ).toHaveLength( 1 ) ;
      expect( todos[0].name ).toBe( "Esteban Quito" ) ;
    } ) ;

    it( "actualiza los datos de un contacto correctamente" , async() => {
      const creado = await contactsRepository.create( {
        organizationId: org1Id ,
        name:           "Juan Pérez" ,
        email:          "juan@viejo.com" ,
      } ) ;

      const actualizado = await contactsRepository.update( creado.id , org1Id , {
        name:  "Juan Carlos Pérez" ,
        email: "juan@nuevo.com" ,
      } ) ;

      expect( actualizado?.name ).toBe( "Juan Carlos Pérez" ) ;
      expect( actualizado?.email ).toBe( "juan@nuevo.com" ) ;
    } ) ;

    it( "filtra por búsqueda de texto (nombre, email, teléfono)" , async() => {
      await contactsRepository.create( {
        organizationId: org1Id ,
        name:           "Alicia Gómez" ,
        email:          "alicia@empresa.com" ,
        phone:          "1144556677" ,
      } ) ;
      await contactsRepository.create( {
        organizationId: org1Id ,
        name:           "Bernardo Silva" ,
        email:          "bsilva@futbol.com" ,
        phone:          "1199887766" ,
      } ) ;

      const resNombre = await contactsRepository.findAll( org1Id , { search: "Alicia" } ) ;
      expect( resNombre ).toHaveLength( 1 ) ;
      expect( resNombre[0].name ).toBe( "Alicia Gómez" ) ;

      const resEmail = await contactsRepository.findAll( org1Id , { search: "futbol.com" } ) ;
      expect( resEmail ).toHaveLength( 1 ) ;
      expect( resEmail[0].name ).toBe( "Bernardo Silva" ) ;

      const resTelefono = await contactsRepository.findAll( org1Id , { search: "4455" } ) ;
      expect( resTelefono ).toHaveLength( 1 ) ;
      expect( resTelefono[0].name ).toBe( "Alicia Gómez" ) ;
    } ) ;

    it( "excluye contactos archivados de findAll por defecto e incluye si se solicita" , async() => {
      const c1 = await contactsRepository.create( {
        organizationId: org1Id ,
        name:           "Activo" ,
      } ) ;
      const c2 = await contactsRepository.create( {
        organizationId: org1Id ,
        name:           "Archivado" ,
      } ) ;

      await contactsRepository.archive( c2.id , org1Id ) ;

      const activos = await contactsRepository.findAll( org1Id ) ;
      expect( activos ).toHaveLength( 1 ) ;
      expect( activos[0].id ).toBe( c1.id ) ;

      const todos = await contactsRepository.findAll( org1Id , { includeArchived: true } ) ;
      expect( todos ).toHaveLength( 2 ) ;
    } ) ;

    it( "permite restaurar un contacto archivado mediante unarchive" , async() => {
      const c = await contactsRepository.create( {
        organizationId: org1Id ,
        name:           "Para restaurar" ,
      } ) ;
      await contactsRepository.archive( c.id , org1Id ) ;
      expect( await contactsRepository.findAll( org1Id ) ).toHaveLength( 0 ) ;

      await contactsRepository.unarchive( c.id , org1Id ) ;
      const activos = await contactsRepository.findAll( org1Id ) ;
      expect( activos ).toHaveLength( 1 ) ;
      expect( activos[0].id ).toBe( c.id ) ;
    } ) ;
  } ) ;

  describe( "Aislamiento Multi-Tenant Transitivo en Métodos de Cobro" , () => {
    it( "rechaza agregar un método de cobro con un contactId que pertenece a otra organización" , async() => {
      // Creamos un contacto en Org 2
      const contactoOrg2 = await contactsRepository.create( {
        organizationId: org2Id ,
        name:           "Contacto Víctima" ,
      } ) ;

      // Intentamos agregarle un método desde la sesión de Org 1
      const resultado = await contactsRepository.addPaymentMethod(
        contactoOrg2.id ,
        org1Id , // Sesión de Org 1
        {
          financialEntityId: entityId ,
          type:              "wallet" ,
          alias:             "alias.intruso.mp" ,
          isDefault:         true ,
        }
      ) ;

      expect( resultado ).toBeNull() ;

      // Verificamos que no se insertó nada
      const metodos = await contactsRepository.findPaymentMethodsByContactId( contactoOrg2.id , org2Id ) ;
      expect( metodos ).toHaveLength( 0 ) ;
    } ) ;

    it( "rechaza consultar métodos de cobro de un contacto que no pertenece a la organización autenticada" , async() => {
      const contactoOrg2 = await contactsRepository.create( {
        organizationId: org2Id ,
        name:           "Contacto de Org 2" ,
      } ) ;

      await contactsRepository.addPaymentMethod(
        contactoOrg2.id ,
        org2Id ,
        {
          financialEntityId: entityId ,
          type:              "wallet" ,
          alias:             "contacto.org2.mp" ,
        }
      ) ;

      // Org 1 consulta los métodos de un contacto ajeno
      const metodosVistosPorOrg1 = await contactsRepository.findPaymentMethodsByContactId( contactoOrg2.id , org1Id ) ;
      expect( metodosVistosPorOrg1 ).toHaveLength( 0 ) ;
    } ) ;

    it( "rechaza eliminar un método de cobro si la organización no es la dueña del contacto" , async() => {
      const contactoOrg2 = await contactsRepository.create( {
        organizationId: org2Id ,
        name:           "Contacto Org 2" ,
      } ) ;

      const metodoOrg2 = await contactsRepository.addPaymentMethod(
        contactoOrg2.id ,
        org2Id ,
        {
          financialEntityId: entityId ,
          type:              "wallet" ,
          alias:             "pago.org2" ,
        }
      ) ;

      expect( metodoOrg2 ).not.toBeNull() ;

      // Org 1 intenta eliminar el método de Org 2
      const eliminado = await contactsRepository.deletePaymentMethod( metodoOrg2!.id , org1Id ) ;
      expect( eliminado ).toBe( false ) ;

      // Verificamos que el método sigue existiendo
      const metodos = await contactsRepository.findPaymentMethodsByContactId( contactoOrg2.id , org2Id ) ;
      expect( metodos ).toHaveLength( 1 ) ;
    } ) ;

    it( "rechaza setDefault en un método de cobro ajeno" , async() => {
      const contactoOrg2 = await contactsRepository.create( {
        organizationId: org2Id ,
        name:           "Contacto Org 2" ,
      } ) ;

      const metodoOrg2 = await contactsRepository.addPaymentMethod(
        contactoOrg2.id ,
        org2Id ,
        {
          financialEntityId: entityId ,
          type:              "bank_account" ,
          alias:             "cuenta.org2" ,
        }
      ) ;

      const updated = await contactsRepository.setDefaultPaymentMethod( metodoOrg2!.id , org1Id ) ;
      expect( updated ).toBeNull() ;
    } ) ;

    it( "setDefaultPaymentMethod desmarca los otros métodos y garantiza un único default transaccional" , async() => {
      const contacto = await contactsRepository.create( {
        organizationId: org1Id ,
        name:           "Mi Proveedor" ,
      } ) ;

      // Primer método queda default automáticamente
      const m1 = await contactsRepository.addPaymentMethod(
        contacto.id ,
        org1Id ,
        {
          financialEntityId: entityId ,
          type:              "wallet" ,
          alias:             "prov.mp" ,
          isDefault:         false , // Debe ser forzado a true por ser el primero
        }
      ) ;
      expect( m1?.isDefault ).toBe( true ) ;

      // Segundo método creado sin default
      const m2 = await contactsRepository.addPaymentMethod(
        contacto.id ,
        org1Id ,
        {
          financialEntityId: entityId ,
          type:              "bank_account" ,
          cbuCvu:            "0110002040000000000015" ,
          isDefault:         false ,
        }
      ) ;
      expect( m2?.isDefault ).toBe( false ) ;

      // Tercer método creado explícitamente como default
      const m3 = await contactsRepository.addPaymentMethod(
        contacto.id ,
        org1Id ,
        {
          financialEntityId: entityId ,
          type:              "wallet" ,
          alias:             "prov.tercero" ,
          isDefault:         true ,
        }
      ) ;
      expect( m3?.isDefault ).toBe( true ) ;

      // Verificamos que m1 perdió el default y m3 lo tiene
      let metodos = await contactsRepository.findPaymentMethodsByContactId( contacto.id , org1Id ) ;
      expect( metodos.find( ( m ) => m.id === m1?.id )?.isDefault ).toBe( false ) ;
      expect( metodos.find( ( m ) => m.id === m2?.id )?.isDefault ).toBe( false ) ;
      expect( metodos.find( ( m ) => m.id === m3?.id )?.isDefault ).toBe( true ) ;

      // Ahora marcamos m2 como default
      await contactsRepository.setDefaultPaymentMethod( m2!.id , org1Id ) ;

      metodos = await contactsRepository.findPaymentMethodsByContactId( contacto.id , org1Id ) ;
      const defaults = metodos.filter( ( m ) => m.isDefault ) ;
      expect( defaults ).toHaveLength( 1 ) ;
      expect( defaults[0].id ).toBe( m2?.id ) ;
    } ) ;
  } ) ;
} ) ;
