// Librerías externas
import { describe , it , expect , beforeEach , afterEach } from "vitest" ;
import { eq } from "drizzle-orm" ;

// Shared
import { executeIdempotent } from "@/shared/services/idempotencyService" ;
import { db } from "@/shared/db/client" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { accounts , ledgerTransactions , ledgerEntries , idempotencyKeys , outboxEvents } from "../schema.db" ;
import { createLedgerTransaction , deleteLedgerTransaction } from "./accountingService" ;
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
    await db.delete( outboxEvents       ) ;
    await db.delete( idempotencyKeys    ) ;
    await db.delete( ledgerEntries      ) ;
    await db.delete( ledgerTransactions ) ;
    await db.delete( accounts           ) ;
    await db.delete( organizations      ) ;

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
    await db.delete( outboxEvents       ) ;
    await db.delete( idempotencyKeys    ) ;
    await db.delete( ledgerEntries      ) ;
    await db.delete( ledgerTransactions ) ;
    await db.delete( accounts           ) ;
    await db.delete( organizations      ) ;
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
    expect( result.error ).toContain( "La transacción contable está desbalanceada." ) ;

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
} ) ;