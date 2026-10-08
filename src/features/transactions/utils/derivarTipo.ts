/**
 * @file derivarTipo.ts
 * Utilidad pura para derivar el tipo de transacción comercial (income, expense, transfer)
 * a partir de las cuentas contables involucradas en sus asientos de partida doble.
 */
// Feature: Accounting
import { CuentaReferenciada , LedgerEntry } from "@/features/accounting/types" ;


export type TransactionType = "income" | "expense" | "transfer" | "exchange" ;

export interface TransactionSummaryDerived {
  type:                  TransactionType ;
  amountInCents:         number ;
  primaryAccountId?:     string ;
  counterpartAccountId?: string ;
  currency?:             string ;
  /** Sólo en `exchange`: importe recibido y su moneda, para poder mostrar "de X a Y". */
  destinationAmountInCents?: number ;
  destinationCurrency?:      string ;
}

/**
 * Deriva el tipo comercial de una transacción a partir del plan de cuentas de sus entradas contables.
 * 
 * @param entries - Asientos contables de la transacción.
 * @param accounts - Cuentas de la organización y personales referenciadas por los asientos.
 * @returns 'income' | 'expense' | 'transfer'.
 */
export function derivarTipoTransaccion(
  entries:  { accountId: string ; debit: number ; credit: number ; currency?: string }[] ,
  accounts: CuentaReferenciada[] | Map< string , CuentaReferenciada >
): TransactionType {
  const accountsMap = ( accounts instanceof Map )
    ? accounts
    : new Map( accounts.map( ( a ) => [ a.id , a ] ) ) ;

  // Un cambio de divisas se reconoce por el dato, no por una etiqueta guardada: es la única
  // transacción cuyos asientos viven en más de una moneda. La moneda se lee de la cuenta cuando el
  // asiento no la trae, que es la misma regla que aplica el motor al registrarla.
  const monedas = new Set< string >() ;

  for( const entry of entries ) {
    const acc = accountsMap.get( entry.accountId ) ;
    const moneda = ( entry.currency || acc?.currency ) ;
    if( moneda ) { monedas.add( moneda ) ; }
  }

  if( monedas.size > 1 ) { return( "exchange" ) ; }

  let hasRevenue = false ;
  let hasExpense = false ;

  for( const entry of entries ) {
    const acc = accountsMap.get( entry.accountId ) ;
    if( !acc ) { continue ; }
    if( acc.type === "revenue" ) {
      hasRevenue = true ;
    } else if( acc.type === "expense" ) {
      hasExpense = true ;
    }
  }

  if( hasRevenue ) { return( "income" ) ; }
  if( hasExpense ) { return( "expense" ) ; }
  return( "transfer" ) ;
}

/**
 * Calcula el resumen representativo para visualización (tipo comercial, importe principal y cuentas).
 * 
 * @param entries - Asientos de la transacción.
 * @param accounts - Cuentas de la organización y personales referenciadas por los asientos.
 * @returns Resumen con tipo, importe en centavos, cuenta principal y divisa.
 */
export function calcularResumenTransaccion(
  entries:  LedgerEntry[] | { accountId: string ; debit: number ; credit: number ; currency?: string }[] ,
  accounts: CuentaReferenciada[] | Map< string , CuentaReferenciada >
): TransactionSummaryDerived {
  const accountsMap = ( accounts instanceof Map )
    ? accounts
    : new Map( accounts.map( ( a ) => [ a.id , a ] ) ) ;

  const type = derivarTipoTransaccion( entries , accountsMap ) ;

  if( type === "exchange" ) {
    // Las cuentas de posición de cambio son de patrimonio; filtrar por 'asset' deja sólo los dos
    // lados que le interesan al usuario: de qué cuenta salió el dinero y en cuál entró.
    const salida = entries.find( ( e ) => {
      const acc = accountsMap.get( e.accountId ) ;
      return( (acc?.type === "asset") && (e.credit > 0) ) ;
    } ) ;

    const entrada = entries.find( ( e ) => {
      const acc = accountsMap.get( e.accountId ) ;
      return( (acc?.type === "asset") && (e.debit > 0) ) ;
    } ) ;

    const cuentaSalida  = salida  ? accountsMap.get( salida.accountId )  : undefined ;
    const cuentaEntrada = entrada ? accountsMap.get( entrada.accountId ) : undefined ;

    return( {
      type ,
      amountInCents:            ( salida?.credit || 0 ) ,
      primaryAccountId:         salida?.accountId ,
      counterpartAccountId:     entrada?.accountId ,
      currency:                 ( salida?.currency || cuentaSalida?.currency ) ,
      destinationAmountInCents: ( entrada?.debit || 0 ) ,
      destinationCurrency:      ( entrada?.currency || cuentaEntrada?.currency ) ,
    } ) ;
  }

  if( type === "income" ) {
    const revenueEntries = entries.filter( ( e ) => {
      const acc = accountsMap.get( e.accountId ) ;
      return( acc?.type === "revenue" ) ;
    } ) ;

    const amountInCents = ( revenueEntries.length > 0 )
      ? revenueEntries.reduce( ( sum , e ) => ( sum + e.credit ) , 0 )
      : entries.reduce( ( max , e ) => Math.max( max , e.debit ) , 0 ) ;

    const assetEntry = entries.find( ( e ) => {
      const acc = accountsMap.get( e.accountId ) ;
      return( (acc?.type === "asset") && (e.debit > 0) ) ;
    } ) ;

    const primaryAccountId = assetEntry?.accountId || revenueEntries[0]?.accountId ;
    const primaryAcc = primaryAccountId ? accountsMap.get( primaryAccountId ) : null ;
    const entryCurrency = entries.find( ( e ) => e.currency )?.currency ;
    const currency = primaryAcc?.currency || entryCurrency || "ARS" ;

    return( {
      type ,
      amountInCents ,
      primaryAccountId ,
      currency ,
    } ) ;
  }

  if( type === "expense" ) {
    const expenseEntries = entries.filter( ( e ) => {
      const acc = accountsMap.get( e.accountId ) ;
      return( acc?.type === "expense" ) ;
    } ) ;

    const amountInCents = ( expenseEntries.length > 0 )
      ? expenseEntries.reduce( ( sum , e ) => ( sum + e.debit ) , 0 )
      : entries.reduce( ( max , e ) => Math.max( max , e.credit ) , 0 ) ;

    const assetEntry = entries.find( ( e ) => {
      const acc = accountsMap.get( e.accountId ) ;
      return( ( (acc?.type === "asset") || (acc?.type === "liability") ) && (e.credit > 0) ) ;
    } ) ;

    const primaryAccountId = assetEntry?.accountId || expenseEntries[0]?.accountId ;
    const primaryAcc = primaryAccountId ? accountsMap.get( primaryAccountId ) : null ;
    const entryCurrency = entries.find( ( e ) => e.currency )?.currency ;
    const currency = primaryAcc?.currency || entryCurrency || "ARS" ;

    return( {
      type ,
      amountInCents ,
      primaryAccountId ,
      currency ,
    } ) ;
  }

  const debitAsset = entries.find( ( e ) => {
    const acc = accountsMap.get( e.accountId ) ;
    return( (acc?.type === "asset") && (e.debit > 0) ) ;
  } ) ;

  const creditAsset = entries.find( ( e ) => {
    const acc = accountsMap.get( e.accountId ) ;
    return( (acc?.type === "asset") && (e.credit > 0) ) ;
  } ) ;

  const amountInCents = debitAsset
    ? debitAsset.debit
    : entries.reduce( ( max , e ) => Math.max( max , e.debit ) , 0 ) ;

  const primaryAccountId = creditAsset?.accountId ;
  const primaryAcc = primaryAccountId ? accountsMap.get( primaryAccountId ) : null ;
  const entryCurrency = entries.find( ( e ) => e.currency )?.currency ;
  const currency = primaryAcc?.currency || entryCurrency || "ARS" ;

  return( {
    type:                 "transfer" ,
    amountInCents ,
    primaryAccountId ,
    counterpartAccountId: debitAsset?.accountId ,
    currency ,
  } ) ;
}
