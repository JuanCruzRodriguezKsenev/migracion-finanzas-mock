/**
 * @file goalsService.test.ts
 * Pruebas de integración contra la base real de las operaciones de Metas (RFC 011 §9).
 * Cubre sin asiento, carreras, interbloqueo, divisa/tipo, estados, sugerido, abandono,
 * cuenta descubierta, Patrimonio Neto, orden, aislamiento e inmutabilidad.
 */
// Librerías externas
import { describe , it , expect , beforeEach }       from "vitest" ;
import { eq , count }                                 from "drizzle-orm" ;
import { readFileSync , readdirSync , statSync }      from "node:fs" ;
import { join }                                       from "node:path" ;

// Shared
import { db }          from "@/shared/db/client" ;
import { limpiarBase } from "@/shared/db/testCleanup" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { accounts , ledgerTransactions , ledgerEntries } from "@/features/accounting/schema.db" ;
import { createLedgerTransaction }                       from "@/features/accounting/services/accountingService" ;

// Feature: Reports
import { reportsService } from "@/features/reports/services/reportsService" ;

// Feature: Goals
import { goalsService }              from "./goalsService" ;
import { goalMovementsRepository }   from "../repositories/goalMovementsRepository" ;
import { goalMovements , goals }     from "../schema.db" ;


describe( "goalsService - integración (RFC 011 §9)" , () => {
  let orgId:   string ;
  let org2Id:  string ;
  let ctaA:    string ;   // asset ARS, 10.000.000
  let ctaB:    string ;   // asset ARS, 10.000.000
  let ctaUsd:  string ;   // asset USD
  let ctaPas:  string ;   // liability ARS
  let ctaGasto: string ;  // expense ARS
  let ctaOtra: string ;   // asset ARS de otra organización

  async function crearCuenta( org: string , code: string , type: string , balance: number , currency = "ARS" ): Promise< string > {
    const [ c ] = await db
      .insert( accounts )
      .values( { organizationId: org , code , name: `Cuenta ${code}` , type , balance , currency } )
      .returning() ;
    return( c.id ) ;
  }

  async function nuevaMeta( target = 100000000 , extra: Record< string , unknown > = {} ): Promise< string > {
    const r = await goalsService.crear( { orgId , name: "Meta" , currency: "ARS" , targetAmount: target , ...extra } ) ;
    if( !r.success ) {
      throw( new Error( r.error ) ) ;
    }
    return( r.value.id ) ;
  }

  async function reservado( cuenta: string ): Promise< number > {
    const r = await goalMovementsRepository.sumReservedByAccount( orgId , [ cuenta ] ) ;
    return( r[ cuenta ] ?? 0 ) ;
  }

  beforeEach( async () => {
    await limpiarBase() ;

    const [ o1 ] = await db.insert( organizations ).values( { name: "Org Metas" , slug: "org-metas" } ).returning() ;
    const [ o2 ] = await db.insert( organizations ).values( { name: "Org Otra" , slug: "org-otra" } ).returning() ;
    orgId  = o1.id ;
    org2Id = o2.id ;

    ctaA     = await crearCuenta( orgId  , "1.1.01.01" , "asset"     , 10000000 ) ;
    ctaB     = await crearCuenta( orgId  , "1.1.01.02" , "asset"     , 10000000 ) ;
    ctaUsd   = await crearCuenta( orgId  , "1.1.01.03" , "asset"     , 10000000 , "USD" ) ;
    ctaPas   = await crearCuenta( orgId  , "2.1.01.01" , "liability" , -5000000 ) ;
    ctaGasto = await crearCuenta( orgId  , "5.1.01.01" , "expense"   , 0 ) ;
    ctaOtra  = await crearCuenta( org2Id , "1.1.01.01" , "asset"     , 10000000 ) ;
  } ) ;

  it( "AC-2: aportar baja el libre y NO genera asientos ni toca balances" , async () => {
    const meta = await nuevaMeta() ;
    const [ { n: txAntes } ]  = await db.select( { n: count() } ).from( ledgerTransactions ) ;
    const [ { n: entAntes } ] = await db.select( { n: count() } ).from( ledgerEntries ) ;

    const r = await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 3000000 } ) ;
    expect( r.success ).toBe( true ) ;

    const [ { n: txDespues } ]  = await db.select( { n: count() } ).from( ledgerTransactions ) ;
    const [ { n: entDespues } ] = await db.select( { n: count() } ).from( ledgerEntries ) ;
    expect( txDespues ).toBe( txAntes ) ;
    expect( entDespues ).toBe( entAntes ) ;

    const [ cuenta ] = await db.select().from( accounts ).where( eq( accounts.id , ctaA ) ) ;
    expect( cuenta.balance ).toBe( 10000000 ) ;

    const res = await goalsService.reservadoPorCuenta( orgId ) ;
    expect( res[ ctaA ] ).toEqual( { reservado: 3000000 , libre: 7000000 } ) ;
    expect( res[ ctaB ] ).toBeUndefined() ;
  } ) ;

  it( "AC-3: aportar de más se rechaza con el libre a la vista; una cuenta con libre negativo rechaza todo" , async () => {
    const meta = await nuevaMeta() ;
    await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 9000000 } ) ;

    const r = await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 1000001 } ) ;
    expect( r.success ).toBe( false ) ;
    expect( r.error ).toContain( "saldo libre" ) ;
    expect( r.error ).toMatch( /10\.000,00/ ) ;
    expect( await reservado( ctaA ) ).toBe( 9000000 ) ;

    // Libre exacto se acepta
    expect( ( await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 1000000 } ) ).success ).toBe( true ) ;
    // Libre cero rechaza cualquier monto
    expect( ( await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 1 } ) ).success ).toBe( false ) ;
  } ) ;

  it( "AC-4: carrera de dos aportes que superan el libre — uno gana (20 corridas)" , async () => {
    let falladas = 0 ;
    for( let i = 0 ; i < 20 ; i++ ) {
      await db.delete( goalMovements ) ;
      await db.delete( goals ) ;
      const m1 = await nuevaMeta() ;
      const m2 = await nuevaMeta() ;

      const [ a , b ] = await Promise.all( [
        goalsService.aportar( { orgId , goalId: m1 , accountId: ctaA , amount: 8000000 } ) ,
        goalsService.aportar( { orgId , goalId: m2 , accountId: ctaA , amount: 8000000 } )
      ] ) ;

      const aceptados = [ a , b ].filter( ( x ) => { return( x.success ) ; } ).length ;
      const reserv    = await reservado( ctaA ) ;
      if( (aceptados !== 1) || (reserv !== 8000000) ) {
        falladas++ ;
      }
    }
    console.info( `carrera de aportes: 20 corridas, ${falladas} fallidas` ) ;
    expect( falladas ).toBe( 0 ) ;
  } ) ;

  it( "AC-4 (misma meta): dos aportes simultáneos a la misma meta y cuenta tampoco superan el libre" , async () => {
    const meta = await nuevaMeta() ;
    const res = await Promise.all( [
      goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 8000000 } ) ,
      goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 8000000 } )
    ] ) ;
    expect( res.filter( ( x ) => { return( x.success ) ; } ).length ).toBe( 1 ) ;
    expect( await reservado( ctaA ) ).toBe( 8000000 ) ;
  } ) ;

  it( "interbloqueo: metas distintas a la misma cuenta, y aporte contra retiro de la misma meta, terminan sin deadlock" , async () => {
    for( let i = 0 ; i < 10 ; i++ ) {
      const m1 = await nuevaMeta() ;
      const m2 = await nuevaMeta() ;
      await goalsService.aportar( { orgId , goalId: m1 , accountId: ctaB , amount: 1000000 } ) ;

      const resultados = await Promise.allSettled( [
        goalsService.aportar( { orgId , goalId: m1 , accountId: ctaA , amount: 100000 } ) ,
        goalsService.aportar( { orgId , goalId: m2 , accountId: ctaA , amount: 100000 } ) ,
        goalsService.aportar( { orgId , goalId: m1 , accountId: ctaB , amount: 100000 } ) ,
        goalsService.retirar( { orgId , goalId: m1 , accountId: ctaB , amount: 500000 } ) ,
      ] ) ;

      for( const r of resultados ) {
        expect( r.status ).toBe( "fulfilled" ) ;
        if( r.status === "fulfilled" ) {
          expect( r.value.success ).toBe( true ) ;
        }
      }
    }
  } ) ;

  it( "AC-5: divisa distinta, cuenta que no es de activo y cuenta de otra organización se rechazan" , async () => {
    const meta = await nuevaMeta() ;
    expect( ( await goalsService.aportar( { orgId , goalId: meta , accountId: ctaUsd , amount: 100 } ) ).success ).toBe( false ) ;
    expect( ( await goalsService.aportar( { orgId , goalId: meta , accountId: ctaPas , amount: 100 } ) ).success ).toBe( false ) ;
    expect( ( await goalsService.aportar( { orgId , goalId: meta , accountId: ctaGasto , amount: 100 } ) ).success ).toBe( false ) ;
    expect( ( await goalsService.aportar( { orgId , goalId: meta , accountId: ctaOtra , amount: 100 } ) ).success ).toBe( false ) ;
    const [ { n } ] = await db.select( { n: count() } ).from( goalMovements ) ;
    expect( n ).toBe( 0 ) ;
  } ) ;

  it( "AC-7: no se retira más de lo apartado por esa meta en esa cuenta" , async () => {
    const meta = await nuevaMeta() ;
    await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 2000000 } ) ;
    await goalsService.aportar( { orgId , goalId: meta , accountId: ctaB , amount: 1000000 } ) ;

    const mal = await goalsService.retirar( { orgId , goalId: meta , accountId: ctaA , amount: 2500000 } ) ;
    expect( mal.success ).toBe( false ) ;
    expect( mal.error ).toContain( "apartado" ) ;

    const sinPlata = await goalsService.retirar( { orgId , goalId: meta , accountId: ctaUsd , amount: 1 } ) ;
    expect( sinPlata.success ).toBe( false ) ;

    expect( ( await goalsService.retirar( { orgId , goalId: meta , accountId: ctaA , amount: 2000000 } ) ).success ).toBe( true ) ;
    expect( await reservado( ctaA ) ).toBe( 0 ) ;
    expect( await reservado( ctaB ) ).toBe( 1000000 ) ;
  } ) ;

  it( "AC-8/9/10: se completa, se reabre por retiro y por suba de objetivo, y admite aportes estando completada" , async () => {
    const meta = await nuevaMeta( 3000000 ) ;

    const r1 = await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 3000000 } ) ;
    expect( r1.success && r1.value.status ).toBe( "completed" ) ;
    const [ g1 ] = await db.select().from( goals ).where( eq( goals.id , meta ) ) ;
    expect( g1.completedAt ).not.toBeNull() ;

    // AC-10: aportar a una completada, el excedente cuenta
    const r2 = await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 500000 } ) ;
    expect( r2.success && r2.value.ahorrado ).toBe( 3500000 ) ;
    expect( r2.success && r2.value.status ).toBe( "completed" ) ;

    // Retiro que la deja bajo el objetivo la reabre
    const r3 = await goalsService.retirar( { orgId , goalId: meta , accountId: ctaA , amount: 600000 } ) ;
    expect( r3.success && r3.value.status ).toBe( "active" ) ;
    const [ g3 ] = await db.select().from( goals ).where( eq( goals.id , meta ) ) ;
    expect( g3.completedAt ).toBeNull() ;

    // Vuelve a completarse y se reabre subiendo el objetivo
    await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 100000 } ) ;
    const e = await goalsService.editar( { orgId , goalId: meta , name: "Meta" , targetAmount: 9000000 , priority: "normal" } ) ;
    expect( e.success && e.value.status ).toBe( "active" ) ;

    // Y bajando el objetivo bajo lo ahorrado, se completa
    const e2 = await goalsService.editar( { orgId , goalId: meta , name: "Meta" , targetAmount: 1000000 , priority: "normal" } ) ;
    expect( e2.success && e2.value.status ).toBe( "completed" ) ;
  } ) ;

  it( "editar no cambia la divisa y rechaza metas ajenas" , async () => {
    const meta = await nuevaMeta() ;
    const e = await goalsService.editar( { orgId , goalId: meta , name: "Otro" , targetAmount: 5 , priority: "high" } ) ;
    expect( e.success && e.value.currency ).toBe( "ARS" ) ;
    expect( e.success && e.value.priority ).toBe( "high" ) ;
    const ajeno = await goalsService.editar( { orgId: org2Id , goalId: meta , name: "Hack" , targetAmount: 5 , priority: "high" } ) ;
    expect( ajeno.success ).toBe( false ) ;
  } ) ;

  it( "AC-11: sugerido — mes en curso, 10 meses, vencida, sin fecha y restante ≤ 0" , async () => {
    const hoy = new Date( "2026-10-15T15:00:00Z" ) ;
    const mes   = await nuevaMeta( 5000000  , { targetDate: "2026-10-31" } ) ;
    const diez  = await nuevaMeta( 10000001 , { targetDate: "2027-08-20" } ) ;
    const venc  = await nuevaMeta( 5000000  , { targetDate: "2026-09-01" } ) ;
    const sin   = await nuevaMeta( 5000000 ) ;

    const v = await goalsService.vista( { orgId , hoy } ) ;
    const por = ( id: string ) => { return( v.metas.find( ( m ) => { return( m.goal.id === id ) ; } )! ) ; } ;

    expect( por( mes ).mesesRestantes ).toBe( 1 ) ;
    expect( por( mes ).aporteSugerido ).toBe( 5000000 ) ;
    expect( por( diez ).mesesRestantes ).toBe( 10 ) ;
    expect( por( diez ).aporteSugerido ).toBe( 1000001 ) ;
    expect( por( venc ).vencida ).toBe( true ) ;
    expect( por( venc ).aporteSugerido ).toBeNull() ;
    expect( por( sin ).aporteSugerido ).toBeNull() ;
    expect( por( sin ).vencida ).toBe( false ) ;

    await goalsService.aportar( { orgId , goalId: diez , accountId: ctaA , amount: 4000000 } ) ;
    const v2 = await goalsService.vista( { orgId , hoy } ) ;
    expect( v2.metas.find( ( m ) => { return( m.goal.id === diez ) ; } )!.aporteSugerido ).toBe( 600001 ) ;
  } ) ;

  it( "AC-12: abandonar devuelve a cada cuenta, deja el historial y la meta sale de la vista; sin plata también" , async () => {
    const meta = await nuevaMeta() ;
    await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 2000000 } ) ;
    await goalsService.aportar( { orgId , goalId: meta , accountId: ctaB , amount: 3000000 } ) ;

    const r = await goalsService.abandonar( { orgId , goalId: meta } ) ;
    expect( r.success && r.value.status ).toBe( "abandoned" ) ;
    expect( await reservado( ctaA ) ).toBe( 0 ) ;
    expect( await reservado( ctaB ) ).toBe( 0 ) ;

    const mov = await db.select().from( goalMovements ).where( eq( goalMovements.goalId , meta ) ) ;
    expect( mov.length ).toBe( 4 ) ;
    expect( mov.filter( ( m ) => { return( m.kind === "withdrawal" ) ; } ).length ).toBe( 2 ) ;

    const v = await goalsService.vista( { orgId } ) ;
    expect( v.metas.find( ( m ) => { return( m.goal.id === meta ) ; } ) ).toBeUndefined() ;

    // Abandonada: no admite aportes ni retiros ni más abandonos
    expect( ( await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 1 } ) ).success ).toBe( false ) ;
    expect( ( await goalsService.retirar( { orgId , goalId: meta , accountId: ctaA , amount: 1 } ) ).success ).toBe( false ) ;
    expect( ( await goalsService.abandonar( { orgId , goalId: meta } ) ).success ).toBe( false ) ;

    const vacia = await nuevaMeta() ;
    expect( ( await goalsService.abandonar( { orgId , goalId: vacia } ) ).success ).toBe( true ) ;
  } ) ;

  it( "AC-13: un gasto que deja la cuenta descubierta no falla, y la cuenta rechaza aportes nuevos" , async () => {
    const meta = await nuevaMeta() ;
    await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 8000000 } ) ;

    const gasto = await createLedgerTransaction( {
      organizationId: orgId ,
      description:    "Gasto grande" ,
      occurredAt:     new Date() ,
      entries: [
        { accountId: ctaGasto , debit: 5000000 , credit: 0       , currency: "ARS" } ,
        { accountId: ctaA     , debit: 0       , credit: 5000000 , currency: "ARS" }
      ]
    } ) ;
    expect( gasto.success ).toBe( true ) ;

    const res = await goalsService.reservadoPorCuenta( orgId ) ;
    expect( res[ ctaA ].libre ).toBe( -3000000 ) ;

    const r = await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 1 } ) ;
    expect( r.success ).toBe( false ) ;
    expect( r.error ).toContain( "saldo libre" ) ;
  } ) ;

  it( "AC-14: el Patrimonio Neto no cambia al aportar" , async () => {
    const meta = await nuevaMeta() ;
    const antes = await reportsService.armarReporte( { orgId , currency: "ARS" } ) ;
    await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 4000000 } ) ;
    const despues = await reportsService.armarReporte( { orgId , currency: "ARS" } ) ;

    expect( despues.patrimonio.neto ).toBe( antes.patrimonio.neto ) ;
    expect( despues.patrimonio.activos ).toBe( antes.patrimonio.activos ) ;
  } ) ;

  it( "RN-20: orden — prioritarias, fecha más próxima (sin fecha al final) y nombre" , async () => {
    const mk = async ( name: string , extra: Record< string , unknown > ) => {
      const r = await goalsService.crear( { orgId , name , currency: "ARS" , targetAmount: 1000 , ...extra } ) ;
      return( r.success ? r.value.id : "" ) ;
    } ;
    await mk( "D normal sin fecha"   , {} ) ;
    await mk( "C normal lejana"      , { targetDate: "2028-01-01" } ) ;
    await mk( "B normal cercana"     , { targetDate: "2027-01-01" } ) ;
    await mk( "A prioritaria sin fecha" , { priority: "high" } ) ;
    await mk( "A2 normal sin fecha"  , {} ) ;

    const v = await goalsService.vista( { orgId } ) ;
    expect( v.metas.map( ( m ) => { return( m.goal.name ) ; } ) ).toEqual( [
      "A prioritaria sin fecha" , "B normal cercana" , "C normal lejana" , "A2 normal sin fecha" , "D normal sin fecha"
    ] ) ;
  } ) ;

  it( "vista: indicadores por divisa, filtros y cuentas compatibles con su libre" , async () => {
    const m1 = await nuevaMeta( 4000000 ) ;
    await nuevaMeta( 6000000 ) ;
    await goalsService.crear( { orgId , name: "Dólares" , currency: "USD" , targetAmount: 999 } ) ;
    await goalsService.aportar( { orgId , goalId: m1 , accountId: ctaA , amount: 4000000 } ) ;

    const v = await goalsService.vista( { orgId , currency: "ARS" } ) ;
    expect( v.currency ).toBe( "ARS" ) ;
    expect( v.divisas ).toEqual( [ "ARS" , "USD" ] ) ;
    expect( v.indicadores ).toEqual( {
      cantidad: 2 , objetivoTotal: 10000000 , ahorradoTotal: 4000000 , porcentajeTotal: 40 , completadas: 1 , porCompletar: 1
    } ) ;
    expect( v.cuentas.map( ( c ) => { return( c.id ) ; } ).sort() ).toEqual( [ ctaA , ctaB ].sort() ) ;
    expect( v.cuentas.find( ( c ) => { return( c.id === ctaA ) ; } )!.libre ).toBe( 6000000 ) ;

    expect( ( await goalsService.vista( { orgId , currency: "ARS" , filter: "completed" } ) ).metas.length ).toBe( 1 ) ;
    expect( ( await goalsService.vista( { orgId , currency: "ARS" , filter: "active" } ) ).metas.length ).toBe( 1 ) ;
    expect( ( await goalsService.vista( { orgId , currency: "USD" } ) ).indicadores.cantidad ).toBe( 1 ) ;
  } ) ;

  it( "aislamiento: otra organización no ve ni modifica metas ni reservas" , async () => {
    const meta = await nuevaMeta() ;
    await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount: 1000000 } ) ;

    const vOtra = await goalsService.vista( { orgId: org2Id } ) ;
    expect( vOtra.metas.length ).toBe( 0 ) ;
    expect( await goalsService.reservadoPorCuenta( org2Id ) ).toEqual( {} ) ;

    expect( ( await goalsService.aportar( { orgId: org2Id , goalId: meta , accountId: ctaOtra , amount: 1 } ) ).success ).toBe( false ) ;
    expect( ( await goalsService.retirar( { orgId: org2Id , goalId: meta , accountId: ctaA , amount: 1 } ) ).success ).toBe( false ) ;
    expect( ( await goalsService.abandonar( { orgId: org2Id , goalId: meta } ) ).success ).toBe( false ) ;
    expect( await reservado( ctaA ) ).toBe( 1000000 ) ;
  } ) ;

  it( "montos inválidos en el servicio: 0, negativo y decimal" , async () => {
    const meta = await nuevaMeta() ;
    for( const amount of [ 0 , -5 , 10.5 ] ) {
      expect( ( await goalsService.aportar( { orgId , goalId: meta , accountId: ctaA , amount } ) ).success ).toBe( false ) ;
      expect( ( await goalsService.retirar( { orgId , goalId: meta , accountId: ctaA , amount } ) ).success ).toBe( false ) ;
    }
  } ) ;

  it( "inmutabilidad: ningún código de producción hace UPDATE/DELETE sobre goal_movements y el repositorio no los expone" , () => {
    expect( Object.keys( goalMovementsRepository ).sort() ).toEqual( [ "history" , "insert" , "sumReservedByAccount" , "sumSignedByGoal" , "sumSignedByGoalAndAccount" ] ) ;

    const recorrer = ( dir: string ): string[] => {
      return( readdirSync( dir ).flatMap( ( n ) => {
        const p = join( dir , n ) ;
        if( statSync( p ).isDirectory() ) {
          return( recorrer( p ) ) ;
        }
        return( ( p.endsWith( ".ts" ) && !p.endsWith( ".test.ts" ) ) ? [ p ] : [] ) ;
      } ) ) ;
    } ;

    const raiz = join( process.cwd() , "src" ) ;
    for( const archivo of recorrer( raiz ) ) {
      // La limpieza de la base de tests es la única excepción: vacía todas las tablas
      if( archivo.endsWith( "testCleanup.ts" ) ) {
        continue ;
      }
      const lineas = readFileSync( archivo , "utf8" ).split( "\n" ) ;
      for( const l of lineas ) {
        expect( /\.(update|delete)\(\s*goalMovements\b/.test( l ) ).toBe( false ) ;
      }
    }
  } ) ;
} ) ;
