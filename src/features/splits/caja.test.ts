// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                   from "next-auth" ;
import type { Session }                                       from "next-auth" ;
import { eq , and , sql }                                     from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia , crearOrganizacionRica , conteosDe } from "@/shared/db/testFixtures" ;
import { limpiarBase }                                                  from "@/shared/db/testCleanup" ;
import { db }                                                           from "@/shared/db/client" ;

// Feature: Accounting
import { createLedgerTransactionAction }                 from "@/features/accounting/actions/accountingActions" ;
import { accounts , ledgerTransactions , ledgerEntries } from "@/features/accounting/schema.db" ;

// Feature: Auth
import { organizations , users }  from "@/features/auth/schema.db" ;
import { organizationRepository } from "@/features/auth/repositories/organizationRepository" ;

// Feature: Notifications
import { notifications } from "@/features/notifications/schema.db" ;

// Feature: Splits
import { guardarAcuerdoAction , previsualizarRepartoAction } from "./actions/acuerdoActions" ;
import { obtenerCajaAction , registrarAporteCajaAction }     from "./actions/cajaActions" ;
import { expenseSplits , commonPotContributions }            from "./schema.db" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

function sesionDe( userId: string , organizationId: string ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role: "owner" } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

describe( "caja común (plan 21)" , () => {
  let orgA:     string ;
  let orgB:     string ;
  let ana:      string ; // owner
  let beto:     string ; // member
  let lector:   string ; // viewer
  let ownerB:   string ;
  let cajaId:   string ; // asset ARS
  let dolaresId: string ; // asset USD
  let gastoId:  string ; // expense
  let ajenaId:  string ; // asset de la organización B

  async function activarCaja( cuentas: string[] , modo: "none" | "fixed_percentages" = "none" ) {
    sesionDe( ana , orgA ) ;
    return( await guardarAcuerdoAction( {
      modo ,
      usesCommonPot:  true ,
      porcentajes:    ( modo === "fixed_percentages" ) ? [ { userId: ana , percentageBp: 5000 } , { userId: beto , percentageBp: 5000 } ] : [] ,
      cuentasCajaIds: cuentas ,
    } ) ) ;
  }

  async function aportar( userId: string , monto: number , quien?: string , divisa = "ARS" ) {
    sesionDe( userId , orgA ) ;
    return( await registrarAporteCajaAction( { ...( quien ? { userId: quien } : {} ) , currency: divisa , amountInCents: monto } ) ) ;
  }

  async function vistaDe( userId: string ) {
    sesionDe( userId , orgA ) ;
    const res = await obtenerCajaAction() ;
    expect( res.success ).toBe( true ) ;
    return( res.success ? res.value : null ) ;
  }

  async function avisos( userId: string , tipo: string ) {
    return( await db.select().from( notifications ).where( and( eq( notifications.recipientUserId , userId ) , eq( notifications.type , tipo ) ) ) ) ;
  }

  async function contarAsientos(): Promise< [ number , number ] > {
    const [ t ] = await db.select( { n: sql< number >`count(*)::int` } ).from( ledgerTransactions ) ;
    const [ e ] = await db.select( { n: sql< number >`count(*)::int` } ).from( ledgerEntries ) ;
    return( [ t.n , e.n ] ) ;
  }

  async function aportesGuardados( org = orgA ) {
    return( await db.select().from( commonPotContributions ).where( eq( commonPotContributions.organizationId , org ) ) ) ;
  }

  const gasto = ( monto = 10001 ) => ( {
    description: "Súper" ,
    entries:     [ { accountId: gastoId , debit: monto , credit: 0 } , { accountId: cajaId , debit: 0 , credit: monto } ] ,
  } ) ;

  beforeEach( async () => {
    vi.restoreAllMocks() ;
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-caja"   } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-caja" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;

    ana    = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "ana@ejemplo.com"    , name: "Ana"    , role: "owner"  } ) ).id ;
    beto   = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "beto@ejemplo.com"   , name: "Beto"   , role: "member" } ) ).id ;
    lector = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "lector@ejemplo.com" , name: "Lector" , role: "viewer" } ) ).id ;
    ownerB = ( await crearUsuarioConMembresia( { organizationId: orgB , email: "ownerb@ejemplo.com" , name: "OwnerB" , role: "owner"  } ) ).id ;

    const cuentas = await db
      .insert( accounts )
      .values( [
        { organizationId: orgA , code: "1.1.01" , name: "Caja"     , type: "asset"   , balance: 10000000 , currency: "ARS" } ,
        { organizationId: orgA , code: "1.1.02" , name: "Dólares"  , type: "asset"   , balance: 0        , currency: "USD" } ,
        { organizationId: orgA , code: "5.1.01" , name: "Comida"   , type: "expense" , balance: 0        , currency: "ARS" } ,
        { organizationId: orgB , code: "1.1.01" , name: "Caja B"   , type: "asset"   , balance: 0        , currency: "ARS" } ,
      ] )
      .returning() ;
    cajaId    = cuentas[0].id ;
    dolaresId = cuentas[1].id ;
    gastoId   = cuentas[2].id ;
    ajenaId   = cuentas[3].id ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  describe( "marcar las cuentas en el acuerdo (S-AG, S-AH)" , () => {
    it( "S-AG: con la caja activa y sin cuentas, falla" , async () => {
      const res = await activarCaja( [] ) ;

      expect( res.success ).toBe( false ) ;
      expect( !res.success && res.error ).toBe( "Elegí al menos una cuenta para la caja común." ) ;
    } ) ;

    it( "S-AG: una cuenta de otra organización o una cuenta de gasto fallan y no marcan nada" , async () => {
      const ajena = await activarCaja( [ ajenaId ] ) ;
      const gastoR = await activarCaja( [ gastoId ] ) ;

      expect( !ajena.success && ajena.error ).toBe( "Cuenta inválida para la caja común." ) ;
      expect( !gastoR.success && gastoR.error ).toBe( "Cuenta inválida para la caja común." ) ;
      expect( await db.select().from( accounts ).where( eq( accounts.isCommonPot , true ) ) ).toHaveLength( 0 ) ;
    } ) ;

    it( "S-AG: un guardado válido deja la cuenta marcada y avisa una sola vez; repetirlo no avisa de nuevo" , async () => {
      expect( ( await activarCaja( [ cajaId ] ) ).success ).toBe( true ) ;

      const [ marcada ] = await db.select().from( accounts ).where( eq( accounts.id , cajaId ) ) ;
      expect( marcada.isCommonPot ).toBe( true ) ;
      expect( await avisos( beto , "agreement_changed" ) ).toHaveLength( 1 ) ;

      expect( ( await activarCaja( [ cajaId ] ) ).success ).toBe( true ) ;
      expect( await avisos( beto , "agreement_changed" ) ).toHaveLength( 1 ) ;

      expect( ( await activarCaja( [ cajaId , dolaresId ] ) ).success ).toBe( true ) ;
      expect( await avisos( beto , "agreement_changed" ) ).toHaveLength( 2 ) ;
    } ) ;

    it( "S-AG: el owner ve las cuentas de activo marcables; el member, ninguna" , async () => {
      const { obtenerAcuerdoAction } = await import( "./actions/acuerdoActions" ) ;
      await activarCaja( [ cajaId ] ) ;

      sesionDe( ana , orgA ) ;
      const deOwner = await obtenerAcuerdoAction() ;
      expect( deOwner.success && deOwner.value.cuentasMarcables ).toEqual( [
        { id: cajaId    , nombre: "Caja"    , divisa: "ARS" , esCaja: true } ,
        { id: dolaresId , nombre: "Dólares" , divisa: "USD" , esCaja: false } ,
      ] ) ;

      sesionDe( beto , orgA ) ;
      const deMember = await obtenerAcuerdoAction() ;
      expect( deMember.success && deMember.value.cuentasMarcables ).toEqual( [] ) ;
    } ) ;

    it( "AC-14: un gasto contra la cuenta marcada no genera deuda y la vista previa dice «caja común»" , async () => {
      expect( ( await activarCaja( [ cajaId ] , "fixed_percentages" ) ).success ).toBe( true ) ;
      sesionDe( ana , orgA ) ;

      const previa = await previsualizarRepartoAction( { tipo: "expense" , montoEnCentavos: 10001 , currency: "ARS" , accountIds: [ cajaId ] } ) ;
      expect( previa.success && previa.value ).toMatchObject( { aplica: false , motivo: "caja_comun" } ) ;

      const res = await createLedgerTransactionAction( gasto() ) ;

      expect( res.success ).toBe( true ) ;
      expect( await db.select().from( expenseSplits ).where( eq( expenseSplits.organizationId , orgA ) ) ).toHaveLength( 0 ) ;
    } ) ;

    it( "S-AH: desactivar la caja desmarca las cuentas, el gasto vuelve a repartir, los aportes se conservan y la pestaña desaparece" , async () => {
      await activarCaja( [ cajaId ] , "fixed_percentages" ) ;
      expect( ( await aportar( ana , 300000 ) ).success ).toBe( true ) ;

      sesionDe( ana , orgA ) ;
      const res = await guardarAcuerdoAction( {
        modo:          "fixed_percentages" ,
        usesCommonPot: false ,
        porcentajes:   [ { userId: ana , percentageBp: 5000 } , { userId: beto , percentageBp: 5000 } ] ,
      } ) ;
      expect( res.success ).toBe( true ) ;

      expect( await db.select().from( accounts ).where( eq( accounts.isCommonPot , true ) ) ).toHaveLength( 0 ) ;
      expect( await aportesGuardados() ).toHaveLength( 1 ) ;
      expect( ( await vistaDe( ana ) )?.visible ).toBe( false ) ;

      expect( ( await createLedgerTransactionAction( gasto() ) ).success ).toBe( true ) ;
      expect( await db.select().from( expenseSplits ).where( eq( expenseSplits.organizationId , orgA ) ) ).toHaveLength( 1 ) ;

      // Al volver a activarla, los aportes reaparecen
      await activarCaja( [ cajaId ] ) ;
      expect( ( await vistaDe( ana ) )?.participaciones[ 0 ]?.total ).toBe( 300000 ) ;
    } ) ;
  } ) ;

  describe( "participación y registro (RN-26, RN-27, RN-28)" , () => {
    beforeEach( async () => {
      await activarCaja( [ cajaId , dolaresId ] ) ;
    } ) ;

    it( "AC-23: Ana aporta 300.000 y Beto 100.000 → 75,0 % y 25,0 %; Ana retira 100.000 → 66,7 % y 33,3 %" , async () => {
      expect( ( await aportar( ana , 30000000 ) ).success ).toBe( true ) ;
      expect( ( await aportar( beto , 10000000 ) ).success ).toBe( true ) ;

      const antes = ( await vistaDe( ana ) )?.participaciones[ 0 ] ;
      expect( antes?.filas.map( ( f ) => [ f.nombre , f.bp ] ) ).toEqual( [ [ "Ana" , 7500 ] , [ "Beto" , 2500 ] ] ) ;

      expect( ( await aportar( ana , -10000000 ) ).success ).toBe( true ) ;

      const despues = ( await vistaDe( ana ) )?.participaciones[ 0 ] ;
      expect( despues?.filas.map( ( f ) => [ f.nombre , f.neto , f.bp ] ) ).toEqual( [ [ "Ana" , 20000000 , 6666 ] , [ "Beto" , 10000000 , 3333 ] ] ) ;
    } ) ;

    it( "AC-24: aportar y retirar no cambia ni una fila del libro mayor" , async () => {
      const antes = await contarAsientos() ;

      await aportar( ana , 300000 ) ;
      await aportar( ana , -100000 ) ;
      await aportar( beto , 5000 ) ;

      expect( await contarAsientos() ).toEqual( antes ) ;
      expect( await aportesGuardados() ).toHaveLength( 3 ) ;
      expect( await db.select().from( notifications ).where( eq( notifications.type , "caja" ) ) ).toHaveLength( 0 ) ;
    } ) ;

    it( "S-AJ: un retiro mayor que el neto falla y no deja fila" , async () => {
      await aportar( ana , 100000 ) ;

      const res = await aportar( ana , -100001 ) ;

      expect( !res.success && res.error ).toBe( "No podés retirar más de lo que aportaste." ) ;
      expect( await aportesGuardados() ).toHaveLength( 1 ) ;
    } ) ;

    it( "S-AJ / NFR-3: dos retiros simultáneos que suman más que el neto → sólo uno entra" , async () => {
      await aportar( ana , 100000 ) ;
      sesionDe( ana , orgA ) ;

      const [ r1 , r2 ] = await Promise.all( [
        registrarAporteCajaAction( { currency: "ARS" , amountInCents: -80000 } ) ,
        registrarAporteCajaAction( { currency: "ARS" , amountInCents: -80000 } ) ,
      ] ) ;

      expect( [ r1.success , r2.success ].filter( Boolean ) ).toHaveLength( 1 ) ;
      expect( ( await aportesGuardados() ).reduce( ( s , a ) => ( s + a.amountInCents ) , 0 ) ).toBe( 20000 ) ;
    } ) ;

    it( "S-AJ: el member registra el propio; el de otro, no; el owner registra el de otro" , async () => {
      expect( ( await aportar( beto , 1000 ) ).success ).toBe( true ) ;
      expect( ( await aportar( beto , 1000 , ana ) ).success ).toBe( false ) ;
      expect( ( await aportar( ana , 2000 , beto ) ).success ).toBe( true ) ;

      const filas = await aportesGuardados() ;
      expect( filas ).toHaveLength( 2 ) ;
      expect( filas.find( ( f ) => (f.amountInCents === 2000) ) ).toMatchObject( { userId: beto , registeredByUserId: ana } ) ;
    } ) ;

    it( "S-AJ: el viewer no registra, y no se registra a favor de un viewer ni de alguien ajeno a la organización" , async () => {
      expect( ( await aportar( lector , 1000 ) ).success ).toBe( false ) ;
      expect( ( await aportar( ana , 1000 , lector ) ).success ).toBe( false ) ;
      expect( ( await aportar( ana , 1000 , ownerB ) ).success ).toBe( false ) ;
      expect( await aportesGuardados() ).toHaveLength( 0 ) ;

      const vista = await vistaDe( lector ) ;
      expect( vista ).toMatchObject( { visible: true , puedeEscribir: false , miembros: [] } ) ;
    } ) ;

    it( "S-AK: una divisa que ninguna cuenta de la caja usa falla; las de las cuentas marcadas se ofrecen" , async () => {
      expect( ( await aportar( ana , 1000 , undefined , "EUR" ) ).success ).toBe( false ) ;
      expect( ( await aportar( ana , 1000 , undefined , "USD" ) ).success ).toBe( true ) ;
      expect( ( await vistaDe( ana ) )?.divisas ).toEqual( [ "ARS" , "USD" ] ) ;
    } ) ;

    it( "NFR-1: los aportes de otra organización no aparecen" , async () => {
      await db.insert( commonPotContributions ).values( { organizationId: orgB , userId: ownerB , amountInCents: 999999 , currency: "ARS" } ) ;
      await aportar( ana , 1000 ) ;

      const vista = await vistaDe( ana ) ;

      expect( vista?.participaciones ).toHaveLength( 1 ) ;
      expect( vista?.participaciones[ 0 ].total ).toBe( 1000 ) ;
      expect( vista?.aportes ).toHaveLength( 1 ) ;
    } ) ;

    it( "un miembro borrado queda como «Miembro anterior» y el total no cambia" , async () => {
      await aportar( ana , 300000 ) ;
      await aportar( beto , 100000 ) ;

      await db.delete( users ).where( eq( users.id , beto ) ) ;

      const p = ( await vistaDe( ana ) )?.participaciones[ 0 ] ;

      expect( p?.total ).toBe( 400000 ) ;
      expect( p?.filas.map( ( f ) => [ f.userId , f.nombre , f.neto ] ) ).toEqual( [ [ ana , "Ana" , 300000 ] , [ null , null , 100000 ] ] ) ;
    } ) ;

    it( "los datos viajan sin nota vacía y la nota se guarda recortada" , async () => {
      sesionDe( ana , orgA ) ;
      await registrarAporteCajaAction( { currency: "ARS" , amountInCents: 1000 , note: "  Alquiler  " } ) ;
      await registrarAporteCajaAction( { currency: "ARS" , amountInCents: 1000 , note: "   " } ) ;

      const notas = ( await aportesGuardados() ).map( ( a ) => a.note ).sort() ;
      expect( notas ).toEqual( [ "Alquiler" , null ] ) ;
    } ) ;

    it( "un monto cero o no entero se rechaza" , async () => {
      sesionDe( ana , orgA ) ;
      expect( ( await registrarAporteCajaAction( { currency: "ARS" , amountInCents: 0 } ) ).success ).toBe( false ) ;
      expect( ( await registrarAporteCajaAction( { currency: "ARS" , amountInCents: 10.5 } ) ).success ).toBe( false ) ;
    } ) ;
  } ) ;

  it( "borrar una organización rica elimina también sus aportes a la caja" , async () => {
    const [ c ] = await db.insert( organizations ).values( { name: "Rica" , slug: "rica-caja" } ).returning() ;
    await db.transaction( async ( tx ) => { await crearOrganizacionRica( c.id , tx ) ; } ) ;

    expect( ( await conteosDe( c.id ) ).common_pot_contributions ).toBe( 1 ) ;

    await db.transaction( async ( tx ) => { await organizationRepository.eliminarCompleta( c.id , tx ) ; } ) ;

    expect( ( await conteosDe( c.id ) ).common_pot_contributions ).toBe( 0 ) ;
  } ) ;

  it( "sin la caja activa, obtenerCajaAction no muestra nada" , async () => {
    sesionDe( ana , orgA ) ;
    const res = await obtenerCajaAction() ;

    expect( res.success && res.value ).toMatchObject( { visible: false , participaciones: [] , aportes: [] , divisas: [] } ) ;
    expect( ( await aportar( ana , 1000 ) ).success ).toBe( false ) ;
  } ) ;
} ) ;
