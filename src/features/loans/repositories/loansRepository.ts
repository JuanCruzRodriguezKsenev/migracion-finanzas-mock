/**
 * @file loansRepository.ts
 * Capa de acceso a datos (DAL) para Préstamos (RFC 008).
 * Todas las operaciones imponen aislamiento multi-tenant por organizationId.
 */
// Librerías externas
import { eq , and , isNull , desc , inArray } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Accounting
import { accounts , financialEntities } from "@/features/accounting/schema.db" ;

// Feature: Contacts
import { contacts } from "@/features/contacts/schema.db" ;

// Feature: Loans
import { loans , loanAccounts } from "../schema.db" ;
import type {
  Loan ,
  InsertLoan ,
  LoanAccount ,
  InsertLoanAccount ,
  LoanWithAccounts ,
  LoanAccountWithAccount
} from "../types" ;


export const loansRepository = {
  /**
   * Retorna todos los préstamos activos (no archivados) de una organización.
   *
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia transaccional o cliente de BD.
   * @returns Lista de préstamos activos ordenados por fecha de creación descendente.
   */
  async findAll( organizationId: string , tx: DBOrTx = db ): Promise< Loan[] > {
    return( await tx
      .select()
      .from( loans )
      .where(
        and(
          eq( loans.organizationId , organizationId ) ,
          isNull( loans.archivedAt )
        )
      )
      .orderBy( desc( loans.createdAt ) )
    ) ;
  } ,

  /**
   * Retorna todos los préstamos activos con sus relaciones (entidad, contacto y cuentas espejo).
   *
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia transaccional o cliente de BD.
   * @returns Lista de préstamos con entidades y cuentas asociadas.
   */
  async findAllWithRelations( organizationId: string , tx: DBOrTx = db ): Promise< LoanWithAccounts[] > {
    const loanRows = await tx
      .select( {
        loan:    loans ,
        entity:  financialEntities ,
        contact: contacts
      } )
      .from( loans )
      .leftJoin( financialEntities , eq( loans.entityId  , financialEntities.id ) )
      .leftJoin( contacts          , eq( loans.contactId , contacts.id          ) )
      .where(
        and(
          eq( loans.organizationId , organizationId ) ,
          isNull( loans.archivedAt )
        )
      )
      .orderBy( desc( loans.createdAt ) ) ;

    if( loanRows.length === 0 ) {
      return( [] ) ;
    }

    const loanIds = loanRows.map( ( r ) => r.loan.id ) ;

    const accountRows = await tx
      .select( {
        loanAccount: loanAccounts ,
        account:     accounts
      } )
      .from( loanAccounts )
      .innerJoin( accounts , eq( loanAccounts.accountId , accounts.id ) )
      .where(
        and(
          inArray( loanAccounts.loanId , loanIds ) ,
          eq( accounts.organizationId  , organizationId )
        )
      ) ;

    return( loanRows.map( ( r ) => {
      const relatedAccounts = accountRows
        .filter( ( ar ) => ar.loanAccount.loanId === r.loan.id )
        .map( ( ar ) => ( {
          ...ar.loanAccount ,
          account: ar.account
        } ) ) ;

      return( {
        ...r.loan ,
        entity:   ( r.entity?.id ? r.entity : null ) ,
        contact:  ( r.contact?.id ? r.contact : null ) ,
        accounts: relatedAccounts
      } ) ;
    } ) ) ;
  } ,

  /**
   * Obtiene un préstamo por su ID, validando pertenencia a la organización.
   *
   * @param id - ID del préstamo.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia transaccional o cliente de BD.
   * @returns El préstamo encontrado o null.
   */
  async findById( id: string , organizationId: string , tx: DBOrTx = db ): Promise< Loan | null > {
    const [ found ] = await tx
      .select()
      .from( loans )
      .where(
        and(
          eq( loans.id             , id             ) ,
          eq( loans.organizationId , organizationId )
        )
      )
      .limit( 1 ) ;

    return( found || null ) ;
  } ,

  /**
   * Obtiene un préstamo bloqueando la fila para actualización exclusiva (SELECT FOR UPDATE)
   * dentro de una transacción ACID, evitando condiciones de carrera concurrentes.
   *
   * @param id - ID del préstamo.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Conexión de transacción activa requerida para el bloqueo pesimista.
   * @returns El préstamo bloqueado o null.
   */
  async findByIdForUpdate( id: string , organizationId: string , tx: DBOrTx = db ): Promise< Loan | null > {
    const [ found ] = await tx
      .select()
      .from( loans )
      .where(
        and(
          eq( loans.id             , id             ) ,
          eq( loans.organizationId , organizationId )
        )
      )
      .for( "update" ) ;

    return( found || null ) ;
  } ,

  /**
   * Registra un nuevo préstamo en la base de datos.
   *
   * @param data - Datos del préstamo a insertar.
   * @param tx - Instancia transaccional o cliente de BD.
   * @returns El registro de préstamo persistido.
   */
  async create( data: InsertLoan , tx: DBOrTx = db ): Promise< Loan > {
    const [ inserted ] = await tx
      .insert( loans )
      .values( data )
      .returning() ;

    return( inserted ) ;
  } ,

  /**
   * Actualiza los datos de un préstamo existente perteneciente a la organización.
   *
   * @param id - ID del préstamo.
   * @param organizationId - ID de la organización dueña.
   * @param data - Campos a actualizar.
   * @param tx - Instancia transaccional o cliente de BD.
   * @returns El préstamo actualizado o null si no se encontró.
   */
  async update(
    id:             string ,
    organizationId: string ,
    data:           Partial< InsertLoan > ,
    tx:             DBOrTx = db
  ): Promise< Loan | null > {
    const [ updated ] = await tx
      .update( loans )
      .set( {
        ...data ,
        updatedAt: new Date()
      } )
      .where(
        and(
          eq( loans.id             , id             ) ,
          eq( loans.organizationId , organizationId )
        )
      )
      .returning() ;

    return( updated || null ) ;
  } ,

  /**
   * Marca un préstamo como archivado (baja lógica).
   *
   * @param id - ID del préstamo.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia transaccional o cliente de BD.
   * @returns El préstamo actualizado o null.
   */
  async archive( id: string , organizationId: string , tx: DBOrTx = db ): Promise< Loan | null > {
    const now = new Date() ;
    const [ updated ] = await tx
      .update( loans )
      .set( {
        archivedAt: now ,
        updatedAt:  now
      } )
      .where(
        and(
          eq( loans.id             , id             ) ,
          eq( loans.organizationId , organizationId )
        )
      )
      .returning() ;

    return( updated || null ) ;
  } ,

  /**
   * Vincula una cuenta del libro mayor a un préstamo.
   *
   * @param data - Vínculo préstamo-cuenta por divisa.
   * @param tx - Instancia transaccional o cliente de BD.
   * @returns El vínculo persistido.
   */
  async addLoanAccount( data: InsertLoanAccount , tx: DBOrTx = db ): Promise< LoanAccount > {
    const [ inserted ] = await tx
      .insert( loanAccounts )
      .values( data )
      .returning() ;

    return( inserted ) ;
  } ,

  /**
   * Obtiene todas las cuentas asociadas a un préstamo, validando aislamiento multi-tenant.
   *
   * @param loanId - ID del préstamo.
   * @param organizationId - ID de la organización dueña.
   * @param tx - Instancia transaccional o cliente de BD.
   * @returns Lista de vínculos con la cuenta de mayor asociada.
   */
  async findAccountsByLoanId(
    loanId:         string ,
    organizationId: string ,
    tx:             DBOrTx = db
  ): Promise< LoanAccountWithAccount[] > {
    const rows = await tx
      .select( {
        loanAccount: loanAccounts ,
        account:     accounts
      } )
      .from( loanAccounts )
      .innerJoin( accounts , eq( loanAccounts.accountId , accounts.id ) )
      .where(
        and(
          eq( loanAccounts.loanId     , loanId         ) ,
          eq( accounts.organizationId , organizationId )
        )
      ) ;

    return( rows.map( ( r ) => {
      return( {
        ...r.loanAccount ,
        account: r.account
      } ) ;
    } ) ) ;
  }
} ;
