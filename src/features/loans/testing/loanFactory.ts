/**
 * @file loanFactory.ts
 * Factory centralizado para generar instancias de prueba de Loan (RFC 008).
 */
// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Accounting
import { accountRepository } from "@/features/accounting/repositories/accountRepository" ;

// Feature: Loans
import { loansRepository } from "../repositories/loansRepository" ;
import type { Loan , LoanWithAccounts } from "../types" ;


/**
 * Genera una entidad Loan en memoria para tests con valores canónicos por defecto
 * que pueden ser sobreescritos mediante el parámetro `overrides`.
 *
 * @param overrides - Campos específicos para personalizar el préstamo.
 * @returns Instancia completa de Loan válida para pruebas.
 */
export function makeLoan( overrides?: Partial< Loan > ): Loan {
  const now = new Date( "2026-09-15T12:00:00Z" ) ;

  return( {
    id:                   "loan-test-1" ,
    organizationId:       "org-test-1" ,
    name:                 "Préstamo Personal Test" ,
    direction:            "borrowed" ,
    entityId:             "entity-test-1" ,
    contactId:            null ,
    principalAmount:      1000000 , // $10.000 en centavos
    currency:             "ARS" ,
    interestRateAnnual:   0 ,
    totalInstallments:    12 ,
    frequency:            "monthly" ,
    intervalCount:        1 ,
    startDate:            now ,
    firstInstallmentDate: "2026-10-10" ,
    resolvedThrough:      null ,
    archivedAt:           null ,
    createdAt:            now ,
    updatedAt:            now ,
    ...overrides
  } ) ;
}

/**
 * Crea un préstamo en base de datos con su cuenta espejo asociada y vínculo loanAccounts.
 * El código contable de la cuenta creada es parametrizable para evitar colisiones
 * del índice único accounts_org_code_unique.
 *
 * @param organizationId - ID de la organización.
 * @param overrides - Valores a sobreescribir en el préstamo.
 * @param accountCode - Código de cuenta contable (default "2.1.01.01" para borrowed o "1.1.01.01" para lent).
 * @param tx - Conexión de BD o transacción.
 * @returns El préstamo creado con sus cuentas asociadas.
 */
export async function insertTestLoan(
  organizationId: string ,
  overrides?:     Partial< Loan > ,
  accountCode?:   string ,
  tx:             DBOrTx = db
): Promise< LoanWithAccounts > {
  const direction   = overrides?.direction || "borrowed" ;
  const defaultCode = ( direction === "borrowed" ? "2.1.01.01" : "1.1.01.01" ) ;
  const code        = ( accountCode || defaultCode ) ;
  const accountType = ( direction === "borrowed" ? "liability" : "asset" ) ;
  const currency    = overrides?.currency || "ARS" ;

  const cuenta = await accountRepository.create( {
    organizationId ,
    code ,
    name:     `Cuenta Préstamo ${code}` ,
    type:     accountType ,
    balance:  0 ,
    currency
  } , tx ) ;

  const loan = await loansRepository.create( {
    organizationId ,
    name:                 overrides?.name || "Préstamo DB Test" ,
    direction ,
    entityId:             overrides?.entityId !== undefined ? overrides.entityId : null ,
    contactId:            overrides?.contactId !== undefined ? overrides.contactId : null ,
    principalAmount:      overrides?.principalAmount ?? 1000000 ,
    currency ,
    interestRateAnnual:   overrides?.interestRateAnnual ?? 0 ,
    totalInstallments:    overrides?.totalInstallments ?? 12 ,
    frequency:            overrides?.frequency ?? "monthly" ,
    intervalCount:        overrides?.intervalCount ?? 1 ,
    startDate:            overrides?.startDate ?? new Date( "2026-09-15T12:00:00Z" ) ,
    firstInstallmentDate: overrides?.firstInstallmentDate ?? "2026-10-10" ,
    resolvedThrough:      overrides?.resolvedThrough ?? null ,
    archivedAt:           overrides?.archivedAt ?? null
  } , tx ) ;

  const loanAccount = await loansRepository.addLoanAccount( {
    loanId:    loan.id ,
    accountId: cuenta.id ,
    currency
  } , tx ) ;

  return( {
    ...loan ,
    accounts: [ { ...loanAccount , account: cuenta } ]
  } ) ;
}
