// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                   from "next-auth" ;
import { eq }                                                 from "drizzle-orm" ;

// Shared
import { db }                       from "@/shared/db/client" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { accounts , categories , ledgerEntries , ledgerTransactions } from "@/features/accounting/schema.db" ;

// Feature: Transactions
import { createTransactionFromFormAction } from "./transactionsActions" ;
import { obtenerCuentaPorMoneda }          from "../services/accountResolver" ;

vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;


/**
 * Suite para la traducción de un formulario a asientos de partida doble.
 * Cubre sobre todo el cruce de monedas: es donde una app de finanzas se rompe en silencio, porque
 * el saldo de una cuenta es un entero sin unidad y sumarle otra divisa no falla, sólo miente.
 */
describe( "createTransactionFromFormAction — monedas" , () => {
  let orgId:      string ;
  let cajaArsId:  string ;
  let cajaUsdId:  string ;
  let bancoArsId: string ;

  beforeEach( async () => {
    vi.clearAllMocks() ;

    await limpiarBase() ;

    const [ org ] = await db
      .insert( organizations )
      .values( {name: "Org Monedas" , slug: "org-monedas"} )
      .returning() ;

    orgId = org.id ;

    const [ cajaArs ] = await db
      .insert( accounts )
      .values( {organizationId: orgId , code: "1.1.01" , name: "Caja ARS" , type: "asset" , balance: 50000000 , currency: "ARS"} )
      .returning() ;

    const [ cajaUsd ] = await db
      .insert( accounts )
      .values( {organizationId: orgId , code: "1.1.02" , name: "Caja USD" , type: "asset" , balance: 0 , currency: "USD"} )
      .returning() ;

    const [ bancoArs ] = await db
      .insert( accounts )
      .values( {organizationId: orgId , code: "1.1.03" , name: "Banco ARS" , type: "asset" , balance: 0 , currency: "ARS"} )
      .returning() ;

    cajaArsId  = cajaArs.id ;
    cajaUsdId  = cajaUsd.id ;
    bancoArsId = bancoArs.id ;

    // El autor del asiento (created_by_user_id) tiene FK a users: la sesión simulada usa un usuario real
    const usuario = await crearUsuarioConMembresia( { organizationId: orgId , role: "owner" } ) ;

    vi.mocked( getServerSession ).mockResolvedValue( {
      user:    {id: usuario.id , organizationId: orgId , role: "owner"} ,
      expires: new Date().toISOString() ,
    } ) ;
  } ) ;

  it( "debería ignorar la moneda del formulario y usar la de la cuenta de origen" , async () => {
    // El formulario pide USD sobre una caja en pesos: antes esto contaminaba el saldo en ARS.
    const res = await createTransactionFromFormAction( {
      description:     "Compra con moneda equivocada" ,
      type:            "expense" ,
      amount:          100 ,
      currency:        "USD" ,
      sourceAccountId: cajaArsId ,
    } ) ;

    expect( res.success ).toBe( true ) ;

    const asientos = await db.select().from( ledgerEntries ) ;
    expect( asientos.length ).toBe( 2 ) ;
    expect( asientos.every( ( a ) => a.currency === "ARS" ) ).toBe( true ) ;
  } ) ;

  it( "debería crear un solo movimiento si se repite el envío con la misma clave, y otro si cambia el monto" , async () => {
    const clave = "3f2b8c1e-9d4a-4b6f-8a1c-2e7d5f0a9b31" ;
    const datos = {
      description:     "Envío reintentado" ,
      type:            "expense" as const ,
      amount:          100 ,
      sourceAccountId: cajaArsId ,
      occurredAt:      new Date( "2026-10-10T12:00:00.000Z" ) ,
    } ;

    const r1 = await createTransactionFromFormAction( datos , clave ) ;
    const r2 = await createTransactionFromFormAction( datos , clave ) ;

    expect( r1.success ).toBe( true ) ;
    expect( r2.success ).toBe( true ) ;
    expect( (await db.select().from( ledgerTransactions ).where( eq(ledgerTransactions.organizationId , orgId) )).length ).toBe( 1 ) ;

    // Otro monto con la misma clave: la huella cambió, es otro envío
    const r3 = await createTransactionFromFormAction( {...datos , amount: 250} , clave ) ;

    expect( r3.success ).toBe( true ) ;
    expect( (await db.select().from( ledgerTransactions ).where( eq(ledgerTransactions.organizationId , orgId) )).length ).toBe( 2 ) ;
  } ) ;

  it( "debería crear la contrapartida de gasto en la moneda de la cuenta" , async () => {
    const res = await createTransactionFromFormAction( {
      description:     "Gasto en dólares" ,
      type:            "expense" ,
      amount:          20 ,
      sourceAccountId: cajaUsdId ,
    } ) ;

    expect( res.success ).toBe( true ) ;

    const gastos = await db.select().from( accounts ).where( eq(accounts.type , "expense") ) ;
    expect( gastos.length ).toBe( 1 ) ;
    expect( gastos[0].currency ).toBe( "USD" ) ;
  } ) ;

  it( "debería rechazar una transferencia entre monedas distintas" , async () => {
    const res = await createTransactionFromFormAction( {
      description:          "Transferencia imposible" ,
      type:                 "transfer" ,
      amount:               1000 ,
      sourceAccountId:      cajaArsId ,
      destinationAccountId: cajaUsdId ,
    } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ) {
      expect( res.error ).toContain( "cambio" ) ;
    }
  } ) ;

  it( "debería registrar un cambio de divisas con cuatro asientos en dos monedas" , async () => {
    // Vendo 100.000 ARS y recibo 100 USD
    const res = await createTransactionFromFormAction( {
      description:          "Compra de dólares" ,
      type:                 "exchange" ,
      amount:               100000 ,
      destinationAmount:    100 ,
      sourceAccountId:      cajaArsId ,
      destinationAccountId: cajaUsdId ,
    } ) ;

    expect( res.success ).toBe( true ) ;

    const asientos = await db.select().from( ledgerEntries ) ;
    expect( asientos.length ).toBe( 4 ) ;

    // Cada moneda cierra en cero por separado: es la regla que hace válido el cruce.
    const porMoneda = new Map< string , number >() ;
    for( const a of asientos ) {
      porMoneda.set( a.currency , (porMoneda.get( a.currency ) || 0) + a.debit - a.credit ) ;
    }

    expect( porMoneda.get( "ARS" ) ).toBe( 0 ) ;
    expect( porMoneda.get( "USD" ) ).toBe( 0 ) ;

    const [ caja ]  = await db.select().from( accounts ).where( eq(accounts.id , cajaArsId) ) ;
    const [ dolar ] = await db.select().from( accounts ).where( eq(accounts.id , cajaUsdId) ) ;

    expect( caja.balance ).toBe( 50000000 - 10000000 ) ;
    expect( dolar.balance ).toBe( 10000 ) ;

    // Se crearon las dos cuentas de posición, una por divisa.
    const posiciones = await db.select().from( accounts ).where( eq(accounts.type , "equity") ) ;
    expect( posiciones.map( ( p ) => p.currency ).sort() ).toEqual( [ "ARS" , "USD" ] ) ;
  } ) ;

  it( "debería rechazar un cambio entre dos cuentas de la misma moneda" , async () => {
    const res = await createTransactionFromFormAction( {
      description:          "Cambio que no cambia nada" ,
      type:                 "exchange" ,
      amount:               1000 ,
      destinationAmount:    1000 ,
      sourceAccountId:      cajaArsId ,
      destinationAccountId: bancoArsId ,
    } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ) {
      expect( res.error ).toContain( "transferencia" ) ;
    }
  } ) ;

  describe( "D1 — Defecto contable de posición de cambio (RFC 022 §0, §5)" , () => {
    it( "con Patrimonio Neto Inicial presente, codigoBase: '3.3.01' debe devolver 3.3.01-ARS y no el patrimonio" , async () => {
      // 1. Crear Patrimonio Neto Inicial (3.1.01.01, equity, ARS)
      const [ patrimonio ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "3.1.01.01" ,
          name:           "Patrimonio Neto Inicial" ,
          type:           "equity" ,
          balance:        100000000 ,
          currency:       "ARS" ,
        } )
        .returning() ;

      const allAccounts = await db
        .select()
        .from( accounts )
        .where( eq(accounts.organizationId , orgId) ) ;

      // 2. Pedir cuenta de posición de cambio
      const ctaPosicion = await obtenerCuentaPorMoneda( {
        allAccounts ,
        organizationId: orgId ,
        currency:       "ARS" ,
        type:           "equity" ,
        codigoBase:     "3.3.01" ,
        nombreBase:     "Posición de cambio" ,
      } ) ;

      expect( ctaPosicion.id ).not.toBe( patrimonio.id ) ;
      expect( ctaPosicion.code ).toBe( "3.3.01-ARS" ) ;
    } ) ;
  } ) ;

  describe( "Imputación real por categoría (RFC 022 §5)" , () => {
    it( "debería imputar el débito a la cuenta de la categoría elegida (Supermercado)" , async () => {
      const [ catSuper ] = await db
        .insert( categories )
        .values( {
          organizationId: orgId ,
          name:           "Supermercado" ,
          type:           "expense" ,
          accountCode:    "5.1.03.01" ,
        } )
        .returning() ;

      const res = await createTransactionFromFormAction( {
        description:     "Compra de lácteos" ,
        type:            "expense" ,
        amount:          150 ,
        sourceAccountId: cajaArsId ,
        categoryId:      catSuper.id ,
      } ) ;

      expect( res.success ).toBe( true ) ;

      const [ cuentaSuper ] = await db
        .select()
        .from( accounts )
        .where( eq(accounts.code , "5.1.03.01-ARS") ) ;

      expect( cuentaSuper ).toBeDefined() ;

      const asientos = await db
        .select()
        .from( ledgerEntries )
        .where( eq(ledgerEntries.accountId , cuentaSuper.id) ) ;

      expect( asientos.length ).toBe( 1 ) ;
      expect( asientos[0].debit ).toBe( 15000 ) ;
    } ) ;

    it( "sin categoría especificada, debería imputar a la hoja General de Gastos" , async () => {
      const res = await createTransactionFromFormAction( {
        description:     "Gasto sin detallar" ,
        type:            "expense" ,
        amount:          50 ,
        sourceAccountId: cajaArsId ,
      } ) ;

      expect( res.success ).toBe( true ) ;

      const [ cuentaGeneral ] = await db
        .select()
        .from( accounts )
        .where( eq(accounts.code , "5.1.01.99-ARS") ) ;

      expect( cuentaGeneral ).toBeDefined() ;

      const asientos = await db
        .select()
        .from( ledgerEntries )
        .where( eq(ledgerEntries.accountId , cuentaGeneral.id) ) ;

      expect( asientos.length ).toBe( 1 ) ;
      expect( asientos[0].debit ).toBe( 5000 ) ;
    } ) ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;
} ) ;
