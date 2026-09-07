/**
 * @file contactsRepository.ts
 * Capa de acceso a datos (DAL) para Contactos y Métodos de Cobro (RFC 006).
 * Todas las operaciones validan aislamiento multi-tenant por organizationId.
 * Para contact_payment_methods, el aislamiento se garantiza mediante JOIN con contacts.
 */
// Librerías externas
import { eq , and , or , ilike , isNull , desc , asc } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Accounting
import { financialEntities } from "@/features/accounting/schema.db" ;

// Feature: Contacts
import {
  Contact ,
  InsertContact ,
  ContactPaymentMethod ,
  InsertContactPaymentMethod ,
  ContactWithPaymentMethods ,
  ContactPaymentMethodWithEntity
} from "../types" ;
import { contacts , contactPaymentMethods } from "../schema.db" ;


export interface FindContactsOptions {
  search?:          string ;
  includeArchived?: boolean ;
}

export const contactsRepository = {
  /**
   * Obtiene todos los contactos de una organización con sus métodos de cobro y entidades asociadas.
   * Sin paginación por cursor: búsqueda textual por nombre, email o teléfono.
   *
   * @param organizationId - ID de la organización dueña.
   * @param options - Opciones de filtrado (búsqueda y archivados).
   * @param tx - Instancia de transacción o cliente de DB.
   * @returns Lista de contactos con sus métodos de cobro.
   */
  async findAll(
    organizationId: string ,
    options:        FindContactsOptions = {} ,
    tx:             DBOrTx = db
  ): Promise< ContactWithPaymentMethods[] > {
    const { search , includeArchived = false } = options ;

    const conditions = [ eq( contacts.organizationId , organizationId ) ] ;

    if( !includeArchived ) {
      conditions.push( isNull( contacts.archivedAt ) ) ;
    }

    if( search && ( search.trim() !== "" ) ) {
      const pattern = `%${search.trim()}%` ;
      conditions.push(
        or(
          ilike( contacts.name  , pattern ) ,
          ilike( contacts.email , pattern ) ,
          ilike( contacts.phone , pattern )
        )!
      ) ;
    }

    const contactRows = await tx
      .select()
      .from( contacts )
      .where( and( ...conditions ) )
      .orderBy( asc( contacts.name ) ) ;

    if( contactRows.length === 0 ) {
      return( [] ) ;
    }

    // Cargar métodos de pago vinculados a los contactos encontrados
    const contactIds = contactRows.map( ( c ) => c.id ) ;

    const methodsWithEntities = await tx
      .select( {
        method: contactPaymentMethods ,
        entity: financialEntities ,
      } )
      .from( contactPaymentMethods )
      .innerJoin( contacts , eq( contactPaymentMethods.contactId , contacts.id ) )
      .innerJoin( financialEntities , eq( contactPaymentMethods.financialEntityId , financialEntities.id ) )
      .where(
        and(
          eq( contacts.organizationId , organizationId ) ,
        )
      )
      .orderBy( desc( contactPaymentMethods.isDefault ) , asc( contactPaymentMethods.createdAt ) ) ;

    const methodsByContactId = new Map< string , ContactPaymentMethodWithEntity[] >() ;
    for( const row of methodsWithEntities ) {
      if( contactIds.includes( row.method.contactId ) ) {
        const list = methodsByContactId.get( row.method.contactId ) || [] ;
        list.push( {
          ...row.method ,
          financialEntity: row.entity ,
        } ) ;
        methodsByContactId.set( row.method.contactId , list ) ;
      }
    }

    return(
      contactRows.map( ( c ) => {
        return( {
          ...c ,
          paymentMethods: methodsByContactId.get( c.id ) || [] ,
        } ) ;
      } )
    ) ;
  } ,

  /**
   * Obtiene un contacto por su ID validando pertenencia a la organización.
   *
   * @param id - ID del contacto.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia de transacción o cliente de DB.
   * @returns El contacto con sus métodos o null.
   */
  async findById(
    id:             string ,
    organizationId: string ,
    tx:             DBOrTx = db
  ): Promise< ContactWithPaymentMethods | null > {
    const contactRows = await tx
      .select()
      .from( contacts )
      .where(
        and(
          eq( contacts.id             , id ) ,
          eq( contacts.organizationId , organizationId )
        )
      )
      .limit( 1 ) ;

    const contact = contactRows[0] ;
    if( !contact ) {
      return( null ) ;
    }

    const methodsWithEntities = await tx
      .select( {
        method: contactPaymentMethods ,
        entity: financialEntities ,
      } )
      .from( contactPaymentMethods )
      .innerJoin( contacts , eq( contactPaymentMethods.contactId , contacts.id ) )
      .innerJoin( financialEntities , eq( contactPaymentMethods.financialEntityId , financialEntities.id ) )
      .where(
        and(
          eq( contactPaymentMethods.contactId , id ) ,
          eq( contacts.organizationId         , organizationId )
        )
      )
      .orderBy( desc( contactPaymentMethods.isDefault ) , asc( contactPaymentMethods.createdAt ) ) ;

    const paymentMethods: ContactPaymentMethodWithEntity[] = methodsWithEntities.map( ( row ) => {
      return( {
        ...row.method ,
        financialEntity: row.entity ,
      } ) ;
    } ) ;

    return( {
      ...contact ,
      paymentMethods ,
    } ) ;
  } ,

  /**
   * Crea un nuevo contacto en la organización.
   *
   * @param data - Datos del contacto a insertar.
   * @param tx - Instancia de transacción o cliente de DB.
   * @returns El contacto creado.
   */
  async create(
    data: Omit< InsertContact , "id" | "createdAt" | "updatedAt" > ,
    tx:   DBOrTx = db
  ): Promise< Contact > {
    const [ created ] = await tx
      .insert( contacts )
      .values( {
        ...data ,
        createdAt: new Date() ,
        updatedAt: new Date() ,
      } )
      .returning() ;

    return( created ) ;
  } ,

  /**
   * Actualiza los datos de un contacto validando organización.
   *
   * @param id - ID del contacto.
   * @param organizationId - ID de la organización dueña.
   * @param data - Campos editables.
   * @param tx - Instancia de transacción o cliente de DB.
   * @returns El contacto actualizado o null si no existe o no pertenece a la organización.
   */
  async update(
    id:             string ,
    organizationId: string ,
    data:           Partial< Pick< InsertContact , "name" | "email" | "phone" | "notes" > > ,
    tx:             DBOrTx = db
  ): Promise< Contact | null > {
    const [ updated ] = await tx
      .update( contacts )
      .set( {
        ...data ,
        updatedAt: new Date() ,
      } )
      .where(
        and(
          eq( contacts.id             , id ) ,
          eq( contacts.organizationId , organizationId )
        )
      )
      .returning() ;

    return( updated || null ) ;
  } ,

  /**
   * Realiza la baja lógica (archivado) de un contacto.
   *
   * @param id - ID del contacto.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia de transacción o cliente de DB.
   * @returns El contacto archivado o null.
   */
  async archive(
    id:             string ,
    organizationId: string ,
    tx:             DBOrTx = db
  ): Promise< Contact | null > {
    const ahora = new Date() ;
    const [ archived ] = await tx
      .update( contacts )
      .set( {
        archivedAt: ahora ,
        updatedAt:  ahora ,
      } )
      .where(
        and(
          eq( contacts.id             , id ) ,
          eq( contacts.organizationId , organizationId )
        )
      )
      .returning() ;

    return( archived || null ) ;
  } ,

  /**
   * Restaura un contacto archivado (desarchivado).
   *
   * @param id - ID del contacto.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia de transacción o cliente de DB.
   * @returns El contacto restaurado o null.
   */
  async unarchive(
    id:             string ,
    organizationId: string ,
    tx:             DBOrTx = db
  ): Promise< Contact | null > {
    const ahora = new Date() ;
    const [ unarchived ] = await tx
      .update( contacts )
      .set( {
        archivedAt: null ,
        updatedAt:  ahora ,
      } )
      .where(
        and(
          eq( contacts.id             , id ) ,
          eq( contacts.organizationId , organizationId )
        )
      )
      .returning() ;

    return( unarchived || null ) ;
  } ,

  /**
   * Obtiene los métodos de pago de un contacto verificando transitivamente la organización.
   * Jamás confía en contactId del cliente sin comprobar que contacts.organizationId coincide.
   *
   * @param contactId - ID del contacto.
   * @param organizationId - ID de la organización autenticada.
   * @param tx - Instancia de transacción o cliente de DB.
   * @returns Métodos de cobro del contacto con su entidad financiera.
   */
  async findPaymentMethodsByContactId(
    contactId:      string ,
    organizationId: string ,
    tx:             DBOrTx = db
  ): Promise< ContactPaymentMethodWithEntity[] > {
    const rows = await tx
      .select( {
        method: contactPaymentMethods ,
        entity: financialEntities ,
      } )
      .from( contactPaymentMethods )
      .innerJoin( contacts , eq( contactPaymentMethods.contactId , contacts.id ) )
      .innerJoin( financialEntities , eq( contactPaymentMethods.financialEntityId , financialEntities.id ) )
      .where(
        and(
          eq( contactPaymentMethods.contactId , contactId ) ,
          eq( contacts.organizationId         , organizationId )
        )
      )
      .orderBy( desc( contactPaymentMethods.isDefault ) , asc( contactPaymentMethods.createdAt ) ) ;

    return(
      rows.map( ( r ) => {
        return( {
          ...r.method ,
          financialEntity: r.entity ,
        } ) ;
      } )
    ) ;
  } ,

  /**
   * Agrega un método de cobro a un contacto con validación estricta de pertenencia multi-tenant.
   * Si es el primer método o se marca como default, desmarca transaccionalmente otros métodos del contacto.
   *
   * @param contactId - ID del contacto.
   * @param organizationId - ID de la organización autenticada.
   * @param data - Datos del método de pago.
   * @param tx - Instancia de transacción o cliente de DB.
   * @returns El método creado con su entidad financiera o null si el contacto es ajeno.
   */
  async addPaymentMethod(
    contactId:      string ,
    organizationId: string ,
    data:           Omit< InsertContactPaymentMethod , "id" | "contactId" | "createdAt" > ,
    tx:             DBOrTx = db
  ): Promise< ContactPaymentMethodWithEntity | null > {
    return(
      await tx.transaction( async( tr ) => {
        // 1. Validar que el contacto pertenezca a la organización
        const [ contact ] = await tr
          .select( { id: contacts.id } )
          .from( contacts )
          .where(
            and(
              eq( contacts.id             , contactId ) ,
              eq( contacts.organizationId , organizationId )
            )
          )
          .limit( 1 ) ;

        if( !contact ) {
          return( null ) ;
        }

        // 2. Verificar cuántos métodos existen para determinar si este debe ser default
        const existingMethods = await tr
          .select( { id: contactPaymentMethods.id } )
          .from( contactPaymentMethods )
          .where( eq( contactPaymentMethods.contactId , contactId ) ) ;

        const shouldBeDefault = ( data.isDefault || ( existingMethods.length === 0 ) ) ;

        if( shouldBeDefault && ( existingMethods.length > 0 ) ) {
          // Desmarcar transaccionalmente todos los demás
          await tr
            .update( contactPaymentMethods )
            .set( { isDefault: false } )
            .where( eq( contactPaymentMethods.contactId , contactId ) ) ;
        }

        // 3. Insertar el nuevo método
        const [ createdMethod ] = await tr
          .insert( contactPaymentMethods )
          .values( {
            ...data ,
            contactId ,
            isDefault: shouldBeDefault ,
            createdAt: new Date() ,
          } )
          .returning() ;

        // 4. Obtener la entidad financiera
        const [ entity ] = await tr
          .select()
          .from( financialEntities )
          .where( eq( financialEntities.id , createdMethod.financialEntityId ) )
          .limit( 1 ) ;

        return( {
          ...createdMethod ,
          financialEntity: entity ,
        } ) ;
      } )
    ) ;
  } ,

  /**
   * Elimina un método de cobro validando transitivamente la organización a través del contacto.
   *
   * @param paymentMethodId - ID del método de cobro.
   * @param organizationId - ID de la organización autenticada.
   * @param tx - Instancia de transacción o cliente de DB.
   * @returns `true` si fue eliminado; `false` si no existía o pertenecía a otra organización.
   */
  async deletePaymentMethod(
    paymentMethodId: string ,
    organizationId:  string ,
    tx:              DBOrTx = db
  ): Promise< boolean > {
    return(
      await tx.transaction( async( tr ) => {
        const [ validRow ] = await tr
          .select( {
            methodId:  contactPaymentMethods.id ,
            contactId: contactPaymentMethods.contactId ,
            isDefault: contactPaymentMethods.isDefault ,
          } )
          .from( contactPaymentMethods )
          .innerJoin( contacts , eq( contactPaymentMethods.contactId , contacts.id ) )
          .where(
            and(
              eq( contactPaymentMethods.id , paymentMethodId ) ,
              eq( contacts.organizationId  , organizationId )
            )
          )
          .limit( 1 ) ;

        if( !validRow ) {
          return( false ) ;
        }

        await tr
          .delete( contactPaymentMethods )
          .where( eq( contactPaymentMethods.id , paymentMethodId ) ) ;

        // Si eliminamos el método default, asignar default al más antiguo restante
        if( validRow.isDefault ) {
          const [ nextDefault ] = await tr
            .select( { id: contactPaymentMethods.id } )
            .from( contactPaymentMethods )
            .where( eq( contactPaymentMethods.contactId , validRow.contactId ) )
            .orderBy( asc( contactPaymentMethods.createdAt ) )
            .limit( 1 ) ;

          if( nextDefault ) {
            await tr
              .update( contactPaymentMethods )
              .set( { isDefault: true } )
              .where( eq( contactPaymentMethods.id , nextDefault.id ) ) ;
          }
        }

        return( true ) ;
      } )
    ) ;
  } ,

  /**
   * Establece un método de cobro como predeterminado (default) para su contacto de forma transaccional.
   * Desmarca los demás métodos del contacto en la misma transacción y valida transitivamente el aislamiento.
   *
   * @param paymentMethodId - ID del método a marcar como default.
   * @param organizationId - ID de la organización autenticada.
   * @param tx - Instancia de transacción o cliente de DB.
   * @returns El método actualizado o null si no pertenece a la organización.
   */
  async setDefaultPaymentMethod(
    paymentMethodId: string ,
    organizationId:  string ,
    tx:              DBOrTx = db
  ): Promise< ContactPaymentMethod | null > {
    return(
      await tx.transaction( async( tr ) => {
        // Verificar existencia y pertenencia organizacional mediante JOIN
        const [ validRow ] = await tr
          .select( {
            methodId:  contactPaymentMethods.id ,
            contactId: contactPaymentMethods.contactId ,
          } )
          .from( contactPaymentMethods )
          .innerJoin( contacts , eq( contactPaymentMethods.contactId , contacts.id ) )
          .where(
            and(
              eq( contactPaymentMethods.id , paymentMethodId ) ,
              eq( contacts.organizationId  , organizationId )
            )
          )
          .limit( 1 ) ;

        if( !validRow ) {
          return( null ) ;
        }

        // Desmarcar todos los demás métodos del mismo contacto
        await tr
          .update( contactPaymentMethods )
          .set( { isDefault: false } )
          .where( eq( contactPaymentMethods.contactId , validRow.contactId ) ) ;

        // Marcar este método como isDefault = true
        const [ updated ] = await tr
          .update( contactPaymentMethods )
          .set( { isDefault: true } )
          .where( eq( contactPaymentMethods.id , paymentMethodId ) )
          .returning() ;

        return( updated || null ) ;
      } )
    ) ;
  } ,
} ;
