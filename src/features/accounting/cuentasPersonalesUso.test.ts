// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach , afterAll } from "vitest" ;
import { getServerSession }                                               from "next-auth" ;
import type { Session }                                                   from "next-auth" ;
import { eq }                                                             from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia , crearCuentaPersonal } from "@/shared/db/testFixtures" ;
import { limpiarBase }                                    from "@/shared/db/testCleanup" ;
import { db }                                             from "@/shared/db/client" ;

// Feature: Accounting
import { financialEntities , accounts , ledgerTransactions , categories }                                                                                                  from "./schema.db" ;
import { createAccountAction , createLedgerTransactionAction , reverseLedgerTransactionAction , deleteLedgerTransactionAction , getAccountsAction , getTransactionsPageAction } from "./actions/accountingActions" ;
import { obtenerMisCuentasAction , dejarDeCompartirAction }                                                                         from "./actions/cuentasPersonalesActions" ;
import { createLedgerTransaction }                                                                                                                          from "./services/accountingService" ;
import { derivarResumenDeMes }                                                                                                                              from "./services/monthlySummaryService" ;
import { accountRepository }                                                                                                                                from "./repositories/accountRepository" ;

// Feature: Auth
import { organizations }        from "@/features/auth/schema.db" ;
import { membershipRepository } from "@/features/auth/repositories/membershipRepository" ;

// Feature: Splits
import { acuerdoRepository }                            from "@/features/splits/repositories/acuerdoRepository" ;
import { expenseSplits , organizationAgreements } from "@/features/splits/schema.db" ;

// Feature: Notifications
import { notifications } from "@/features/notifications/schema.db" ;

// Feature: Transactions
import { createTransactionFromFormAction } from "@/features/transactions/actions/transactionsActions" ;

// Feature: Loans
import { createLoanAction } from "@/features/loans/actions/loansActions" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

function sesionDe( userId: string , organizationId: string , role = "owner" ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

describe( "cuentas personales — códigos contables sin choque (plan 24, paso 0)" , () => {
  let orgA: string ;
  let ana:  string ;

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa" , slug: "casa-cpu" } ).returning() ;
    orgA = a.id ;
    ana  = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "ana@ejemplo.com" , role: "owner" } ) ).id ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "con una personal en el último código libre de asset, cuenta y préstamo de activo obtienen códigos distintos" , async () => {
    await db.insert( accounts ).values( { organizationId: orgA , code: "3.1.01.01" , name: "Patrimonio Neto" , type: "equity" } ) ;
    await crearCuentaPersonal( { ownerUserId: ana , organizationId: orgA , name: "Ahorros de Ana" , code: "1.1.01.01" } ) ;
    const [ entidad ] = await db.insert( financialEntities ).values( { organizationId: orgA , name: "Banco Uno" , brandDomain: "uno.com" , logo: "bank" } ).returning() ;
    sesionDe( ana , orgA ) ;

    const cuenta = await createAccountAction( { name: "Caja" , type: "asset" } ) ;
    expect( cuenta.success ).toBe( true ) ;

    const prestamo = await createLoanAction( {
      name:                 "Préstamo a Pedro" ,
      direction:            "lent" ,
      entityId:             entidad.id ,
      principalAmount:      100000 ,
      currency:             "ARS" ,
      interestRateAnnual:   0 ,
      totalInstallments:    2 ,
      frequency:            "monthly" ,
      intervalCount:        1 ,
      startDate:            new Date( "2026-09-01T12:00:00Z" ) ,
      firstInstallmentDate: "2026-10-10" ,
      resolvedThrough:      "2026-09-01" ,
    } ) ;
    expect( prestamo.success ).toBe( true ) ;

    const codigos = ( await db.select( { code: accounts.code , type: accounts.type } ).from( accounts ) ).filter( ( c ) => c.type === "asset" ).map( ( c ) => c.code ) ;
    expect( codigos ).toHaveLength( 3 ) ;
    expect( new Set( codigos ).size ).toBe( 3 ) ;
  } ) ;
} ) ;

describe( "cuentas personales — uso en movimientos (plan 24)" , () => {
  let orgA:     string ; // Casa: ana owner, beto y carla members, lector viewer
  let orgB:     string ; // Taller: ana owner
  let ana:      string ;
  let beto:     string ;
  let carla:    string ;
  let lector:   string ;
  let personal: string ; // asset ARS de Ana, anclado en A, 5000
  let gastoA:   string ; // expense de A
  let gastoB:   string ; // expense de B

  const MARZO = new Date( 2026 , 2 , 10 , 12 ) ;

  /** Gasto de `monto` centavos desde la personal hacia la cuenta de gasto de la organización. */
  async function gastar( quien: string , org: string , opts: { cuenta?: string ; gasto?: string ; monto?: number ; titular?: string } = {} ) {
    sesionDe( quien , org ) ;
    const monto = ( opts.monto ?? 300 ) ;

    return( await createLedgerTransactionAction( {
      description:  "Gasto con personal" ,
      occurredAt:   MARZO ,
      holderUserId: opts.titular ,
      entries: [
        { accountId: ( opts.cuenta ?? personal ) , debit: 0     , credit: monto } ,
        { accountId: ( opts.gasto  ?? gastoA   ) , debit: monto , credit: 0     } ,
      ] ,
    } ) ) ;
  }

  const saldoDe       = async ( id: string ) => ( await db.select().from( accounts ).where( eq(accounts.id , id) ) )[0].balance ;
  const movimientos   = async () => await db.select().from( ledgerTransactions ) ;

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-cpu2"   } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-cpu2" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;

    ana    = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "ana@ejemplo.com"    , role: "owner"  } ) ).id ;
    beto   = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "beto@ejemplo.com"   , role: "member" } ) ).id ;
    carla  = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "carla@ejemplo.com"  , role: "member" } ) ).id ;
    lector = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "lector@ejemplo.com" , role: "viewer" } ) ).id ;
    await membershipRepository.add( ana , orgB , "owner" ) ;

    gastoA = ( await db.insert( accounts ).values( { organizationId: orgA , code: "5.1.01.01" , name: "Gastos A" , type: "expense" } ).returning() )[0].id ;
    gastoB = ( await db.insert( accounts ).values( { organizationId: orgB , code: "5.1.01.01" , name: "Gastos B" , type: "expense" } ).returning() )[0].id ;

    personal = ( await crearCuentaPersonal( { ownerUserId: ana , organizationId: orgA , name: "Ahorros de Ana" , code: "1.1.80.01" , balance: 5000 , compartidaCon: [ orgA ] } ) ).id ;
  } ) ;

  afterEach( () => {
    vi.restoreAllMocks() ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  describe( "AC-2 (servidor) — gastar con una personal compartida" , () => {
    it( "el dueño asienta el gasto: baja el saldo único, sube el gasto de la organización y el titular es el dueño" , async () => {
      const res = await gastar( ana , orgA ) ;

      expect( res.success ).toBe( true ) ;
      expect( await saldoDe( personal ) ).toBe( 4700 ) ;
      expect( await saldoDe( gastoA ) ).toBe( 300 ) ;
      expect( ( await movimientos() )[0] ).toMatchObject( { organizationId: orgA , createdByUserId: ana } ) ;
    } ) ;

    it( "desde el formulario: una origen personal fija el titular al dueño y rechaza otro titular" , async () => {
      const [ cat ] = await db.insert( categories ).values( { organizationId: orgA , name: "Comida" , type: "expense" , accountCode: "5.2.01" } ).returning() ;
      sesionDe( ana , orgA ) ;

      const otroTitular = await createTransactionFromFormAction( { type: "expense" , amount: 10 , description: "Almuerzo" , sourceAccountId: personal , categoryId: cat.id , holderUserId: beto , occurredAt: MARZO } ) ;
      expect( otroTitular.success ).toBe( false ) ;
      expect( await saldoDe( personal ) ).toBe( 5000 ) ;

      const res = await createTransactionFromFormAction( { type: "expense" , amount: 10 , description: "Almuerzo" , sourceAccountId: personal , categoryId: cat.id , occurredAt: MARZO } ) ;
      expect( res.success ).toBe( true ) ;
      expect( await saldoDe( personal ) ).toBe( 4000 ) ;
      expect( ( await movimientos() )[0].holderUserId ).toBe( ana ) ;
    } ) ;

    it( "AC-2 / A1: una personal privada propia (sin compartir con la organización) se asienta" , async () => {
      const privada = ( await crearCuentaPersonal( { ownerUserId: ana , organizationId: orgA , code: "1.1.80.02" , balance: 100 } ) ).id ;
      const res     = await gastar( ana , orgA , { cuenta: privada , monto: 50 , titular: ana } ) ;

      expect( res.success ).toBe( true ) ;
      expect( await saldoDe( privada ) ).toBe( 50 ) ;
      expect( await saldoDe( gastoA ) ).toBe( 50 ) ;
      expect( ( await movimientos() )[0] ).toMatchObject( { organizationId: orgA , createdByUserId: ana , holderUserId: ana } ) ;
    } ) ;
  } ) ;

  describe( "AC-3 — otro miembro no ve más que lo que se asentó en su organización" , () => {
    it( "beto ve el movimiento en la lista, pero ni el saldo ni la cuenta en sus acciones de cuentas" , async () => {
      await gastar( ana , orgA ) ;
      sesionDe( beto , orgA ) ;

      const pagina = await getTransactionsPageAction( {} ) ;
      expect( pagina.success && pagina.value.items ).toHaveLength( 1 ) ;
      expect( pagina.success && pagina.value.cuentasPersonales ).toEqual( [ expect.objectContaining( { id: personal , name: "Ahorros de Ana" , ownerNombre: expect.any( String ) } ) ] ) ;
      expect( pagina.success && Object.keys( pagina.value.cuentasPersonales[0] ) ).not.toContain( "balance" ) ;

      const cuentas = await getAccountsAction() ;
      expect( cuentas.success && cuentas.value.map( ( c ) => c.id ) ).not.toContain( personal ) ;

      const mias = await obtenerMisCuentasAction() ;
      expect( mias.success && mias.value ).toEqual( [] ) ;
    } ) ;

    it( "los movimientos de otra organización no aparecen en la lista" , async () => {
      await accountRepository.compartir( personal , orgB ) ;
      await gastar( ana , orgB , { gasto: gastoB , monto: 200 } ) ;
      sesionDe( beto , orgA ) ;

      const pagina = await getTransactionsPageAction( {} ) ;

      expect( pagina.success && pagina.value.items ).toHaveLength( 0 ) ;
      expect( pagina.success && pagina.value.cuentasPersonales ).toEqual( [] ) ;
    } ) ;
  } ) ;

  describe( "AC-4 / RN-13 — dejar de compartir conserva el movimiento" , () => {
    it( "el movimiento sigue en la lista y Ana sigue pudiendo usar su propia cuenta" , async () => {
      await gastar( ana , orgA ) ;

      sesionDe( ana , orgA ) ;
      const dejar = await dejarDeCompartirAction( { accountId: personal , organizationId: orgA } ) ;
      expect( dejar.success ).toBe( true ) ;

      // Ya no está compartida, pero sigue siendo usable para Ana (RN-2)
      expect( ( await accountRepository.findUsablesPara( orgA , ana ) ).map( ( c ) => c.id ) ).toContain( personal ) ;

      const pagina = await getTransactionsPageAction( {} ) ;
      expect( pagina.success && pagina.value.items ).toHaveLength( 1 ) ;
      expect( pagina.success && pagina.value.items[0].entries.map( ( e ) => e.accountId ) ).toContain( personal ) ;
      expect( pagina.success && pagina.value.cuentasPersonales ).toEqual( [ expect.objectContaining( { id: personal , ownerNombre: expect.any( String ) } ) ] ) ;

      const otra = await gastar( ana , orgA ) ;
      expect( otra.success ).toBe( true ) ;
      expect( await saldoDe( personal ) ).toBe( 4400 ) ;
    } ) ;

    it( "findUsablesPara trae las de la organización, las propias (compartidas o no) y las de otros compartidas" , async () => {
      const ajenaCompartida = await crearCuentaPersonal( { ownerUserId: beto , organizationId: orgA , code: "1.1.80.03" , compartidaCon: [ orgA ] } ) ;
      const ajenaPrivada    = await crearCuentaPersonal( { ownerUserId: beto , organizationId: orgA , code: "1.1.80.04" } ) ;
      await db.insert( accounts ).values( { organizationId: orgA , code: "1.1.01.01" , name: "Efectivo" , type: "asset" } ) ;

      const deAna = await accountRepository.findUsablesPara( orgA , ana ) ;
      const ids   = deAna.map( ( c ) => c.id ) ;

      expect( ids ).toContain( personal ) ;
      expect( ids ).toContain( ajenaCompartida.id ) ;
      expect( ids ).not.toContain( ajenaPrivada.id ) ;
      expect( deAna.find( ( c ) => (c.id === ajenaCompartida.id) )?.ownerNombre ).toBeTruthy() ;
      expect( deAna.find( ( c ) => (c.name === "Efectivo") )?.etiqueta ).toEqual( { tipo: "organizacion" } ) ;
    } ) ;
  } ) ;

  describe( "AC-6 / AC-14 / A2 — quién puede asentar sobre la cuenta de otro" , () => {
    it( "AC-6 / AC-14: Beto con la compartida de Ana puede asentar sin habilitación a nombre de Ana" , async () => {
      const ok = await gastar( beto , orgA , { titular: ana } ) ;
      expect( ok.success ).toBe( true ) ;
      expect( await saldoDe( personal ) ).toBe( 4700 ) ;
      expect( ( await movimientos() )[0] ).toMatchObject( { createdByUserId: beto , holderUserId: ana } ) ;
    } ) ;

    it( "AC-6: Beto intentando asentar a su propio nombre con la cuenta de Ana es rechazado" , async () => {
      const aNombreDeBeto = await gastar( beto , orgA , { titular: beto } ) ;
      expect( aNombreDeBeto.success ).toBe( false ) ;
      expect( await saldoDe( personal ) ).toBe( 5000 ) ;
    } ) ;

    it( "AC-6: Beto con una personal no compartida de Ana es rechazado" , async () => {
      const noCompartida = ( await crearCuentaPersonal( { ownerUserId: ana , organizationId: orgA , code: "1.1.80.99" , balance: 2000 } ) ).id ;
      const res = await gastar( beto , orgA , { cuenta: noCompartida , titular: ana } ) ;

      expect( res.success ).toBe( false ) ;
      expect( await saldoDe( noCompartida ) ).toBe( 2000 ) ;
      expect( await movimientos() ).toHaveLength( 0 ) ;
    } ) ;

    it( "A2 / AC-4: Ana deja de compartir y Beto ya no puede asentar con ella" , async () => {
      sesionDe( ana , orgA ) ;
      await dejarDeCompartirAction( { accountId: personal , organizationId: orgA } ) ;

      const res = await gastar( beto , orgA , { titular: ana } ) ;
      expect( res.success ).toBe( false ) ;
      expect( await saldoDe( personal ) ).toBe( 5000 ) ;
      expect( await movimientos() ).toHaveLength( 0 ) ;
    } ) ;

    it( "un viewer no escribe sobre una personal ni a nombre del dueño" , async () => {
      const res = await gastar( lector , orgA , { titular: ana } ) ;

      expect( res.success ).toBe( false ) ;
      expect( await saldoDe( personal ) ).toBe( 5000 ) ;
    } ) ;

    it( "el motor rechaza una personal sin autor (cron, outbox, seed)" , async () => {
      const res = await createLedgerTransaction( {
        organizationId: orgA ,
        description:    "Sin autor" ,
        entries: [
          { accountId: personal , debit: 0   , credit: 100 } ,
          { accountId: gastoA   , debit: 100 , credit: 0   } ,
        ] ,
      } ) ;

      expect( res.success ).toBe( false ) ;
      expect( await saldoDe( personal ) ).toBe( 5000 ) ;
    } ) ;
  } ) ;

  describe( "A3 — divisa distinta" , () => {
    it( "un gasto en ARS contra una personal en USD falla con el error de moneda existente" , async () => {
      const usd = ( await crearCuentaPersonal( { ownerUserId: ana , organizationId: orgA , code: "1.1.80.04" , currency: "USD" , balance: 100 , compartidaCon: [ orgA ] } ) ).id ;
      sesionDe( ana , orgA ) ;

      const res = await createLedgerTransactionAction( {
        description: "Mezcla" ,
        entries: [
          { accountId: usd    , debit: 0   , credit: 100 , currency: "ARS" } ,
          { accountId: gastoA , debit: 100 , credit: 0   , currency: "ARS" } ,
        ] ,
      } ) ;

      expect( !res.success && res.error ).toContain( "opera en USD" ) ;
      expect( await saldoDe( usd ) ).toBe( 100 ) ;
    } ) ;
  } ) ;

  describe( "A8 — reversa y eliminación" , () => {
    it( "con la cuenta ya no compartida, el dueño reversa y el saldo único se corrige" , async () => {
      const original = await gastar( ana , orgA ) ;
      expect( original.success ).toBe( true ) ;

      sesionDe( ana , orgA ) ;
      await dejarDeCompartirAction( { accountId: personal , organizationId: orgA } ) ;

      const reversa = await reverseLedgerTransactionAction( { transactionId: original.success ? original.value.id : "" } ) ;

      expect( reversa.success ).toBe( true ) ;
      expect( await saldoDe( personal ) ).toBe( 5000 ) ;
      expect( await saldoDe( gastoA ) ).toBe( 0 ) ;
    } ) ;

    it( "un member que no es el dueño ni el autor no puede reversar; el autor, sí" , async () => {
      const original = await gastar( beto , orgA , { titular: ana } ) ;
      const id       = ( original.success ? original.value.id : "" ) ;

      sesionDe( carla , orgA ) ;
      const deCarla = await reverseLedgerTransactionAction( { transactionId: id } ) ;
      expect( deCarla.success ).toBe( false ) ;
      expect( await saldoDe( personal ) ).toBe( 4700 ) ;

      sesionDe( beto , orgA ) ;
      const deBeto = await reverseLedgerTransactionAction( { transactionId: id } ) ;
      expect( deBeto.success ).toBe( true ) ;
      expect( await saldoDe( personal ) ).toBe( 5000 ) ;
    } ) ;

    it( "un owner de la organización puede reversar aunque no sea el dueño ni el autor" , async () => {
      const original = await gastar( beto , orgA , { titular: ana } ) ;
      const dueña2   = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "dueña2@ejemplo.com" , role: "owner" } ) ).id ;

      sesionDe( dueña2 , orgA ) ;
      const res = await reverseLedgerTransactionAction( { transactionId: original.success ? original.value.id : "" } ) ;

      expect( res.success ).toBe( true ) ;
      expect( await saldoDe( personal ) ).toBe( 5000 ) ;
    } ) ;

    it( "eliminar un movimiento que usa una personal se rechaza y no toca saldos" , async () => {
      const original = await gastar( ana , orgA ) ;
      sesionDe( ana , orgA ) ;

      const res = await deleteLedgerTransactionAction( original.success ? original.value.id : "" ) ;

      expect( !res.success && res.error ).toContain( "Reversá el movimiento" ) ;
      expect( await saldoDe( personal ) ).toBe( 4700 ) ;
      expect( await movimientos() ).toHaveLength( 1 ) ;
    } ) ;
  } ) ;

  describe( "AC-13 / AC-14 / AC-15 / AC-17 / A10 / A11 — absorción, reparto y deudas" , () => {
    beforeEach( async () => {
      // Reparto 50/50 entre Ana y Beto en Casa
      await acuerdoRepository.guardar( orgA , {
        modo:          "fixed_percentages" ,
        usesCommonPot: false ,
        porcentajes:   [
          { userId: ana  , percentageBp: 5000 } ,
          { userId: beto , percentageBp: 5000 } ,
        ] ,
      } , ana , db ) ;
    } ) ;

    it( "AC-13 / RN-19: Ana absorbe -> cabecera absorbedByHolder = true, 0 expense_splits, 0 avisos de deuda, suma en el resumen" , async () => {
      sesionDe( ana , orgA ) ;

      const res = await createTransactionFromFormAction( {
        type:            "expense" ,
        amount:          120 ,
        description:     "Súper absorbido" ,
        sourceAccountId: personal ,
        occurredAt:      MARZO ,
        absorbeElDueno:  true ,
      } ) ;

      expect( res.success ).toBe( true ) ;
      expect( await saldoDe( personal ) ).toBe( -7000 ) ; // 5000 - 12000

      const txs = await movimientos() ;
      expect( txs ).toHaveLength( 1 ) ;
      expect( txs[0].absorbedByHolder ).toBe( true ) ;

      // 0 expense_splits generados
      const splits = await db.select().from( expenseSplits ).where( eq( expenseSplits.organizationId , orgA ) ) ;
      expect( splits ).toHaveLength( 0 ) ;

      // 0 avisos de deuda generados
      const avisos = await db.select().from( notifications ).where( eq( notifications.organizationId , orgA ) ) ;
      expect( avisos.filter( ( n ) => n.type === "debt_created" ) ).toHaveLength( 0 ) ;

      // Suma en el resumen mensual de Casa
      const resumen = await derivarResumenDeMes( orgA , 2026 , 2 ) ;
      expect( resumen.totalExpense ).toBe( 12000 ) ;
    } ) ;

    it( "RN-19 / §3.4.6: reversar un movimiento absorbido no falla aunque no haya expense_splits, y devuelve el saldo" , async () => {
      sesionDe( ana , orgA ) ;

      const original = await createTransactionFromFormAction( {
        type:            "expense" ,
        amount:          120 ,
        description:     "Súper absorbido a reversar" ,
        sourceAccountId: personal ,
        occurredAt:      MARZO ,
        absorbeElDueno:  true ,
      } ) ;
      expect( original.success ).toBe( true ) ;
      expect( await saldoDe( personal ) ).toBe( -7000 ) ;

      const reversa = await reverseLedgerTransactionAction( { transactionId: original.success ? original.value.id : "" } ) ;

      expect( reversa.success ).toBe( true ) ;
      expect( await saldoDe( personal ) ).toBe( 5000 ) ;
      expect( await saldoDe( gastoA ) ).toBe( 0 ) ;

      const splits = await db.select().from( expenseSplits ).where( eq( expenseSplits.organizationId , orgA ) ) ;
      expect( splits ).toHaveLength( 0 ) ;
    } ) ;

    it( "AC-15 / A10: Beto envía absorbidoPorElTitular: true con la cuenta de Ana -> se ignora, deuda de $2.000 a Ana" , async () => {
      sesionDe( beto , orgA ) ;

      const res = await createTransactionFromFormAction( {
        type:            "expense" ,
        amount:          40 ,
        description:     "Farmacia" ,
        sourceAccountId: personal ,
        occurredAt:      MARZO ,
        holderUserId:    ana ,
        absorbeElDueno:  true , // Beto intenta perdonar la deuda ajena
      } ) ;

      expect( res.success ).toBe( true ) ;

      const txs = await movimientos() ;
      expect( txs ).toHaveLength( 1 ) ;
      expect( txs[0].absorbedByHolder ).toBe( false ) ;

      // Beto le debe $2.000 a Ana
      const splits = await db.select().from( expenseSplits ).where( eq( expenseSplits.organizationId , orgA ) ) ;
      expect( splits ).toHaveLength( 1 ) ;
      expect( splits[0] ).toMatchObject( {
        debtorUserId:  beto ,
        amountInCents: 2000 ,
      } ) ;
    } ) ;

    it( "A11: sin respuesta (campo ausente / false) con la propia -> deuda generada normalmente" , async () => {
      sesionDe( ana , orgA ) ;

      const res = await createTransactionFromFormAction( {
        type:            "expense" ,
        amount:          40 ,
        description:     "Farmacia sin absorción" ,
        sourceAccountId: personal ,
        occurredAt:      MARZO ,
      } ) ;

      expect( res.success ).toBe( true ) ;

      const txs = await movimientos() ;
      expect( txs[0].absorbedByHolder ).toBe( false ) ;

      const splits = await db.select().from( expenseSplits ).where( eq( expenseSplits.organizationId , orgA ) ) ;
      expect( splits ).toHaveLength( 1 ) ;
      expect( splits[0] ).toMatchObject( {
        debtorUserId:  beto ,
        amountInCents: 2000 ,
      } ) ;
    } ) ;

    it( "AC-14: Beto con la compartida, titular Ana fijo, deuda a Ana y aviso a Ana" , async () => {
      sesionDe( beto , orgA ) ;

      const res = await createTransactionFromFormAction( {
        type:            "expense" ,
        amount:          20 ,
        description:     "Kiosco" ,
        sourceAccountId: personal ,
        occurredAt:      MARZO ,
      } ) ;

      expect( res.success ).toBe( true ) ;

      const txs = await movimientos() ;
      expect( txs[0].holderUserId ).toBe( ana ) ;

      // Deuda de Beto a Ana por 1000
      const splits = await db.select().from( expenseSplits ).where( eq( expenseSplits.organizationId , orgA ) ) ;
      expect( splits ).toHaveLength( 1 ) ;
      expect( splits[0] ).toMatchObject( {
        debtorUserId:  beto ,
        amountInCents: 1000 ,
      } ) ;

      // Notificación charged_to_holder para Ana
      const avisos = await db.select().from( notifications ).where( eq( notifications.organizationId , orgA ) ) ;
      expect( avisos.some( ( n ) => ( (n.type === "charged_to_holder") && (n.recipientUserId === ana) ) ) ).toBe( true ) ;
    } ) ;

    it( "AC-17: compartida en una organización sin reparto -> asienta, nadie debe" , async () => {
      // Borrar acuerdo
      await db.delete( organizationAgreements ).where( eq( organizationAgreements.organizationId , orgA ) ) ;

      sesionDe( beto , orgA ) ;

      const res = await createTransactionFromFormAction( {
        type:            "expense" ,
        amount:          20 ,
        description:     "Kiosco sin reparto" ,
        sourceAccountId: personal ,
        occurredAt:      MARZO ,
      } ) ;

      expect( res.success ).toBe( true ) ;

      const txs = await movimientos() ;
      expect( txs[0].holderUserId ).toBe( ana ) ;

      const splits = await db.select().from( expenseSplits ).where( eq( expenseSplits.organizationId , orgA ) ) ;
      expect( splits ).toHaveLength( 0 ) ;
    } ) ;

    it( "eliminar un movimiento que usa una personal se rechaza y no toca saldos" , async () => {
      const original = await gastar( ana , orgA ) ;
      sesionDe( ana , orgA ) ;

      const res = await deleteLedgerTransactionAction( original.success ? original.value.id : "" ) ;

      expect( !res.success && res.error ).toContain( "Reversá el movimiento" ) ;
      expect( await saldoDe( personal ) ).toBe( 4700 ) ;
      expect( await movimientos() ).toHaveLength( 1 ) ;
    } ) ;
  } ) ;

  describe( "A9 / AC-8 — la misma personal en dos organizaciones" , () => {
    it( "el saldo es único, cada organización ve lo suyo y el resumen mensual de cada una suma sólo su gasto" , async () => {
      await accountRepository.compartir( personal , orgB ) ;

      expect( ( await gastar( ana , orgA , { monto: 300 } ) ).success ).toBe( true ) ;
      expect( ( await gastar( ana , orgB , { monto: 200 , gasto: gastoB } ) ).success ).toBe( true ) ;

      expect( await saldoDe( personal ) ).toBe( 4500 ) ;

      sesionDe( ana , orgA ) ;
      const deA = await getTransactionsPageAction( {} ) ;
      sesionDe( ana , orgB ) ;
      const deB = await getTransactionsPageAction( {} ) ;

      expect( deA.success && deA.value.items.map( ( t ) => t.organizationId ) ).toEqual( [ orgA ] ) ;
      expect( deB.success && deB.value.items.map( ( t ) => t.organizationId ) ).toEqual( [ orgB ] ) ;

      expect( ( await derivarResumenDeMes( orgA , 2026 , 2 ) ).totalExpense ).toBe( 300 ) ;
      expect( ( await derivarResumenDeMes( orgB , 2026 , 2 ) ).totalExpense ).toBe( 200 ) ;
    } ) ;

    it( "AC-8: el resumen de la organización donde la personal no se usó no suma nada" , async () => {
      await gastar( ana , orgA ) ;

      const resumenB = await derivarResumenDeMes( orgB , 2026 , 2 ) ;

      expect( resumenB.totalExpense ).toBe( 0 ) ;
      expect( resumenB.assetsSnapshot ).toBe( 0 ) ;
      expect( ( await derivarResumenDeMes( orgA , 2026 , 2 ) ).assetsSnapshot ).toBe( 0 ) ;
    } ) ;
  } ) ;

  describe( "Atomicidad y concurrencia" , () => {
    it( "si falla después del primer saldo, ningún saldo cambia y no queda movimiento" , async () => {
      const original = accountRepository.updateBalance.bind( accountRepository ) ;
      let llamadas   = 0 ;

      vi.spyOn( accountRepository , "updateBalance" ).mockImplementation( async ( id , saldo , tx ) => {
        llamadas++ ;
        if( llamadas === 2 ) { throw new Error( "falla forzada" ) ; }
        await original( id , saldo , tx ) ;
      } ) ;

      const res = await gastar( ana , orgA ) ;

      expect( res.success ).toBe( false ) ;
      expect( llamadas ).toBe( 2 ) ;
      expect( await saldoDe( personal ) ).toBe( 5000 ) ;
      expect( await saldoDe( gastoA ) ).toBe( 0 ) ;
      expect( await movimientos() ).toHaveLength( 0 ) ;
    } ) ;

    it( "NFR-2: dos organizaciones moviendo las mismas dos personales en sentido inverso no se traban" , async () => {
      const p2 = ( await crearCuentaPersonal( { ownerUserId: ana , organizationId: orgA , code: "1.1.80.05" , balance: 5000 , compartidaCon: [ orgA , orgB ] } ) ).id ;
      await accountRepository.compartir( personal , orgB ) ;

      for( let i = 0 ; i < 15 ; i++ ) {
        const [ r1 , r2 ] = await Promise.all( [
          createLedgerTransaction( { organizationId: orgA , createdByUserId: ana , holderUserId: ana , description: "A" , entries: [ { accountId: personal , debit: 0   , credit: 10 } , { accountId: p2       , debit: 10 , credit: 0 } ] } ) ,
          createLedgerTransaction( { organizationId: orgB , createdByUserId: ana , holderUserId: ana , description: "B" , entries: [ { accountId: p2       , debit: 0   , credit: 10 } , { accountId: personal , debit: 10 , credit: 0 } ] } ) ,
        ] ) ;

        expect( [ r1.success , r2.success ] ).toEqual( [ true , true ] ) ;
      }

      expect( await saldoDe( personal ) ).toBe( 5000 ) ;
      expect( await saldoDe( p2 ) ).toBe( 5000 ) ;
    } ) ;
  } ) ;
} ) ;
