/**
 * @file testFixtures.ts
 * Utilidades y creadores de entidades base para la suite de pruebas automatizadas.
 */
// Librerías externas
import { sql } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "./client" ;

// Feature: Auth
import { users , memberships , invitations , holderAuthorizations } from "@/features/auth/schema.db" ;
import type { User }                                                from "@/features/auth/repositories/userRepository" ;

// Feature: Accounting
import { categories , financialEntities , accounts , categoryAccounts , ledgerTransactions , ledgerEntries , outboxEvents , monthlySummaries } from "@/features/accounting/schema.db" ;

// Feature: Cards
import { cards , cardAccounts , cardInstallmentPlans } from "@/features/cards/schema.db" ;

// Feature: Loans
import { loans , loanAccounts } from "@/features/loans/schema.db" ;

// Feature: Contacts
import { contacts , contactPaymentMethods } from "@/features/contacts/schema.db" ;

// Feature: Subscriptions
import { subscriptions } from "@/features/subscriptions/schema.db" ;

// Feature: Budgets
import { budgets , budgetLimits } from "@/features/budgets/schema.db" ;

// Feature: Goals
import { goals , goalMovements } from "@/features/goals/schema.db" ;

// Feature: Notifications
import { notifications } from "@/features/notifications/schema.db" ;


export interface OpcionesCrearUsuarioConMembresia {
  organizationId:      string ;
  email?:              string ;
  name?:               string ;
  role?:               string ;
  passwordHash?:       string ;
  salt?:               string ;
  hashParams?:         string ;
  lastOrganizationId?: string | null ;
}

/**
 * Inserta un usuario junto con su membresía inicial en una organización dada.
 *
 * @param opciones - Parámetros de creación del usuario y su rol en la organización.
 * @param tx - Instancia de transacción opcional.
 * @returns El registro de usuario insertado.
 */
export async function crearUsuarioConMembresia(
  opciones: OpcionesCrearUsuarioConMembresia ,
  tx:       DBOrTx = db
): Promise< User > {
  const [ usuario ] = await tx
    .insert( users )
    .values( {
      email:              opciones.email ?? `usuario-${Date.now()}-${Math.random().toString( 36 ).slice( 2 , 7 )}@ejemplo.com` ,
      name:               opciones.name ?? "Usuario de Prueba" ,
      passwordHash:       opciones.passwordHash ?? "0".repeat( 128 ) ,
      salt:               opciones.salt ?? "0123456789abcdef0123456789abcdef" ,
      hashParams:         opciones.hashParams ,
      lastOrganizationId: ( opciones.lastOrganizationId !== undefined ) ? opciones.lastOrganizationId : opciones.organizationId ,
    } )
    .returning() ;

  await tx
    .insert( memberships )
    .values( {
      userId:         usuario.id ,
      organizationId: opciones.organizationId ,
      role:           opciones.role ?? "member" ,
    } ) ;

  return( usuario ) ;
}

/**
 * Crea para una organización al menos una fila en **cada** tabla que `eliminarCompleta` borra, incluidas
 * las que no tienen `organization_id` (asientos, `card_accounts`, `loan_accounts`, `category_accounts`,
 * `contact_payment_methods`) y una categoría con padre e hijo. Sin esto, un test de borrado no ejercita
 * las claves `RESTRICT` entre tablas hijas.
 *
 * @param organizationId - Organización a poblar (ya existente).
 * @param tx - Instancia de transacción opcional.
 */
export async function crearOrganizacionRica( organizationId: string , tx: DBOrTx = db ): Promise< void > {
  const [ entidad ] = await tx.insert( financialEntities ).values( { organizationId , name: "Banco de prueba" } ).returning() ;

  const [ efectivo , deuda ] = await tx
    .insert( accounts )
    .values( [
      { organizationId , code: "1.1.01" , name: "Efectivo"       , type: "asset"     , entityId: entidad.id } ,
      { organizationId , code: "2.1.01" , name: "Deuda tarjeta"  , type: "liability" } ,
    ] )
    .returning() ;

  const [ prestamoCuenta , tarjetaCuenta ] = await tx
    .insert( accounts )
    .values( [
      { organizationId , code: "2.2.01" , name: "Préstamo" , type: "liability" } ,
      { organizationId , code: "2.3.01" , name: "Tarjeta"  , type: "liability" } ,
    ] )
    .returning() ;

  const [ padre ] = await tx
    .insert( categories )
    .values( { organizationId , name: "Gastos" , type: "expense" , accountCode: "5.1" } )
    .returning() ;

  const [ hija ] = await tx
    .insert( categories )
    .values( { organizationId , name: "Comida" , type: "expense" , accountCode: "5.1.01" , parentId: padre.id } )
    .returning() ;

  await tx.insert( categoryAccounts ).values( { categoryId: hija.id , accountId: efectivo.id , currency: "ARS" } ) ;

  const [ transaccion ] = await tx
    .insert( ledgerTransactions )
    .values( { organizationId , description: "Compra de prueba" , categoryId: hija.id } )
    .returning() ;

  await tx.insert( ledgerEntries ).values( [
    { transactionId: transaccion.id , accountId: efectivo.id , debit: 1000 , credit: 0    } ,
    { transactionId: transaccion.id , accountId: deuda.id    , debit: 0    , credit: 1000 } ,
  ] ) ;

  const [ tarjeta ] = await tx
    .insert( cards )
    .values( {
      organizationId , entityId: entidad.id , label: "Visa de prueba" , type: "credit" , network: "visa" ,
      lastFour: "1234" , expiryMonth: 12 , expiryYear: 2030 ,
    } )
    .returning() ;

  await tx.insert( cardAccounts ).values( { cardId: tarjeta.id , accountId: tarjetaCuenta.id , currency: "ARS" } ) ;

  await tx.insert( cardInstallmentPlans ).values( {
    organizationId , cardId: tarjeta.id , description: "Heladera" , installmentAmount: 500 ,
    totalInstallments: 3 , purchasedAt: new Date() , firstInstallmentDate: "2030-01-01" ,
  } ) ;

  const [ contacto ] = await tx.insert( contacts ).values( { organizationId , name: "Contacto de prueba" } ).returning() ;

  await tx.insert( contactPaymentMethods ).values( { contactId: contacto.id , financialEntityId: entidad.id } ) ;

  const [ prestamo ] = await tx
    .insert( loans )
    .values( {
      organizationId , name: "Préstamo de prueba" , direction: "borrowed" , contactId: contacto.id ,
      principalAmount: 10000 , startDate: new Date() , firstInstallmentDate: "2030-01-01" ,
    } )
    .returning() ;

  await tx.insert( loanAccounts ).values( { loanId: prestamo.id , accountId: prestamoCuenta.id , currency: "ARS" } ) ;

  await tx.insert( subscriptions ).values( {
    organizationId , name: "Suscripción de prueba" , amount: 100 , frequency: "monthly" ,
    startDate: new Date() , nextPaymentDate: new Date() , accountId: efectivo.id , categoryId: hija.id ,
  } ) ;

  const [ presupuesto ] = await tx.insert( budgets ).values( { organizationId , categoryId: hija.id , currency: "ARS" } ).returning() ;

  await tx.insert( budgetLimits ).values( { budgetId: presupuesto.id , effectiveFrom: "2030-01" , amount: 100000 } ) ;

  const [ meta ] = await tx.insert( goals ).values( { organizationId , name: "Meta de prueba" , currency: "ARS" , targetAmount: 100000 } ).returning() ;

  await tx.insert( goalMovements ).values( { organizationId , goalId: meta.id , accountId: efectivo.id , kind: "contribution" , amount: 500 } ) ;

  await tx.insert( outboxEvents ).values( { organizationId , eventType: "TRANSACTION_CREATED" , payload: {} } ) ;
  await tx.insert( monthlySummaries ).values( { organizationId , year: 2030 , month: 0 } ) ;
  await tx.insert( invitations ).values( {
    organizationId , email: "pendiente@ejemplo.com" , role: "member" , expiresAt: new Date( Date.now() + 86400000 ) ,
  } ) ;

  // Habilitación entre dos usuarios sueltos (sin membresía: no altera quiénes pertenecen a la organización)
  const sufijo = `${Date.now()}-${Math.random().toString( 36 ).slice( 2 , 7 )}` ;
  const [ otorgante , habilitado ] = await tx
    .insert( users )
    .values( [
      { email: `otorgante-${sufijo}@ejemplo.com`  , name: "Otorgante de prueba"  , passwordHash: "0".repeat( 128 ) , salt: "0123456789abcdef0123456789abcdef" } ,
      { email: `habilitado-${sufijo}@ejemplo.com` , name: "Habilitado de prueba" , passwordHash: "0".repeat( 128 ) , salt: "0123456789abcdef0123456789abcdef" } ,
    ] )
    .returning() ;

  await tx.insert( holderAuthorizations ).values( { organizationId , grantorUserId: otorgante.id , granteeUserId: habilitado.id } ) ;

  await tx.insert( notifications ).values( {
    organizationId , recipientUserId: otorgante.id , type: "charged_to_holder" , actorUserId: habilitado.id ,
    transactionId: transaccion.id , amountInCents: 1000 , currency: "ARS" ,
  } ) ;
}

/** Consultas de conteo por organización: una por cada tabla que `eliminarCompleta` borra. */
const CONSULTAS: Record< string , ( id: string ) => ReturnType< typeof sql > > = {
  accounts:                ( id ) => sql`select count(*) from accounts where organization_id = ${id}` ,
  budgets:                 ( id ) => sql`select count(*) from budgets where organization_id = ${id}` ,
  card_installment_plans:  ( id ) => sql`select count(*) from card_installment_plans where organization_id = ${id}` ,
  cards:                   ( id ) => sql`select count(*) from cards where organization_id = ${id}` ,
  categories:              ( id ) => sql`select count(*) from categories where organization_id = ${id}` ,
  contacts:                ( id ) => sql`select count(*) from contacts where organization_id = ${id}` ,
  financial_entities:      ( id ) => sql`select count(*) from financial_entities where organization_id = ${id}` ,
  goal_movements:          ( id ) => sql`select count(*) from goal_movements where organization_id = ${id}` ,
  goals:                   ( id ) => sql`select count(*) from goals where organization_id = ${id}` ,
  holder_authorizations:   ( id ) => sql`select count(*) from holder_authorizations where organization_id = ${id}` ,
  invitations:             ( id ) => sql`select count(*) from invitations where organization_id = ${id}` ,
  ledger_transactions:     ( id ) => sql`select count(*) from ledger_transactions where organization_id = ${id}` ,
  loans:                   ( id ) => sql`select count(*) from loans where organization_id = ${id}` ,
  memberships:             ( id ) => sql`select count(*) from memberships where organization_id = ${id}` ,
  monthly_summaries:       ( id ) => sql`select count(*) from monthly_summaries where organization_id = ${id}` ,
  notifications:           ( id ) => sql`select count(*) from notifications where organization_id = ${id}` ,
  outbox_events:           ( id ) => sql`select count(*) from outbox_events where organization_id = ${id}` ,
  subscriptions:           ( id ) => sql`select count(*) from subscriptions where organization_id = ${id}` ,
  budget_limits:           ( id ) => sql`select count(*) from budget_limits where budget_id in (select id from budgets where organization_id = ${id})` ,
  ledger_entries:          ( id ) => sql`select count(*) from ledger_entries where transaction_id in (select id from ledger_transactions where organization_id = ${id})` ,
  card_accounts:           ( id ) => sql`select count(*) from card_accounts where card_id in (select id from cards where organization_id = ${id})` ,
  loan_accounts:           ( id ) => sql`select count(*) from loan_accounts where loan_id in (select id from loans where organization_id = ${id})` ,
  category_accounts:       ( id ) => sql`select count(*) from category_accounts where category_id in (select id from categories where organization_id = ${id})` ,
  contact_payment_methods: ( id ) => sql`select count(*) from contact_payment_methods where contact_id in (select id from contacts where organization_id = ${id})` ,
} ;

/** Cantidad de filas de cada tabla del borrado para una organización. */
export async function conteosDe( organizationId: string ): Promise< Record< string , number > > {
  const resultado: Record< string , number > = {} ;

  for( const [ tabla , consulta ] of Object.entries( CONSULTAS ) ) {
    const filas = await db.execute( consulta( organizationId ) ) as unknown as { count: string }[] ;
    resultado[tabla] = Number( filas[0].count ) ;
  }

  return( resultado ) ;
}
