/**
 * @file accountResolver.ts
 * Resolución de la cuenta del plan contable que corresponde a un tipo y una moneda.
 *
 * Vivía en `transactionsActions.ts`, pero toda exportación de un archivo `"use server"` es una acción
 * invocable desde afuera, y ésta recibe `organizationId` por parámetro y crea cuentas: es un servicio.
 */
// Feature: Accounting
import { accountRepository } from "@/features/accounting/repositories/accountRepository" ;
import { Account }           from "@/features/accounting/types" ;


/**
 * Obtiene —o crea— la cuenta del plan contable que corresponde a un tipo y una moneda.
 *
 * Existe una cuenta por divisa a propósito: el saldo de una cuenta es un entero en su propia
 * moneda, así que "Gastos Generales" en pesos y en dólares no pueden ser la misma fila. El código
 * contable lleva la moneda como sufijo porque `(organization_id, code)` es único.
 *
 * @param params - Cuentas ya cargadas, organización, moneda, tipo contable y código/nombre base.
 * @returns La cuenta existente para esa moneda, o la recién creada.
 */
export async function obtenerCuentaPorMoneda( params: {
  allAccounts:    Account[] ;
  organizationId: string ;
  currency:       string ;
  type:           "expense" | "revenue" | "equity" ;
  codigoBase:     string ;
  nombreBase:     string ;
} ): Promise< Account > {
  const { allAccounts , organizationId , currency , type , codigoBase , nombreBase } = params ;

  const targetCode = `${codigoBase}-${currency}` ;
  const existente  = allAccounts.find( ( a ) => (a.code === targetCode) && (a.type === type) ) ;

  if( existente ) { return( existente ) ; }

  return( await accountRepository.create( {
    organizationId ,
    code:    targetCode ,
    name:    `${nombreBase} (${currency})` ,
    type ,
    balance: 0 ,
    currency ,
  } ) ) ;
}
