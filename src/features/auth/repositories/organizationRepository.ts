/**
 * @file organizationRepository.ts
 * Repositorio de la entidad Organización: renombrado y borrado completo (Capa DAL).
 */
// Librerías externas
import { eq , and , inArray , isNotNull } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;
import {
  outboxEvents ,
  monthlySummaries ,
  ledgerEntries ,
  ledgerTransactions ,
  cardInstallmentPlans ,
  cardAccounts ,
  cards ,
  loanAccounts ,
  loans ,
  contactPaymentMethods ,
  contacts ,
  subscriptions ,
  categoryAccounts ,
  accounts ,
  financialEntities ,
  categories ,
  invitations ,
  holderAuthorizations ,
  memberships ,
  budgets ,
  budgetLimits ,
  goals ,
  goalMovements ,
  notifications ,
  organizationAgreements ,
  agreementPercentages ,
  monthlyContributions ,
  expenseSplits ,
  memberPayments ,
  paymentRequests ,
  commonPotContributions
} from "@/shared/db/schema" ;

// Feature: Auth
import { organizations } from "../schema.db" ;


/**
 * Tablas que tienen la columna `organization_id` y que `eliminarCompleta` borra explícitamente (NFR-6).
 * Una tabla nueva con `organization_id` debe sumarse acá **y** al borrado: un test compara esta lista
 * con `information_schema` y falla si falta alguna. Las tablas sin la columna que cuelgan de éstas
 * (`ledger_entries`, `card_accounts`, `loan_accounts`, `category_accounts`, `contact_payment_methods`, `budget_limits`)
 * se borran por subconsulta dentro del mismo borrado.
 */
export const TABLAS_CON_ORGANIZACION = [
  "accounts" ,
  "agreement_percentages" ,
  "budgets" ,
  "card_installment_plans" ,
  "cards" ,
  "categories" ,
  "common_pot_contributions" ,
  "contacts" ,
  "expense_splits" ,
  "financial_entities" ,
  "goal_movements" ,
  "goals" ,
  "holder_authorizations" ,
  "invitations" ,
  "ledger_transactions" ,
  "loans" ,
  "member_payments" ,
  "memberships" ,
  "monthly_contributions" ,
  "monthly_summaries" ,
  "notifications" ,
  "organization_agreements" ,
  "outbox_events" ,
  "payment_requests" ,
  "subscriptions" ,
] as const ;

/**
 * Repositorio de Organizaciones.
 */
export const organizationRepository = {
  /**
   * Cambia el nombre de una organización. El `slug` no se toca (RN-33).
   *
   * @param organizationId - Identificador de la organización.
   * @param nombre - Nombre nuevo, ya validado.
   * @param tx - Instancia de transacción opcional.
   * @returns `true` si la organización existía.
   */
  async renombrar( organizationId: string , nombre: string , tx: DBOrTx = db ): Promise< boolean > {
    const filas = await tx
      .update( organizations )
      .set( { name: nombre } )
      .where( eq( organizations.id , organizationId ) )
      .returning( { id: organizations.id } ) ;

    return( filas.length > 0 ) ;
  } ,

  /**
   * Lee el nombre actual de una organización.
   *
   * @param organizationId - Identificador de la organización.
   * @param tx - Instancia de transacción opcional.
   * @returns El nombre, o `null` si no existe.
   */
  async findNombre( organizationId: string , tx: DBOrTx = db ): Promise< string | null > {
    const [ fila ] = await tx
      .select( { name: organizations.name } )
      .from( organizations )
      .where( eq( organizations.id , organizationId ) )
      .limit( 1 ) ;

    return( fila?.name ?? null ) ;
  } ,

  /**
   * Borra una organización con todos sus datos (RN-34), tabla por tabla y en el orden de `limpiarBase()`.
   *
   * No confía en el `ON DELETE CASCADE`: entre las tablas hijas hay claves `RESTRICT` y el orden en que
   * Postgres dispara los triggers de cascada no es contractual. El cascade queda como red de seguridad.
   * Debe correr dentro de **una** transacción recibida por parámetro.
   *
   * @param organizationId - Identificador de la organización a eliminar.
   * @param tx - Transacción activa.
   */
  async eliminarCompleta( organizationId: string , tx: DBOrTx ): Promise< void > {
    const transaccionesDeLaOrg = tx.select( { id: ledgerTransactions.id } ).from( ledgerTransactions ).where( eq( ledgerTransactions.organizationId , organizationId ) ) ;
    const tarjetasDeLaOrg      = tx.select( { id: cards.id               } ).from( cards               ).where( eq( cards.organizationId               , organizationId ) ) ;
    const prestamosDeLaOrg     = tx.select( { id: loans.id               } ).from( loans               ).where( eq( loans.organizationId               , organizationId ) ) ;
    const contactosDeLaOrg     = tx.select( { id: contacts.id            } ).from( contacts            ).where( eq( contacts.organizationId            , organizationId ) ) ;
    const categoriasDeLaOrg    = tx.select( { id: categories.id          } ).from( categories          ).where( eq( categories.organizationId          , organizationId ) ) ;
    const presupuestosDeLaOrg  = tx.select( { id: budgets.id             } ).from( budgets             ).where( eq( budgets.organizationId             , organizationId ) ) ;

    // 1. Sin dependientes
    await tx.delete( outboxEvents      ).where( eq( outboxEvents.organizationId      , organizationId ) ) ;
    await tx.delete( monthlySummaries  ).where( eq( monthlySummaries.organizationId  , organizationId ) ) ;

    // 1b. Avisos (cuelgan de transacciones, usuarios y organización: antes que ledger_transactions)
    await tx.delete( notifications ).where( eq( notifications.organizationId , organizationId ) ) ;

    // 1c. Reparto: las deudas cuelgan de transacciones (antes que ledger_transactions); el acuerdo, los porcentajes
    //     y los aportes cuelgan de usuarios y organización (antes que memberships)
    await tx.delete( expenseSplits         ).where( eq( expenseSplits.organizationId         , organizationId ) ) ;
    await tx.delete( agreementPercentages  ).where( eq( agreementPercentages.organizationId  , organizationId ) ) ;
    await tx.delete( monthlyContributions  ).where( eq( monthlyContributions.organizationId  , organizationId ) ) ;
    await tx.delete( memberPayments        ).where( eq( memberPayments.organizationId        , organizationId ) ) ;
    await tx.delete( paymentRequests       ).where( eq( paymentRequests.organizationId       , organizationId ) ) ;
    await tx.delete( commonPotContributions ).where( eq( commonPotContributions.organizationId , organizationId ) ) ;
    await tx.delete( organizationAgreements ).where( eq( organizationAgreements.organizationId , organizationId ) ) ;

    // 2-3. Asientos antes que transacciones (restrict a accounts)
    await tx.delete( ledgerEntries      ).where( inArray( ledgerEntries.transactionId , transaccionesDeLaOrg ) ) ;
    await tx.delete( ledgerTransactions ).where( eq( ledgerTransactions.organizationId , organizationId ) ) ;

    // 4. Planes de cuotas
    await tx.delete( cardInstallmentPlans ).where( eq( cardInstallmentPlans.organizationId , organizationId ) ) ;

    // 5. Tarjetas
    await tx.delete( cardAccounts ).where( inArray( cardAccounts.cardId , tarjetasDeLaOrg ) ) ;
    await tx.delete( cards        ).where( eq( cards.organizationId , organizationId ) ) ;

    // 6. Préstamos
    await tx.delete( loanAccounts ).where( inArray( loanAccounts.loanId , prestamosDeLaOrg ) ) ;
    await tx.delete( loans        ).where( eq( loans.organizationId , organizationId ) ) ;

    // 7. Contactos
    await tx.delete( contactPaymentMethods ).where( inArray( contactPaymentMethods.contactId , contactosDeLaOrg ) ) ;
    await tx.delete( contacts              ).where( eq( contacts.organizationId , organizationId ) ) ;

    // 8. Suscripciones (antes que accounts y categories)
    await tx.delete( subscriptions ).where( eq( subscriptions.organizationId , organizationId ) ) ;

    // 8b. Metas y presupuestos (antes que accounts y categories: FK restrict a cuentas, metas y categorías)
    await tx.delete( goalMovements ).where( eq( goalMovements.organizationId , organizationId ) ) ;
    await tx.delete( goals         ).where( eq( goals.organizationId         , organizationId ) ) ;
    await tx.delete( budgetLimits  ).where( inArray( budgetLimits.budgetId , presupuestosDeLaOrg ) ) ;
    await tx.delete( budgets       ).where( eq( budgets.organizationId       , organizationId ) ) ;

    // 9. Vínculos categoría-cuenta (restrict a ambas)
    await tx.delete( categoryAccounts ).where( inArray( categoryAccounts.categoryId , categoriasDeLaOrg ) ) ;

    // 10. Cuentas y entidades
    await tx.delete( accounts          ).where( eq( accounts.organizationId          , organizationId ) ) ;
    await tx.delete( financialEntities ).where( eq( financialEntities.organizationId , organizationId ) ) ;

    // 11. Categorías: primero las hijas (autorreferencia restrict; jerarquía de dos niveles)
    await tx.delete( categories ).where( and( eq( categories.organizationId , organizationId ) , isNotNull( categories.parentId ) ) ) ;
    await tx.delete( categories ).where( eq( categories.organizationId , organizationId ) ) ;

    // 12. Habilitaciones, membresías e invitaciones (habilitaciones antes que membresías)
    await tx.delete( holderAuthorizations ).where( eq( holderAuthorizations.organizationId , organizationId ) ) ;
    await tx.delete( memberships ).where( eq( memberships.organizationId , organizationId ) ) ;
    await tx.delete( invitations ).where( eq( invitations.organizationId , organizationId ) ) ;

    // 13. La organización (`users.last_organization_id` queda en NULL por su ON DELETE SET NULL)
    await tx.delete( organizations ).where( eq( organizations.id , organizationId ) ) ;
  } ,
} ;
