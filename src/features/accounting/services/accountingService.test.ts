// Librerías externas
import { describe , it , expect , beforeEach , afterEach , afterAll } from "vitest" ;
import { eq }                                                       from "drizzle-orm" ;

// Shared
import { executeIdempotent } from "@/shared/services/idempotencyService" ;
import { db }                from "@/shared/db/client" ;
import { limpiarBase }       from "@/shared/db/testCleanup" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { accounts , ledgerTransactions , ledgerEntries , idempotencyKeys , outboxEvents } from "../schema.db" ;
import {
  createLedgerTransaction ,
  deleteLedgerTransaction ,
  updateLedgerTransactionMetadata ,
  reverseLedgerTransaction
} from "./accountingService" ;
import { createTransactionSchema } from "../schemas/accounting.schema" ;


/**
 * Suite de pruebas de integración para el Core Contable de Partida Doble.
 * Valida la consistencia matemática, transaccionalidad ACID, borrado y reversión de saldos,
 * control de idempotencia y validaciones runtime.
 */
describe( "accountingService" , () => {
  let orgId:          string ;
  let ctaBancoId:     string ;
  let ctaIngresosId:  string ;
  let ctaTarjetaId:   string ;

  beforeEach( async () => {
    // 1. Limpiar base de datos antes de cada prueba
    await limpiarBase() ;

    // 2. Crear Organización de prueba
    const [ org ] = await db
      .insert( organizations )
      .values( {
        name: "Test Contabilidad Org" ,
        slug: "test-contabilidad-org" ,
      } )
      .returning() ;

    orgId = org.id ;

    // 3. Crear Cuenta de Activo (Banco Galicia, balance inicial $0)
    const [ ctaBanco ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "1.1.01.01" ,
        name:           "Caja de Ahorros Galicia" ,
        type:           "asset" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    ctaBancoId = ctaBanco.id ;

    // 4. Crear Cuenta de Ingreso (Sueldo, balance inicial $0)
    const [ ctaIngresos ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "4.1.01.01" ,
        name:           "Sueldos" ,
        type:           "revenue" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    ctaIngresosId = ctaIngresos.id ;

    // 5. Crear Cuenta de Pasivo (Tarjeta de Crédito, balance inicial -$5.000 centavos = -$50.00 ARS)
    const [ ctaTarjeta ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgId ,
        code:           "2.1.01.01" ,
        name:           "Tarjeta Visa Galicia" ,
        type:           "liability" ,
        balance:        -5000 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    ctaTarjetaId = ctaTarjeta.id ;
  } ) ;

  afterEach( async () => {
    // Limpieza posterior de los registros de prueba
    await limpiarBase() ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "debería registrar una transacción balanceada y actualizar los saldos correctamente" , async () => {
    const monto = 35000000 ; // $350,000.00 ARS en centavos

    const result = await createLedgerTransaction( {
      organizationId: orgId ,
      description:    "Cobro de sueldo de Junio" ,
      entries: [
        {
          accountId: ctaBancoId ,
          debit:     monto ,
          credit:    0 ,
        } ,
        {
          accountId: ctaIngresosId ,
          debit:     0 ,
          credit:    monto ,
        }
      ] ,
    } ) ;

    expect( result.success ).toBe( true ) ;
    if( !result.success ){
      return ;
    }

    const transaccion = result.value ;

    // Validar cabecera
    expect( transaccion.id ).toBeDefined() ;
    expect( transaccion.description ).toBe( "Cobro de sueldo de Junio" ) ;

    // Validar movimientos en el diario
    const entradas = await db
      .select()
      .from( ledgerEntries )
      .where( eq(ledgerEntries.transactionId , transaccion.id) ) ;

    expect( entradas.length ).toBe( 2 ) ;
    
    const entradaBanco    = entradas.find( (e) => e.accountId === ctaBancoId ) ;
    const entradaIngresos = entradas.find( (e) => e.accountId === ctaIngresosId ) ;

    expect( entradaBanco         ).toBeDefined() ;
    expect( entradaBanco?.debit  ).toBe( monto ) ;
    expect( entradaBanco?.credit ).toBe( 0 ) ;

    expect( entradaIngresos         ).toBeDefined() ;
    expect( entradaIngresos?.debit  ).toBe( 0 ) ;
    expect( entradaIngresos?.credit ).toBe( monto ) ;

    // Validar saldos finales de las cuentas
    const [ bancoActualizado ] = await db
      .select()
      .from( accounts )
      .where( eq(accounts.id , ctaBancoId) ) ;
    expect( bancoActualizado.balance ).toBe( monto ) ;

    const [ ingresosActualizados ] = await db
      .select()
      .from( accounts )
      .where( eq(accounts.id , ctaIngresosId) ) ;
    expect( ingresosActualizados.balance ).toBe( monto ) ;

    // Validar evento en Outbox
    const events = await db
      .select()
      .from( outboxEvents )
      .where( eq(outboxEvents.organizationId , orgId) ) ;
    expect( events.length ).toBe( 1 ) ;
    expect( events[0].eventType ).toBe( "TRANSACTION_CREATED" ) ;
  } ) ;

  it( "debería retornar fail y no alterar DB si la transacción está desbalanceada" , async () => {
    const result = await createLedgerTransaction( {
      organizationId: orgId ,
      description:    "Transacción de prueba errónea" ,
      entries: [
        {
          accountId: ctaBancoId ,
          debit:     500000 ,
          credit:    0 ,
        } ,
        {
          accountId: ctaIngresosId ,
          debit:     0 ,
          credit:    400000 , // Desbalance de 1000 ARS
        }
      ] ,
    } ) ;

    expect( result.success ).toBe( false ) ;
    // El mensaje nombra la moneda: el balance se valida por divisa, no sobre el total mezclado.
    expect( result.error ).toContain( "desbalanceada en ARS" ) ;

    // Verificar que no se insertó nada
    const transacciones = await db.select().from( ledgerTransactions ) ;
    expect( transacciones.length ).toBe( 0 ) ;

    const entradas = await db.select().from( ledgerEntries ) ;
    expect( entradas.length ).toBe( 0 ) ;

    const [ ctaBanco ] = await db.select().from( accounts ).where( eq(accounts.id , ctaBancoId) ) ;
    expect( ctaBanco.balance ).toBe( 0 ) ;
  } ) ;

  it( "debería retornar fail si se intenta registrar una transacción con menos de dos entradas" , async () => {
    const result = await createLedgerTransaction( {
      organizationId: orgId ,
      description:    "Transacción sin contrapartida" ,
      entries: [
        {
          accountId: ctaBancoId ,
          debit:     1000 ,
          credit:    0 ,
        }
      ] ,
    } ) ;

    expect( result.success ).toBe( false ) ;
    expect( result.error ).toBe( "Una transacción de partida doble requiere al menos dos entradas contables." ) ;
  } ) ;

  it( "debería retornar fail si la cuenta no pertenece al inquilino" , async () => {
    // 1. Crear organización intrusa
    const [ orgIntrusa ] = await db
      .insert( organizations )
      .values( {
        name: "Organización Intrusa" ,
        slug: "organizacion-intrusa" ,
      } )
      .returning() ;

    // 2. Crear cuenta de activo para la organización intrusa
    const [ ctaIntrusa ] = await db
      .insert( accounts )
      .values( {
        organizationId: orgIntrusa.id ,
        code:           "1.1.01.99" ,
        name:           "Caja Intrusa" ,
        type:           "asset" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    // 3. Intentar registrar transacción en orgId usando la cuenta de orgIntrusa
    const result = await createLedgerTransaction( {
      organizationId: orgId ,
      description:    "Intento de desvío de fondos" ,
      entries: [
        {
          accountId: ctaIntrusa.id ,
          debit:     5000 ,
          credit:    0 ,
        } ,
        {
          accountId: ctaIngresosId ,
          debit:     0 ,
          credit:    5000 ,
        }
      ] ,
    } ) ;

    expect( result.success ).toBe( false ) ;
    expect( result.error ).toContain( "no existe o no pertenece a la organización solicitante" ) ;

    // Limpieza de org intrusa
    await db.delete( accounts      ).where( eq(accounts.organizationId , orgIntrusa.id) ) ;
    await db.delete( organizations ).where( eq(organizations.id        , orgIntrusa.id) ) ;
  } ) ;

  it( "debería registrar un pago de tarjeta de crédito (pasivo) y reducir la deuda correctamente" , async () => {
    // Establesco saldo de Banco Galicia a 10000
    await db
      .update( accounts )
      .set( { balance: 10000 } )
      .where( eq(accounts.id , ctaBancoId) ) ;

    const pago = 5000 ;

    const result = await createLedgerTransaction( {
      organizationId: orgId ,
      description:    "Pago mensual de Tarjeta de Crédito" ,
      entries: [
        {
          accountId: ctaTarjetaId , // Débito a cuenta de pasivo: aumenta saldo negativo de -5000 a 0 (reduce deuda)
          debit:     pago ,
          credit:    0 ,
        } ,
        {
          accountId: ctaBancoId , // Crédito a cuenta de activo: disminuye saldo de 10000 a 5000
          debit:     0 ,
          credit:    pago ,
        }
      ] ,
    } ) ;

    expect( result.success ).toBe( true ) ;
    if( !result.success ) return ;

    const [ tarjetaActualizada ] = await db.select().from( accounts ).where( eq(accounts.id , ctaTarjetaId) ) ;
    expect( tarjetaActualizada.balance ).toBe( 0 ) ;

    const [ bancoActualizado ] = await db.select().from( accounts ).where( eq(accounts.id , ctaBancoId) ) ;
    expect( bancoActualizado.balance ).toBe( 5000 ) ;
  } ) ;

  it( "debería revertir correctamente los saldos al eliminar una transacción" , async () => {
    // 1. Crear transacción que incrementa balance en ctaBanco y ctaIngresos
    const monto = 10000 ; // $100.00
    const resCrear = await createLedgerTransaction( {
      organizationId: orgId ,
      description:    "Cobro de servicios prestados" ,
      entries: [
        {
          accountId: ctaBancoId ,
          debit:     monto ,
          credit:    0 ,
        } ,
        {
          accountId: ctaIngresosId ,
          debit:     0 ,
          credit:    monto ,
        }
      ] ,
    } ) ;

    expect( resCrear.success ).toBe( true ) ;
    if( !resCrear.success ){
      return ;
    }
    const txId = resCrear.value.id ;

    // Verificar saldos actualizados
    let [ ctaBanco ] = await db.select().from( accounts ).where( eq(accounts.id , ctaBancoId) ) ;
    let [ ctaIngresos ] = await db.select().from( accounts ).where( eq(accounts.id , ctaIngresosId) ) ;
    expect( ctaBanco.balance ).toBe( monto ) ;
    expect( ctaIngresos.balance ).toBe( monto ) ;

    // 2. Eliminar la transacción
    const resEliminar = await deleteLedgerTransaction( txId , orgId ) ;
    expect( resEliminar.success ).toBe( true ) ;

    // Verificar saldos revertidos a 0
    [ ctaBanco ] = await db.select().from( accounts ).where( eq(accounts.id , ctaBancoId) ) ;
    [ ctaIngresos ] = await db.select().from( accounts ).where( eq(accounts.id , ctaIngresosId) ) ;
    expect( ctaBanco.balance ).toBe( 0 ) ;
    expect( ctaIngresos.balance ).toBe( 0 ) ;

    // Verificar que la transacción y asientos fueron eliminados
    const txCount = await db.select().from( ledgerTransactions ).where( eq(ledgerTransactions.id , txId) ) ;
    expect( txCount.length ).toBe( 0 ) ;

    const entriesCount = await db.select().from( ledgerEntries ).where( eq(ledgerEntries.transactionId , txId) ) ;
    expect( entriesCount.length ).toBe( 0 ) ;

    // Verificar evento de eliminación en Outbox
    const events = await db
      .select()
      .from( outboxEvents )
      .where( eq(outboxEvents.eventType , "TRANSACTION_DELETED") ) ;
    expect( events.length ).toBe( 1 ) ;
    expect( events[0].organizationId ).toBe( orgId ) ;
  } ) ;

  it( "debería validar la partida doble con el esquema de Zod en runtime" , () => {
    // 1. Partida doble desbalanceada
    const invalidInput = {
      description: "Pago de servicios" ,
      entries: [
        {
          accountId: ctaBancoId ,
          debit:     5000 ,
          credit:    0 ,
        } ,
        {
          accountId: ctaIngresosId ,
          debit:     0 ,
          credit:    6000 , // Desbalance de 1000
        }
      ] ,
    } ;

    const resInvalid = createTransactionSchema.safeParse( invalidInput ) ;
    expect( resInvalid.success ).toBe( false ) ;
    if( resInvalid.success ){
      return ;
    }
    expect( resInvalid.error.message ).toContain( "Desbalance contable detectado" ) ;

    // 2. Partida doble con menos de dos asientos
    const singleInput = {
      description: "Depósito" ,
      entries: [
        {
          accountId: ctaBancoId ,
          debit:     1000 ,
          credit:    0 ,
        }
      ] ,
    } ;

    const resSingle = createTransactionSchema.safeParse( singleInput ) ;
    expect( resSingle.success ).toBe( false ) ;
    if( resSingle.success ){
      return ;
    }
    expect( resSingle.error.message ).toContain( "Una transacción contable requiere al menos dos líneas" ) ;

    // 3. Partida doble correcta
    const validInput = {
      description: "Depósito balanceado" ,
      entries: [
        {
          accountId: ctaBancoId ,
          debit:     1000 ,
          credit:    0 ,
          currency:  "ARS" ,
        } ,
        {
          accountId: ctaIngresosId ,
          debit:     0 ,
          credit:    1000 ,
          currency:  "ARS" ,
        }
      ] ,
    } ;

    const resValid = createTransactionSchema.safeParse( validInput ) ;
    expect( resValid.success ).toBe( true ) ;
  } ) ;

  it( "debería asegurar el control de idempotencia con executeIdempotent" , async () => {
    const key = "test-idempotency-key-123" ;
    let callsCount = 0 ;

    const runOperation = async () => {
      callsCount++ ;
      const res = await createLedgerTransaction( {
        organizationId: orgId ,
        description:    "Transacción idempotente" ,
        entries: [
          {
            accountId: ctaBancoId ,
            debit:     1000 ,
            credit:    0 ,
          } ,
          {
            accountId: ctaIngresosId ,
            debit:     0 ,
            credit:    1000 ,
          }
        ] ,
      } ) ;
      
      if( !res.success ){
        throw new Error( res.error ) ;
      }
      return( res.value ) ;
    } ;

    // Primera llamada: ejecuta la lógica
    const res1 = await executeIdempotent( key , runOperation ) ;
    expect( res1.success ).toBe( true ) ;
    expect( callsCount ).toBe( 1 ) ;

    // Segunda llamada: recupera la caché
    const res2 = await executeIdempotent( key , runOperation ) ;
    expect( res2.success ).toBe( true ) ;
    expect( callsCount ).toBe( 1 ) ; // No incrementó llamadas
    expect( res2.value?.id ).toBe( res1.value?.id ) ;

    // Verificar que los saldos del banco aumentaron sólo una vez (1000 centavos en vez de 2000)
    const [ ctaBanco ] = await db.select().from( accounts ).where( eq(accounts.id , ctaBancoId) ) ;
    expect( ctaBanco.balance ).toBe( 1000 ) ;

    // Simular conflicto (PROCESSING en curso)
    const keyConflicto = "test-processing-key" ;
    await db.insert( idempotencyKeys ).values( {
      key: keyConflicto ,
      status: "PROCESSING" ,
    } ) ;

    const resConflicto = await executeIdempotent( keyConflicto , runOperation ) ;
    expect( resConflicto.success ).toBe( false ) ;
    expect( resConflicto.error ).toBe( "CONFLICT_PROCESSING" ) ;
  } ) ;

  describe( "occurredAt y retroactividad" , () => {
    it( "debería persistir una fecha de ocurrencia retroactiva correctamente" , () => {
      return( new Promise<void>( async ( resolve ) => {
        const fechaPasada = new Date( "2026-01-15T10:00:00.000Z" ) ;

        const result = await createLedgerTransaction( {
          organizationId: orgId ,
          description:    "Gasto retroactivo" ,
          occurredAt:     fechaPasada ,
          entries: [
            { accountId: ctaBancoId    , debit: 5000 , credit: 0    } ,
            { accountId: ctaIngresosId , debit: 0    , credit: 5000 } ,
          ] ,
        } ) ;

        expect( result.success ).toBe( true ) ;
        expect( new Date(result.value!.occurredAt).toISOString() ).toBe( fechaPasada.toISOString() ) ;
        resolve() ;
      } ) ) ;
    } ) ;
  } ) ;

  describe( "updateLedgerTransactionMetadata" , () => {
    it( "debería actualizar la descripción y comercio sin alterar saldos ni asientos" , async () => {
      const creacion = await createLedgerTransaction( {
        organizationId: orgId ,
        description:    "Gasto original" ,
        entries: [
          { accountId: ctaBancoId    , debit: 3000 , credit: 0    } ,
          { accountId: ctaIngresosId , debit: 0    , credit: 3000 } ,
        ] ,
      } ) ;

      expect( creacion.success ).toBe( true ) ;
      const txId = creacion.value!.id ;

      const updateRes = await updateLedgerTransactionMetadata( {
        transactionId: txId ,
        organizationId: orgId ,
        description:   "Gasto modificado con nuevo comercio" ,
        merchantName:  "Comercio ABC" ,
      } ) ;

      expect( updateRes.success ).toBe( true ) ;
      expect( updateRes.value!.description ).toBe( "Gasto modificado con nuevo comercio" ) ;
      expect( updateRes.value!.merchantName ).toBe( "Comercio ABC" ) ;

      // Verificar que el saldo de la cuenta no se alteró
      const [ ctaBanco ] = await db.select().from( accounts ).where( eq(accounts.id , ctaBancoId) ) ;
      expect( ctaBanco.balance ).toBe( 3000 ) ;

      // Verificar que se emitió el evento outbox
      const [ evento ] = await db
        .select()
        .from( outboxEvents )
        .where( eq(outboxEvents.eventType , "TRANSACTION_METADATA_UPDATED") ) ;
      expect( evento ).toBeDefined() ;
    } ) ;
  } ) ;

  describe( "reverseLedgerTransaction" , () => {
    it( "debería crear el asiento inverso y restaurar saldos a su estado original" , async () => {
      // 1. Crear transacción: Ingreso de $10.000 ($100.00 ARS)
      const creacion = await createLedgerTransaction( {
        organizationId: orgId ,
        description:    "Cobro a reversar" ,
        entries: [
          { accountId: ctaBancoId    , debit: 10000 , credit: 0     } ,
          { accountId: ctaIngresosId , debit: 0     , credit: 10000 } ,
        ] ,
      } ) ;

      expect( creacion.success ).toBe( true ) ;
      const txId = creacion.value!.id ;

      // Banco tiene 10000 centavos
      let [ ctaBanco ] = await db.select().from( accounts ).where( eq(accounts.id , ctaBancoId) ) ;
      expect( ctaBanco.balance ).toBe( 10000 ) ;

      // 2. Ejecutar reversión contable
      const revRes = await reverseLedgerTransaction( txId , orgId , "Cobro por error" ) ;
      expect( revRes.success ).toBe( true ) ;
      expect( revRes.value!.description ).toContain( "Reversión" ) ;

      // 3. Saldo debe haber vuelto a 0
      [ ctaBanco ] = await db.select().from( accounts ).where( eq(accounts.id , ctaBancoId) ) ;
      expect( ctaBanco.balance ).toBe( 0 ) ;

      // 4. Se emitió evento Outbox TRANSACTION_REVERSED
      const [ eventoRev ] = await db
        .select()
        .from( outboxEvents )
        .where( eq(outboxEvents.eventType , "TRANSACTION_REVERSED") ) ;
      expect( eventoRev ).toBeDefined() ;
    } ) ;
  } ) ;
  /**
   * Reglas que sostienen la integridad multimoneda del libro diario.
   * Son las que permiten que existan cuentas en cualquier divisa sin que los saldos se contaminen.
   */
  describe( "integridad multimoneda" , () => {
    let ctaUsdId: string ;

    beforeEach( async () => {
      const [ ctaUsd ] = await db
        .insert( accounts )
        .values( {
          organizationId: orgId ,
          code:           "1.1.02.01" ,
          name:           "Caja Dólares" ,
          type:           "asset" ,
          balance:        0 ,
          currency:       "USD" ,
        } )
        .returning() ;

      ctaUsdId = ctaUsd.id ;
    } ) ;

    it( "debería rechazar un asiento cuya moneda no es la de la cuenta" , async () => {
      const res = await createLedgerTransaction( {
        organizationId: orgId ,
        description:    "Gasto en dólares contra una caja en pesos" ,
        entries: [
          {accountId: ctaBancoId    , debit: 0     , credit: 10000 , currency: "USD"} ,
          {accountId: ctaIngresosId , debit: 10000 , credit: 0     , currency: "USD"} ,
        ] ,
      } ) ;

      expect( res.success ).toBe( false ) ;
      expect( res.error ).toContain( "opera en ARS" ) ;

      // El saldo no se tocó: la validación ocurre antes de aplicar nada.
      const [ ctaBanco ] = await db.select().from( accounts ).where( eq(accounts.id , ctaBancoId) ) ;
      expect( ctaBanco.balance ).toBe( 0 ) ;
    } ) ;

    it( "debería rechazar una transacción que sólo cierra si se suman monedas distintas" , async () => {
      const res = await createLedgerTransaction( {
        organizationId: orgId ,
        description:    "Pesos contra dólares por el mismo entero" ,
        entries: [
          {accountId: ctaBancoId , debit: 0     , credit: 10000} ,
          {accountId: ctaUsdId   , debit: 10000 , credit: 0    } ,
        ] ,
      } ) ;

      expect( res.success ).toBe( false ) ;
      expect( res.error ).toContain( "desbalanceada" ) ;
    } ) ;

    it( "debería aceptar un cambio de divisas: dos monedas, cada una cerrando en cero" , async () => {
      const [ posArs ] = await db
        .insert( accounts )
        .values( {organizationId: orgId , code: "3.3.01-ARS" , name: "Posición de cambio (ARS)" , type: "equity" , balance: 0 , currency: "ARS"} )
        .returning() ;

      const [ posUsd ] = await db
        .insert( accounts )
        .values( {organizationId: orgId , code: "3.3.01-USD" , name: "Posición de cambio (USD)" , type: "equity" , balance: 0 , currency: "USD"} )
        .returning() ;

      // Vendo 100.000,00 ARS y recibo 100,00 USD
      const res = await createLedgerTransaction( {
        organizationId: orgId ,
        description:    "Compra de dólares" ,
        entries: [
          {accountId: ctaBancoId , debit: 0        , credit: 10000000} ,
          {accountId: posArs.id  , debit: 10000000 , credit: 0       } ,
          {accountId: ctaUsdId   , debit: 10000    , credit: 0       } ,
          {accountId: posUsd.id  , debit: 0        , credit: 10000   } ,
        ] ,
      } ) ;

      expect( res.success ).toBe( true ) ;

      const [ banco ] = await db.select().from( accounts ).where( eq(accounts.id , ctaBancoId) ) ;
      const [ dolar ] = await db.select().from( accounts ).where( eq(accounts.id , ctaUsdId) ) ;

      expect( banco.balance ).toBe( -10000000 ) ;
      expect( dolar.balance ).toBe( 10000 ) ;
    } ) ;

    it( "debería tomar la moneda de la cuenta cuando el asiento no la declara" , async () => {
      const res = await createLedgerTransaction( {
        organizationId: orgId ,
        description:    "Sueldo sin moneda explícita" ,
        entries: [
          {accountId: ctaBancoId    , debit: 10000 , credit: 0    } ,
          {accountId: ctaIngresosId , debit: 0     , credit: 10000} ,
        ] ,
      } ) ;

      expect( res.success ).toBe( true ) ;

      const asientos = await db.select().from( ledgerEntries ) ;
      expect( asientos.every( ( a ) => a.currency === "ARS" ) ).toBe( true ) ;
    } ) ;
  } ) ;

  /**
   * Guarda contra la doble reversión: sin ella, reversar dos veces devolvía el importe dos veces
   * a las cuentas, creando dinero de la nada.
   */
  describe( "reversión irrepetible" , () => {
    it( "debería rechazar la segunda reversión y dejar los saldos intactos" , async () => {
      const creada = await createLedgerTransaction( {
        organizationId: orgId ,
        description:    "Cobro a reversar" ,
        entries: [
          {accountId: ctaBancoId    , debit: 10000 , credit: 0    } ,
          {accountId: ctaIngresosId , debit: 0     , credit: 10000} ,
        ] ,
      } ) ;

      expect( creada.success ).toBe( true ) ;

      const primera = await reverseLedgerTransaction( creada.value!.id , orgId ) ;
      expect( primera.success ).toBe( true ) ;

      let [ banco ] = await db.select().from( accounts ).where( eq(accounts.id , ctaBancoId) ) ;
      expect( banco.balance ).toBe( 0 ) ;

      const segunda = await reverseLedgerTransaction( creada.value!.id , orgId ) ;
      expect( segunda.success ).toBe( false ) ;
      expect( segunda.error ).toContain( "ya fue reversada" ) ;

      // Lo importante: el saldo no se movió por el segundo intento.
      [ banco ] = await db.select().from( accounts ).where( eq(accounts.id , ctaBancoId) ) ;
      expect( banco.balance ).toBe( 0 ) ;
    } ) ;

    it( "debería dejar el vínculo consultable en los dos sentidos" , async () => {
      const creada = await createLedgerTransaction( {
        organizationId: orgId ,
        description:    "Cobro con vínculo" ,
        entries: [
          {accountId: ctaBancoId    , debit: 10000 , credit: 0    } ,
          {accountId: ctaIngresosId , debit: 0     , credit: 10000} ,
        ] ,
      } ) ;

      const reversion = await reverseLedgerTransaction( creada.value!.id , orgId ) ;
      expect( reversion.success ).toBe( true ) ;

      const [ original ] = await db.select().from( ledgerTransactions ).where( eq(ledgerTransactions.id , creada.value!.id) ) ;
      const [ espejo ]   = await db.select().from( ledgerTransactions ).where( eq(ledgerTransactions.id , reversion.value!.id) ) ;

      expect( original.reversedAt ).toBeInstanceOf( Date ) ;
      expect( espejo.reversesTransactionId ).toBe( original.id ) ;
    } ) ;
  } ) ;

  /**
   * RFC 019: Soporte de importes que superan el límite de integer (32 bits con signo: 2.147.483.647 centavos).
   * Valida que montos mayores a 21.4M (ej. 3.000.000.000 centavos = $30.000.000) se persistan,
   * actualicen saldos y preserven Debe = Haber sin desbordar.
   */
  describe( "soporte de bigint para importes monetarios (RFC 019)" , () => {
    it( "debería registrar y asentar transacciones con montos superiores al límite de int32 sin overflow" , async () => {
      // 3.000.000.000 centavos = $30.000.000,00 ARS (excede 2.147.483.647 de int32)
      const montoGrande = 3000000000 ;

      const resultado = await createLedgerTransaction( {
        organizationId: orgId ,
        description:    "Aporte de capital extraordinario" ,
        entries: [
          {accountId: ctaBancoId    , debit: montoGrande , credit: 0          } ,
          {accountId: ctaIngresosId , debit: 0           , credit: montoGrande} ,
        ] ,
      } ) ;

      expect( resultado.success ).toBe( true ) ;

      // 1. Verificar que las entradas se persistieron en bigint y retornaron como number
      const entradas = await db
        .select()
        .from( ledgerEntries )
        .where( eq(ledgerEntries.transactionId , resultado.value!.id) ) ;

      expect( entradas ).toHaveLength( 2 ) ;
      const entradaDebe  = entradas.find( ( e ) => { return( (e.accountId === ctaBancoId) ) ; } ) ;
      const entradaHaber = entradas.find( ( e ) => { return( (e.accountId === ctaIngresosId) ) ; } ) ;

      expect( entradaDebe?.debit ).toBe( montoGrande ) ;
      expect( entradaHaber?.credit ).toBe( montoGrande ) ;

      // 2. Verificar que los saldos de las cuentas se actualizaron correctamente
      const [ ctaBancoActualizada ] = await db
        .select()
        .from( accounts )
        .where( eq(accounts.id , ctaBancoId) ) ;

      expect( ctaBancoActualizada.balance ).toBe( montoGrande ) ;
    } ) ;
  } ) ;
} ) ;

