/**
 * @file testCleanup.ts
 * Utilidad unificada de limpieza de base de datos para la suite de pruebas.
 *
 * El orden de borrado respeta estrictamente el grafo topológico de claves foráneas
 * del esquema, especialmente aquellas con restricción (`restrict`), impidiendo
 * violaciones de integridad referencial durante la ejecución de los tests.
 */
// Librerías externas
import { isNotNull } from "drizzle-orm" ;

// Shared: Base de datos
import { db } from "./client" ;
import {
  loginAttempts ,
  idempotencyKeys ,
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
  profiles ,
  users ,
  organizations
} from "./schema" ;


/**
 * Limpia todas las tablas de la base de datos de test en un único bloque transaccional.
 * Sigue un orden topológico estricto para evitar conflictos con claves foráneas `restrict`.
 *
 * En `categories`, al tener una autorreferencia `restrict` en `parentId`, se eliminan
 * primero los nodos hijos (hojas) y luego los nodos raíz (padres). Esta lógica es válida
 * para la jerarquía actual de dos niveles; si en el futuro se requieren tres o más niveles,
 * deberá incorporarse una resolución iterativa o recursiva.
 *
 * @returns Promesa que se resuelve al completar el vaciado íntegro de la base de datos.
 */
export async function limpiarBase(): Promise< void > {
  await db.transaction( async ( tx ) => {
    // 1. login_attempts (sin FK)
    await tx.delete( loginAttempts ) ;

    // 2. idempotency_keys (sin FK)
    await tx.delete( idempotencyKeys ) ;

    // 3. outbox_events
    await tx.delete( outboxEvents ) ;

    // 4. monthly_summaries
    await tx.delete( monthlySummaries ) ;

    // 5. ledger_entries → restrict a accounts; antes que ledger_transactions
    await tx.delete( ledgerEntries ) ;

    // 6. ledger_transactions
    await tx.delete( ledgerTransactions ) ;

    // 7. card_installment_plans → cascade a cards, set null a categories; antes que cards
    await tx.delete( cardInstallmentPlans ) ;

    // 8. card_accounts → restrict a accounts; antes que cards
    await tx.delete( cardAccounts ) ;

    // 9. cards → restrict a financial_entities y accounts
    await tx.delete( cards ) ;

    // 10. loan_accounts → restrict a accounts; antes que accounts y que loans
    await tx.delete( loanAccounts ) ;

    // 11. loans → restrict a financial_entities y contacts
    await tx.delete( loans ) ;

    // 12. contact_payment_methods → restrict a financial_entities y contacts
    await tx.delete( contactPaymentMethods ) ;

    // 13. contacts
    await tx.delete( contacts ) ;

    // 14. subscriptions → antes que accounts y categories
    await tx.delete( subscriptions ) ;

    // 15. category_accounts → restrict a categories y accounts
    await tx.delete( categoryAccounts ) ;

    // 16. accounts → restrict a financial_entities
    await tx.delete( accounts ) ;

    // 17. financial_entities
    await tx.delete( financialEntities ) ;

    // 18. categories → primero hojas con parentId no nulo, luego padres
    await tx.delete( categories ).where( isNotNull( categories.parentId ) ) ;
    await tx.delete( categories ) ;

    // 19. profiles → antes que users
    await tx.delete( profiles ) ;

    // 20. users
    await tx.delete( users ) ;

    // 21. organizations
    await tx.delete( organizations ) ;
  } ) ;
}
