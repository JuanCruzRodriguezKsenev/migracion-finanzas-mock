// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                   from "next-auth" ;
import type { Session }                                       from "next-auth" ;
import { eq , and }                                           from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia , crearOrganizacionRica , conteosDe } from "@/shared/db/testFixtures" ;
import { limpiarBase }                                                  from "@/shared/db/testCleanup" ;
import { db }                                                           from "@/shared/db/client" ;

// Feature: Accounting
import { createLedgerTransactionAction }                      from "@/features/accounting/actions/accountingActions" ;
import { createLedgerTransaction }                            from "@/features/accounting/services/accountingService" ;
import { accounts , ledgerTransactions }                      from "@/features/accounting/schema.db" ;

// Feature: Auth
import { organizations , memberships } from "@/features/auth/schema.db" ;
import { membershipRepository }       from "@/features/auth/repositories/membershipRepository" ;
import { organizationRepository }     from "@/features/auth/repositories/organizationRepository" ;

// Feature: Notifications
import { notifications } from "@/features/notifications/schema.db" ;

// Feature: Splits
import { obtenerAcuerdoAction , guardarAcuerdoAction , declararAporteAction , previsualizarRepartoAction } from "./actions/acuerdoActions" ;
import { organizationAgreements , agreementPercentages , expenseSplits , monthlyContributions }          from "./schema.db" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

function sesionDe( userId: string , organizationId: string ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role: "owner" } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

describe( "reparto de gastos (plan 19)" , () => {
  let orgA:    string ;
  let orgB:    string ;
  let ana:     string ; // owner, carga
  let beto:    string ; // member
  let lector:  string ; // viewer
  let ownerB:  string ;
  let cajaId:  string ;
  let ahorroId: string ;
  let gastoId: string ;
  let sueldoId: string ;

  function gasto( monto = 10001 , extra: Record< string , unknown > = {} ) {
    return( {
      description: "Súper" ,
      entries: [
        { accountId: gastoId , debit: monto , credit: 0     } ,
        { accountId: cajaId  , debit: 0     , credit: monto } ,
      ] ,
      ...extra ,
    } ) ;
  }

  async function acuerdo5050() {
    sesionDe( ana , orgA ) ;
    const res = await guardarAcuerdoAction( { modo: "fixed_percentages" , usesCommonPot: false , porcentajes: [ { userId: ana , percentageBp: 5000 } , { userId: beto , percentageBp: 5000 } ] } ) ;
    expect( res.success ).toBe( true ) ;
  }

  async function deudas() {
    return( await db.select().from( expenseSplits ).where( eq( expenseSplits.organizationId , orgA ) ) ) ;
  }

  async function avisos( userId: string , tipo: string ) {
    return( await db.select().from( notifications ).where( and( eq( notifications.recipientUserId , userId ) , eq( notifications.type , tipo ) ) ) ) ;
  }

  beforeEach( async () => {
    vi.restoreAllMocks() ;
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-reparto"   } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-reparto" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;

    ana    = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "ana@ejemplo.com"    , name: "Ana"  , role: "owner"  } ) ).id ;
    beto   = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "beto@ejemplo.com"   , name: "Beto" , role: "member" } ) ).id ;
    lector = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "lector@ejemplo.com" , role: "viewer" } ) ).id ;
    ownerB = ( await crearUsuarioConMembresia( { organizationId: orgB , email: "ownerb@ejemplo.com" , role: "owner"  } ) ).id ;

    const cuentas = await db
      .insert( accounts )
      .values( [
        { organizationId: orgA , code: "1.1.01" , name: "Caja"   , type: "asset"   , balance: 10000000 } ,
        { organizationId: orgA , code: "1.1.02" , name: "Ahorro" , type: "asset"   , balance: 0        } ,
        { organizationId: orgA , code: "5.1.01" , name: "Comida" , type: "expense" , balance: 0        } ,
        { organizationId: orgA , code: "4.1.01" , name: "Sueldo" , type: "revenue" , balance: 0        } ,
      ] )
      .returning() ;
    cajaId   = cuentas[0].id ;
    ahorroId = cuentas[1].id ;
    gastoId  = cuentas[2].id ;
    sueldoId = cuentas[3].id ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "AC-8/AC-9 de punta a punta: $100,01 con acuerdo 50/50 deja una deuda de $50,00 y avisa a Beto, no a Ana" , async () => {
    await acuerdo5050() ;
    sesionDe( ana , orgA ) ;

    const res = await createLedgerTransactionAction( gasto( 10001 ) ) ;

    expect( res.success ).toBe( true ) ;
    if( !res.success ) { return ; }

    expect( res.value.holderUserId ).toBe( ana ) ;

    const filas = await deudas() ;
    expect( filas ).toHaveLength( 1 ) ;
    expect( filas[0] ).toMatchObject( { debtorUserId: beto , amountInCents: 5000 , currency: "ARS" , transactionId: res.value.id } ) ;

    const deBeto = await avisos( beto , "debt_created" ) ;
    expect( deBeto ).toHaveLength( 1 ) ;
    expect( deBeto[0] ).toMatchObject( { amountInCents: 5000 , currency: "ARS" , actorUserId: ana , transactionId: res.value.id } ) ;
    expect( await avisos( ana , "debt_created" ) ).toHaveLength( 0 ) ;
  } ) ;

  it( "a nombre de otro: Ana (owner) carga a nombre de Beto, el titular es Beto, la deuda es de Ana y el autor no se avisa a sí misma" , async () => {
    await acuerdo5050() ;
    sesionDe( ana , orgA ) ;

    const res = await createLedgerTransactionAction( gasto( 10000 , { holderUserId: beto } ) ) ;

    expect( res.success ).toBe( true ) ;
    const filas = await deudas() ;
    expect( filas ).toHaveLength( 1 ) ;
    expect( filas[0].debtorUserId ).toBe( ana ) ;
    expect( await avisos( ana , "debt_created" ) ).toHaveLength( 0 ) ;
  } ) ;

  it( "RN-7: sin titular y con reparto activo, el titular es el autor; sin reparto, sigue en nulo" , async () => {
    sesionDe( ana , orgA ) ;
    const sinReparto = await createLedgerTransactionAction( gasto() ) ;
    expect( sinReparto.success && sinReparto.value.holderUserId ).toBeNull() ;
    expect( await deudas() ).toHaveLength( 0 ) ;

    await acuerdo5050() ;
    sesionDe( ana , orgA ) ;
    const conReparto = await createLedgerTransactionAction( gasto() ) ;
    expect( conReparto.success && conReparto.value.holderUserId ).toBe( ana ) ;
  } ) ;

  it( "AC-12: cambiar el acuerdo no toca el gasto viejo; el nuevo usa 70/30; todos menos el actor reciben el aviso; sin cambios no hay aviso" , async () => {
    await acuerdo5050() ;
    sesionDe( ana , orgA ) ;
    const viejo = await createLedgerTransactionAction( gasto( 10000 ) ) ;
    expect( viejo.success ).toBe( true ) ;

    // El aviso del primer guardado ya existe (el acuerdo pasó de «sin reparto» a 50/50)
    const antes = ( await avisos( beto , "agreement_changed" ) ).length ;

    const res = await guardarAcuerdoAction( { modo: "fixed_percentages" , usesCommonPot: false , porcentajes: [ { userId: ana , percentageBp: 7000 } , { userId: beto , percentageBp: 3000 } ] } ) ;
    expect( res.success ).toBe( true ) ;

    const nuevo = await createLedgerTransactionAction( gasto( 10000 ) ) ;
    expect( nuevo.success ).toBe( true ) ;

    const filas = await deudas() ;
    const deViejo = filas.find( ( f ) => viejo.success && (f.transactionId === viejo.value.id) ) ;
    const deNuevo = filas.find( ( f ) => nuevo.success && (f.transactionId === nuevo.value.id) ) ;
    expect( deViejo?.amountInCents ).toBe( 5000 ) ;
    expect( deNuevo?.amountInCents ).toBe( 3000 ) ;

    expect( ( await avisos( beto   , "agreement_changed" ) ).length ).toBe( antes + 1 ) ;
    expect( ( await avisos( lector , "agreement_changed" ) ).length ).toBe( antes + 1 ) ;
    expect( await avisos( ana , "agreement_changed" ) ).toHaveLength( 0 ) ;

    // Guardar lo mismo no avisa
    const igual = await guardarAcuerdoAction( { modo: "fixed_percentages" , usesCommonPot: false , porcentajes: [ { userId: ana , percentageBp: 7000 } , { userId: beto , percentageBp: 3000 } ] } ) ;
    expect( igual.success ).toBe( true ) ;
    expect( ( await avisos( beto , "agreement_changed" ) ).length ).toBe( antes + 1 ) ;
  } ) ;

  it( "AC-13: porcentajes 50 y 40 se rechazan con «Suman 90 %: faltan 10» y el acuerdo anterior sigue intacto" , async () => {
    await acuerdo5050() ;
    const filasAntes = await db.select().from( agreementPercentages ).where( eq( agreementPercentages.organizationId , orgA ) ) ;

    const res = await guardarAcuerdoAction( { modo: "fixed_percentages" , usesCommonPot: false , porcentajes: [ { userId: ana , percentageBp: 5000 } , { userId: beto , percentageBp: 4000 } ] } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ) { expect( res.error ).toBe( "Suman 90 %: faltan 10" ) ; }

    const filasDespues = await db.select().from( agreementPercentages ).where( eq( agreementPercentages.organizationId , orgA ) ) ;
    expect( filasDespues.map( ( f ) => [ f.userId , f.percentageBp ] ).sort() ).toEqual( filasAntes.map( ( f ) => [ f.userId , f.percentageBp ] ).sort() ) ;
  } ) ;

  it( "A6: los decimales cuentan (33,33 + 33,33 + 33,33 suman 99,99) y la suma de más se informa" , async () => {
    sesionDe( ana , orgA ) ;
    const otro = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "caro@ejemplo.com" , role: "member" } ) ).id ;

    const corto = await guardarAcuerdoAction( { modo: "fixed_percentages" , usesCommonPot: false , porcentajes: [ { userId: ana , percentageBp: 3333 } , { userId: beto , percentageBp: 3333 } , { userId: otro , percentageBp: 3333 } ] } ) ;
    expect( !corto.success && corto.error ).toBe( "Suman 99,99 %: faltan 0,01" ) ;

    const justo = await guardarAcuerdoAction( { modo: "fixed_percentages" , usesCommonPot: false , porcentajes: [ { userId: ana , percentageBp: 3333 } , { userId: beto , percentageBp: 3333 } , { userId: otro , percentageBp: 3334 } ] } ) ;
    expect( justo.success ).toBe( true ) ;

    const demas = await guardarAcuerdoAction( { modo: "fixed_percentages" , usesCommonPot: false , porcentajes: [ { userId: ana , percentageBp: 6000 } , { userId: beto , percentageBp: 6000 } ] } ) ;
    expect( !demas.success && demas.error ).toBe( "Suman 120 %: sobran 20" ) ;
  } ) ;

  it( "AC-14: una cuenta marcada como caja común no genera deuda" , async () => {
    await acuerdo5050() ;
    await db.update( accounts ).set( { isCommonPot: true } ).where( eq( accounts.id , cajaId ) ) ;
    sesionDe( ana , orgA ) ;

    const res = await createLedgerTransactionAction( gasto() ) ;

    expect( res.success ).toBe( true ) ;
    expect( await deudas() ).toHaveLength( 0 ) ;
    expect( await avisos( beto , "debt_created" ) ).toHaveLength( 0 ) ;
  } ) ;

  it( "AC-15: un titular viewer no genera deuda" , async () => {
    await acuerdo5050() ;
    sesionDe( ana , orgA ) ;

    const res = await createLedgerTransactionAction( gasto( 10000 , { holderUserId: lector } ) ) ;

    expect( res.success ).toBe( true ) ;
    expect( await deudas() ).toHaveLength( 0 ) ;
  } ) ;

  it( "AC-16: una organización sin fila de acuerdo no reparte y la vista previa responde aplica: false" , async () => {
    sesionDe( ana , orgA ) ;
    expect( await db.select().from( organizationAgreements ) ).toHaveLength( 0 ) ;

    const res = await createLedgerTransactionAction( gasto() ) ;
    expect( res.success ).toBe( true ) ;
    expect( await deudas() ).toHaveLength( 0 ) ;

    const previa = await previsualizarRepartoAction( { tipo: "expense" , montoEnCentavos: 10001 , currency: "ARS" , accountIds: [ cajaId , gastoId ] } ) ;
    expect( previa.success && previa.value.aplica ).toBe( false ) ;
    expect( previa.success && previa.value.motivo ).toBe( "modo_none" ) ;
  } ) ;

  it( "la vista previa usa el mismo algoritmo que la carga: muestra lo que se fija (RN-17)" , async () => {
    await acuerdo5050() ;
    sesionDe( ana , orgA ) ;

    const previa = await previsualizarRepartoAction( { tipo: "expense" , montoEnCentavos: 10001 , currency: "ARS" , accountIds: [ cajaId , gastoId ] } ) ;
    expect( previa.success ).toBe( true ) ;
    if( !previa.success ) { return ; }

    expect( previa.value.aplica ).toBe( true ) ;
    const deBeto = previa.value.partes.find( ( p ) => (p.userId === beto) ) ;
    const deAna  = previa.value.partes.find( ( p ) => (p.userId === ana) ) ;
    expect( deBeto ).toMatchObject( { montoEnCentavos: 5000 , esDeuda: true , porcentajeBp: 5000 , nombre: "Beto" } ) ;
    expect( deAna  ).toMatchObject( { montoEnCentavos: 5001 , esDeuda: false } ) ;
    expect( previa.value.partes.find( ( p ) => (p.userId === lector) ) ).toBeUndefined() ;

    // Sólo lee
    expect( await deudas() ).toHaveLength( 0 ) ;
    expect( await db.select().from( ledgerTransactions ).where( eq( ledgerTransactions.organizationId , orgA ) ) ).toHaveLength( 0 ) ;
  } ) ;

  it( "S-S: quien entra sin fila de porcentaje cuenta 0 %; si alguien con porcentaje pasa a viewer el acuerdo queda desactualizado, la carga se rechaza sin guardar nada y se arregla editando" , async () => {
    await acuerdo5050() ;
    const nuevo = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "nuevo@ejemplo.com" , name: "Nuevo" , role: "member" } ) ).id ;
    sesionDe( ana , orgA ) ;

    // El que entra después no debe nada hasta que un owner lo incluya; el acuerdo sigue sumando 100 %
    const previaNuevo = await previsualizarRepartoAction( { tipo: "expense" , montoEnCentavos: 10000 , currency: "ARS" , accountIds: [ cajaId , gastoId ] } ) ;
    expect( previaNuevo.success && previaNuevo.value.desactualizado ).toBe( false ) ;
    expect( previaNuevo.success && previaNuevo.value.partes.find( ( p ) => (p.userId === nuevo) )?.montoEnCentavos ).toBe( 0 ) ;

    // Beto (50 %) pasa a viewer: los miembros actuales suman 50 %
    await db.update( memberships ).set( { role: "viewer" } ).where( and( eq( memberships.userId , beto ) , eq( memberships.organizationId , orgA ) ) ) ;

    const previa = await previsualizarRepartoAction( { tipo: "expense" , montoEnCentavos: 10000 , currency: "ARS" , accountIds: [ cajaId , gastoId ] } ) ;
    expect( previa.success && previa.value.desactualizado ).toBe( true ) ;

    const res = await createLedgerTransactionAction( gasto( 10000 ) ) ;
    expect( res.success ).toBe( false ) ;
    if( !res.success ) { expect( res.error ).toBe( "El acuerdo está desactualizado: un owner debe revisarlo." ) ; }

    expect( await db.select().from( ledgerTransactions ).where( eq( ledgerTransactions.organizationId , orgA ) ) ).toHaveLength( 0 ) ;
    const [ caja ] = await db.select().from( accounts ).where( eq( accounts.id , cajaId ) ) ;
    expect( caja.balance ).toBe( 10000000 ) ;
    expect( await avisos( nuevo , "debt_created" ) ).toHaveLength( 0 ) ;

    const guardado = await guardarAcuerdoAction( { modo: "fixed_percentages" , usesCommonPot: false , porcentajes: [ { userId: ana , percentageBp: 6000 } , { userId: nuevo , percentageBp: 4000 } ] } ) ;
    expect( guardado.success ).toBe( true ) ;

    const otraVez = await createLedgerTransactionAction( gasto( 10000 ) ) ;
    expect( otraVez.success ).toBe( true ) ;
    expect( ( await deudas() ).map( ( d ) => [ d.debtorUserId , d.amountInCents ] ) ).toEqual( [ [ nuevo , 4000 ] ] ) ;
  } ) ;

  it( "los movimientos generados (sin aplicarReparto), un ingreso y una transferencia manuales no dejan deuda ni aviso de deuda" , async () => {
    await acuerdo5050() ;
    sesionDe( ana , orgA ) ;

    // Generado: llama al servicio directo, sin el parámetro, aunque traiga autor
    const generado = await createLedgerTransaction( { organizationId: orgA , description: "Cuota" , createdByUserId: ana , entries: [ { accountId: gastoId , debit: 5000 , credit: 0 } , { accountId: cajaId , debit: 0 , credit: 5000 } ] } ) ;
    expect( generado.success ).toBe( true ) ;

    const ingreso = await createLedgerTransactionAction( { description: "Sueldo" , entries: [ { accountId: cajaId , debit: 5000 , credit: 0 } , { accountId: sueldoId , debit: 0 , credit: 5000 } ] } ) ;
    const transf  = await createLedgerTransactionAction( { description: "Ahorro" , entries: [ { accountId: ahorroId , debit: 5000 , credit: 0 } , { accountId: cajaId , debit: 0 , credit: 5000 } ] } ) ;
    expect( ingreso.success && transf.success ).toBe( true ) ;

    expect( await deudas() ).toHaveLength( 0 ) ;
    expect( await avisos( beto , "debt_created" ) ).toHaveLength( 0 ) ;
    expect( ingreso.success && ingreso.value.holderUserId ).toBeNull() ;
  } ) ;

  it( "modo aportes: pesa el aporte del mes, sin declarar cae a partes iguales, y un mes futuro se rechaza" , async () => {
    sesionDe( ana , orgA ) ;
    expect( ( await guardarAcuerdoAction( { modo: "monthly_contributions" , usesCommonPot: false , porcentajes: [] } ) ).success ).toBe( true ) ;

    const iguales = await previsualizarRepartoAction( { tipo: "expense" , montoEnCentavos: 10001 , currency: "ARS" , accountIds: [ cajaId , gastoId ] } ) ;
    expect( iguales.success && iguales.value.partesIguales ).toBe( true ) ;

    const ahora = new Date() ;
    const year  = ahora.getUTCFullYear() ;
    const month = ahora.getUTCMonth() + 1 ;

    expect( ( await declararAporteAction( { userId: ana  , year , month , amountInCents: 60000000 } ) ).success ).toBe( true ) ;
    expect( ( await declararAporteAction( { userId: beto , year , month , amountInCents: 40000000 } ) ).success ).toBe( true ) ;

    const res = await createLedgerTransactionAction( gasto( 1000000 ) ) ;
    expect( res.success ).toBe( true ) ;
    expect( ( await deudas() )[0].amountInCents ).toBe( 400000 ) ;

    const futuro = await declararAporteAction( { userId: ana , year: year + 1 , month , amountInCents: 1 } ) ;
    expect( futuro.success ).toBe( false ) ;

    const filas = await db.select().from( monthlyContributions ).where( eq( monthlyContributions.organizationId , orgA ) ) ;
    expect( filas ).toHaveLength( 2 ) ;
  } ) ;

  it( "AC-29: un owner de otra organización no lee ni cambia nada de la mía, y no puede poner porcentajes de usuarios ajenos" , async () => {
    await acuerdo5050() ;
    const antes = await db.select().from( agreementPercentages ).where( eq( agreementPercentages.organizationId , orgA ) ) ;

    sesionDe( ownerB , orgB ) ;

    const vista = await obtenerAcuerdoAction() ;
    expect( vista.success && vista.value.miembros.some( ( m ) => [ ana , beto ].includes( m.userId ) ) ).toBe( false ) ;

    const guardar = await guardarAcuerdoAction( { modo: "fixed_percentages" , usesCommonPot: false , porcentajes: [ { userId: ana , percentageBp: 5000 } , { userId: beto , percentageBp: 5000 } ] } ) ;
    expect( guardar.success ).toBe( false ) ;

    const aporte = await declararAporteAction( { userId: ana , year: 2020 , month: 1 , amountInCents: 5 } ) ;
    expect( aporte.success ).toBe( false ) ;

    const previa = await previsualizarRepartoAction( { tipo: "expense" , montoEnCentavos: 1000 , currency: "ARS" , holderUserId: ana , accountIds: [ cajaId ] } ) ;
    expect( previa.success ).toBe( false ) ;

    const despues = await db.select().from( agreementPercentages ).where( eq( agreementPercentages.organizationId , orgA ) ) ;
    expect( despues ).toEqual( antes ) ;
    expect( await db.select().from( monthlyContributions ) ).toHaveLength( 0 ) ;
    expect( await db.select().from( organizationAgreements ).where( eq( organizationAgreements.organizationId , orgB ) ) ).toHaveLength( 0 ) ;
  } ) ;

  it( "roles: el member no guarda el acuerdo ni declara el aporte de otro; el viewer no accede a nada" , async () => {
    await acuerdo5050() ;
    sesionDe( beto , orgA ) ;

    expect( ( await guardarAcuerdoAction( { modo: "none" , usesCommonPot: false , porcentajes: [] } ) ).success ).toBe( false ) ;
    expect( ( await declararAporteAction( { userId: ana , year: 2020 , month: 1 , amountInCents: 5 } ) ).success ).toBe( false ) ;
    expect( ( await declararAporteAction( { year: 2020 , month: 1 , amountInCents: 5 } ) ).success ).toBe( true ) ;

    const vista = await obtenerAcuerdoAction() ;
    expect( vista.success && vista.value.rol ).toBe( "member" ) ;
    expect( vista.success && vista.value.miembros.map( ( m ) => m.userId ) ).toEqual( [ beto ] ) ;
    expect( vista.success && vista.value.miembros[0].porcentajeBp ).toBe( 5000 ) ;

    sesionDe( lector , orgA ) ;
    expect( ( await obtenerAcuerdoAction() ).success ).toBe( false ) ;
    expect( ( await guardarAcuerdoAction( { modo: "none" , usesCommonPot: false , porcentajes: [] } ) ).success ).toBe( false ) ;
    expect( ( await declararAporteAction( { year: 2020 , month: 1 , amountInCents: 5 } ) ).success ).toBe( false ) ;
    expect( ( await previsualizarRepartoAction( { tipo: "expense" , montoEnCentavos: 1 , currency: "ARS" , accountIds: [] } ) ).success ).toBe( false ) ;
  } ) ;

  it( "NFR-6 / AC-31: el borrado completo de una organización rica vacía las cuatro tablas nuevas" , async () => {
    await crearOrganizacionRica( orgB ) ;
    const antes = await conteosDe( orgB ) ;

    for( const tabla of [ "expense_splits" , "organization_agreements" , "agreement_percentages" , "monthly_contributions" ] ) {
      expect( antes[ tabla ] , tabla ).toBeGreaterThan( 0 ) ;
    }

    await db.transaction( async ( tx ) => { await organizationRepository.eliminarCompleta( orgB , tx ) ; } ) ;

    const despues = await conteosDe( orgB ) ;
    for( const [ tabla , n ] of Object.entries( despues ) ) {
      expect( n , tabla ).toBe( 0 ) ;
    }
  } ) ;

  it( "NFR-3: dos guardados simultáneos dejan un único acuerdo consistente (porcentajes de una sola llamada, suma 10000)" , async () => {
    sesionDe( ana , orgA ) ;
    const original = membershipRepository.findByOrganization.bind( membershipRepository ) ;

    // Demora tras la lectura de miembros: sin el candado, ambas escribirían entrelazadas
    vi.spyOn( membershipRepository , "findByOrganization" ).mockImplementation( async ( ...args ) => {
      const r = await original( ...args ) ;
      await new Promise( ( resolve ) => setTimeout( resolve , 100 ) ) ;
      return( r ) ;
    } ) ;

    const a = guardarAcuerdoAction( { modo: "fixed_percentages" , usesCommonPot: false , porcentajes: [ { userId: ana , percentageBp: 8000 } , { userId: beto , percentageBp: 2000 } ] } ) ;
    const b = guardarAcuerdoAction( { modo: "fixed_percentages" , usesCommonPot: false , porcentajes: [ { userId: ana , percentageBp: 3000 } , { userId: beto , percentageBp: 7000 } ] } ) ;
    const [ ra , rb ] = await Promise.all( [ a , b ] ) ;

    expect( ra.success && rb.success ).toBe( true ) ;

    const filas = await db.select().from( agreementPercentages ).where( eq( agreementPercentages.organizationId , orgA ) ) ;
    const porId = new Map( filas.map( ( f ) => [ f.userId , f.percentageBp ] ) ) ;

    expect( filas ).toHaveLength( 2 ) ;
    expect( filas.reduce( ( s , f ) => ( s + f.percentageBp ) , 0 ) ).toBe( 10000 ) ;
    expect( [ "8000-2000" , "3000-7000" ] ).toContain( `${porId.get( ana )}-${porId.get( beto )}` ) ;
  } ) ;
} ) ;
