/**
 * @file cardCycleService.test.ts
 * Pruebas de integración de la partición de saldo de una tarjeta de crédito.
 * Verifica el signo de la deuda (un consumo acredita el pasivo), el reparto entre lo facturado y lo
 * que está en curso, y que una tarjeta sin ciclo no invente uno.
 */
// Librerías externas
import { describe , it , expect , beforeEach , afterEach , afterAll , vi } from "vitest" ;

// Shared
import { db } from "@/shared/db/client" ;

// Feature: Accounting
import { accounts , ledgerTransactions , ledgerEntries , financialEntities } from "@/features/accounting/schema.db" ;
import { accountRepository }                                                from "@/features/accounting/repositories/accountRepository" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Cards
import { calcularCicloDeTarjeta }    from "./cardCycleService" ;
import { cards , cardAccounts }      from "../schema.db" ;
import { CardWithAccountsAndEntity } from "../types" ;


describe( "cardCycleService — Partición del saldo de una tarjeta de crédito" , () => {
  let orgId: string ;

  const cleanDb = async () => {
    await db.delete( cardAccounts ) ;
    await db.delete( cards ) ;
    await db.delete( ledgerEntries ) ;
    await db.delete( ledgerTransactions ) ;
    await db.delete( accounts ) ;
    await db.delete( financialEntities ) ;
    await db.delete( organizations ) ;
  } ;

  beforeEach( async () => {
    await cleanDb() ;

    const [ org ] = await db
      .insert( organizations )
      .values( { name: "Org Ciclo" , slug: "org-ciclo" } )
      .returning() ;
    orgId = org.id ;
  } ) ;

  afterEach( () => {
    // Restaurar acá y no al final del test: si una aserción falla, el reloj mockeado se filtraría.
    vi.useRealTimers() ;
  } ) ;

  afterAll( async () => {
    await cleanDb() ;
  } ) ;

  /** Arma una tarjeta de crédito con su cuenta de pasivo, tal como la devuelve el DAL. */
  const armarTarjeta = async ( closingDay: number | null ) => {
    const cuenta = await accountRepository.create( {
      organizationId: orgId ,
      code:           "2.1.01.01" ,
      name:           "Tarjeta Visa Ciclo" ,
      type:           "liability" ,
      balance:        0 ,
      currency:       "ARS" ,
    } ) ;

    const [ tarjeta ] = await db
      .insert( cards )
      .values( {
        organizationId: orgId ,
        label:          "Visa Ciclo" ,
        type:           "credit" ,
        network:        "visa" ,
        lastFour:       "4321" ,
        expiryMonth:    12 ,
        expiryYear:     2030 ,
        closingDay ,
        dueDay:         ( closingDay ? 5 : null ) ,
      } )
      .returning() ;

    const [ vinculo ] = await db
      .insert( cardAccounts )
      .values( { cardId: tarjeta.id , accountId: cuenta.id , currency: "ARS" } )
      .returning() ;

    const conRelaciones = {
      ...tarjeta ,
      accounts: [ { ...vinculo , account: cuenta } ] ,
    } as CardWithAccountsAndEntity ;

    return( { cuenta , tarjeta: conRelaciones } ) ;
  } ;

  /** Registra un consumo: en un pasivo, gastar **acredita** la cuenta. */
  const registrarConsumo = async ( accountId: string , centavos: number , cuando: string ) => {
    const [ tx ] = await db
      .insert( ledgerTransactions )
      .values( {
        organizationId: orgId ,
        description:    `Consumo ${cuando}` ,
        occurredAt:     new Date( cuando ) ,
      } )
      .returning() ;

    await db.insert( ledgerEntries ).values( {
      transactionId: tx.id ,
      accountId ,
      debit:         0 ,
      credit:        centavos ,
      currency:      "ARS" ,
    } ) ;
  } ;

  it( "reparte los consumos entre facturado y en curso, y los devuelve en positivo" , async () => {
    const { cuenta , tarjeta } = await armarTarjeta( 25 ) ;

    // Con cierre el 25 y "hoy" el 10 de marzo, el último cierre congelado es el del 25 de febrero:
    // el período facturado va del 25 de enero al 25 de febrero, y lo posterior está en curso.
    const hoy = new Date( "2026-03-10T12:00:00.000Z" ) ;
    vi.setSystemTime( hoy ) ;

    await registrarConsumo( cuenta.id , 1000000 , "2026-02-10T14:00:00.000Z" ) ; // facturado
    await registrarConsumo( cuenta.id ,  400000 , "2026-03-05T18:00:00.000Z" ) ; // en curso

    const ciclo = await calcularCicloDeTarjeta( tarjeta , orgId , "America/Argentina/Buenos_Aires" ) ;

    expect( ciclo ).not.toBeNull() ;
    // Positivos: la deuda de un pasivo es credit - debit, no al revés.
    expect( ciclo?.facturado ).toBe( 1000000 ) ;
    expect( ciclo?.enCurso ).toBe( 400000 ) ;
  } ) ;

  it( "no calcula ciclo para una tarjeta de crédito sin día de cierre" , async () => {
    const { tarjeta } = await armarTarjeta( null ) ;

    const ciclo = await calcularCicloDeTarjeta( tarjeta , orgId , "America/Argentina/Buenos_Aires" ) ;

    expect( ciclo ).toBeNull() ;
  } ) ;

  it( "no calcula ciclo para una tarjeta de débito" , async () => {
    const { tarjeta } = await armarTarjeta( 25 ) ;

    const debito = { ...tarjeta , type: "debit" } as CardWithAccountsAndEntity ;
    const ciclo  = await calcularCicloDeTarjeta( debito , orgId , "America/Argentina/Buenos_Aires" ) ;

    expect( ciclo ).toBeNull() ;
  } ) ;
} ) ;
