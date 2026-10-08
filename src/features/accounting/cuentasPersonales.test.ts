// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                   from "next-auth" ;
import type { Session }                                       from "next-auth" ;
import { eq , sql }                                           from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia , crearCuentaPersonal } from "@/shared/db/testFixtures" ;
import { limpiarBase }                                    from "@/shared/db/testCleanup" ;
import { db }                                             from "@/shared/db/client" ;

// Feature: Accounting
import { crearCuentaPersonalAction , compartirCuentaAction , dejarDeCompartirAction , obtenerMisCuentasAction } from "./actions/cuentasPersonalesActions" ;
import { accounts , accountShares , categories , ledgerTransactions , ledgerEntries }                                  from "./schema.db" ;
import { derivarResumenDeMes }                                                                                  from "./services/monthlySummaryService" ;
import { categoryRepository }                                                                                   from "./repositories/categoryRepository" ;
import { accountRepository , cuentaVisibleEn }                                                                  from "./repositories/accountRepository" ;
import { getAccountsAction , createAccountAction }                                                              from "./actions/accountingActions" ;

// Feature: Auth
import { organizations }                          from "@/features/auth/schema.db" ;
import { membershipRepository }                   from "@/features/auth/repositories/membershipRepository" ;
import { crearEspacioPersonal }                   from "@/features/auth/services/espacioPersonalService" ;
import { quitarMiembroAction , cambiarRolAction } from "@/features/organizations/actions/membersActions" ;
import { abandonarOrganizacionAction }            from "@/features/organizations/actions/organizationActions" ;

// Feature: Reports
import { reportsRepository } from "@/features/reports/repositories/reportsRepository" ;

// Feature: Cards
import { cardAccounts }    from "@/features/cards/schema.db" ;
import { cardsRepository } from "@/features/cards/repositories/cardsRepository" ;

// Feature: Loans
import { loanAccounts }    from "@/features/loans/schema.db" ;
import { loansRepository } from "@/features/loans/repositories/loansRepository" ;

// Feature: Goals
import { goalsRepository } from "@/features/goals/repositories/goalsRepository" ;
import { goalsService }    from "@/features/goals/services/goalsService" ;

// Feature: Splits
import { cajaRepository }                from "@/features/splits/repositories/cajaRepository" ;
import { resolverReparto }               from "@/features/splits/services/acuerdoService" ;
import { guardarAcuerdoAction }          from "@/features/splits/actions/acuerdoActions" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

function sesionDe( userId: string , organizationId: string ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role: "owner" } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

describe( "cuentas personales — modelo y visibilidad (plan 23)" , () => {
  let orgA:   string ; // ancla
  let orgB:   string ;
  let ana:    string ; // owner de A, member de B, dueña de las personales
  let beto:   string ; // member de A
  let lector: string ; // viewer de A
  let efectivoA: string ; // asset de la organización A
  let personal:  string ; // asset personal de Ana, anclado en A, privado

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-cp"   } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-cp" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;

    ana    = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "ana@ejemplo.com"   , role: "owner"  } ) ).id ;
    beto   = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "beto@ejemplo.com"  , role: "member" } ) ).id ;
    lector = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "lector@ejemplo.com" , role: "viewer" } ) ).id ;
    await membershipRepository.add( ana , orgB , "member" ) ;

    const [ efectivo ] = await db.insert( accounts ).values( { organizationId: orgA , code: "1.1.01.01" , name: "Efectivo" , type: "asset" , balance: 1000 } ).returning() ;
    efectivoA = efectivo.id ;

    personal = ( await crearCuentaPersonal( { ownerUserId: ana , organizationId: orgA , name: "Ahorros de Ana" , code: "1.1.80.01" , balance: 5000 } ) ).id ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  describe( "AC-1 — una privada no se filtra" , () => {
    it( "no sale en findAll de la ancla ni de otra organización, ni en getAccountsAction" , async () => {
      const deA = await accountRepository.findAll( orgA ) ;
      const deB = await accountRepository.findAll( orgB ) ;

      expect( deA.map( ( c ) => c.id ) ).toEqual( [ efectivoA ] ) ;
      expect( deB ).toEqual( [] ) ;

      sesionDe( ana , orgA ) ;
      const res = await getAccountsAction() ;
      expect( res.success && res.value.map( ( c ) => c.id ) ).toEqual( [ efectivoA ] ) ;
    } ) ;

    it( "findById y findByIdForUpdate no la devuelven, ni siquiera compartida con la ancla" , async () => {
      await accountRepository.compartir( personal , orgA ) ;

      expect( await accountRepository.findById( personal , orgA ) ).toBeNull() ;
      expect( await db.transaction( ( tx ) => accountRepository.findByIdForUpdate( personal , orgA , tx ) ) ).toBeNull() ;
      expect( ( await accountRepository.findAll( orgA ) ).map( ( c ) => c.id ) ).toEqual( [ efectivoA ] ) ;
    } ) ;

    it( "cuentaVisibleEn la ve sólo donde fue compartida" , async () => {
      const visibles = async ( orgId: string ) => ( await db.select( { id: accounts.id } ).from( accounts ).where( cuentaVisibleEn( orgId ) ) ).map( ( c ) => c.id ) ;

      expect( await visibles( orgA ) ).toEqual( [ efectivoA ] ) ;

      await accountRepository.compartir( personal , orgB ) ;

      expect( await visibles( orgB ) ).toEqual( [ personal ] ) ;
      expect( await visibles( orgA ) ).toEqual( [ efectivoA ] ) ;
    } ) ;

    it( "el resumen mensual no suma el saldo de activos de una personal (RN-11)" , async () => {
      const [ ingreso ] = await db.insert( accounts ).values( { organizationId: orgA , code: "4.1.01.01" , name: "Sueldo" , type: "revenue" } ).returning() ;
      const ocurrio     = new Date( 2030 , 0 , 10 , 12 ) ;

      const [ t1 ] = await db.insert( ledgerTransactions ).values( { organizationId: orgA , description: "Cobro" , occurredAt: ocurrio } ).returning() ;
      await db.insert( ledgerEntries ).values( [
        { transactionId: t1.id , accountId: efectivoA    , debit: 1000 , credit: 0    } ,
        { transactionId: t1.id , accountId: ingreso.id   , debit: 0    , credit: 1000 } ,
      ] ) ;

      // Movimiento directo sobre la personal (ningún flujo del plan 23 lo genera: se fuerza para probar el predicado)
      const [ t2 ] = await db.insert( ledgerTransactions ).values( { organizationId: orgA , description: "Cobro personal" , occurredAt: ocurrio } ).returning() ;
      await db.insert( ledgerEntries ).values( [
        { transactionId: t2.id , accountId: personal   , debit: 700 , credit: 0   } ,
        { transactionId: t2.id , accountId: ingreso.id , debit: 0   , credit: 700 } ,
      ] ) ;

      const resumen = await derivarResumenDeMes( orgA , 2030 , 0 ) ;

      expect( resumen.assetsSnapshot ).toBe( 1000 ) ;
    } ) ;

    it( "los reportes no cuentan el patrimonio, el saldo ni las divisas de una personal" , async () => {
      const [ ingreso ] = await db.insert( accounts ).values( { organizationId: orgA , code: "4.1.01.01" , name: "Sueldo" , type: "revenue" } ).returning() ;
      const personalUsd = await crearCuentaPersonal( { ownerUserId: ana , organizationId: orgA , currency: "USD" , balance: 900 } ) ;
      const ocurrio     = new Date( 2030 , 0 , 10 , 12 ) ;

      const [ t ] = await db.insert( ledgerTransactions ).values( { organizationId: orgA , description: "Cobro personal" , occurredAt: ocurrio } ).returning() ;
      await db.insert( ledgerEntries ).values( [
        { transactionId: t.id , accountId: personal   , debit: 700 , credit: 0   } ,
        { transactionId: t.id , accountId: ingreso.id , debit: 0   , credit: 700 } ,
      ] ) ;

      expect( await reportsRepository.patrimonioPorMes( { orgId: orgA , monthKeyMax: "2030-12" , zona: "UTC" , currency: "ARS" } ) ).toEqual( [] ) ;
      expect( await reportsRepository.saldosDeHoy( orgA , "ARS" ) ).toEqual( { activos: 1000 , pasivos: 0 } ) ;
      expect( await reportsRepository.saldosDeHoy( orgA , "USD" ) ).toEqual( { activos: 0 , pasivos: 0 } ) ;
      expect( await reportsRepository.divisasConCuentas( orgA ) ).toEqual( [ "ARS" ] ) ;
      expect( personalUsd.currency ).toBe( "USD" ) ;

      const flujos = await reportsRepository.flujosPorMes( { orgId: orgA , monthKey: "2030-01" , zona: "UTC" , currency: "ARS" } ) ;
      expect( flujos.map( ( f ) => f.gastos ) ).toEqual( [ 0 ] ) ;

      const gasto = await reportsRepository.gastoPorHojaDelMes( { orgId: orgA , monthKey: "2030-01" , zona: "UTC" , currency: "ARS" } ) ;
      expect( gasto ).toEqual( [] ) ;

      const top = await reportsRepository.topGastosDelMes( { orgId: orgA , monthKey: "2030-01" , zona: "UTC" , currency: "ARS" } ) ;
      expect( top ).toEqual( [] ) ;
    } ) ;

    it( "categoryRepository.findOrCreateAccountForCurrency devuelve siempre una cuenta de la organización" , async () => {
      const [ cat ] = await db.insert( categories ).values( { organizationId: orgA , name: "Comida" , type: "expense" , accountCode: "5.1.01" } ).returning() ;

      const cuenta = await categoryRepository.findOrCreateAccountForCurrency( cat.id , "ARS" ) ;

      expect( cuenta.ownerUserId ).toBeNull() ;
      expect( cuenta.id ).not.toBe( personal ) ;
    } ) ;

    it( "una tarjeta y un préstamo no listan una personal entre sus cuentas" , async () => {
      const tarjetaCuenta = ( await db.insert( accounts ).values( { organizationId: orgA , code: "2.3.01" , name: "Visa" , type: "liability" } ).returning() )[0] ;

      const card = await cardsRepository.create( {
        organizationId: orgA , label: "Visa" , type: "credit" , network: "visa" , lastFour: "1234" , expiryMonth: 12 , expiryYear: 2030 ,
      } ) ;
      await cardsRepository.addCardAccount( { cardId: card.id , accountId: tarjetaCuenta.id , currency: "ARS" } ) ;
      // Vínculo forzado a una personal: el predicado debe dejarla afuera
      await db.insert( cardAccounts ).values( { cardId: card.id , accountId: personal , currency: "USD" } ) ;

      const [ tarjeta ] = await cardsRepository.findAll( orgA ) ;
      expect( tarjeta.accounts.map( ( c ) => c.accountId ) ).toEqual( [ tarjetaCuenta.id ] ) ;

      const porId = await cardsRepository.findById( card.id , orgA ) ;
      expect( porId?.accounts.map( ( c ) => c.accountId ) ).toEqual( [ tarjetaCuenta.id ] ) ;

      const prestamoCuenta = ( await db.insert( accounts ).values( { organizationId: orgA , code: "2.2.01" , name: "Préstamo" , type: "liability" } ).returning() )[0] ;
      const prestamo = await loansRepository.create( {
        organizationId: orgA , name: "Préstamo" , direction: "borrowed" , principalAmount: 10000 , startDate: new Date() , firstInstallmentDate: "2030-01-01" ,
      } ) ;
      await loansRepository.addLoanAccount( { loanId: prestamo.id , accountId: prestamoCuenta.id , currency: "ARS" } ) ;
      await db.insert( loanAccounts ).values( { loanId: prestamo.id , accountId: personal , currency: "USD" } ) ;

      const [ conRelaciones ] = await loansRepository.findAllWithRelations( orgA ) ;
      expect( conRelaciones.accounts.map( ( c ) => c.accountId ) ).toEqual( [ prestamoCuenta.id ] ) ;

      const cuentas = await loansRepository.findAccountsByLoanId( prestamo.id , orgA ) ;
      expect( cuentas.map( ( c ) => c.accountId ) ).toEqual( [ prestamoCuenta.id ] ) ;
    } ) ;

    it( "la caja común no ofrece una personal ni la deja marcar" , async () => {
      expect( ( await cajaRepository.cuentasMarcables( orgA ) ).map( ( c ) => c.id ) ).toEqual( [ efectivoA ] ) ;

      await db.transaction( async ( tx ) => { await cajaRepository.marcarCuentas( orgA , [ personal ] , tx ) ; } ) ;

      expect( ( await cajaRepository.cuentasDeCaja( orgA ) ) ).toEqual( [] ) ;
      const [ fila ] = await db.select().from( accounts ).where( eq( accounts.id , personal ) ) ;
      expect( fila.isCommonPot ).toBe( false ) ;
    } ) ;

    it( "resolverReparto ignora una personal entre las cuentas del gasto" , async () => {
      const res = await resolverReparto( { orgId: orgA , autorId: ana , tipo: "expense" , montoEnCentavos: 1000 , currency: "ARS" , cuentas: [ personal ] , esGastoManual: true } ) ;

      expect( res.aplica ).toBe( false ) ;
    } ) ;

    it( "una meta no admite aportes desde una personal" , async () => {
      const metaCreada = await goalsRepository.create( { organizationId: orgA , name: "Viaje" , currency: "ARS" , targetAmount: 100000 } ) ;

      const res = await goalsService.aportar( { orgId: orgA , goalId: metaCreada.id , accountId: personal , amount: 100 } ) ;

      expect( res.success ).toBe( false ) ;
      expect( !res.success && res.error ).toBe( "Cuenta no encontrada." ) ;
    } ) ;
  } ) ;

  describe( "AC-5 — compartir y dejar de compartir" , () => {
    it( "el dueño comparte hacia una organización donde es member, de forma idempotente" , async () => {
      sesionDe( ana , orgA ) ;

      expect( (await compartirCuentaAction( { accountId: personal , organizationId: orgB } )).success ).toBe( true ) ;
      expect( (await compartirCuentaAction( { accountId: personal , organizationId: orgB } )).success ).toBe( true ) ;

      const filas = await db.select().from( accountShares ).where( eq( accountShares.accountId , personal ) ) ;
      expect( filas ).toHaveLength( 1 ) ;
    } ) ;

    it( "otra persona no puede compartir ni dejar de compartir una cuenta ajena" , async () => {
      await accountRepository.compartir( personal , orgA ) ;
      await membershipRepository.add( beto , orgB , "member" ) ;
      sesionDe( beto , orgA ) ;

      expect( (await compartirCuentaAction( { accountId: personal , organizationId: orgB } )).success ).toBe( false ) ;
      expect( (await dejarDeCompartirAction( { accountId: personal , organizationId: orgA } )).success ).toBe( false ) ;

      const filas = await db.select().from( accountShares ).where( eq( accountShares.accountId , personal ) ) ;
      expect( filas.map( ( f ) => f.organizationId ) ).toEqual( [ orgA ] ) ;
    } ) ;

    it( "no se comparte hacia una organización donde el dueño es viewer o no es miembro" , async () => {
      await membershipRepository.cambiarRol( ana , orgB , "viewer" ) ;
      sesionDe( ana , orgA ) ;

      expect( (await compartirCuentaAction( { accountId: personal , organizationId: orgB } )).success ).toBe( false ) ;

      const [ c ] = await db.insert( organizations ).values( { name: "Ajena" , slug: "ajena-cp" } ).returning() ;
      expect( (await compartirCuentaAction( { accountId: personal , organizationId: c.id } )).success ).toBe( false ) ;
      expect( await db.select().from( accountShares ) ).toEqual( [] ) ;
    } ) ;

    it( "el dueño deja de compartir y la cuenta vuelve a ser privada" , async () => {
      await accountRepository.compartir( personal , orgB ) ;
      sesionDe( ana , orgA ) ;

      expect( (await dejarDeCompartirAction( { accountId: personal , organizationId: orgB } )).success ).toBe( true ) ;
      expect( await db.select().from( accountShares ) ).toEqual( [] ) ;
    } ) ;

    it( "una cuenta de la organización no se puede compartir como personal" , async () => {
      sesionDe( ana , orgA ) ;

      expect( (await compartirCuentaAction( { accountId: efectivoA , organizationId: orgB } )).success ).toBe( false ) ;
    } ) ;
  } ) ;

  describe( "Creación (RN-2, RN-3, RN-6)" , () => {
    async function asientosDe( orgId: string ): Promise< number > {
      const [ { n } ] = await db.select( { n: sql< number >`count(*)::int` } ).from( ledgerTransactions ).where( eq( ledgerTransactions.organizationId , orgId ) ) ;
      return( n ) ;
    }

    it( "nace privada, de activo, con el saldo directo y sin asiento de apertura, anclada en el espacio Personal (plan 29)" , async () => {
      const personalBeto = await db.transaction( ( tx ) => crearEspacioPersonal( beto , tx ) ) ;
      sesionDe( beto , personalBeto ) ;
      const antes = await asientosDe( personalBeto ) ;

      const res = await crearCuentaPersonalAction( { name: "Caja de Beto" , balance: 25000 , currency: "ARS" } ) ;

      expect( res.success ).toBe( true ) ;
      if( !res.success ) { return ; }

      expect( res.value.type ).toBe( "asset" ) ;
      expect( res.value.ownerUserId ).toBe( beto ) ;
      expect( res.value.organizationId ).toBe( personalBeto ) ;
      expect( res.value.balance ).toBe( 25000 ) ;
      expect( await asientosDe( personalBeto ) ).toBe( antes ) ;
      expect( await db.select().from( ledgerEntries ) ).toEqual( [] ) ;
      expect( await db.select().from( accountShares ).where( eq( accountShares.accountId , res.value.id ) ) ).toEqual( [] ) ;
    } ) ;

    it( "un viewer no puede crear (desde la organización, el servidor rechaza: plan 29, A3)" , async () => {
      sesionDe( lector , orgA ) ;

      expect( (await crearCuentaPersonalAction( { name: "Intento" } )).success ).toBe( false ) ;
    } ) ;

    it( "el código no choca con los de la ancla ni con otras personales de la ancla" , async () => {
      const personalBeto = await db.transaction( ( tx ) => crearEspacioPersonal( beto , tx ) ) ;
      await crearCuentaPersonal( { ownerUserId: beto , organizationId: personalBeto , name: "Previa" , code: "1.1.01.01" } ) ;
      sesionDe( beto , personalBeto ) ;

      const a = await crearCuentaPersonalAction( { name: "Una" } ) ;
      const b = await crearCuentaPersonalAction( { name: "Otra" } ) ;

      expect( a.success && a.value.code ).toBe( "1.1.01.02" ) ;
      expect( b.success && b.value.code ).toBe( "1.1.01.03" ) ;
    } ) ;

    it( "creaciones simultáneas terminan todas con códigos distintos" , async () => {
      const personalBeto = await db.transaction( ( tx ) => crearEspacioPersonal( beto , tx ) ) ;
      sesionDe( beto , personalBeto ) ;

      const resultados = await Promise.all( [ 1 , 2 ].map( ( i ) => crearCuentaPersonalAction( { name: `Simultánea ${i}` } ) ) ) ;
      const codigos    = resultados.filter( ( r ) => r.success ).map( ( r ) => r.success && r.value.code ) ;

      expect( new Set( codigos ).size ).toBe( codigos.length ) ;
      expect( codigos.length ).toBeGreaterThanOrEqual( 1 ) ;
    } ) ;

    it( "los CHECK de la base impiden una personal que no sea de activo o que sea caja común" , async () => {
      await expect(
        db.insert( accounts ).values( { organizationId: orgA , code: "2.1.99" , name: "Mala" , type: "liability" , ownerUserId: ana } )
      ).rejects.toThrow() ;
      await expect(
        db.update( accounts ).set( { isCommonPot: true } ).where( eq( accounts.id , personal ) )
      ).rejects.toThrow() ;
    } ) ;

    it( "obtenerMisCuentasAction devuelve las propias con su etiqueta" , async () => {
      await crearCuentaPersonal( { ownerUserId: ana , organizationId: orgA , name: "Compartida" , code: "1.1.01.03" , compartidaCon: [ orgB ] } ) ;
      await crearCuentaPersonal( { ownerUserId: beto , organizationId: orgA , name: "De Beto" , code: "1.1.01.04" } ) ;
      sesionDe( ana , orgA ) ;

      const res = await obtenerMisCuentasAction() ;

      expect( res.success ).toBe( true ) ;
      if( !res.success ) { return ; }

      expect( res.value.map( ( v ) => v.cuenta.name ) ).toEqual( [ "Compartida" , "Ahorros de Ana" ] ) ;
      expect( res.value[1].etiqueta ).toEqual( { tipo: "privada" } ) ;
      expect( res.value[0].etiqueta ).toEqual( { tipo: "compartida" , organizaciones: [ { id: orgB , nombre: "Taller" } ] } ) ;
    } ) ;
  } ) ;

  describe( "AC-7 — caja común" , () => {
    it( "guardar el acuerdo con una personal como cuenta de la caja es rechazado" , async () => {
      sesionDe( ana , orgA ) ;

      const res = await guardarAcuerdoAction( { modo: "none" , usesCommonPot: true , porcentajes: [] , cuentasCajaIds: [ personal ] } ) ;

      expect( res.success ).toBe( false ) ;
      expect( !res.success && res.error ).toBe( "Cuenta inválida para la caja común." ) ;
    } ) ;
  } ) ;

  describe( "AC-11 — salir de la organización (RN-14)" , () => {
    beforeEach( async () => {
      await membershipRepository.add( beto , orgB , "member" ) ;
    } ) ;

    async function personalDeBetoCompartida() {
      const cuenta = await crearCuentaPersonal( { ownerUserId: beto , organizationId: orgB , name: "Ahorro de Beto" , code: "1.1.01.01" , balance: 777 , compartidaCon: [ orgA , orgB ] } ) ;
      return( cuenta.id ) ;
    }

    async function comparticiones( cuentaId: string ): Promise< string[] > {
      return( ( await db.select().from( accountShares ).where( eq( accountShares.accountId , cuentaId ) ) ).map( ( f ) => f.organizationId ).sort() ) ;
    }

    it( "al quitarlo, sus comparticiones hacia esa organización desaparecen y la cuenta queda intacta" , async () => {
      const cuentaId = await personalDeBetoCompartida() ;
      sesionDe( ana , orgA ) ;

      expect( (await quitarMiembroAction( beto )).success ).toBe( true ) ;

      expect( await comparticiones( cuentaId ) ).toEqual( [ orgB ] ) ;
      const [ cuenta ] = await db.select().from( accounts ).where( eq( accounts.id , cuentaId ) ) ;
      expect( cuenta.balance ).toBe( 777 ) ;
      expect( cuenta.ownerUserId ).toBe( beto ) ;
    } ) ;

    it( "al abandonar la organización, también" , async () => {
      const cuentaId = await personalDeBetoCompartida() ;
      sesionDe( beto , orgA ) ;

      expect( (await abandonarOrganizacionAction()).success ).toBe( true ) ;

      expect( await comparticiones( cuentaId ) ).toEqual( [ orgB ] ) ;
    } ) ;

    it( "al pasar a viewer, también" , async () => {
      const cuentaId = await personalDeBetoCompartida() ;
      sesionDe( ana , orgA ) ;

      expect( (await cambiarRolAction( { userId: beto , rol: "viewer" } )).success ).toBe( true ) ;

      expect( await comparticiones( cuentaId ) ).toEqual( [ orgB ] ) ;
    } ) ;

    it( "cambiar a otro rol que no es viewer no toca las comparticiones" , async () => {
      const cuentaId = await personalDeBetoCompartida() ;
      sesionDe( ana , orgA ) ;

      expect( (await cambiarRolAction( { userId: beto , rol: "owner" } )).success ).toBe( true ) ;

      expect( await comparticiones( cuentaId ) ).toEqual( [ orgA , orgB ].sort() ) ;
    } ) ;
  } ) ;

  describe( "AC-12 — nada existente cambia" , () => {
    it( "una cuenta creada por la vía de siempre queda sin titular" , async () => {
      sesionDe( ana , orgA ) ;

      const res = await createAccountAction( { name: "Banco" , type: "asset" , balance: 300 } ) ;

      expect( res.success && res.value.ownerUserId ).toBeNull() ;
      expect( ( await accountRepository.findAll( orgA ) ).map( ( c ) => c.name ).sort() ).toEqual( [ "Banco" , "Efectivo" ] ) ;
    } ) ;

    it( "sin titular, la cuenta de siempre se ve y conserva su saldo" , async () => {
      const cuentas = await accountRepository.findAll( orgA ) ;

      expect( cuentas ).toHaveLength( 1 ) ;
      expect( cuentas[0].ownerUserId ).toBeNull() ;
      expect( cuentas[0].balance ).toBe( 1000 ) ;
    } ) ;
  } ) ;
} ) ;
