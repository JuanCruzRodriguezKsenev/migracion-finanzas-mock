// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                    from "next-auth" ;
import type { Session }                                        from "next-auth" ;
import { eq , and }                                            from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Accounting
import { ledgerTransactions } from "@/features/accounting/schema.db" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Notifications
import { listarNotificacionesAction } from "@/features/notifications/actions/notificationsActions" ;
import { notificationRepository }      from "@/features/notifications/repositories/notificationRepository" ;
import { notifications }               from "@/features/notifications/schema.db" ;

// Feature: Splits
import { reclamarPagoAction , confirmarReclamoAction , rechazarReclamoAction , cancelarReclamoAction } from "./actions/reclamosActions" ;
import { obtenerSaldosAction , registrarPagoAction }                                                   from "./actions/saldosActions" ;
import { expenseSplits , memberPayments , paymentClaims }                                              from "./schema.db" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

function sesionDe( userId: string , organizationId: string , role = "member" ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

describe( "reclamos de pago («Ya pagué») y confirmación (plan 44)" , () => {
  let orgA:   string ;
  let orgB:   string ;
  let karla:  string ; // acreedor (owner en orgA)
  let juan:   string ; // deudor (member en orgA)
  let lector: string ; // viewer en orgA
  let ajeno:  string ; // miembro sólo en orgB

  /** Inserta una transacción, gasto repartido y aviso debt_created al deudor. */
  async function deudaConAviso( org: string , acreedor: string , deudor: string , monto: number , divisa = "ARS" ) {
    const [ tx ] = await db.insert( ledgerTransactions ).values( { organizationId: org , description: "Cena compartida" , holderUserId: acreedor } ).returning() ;
    await db.insert( expenseSplits ).values( { organizationId: org , transactionId: tx.id , debtorUserId: deudor , amountInCents: monto , currency: divisa } ) ;
    const [ av ] = await db.insert( notifications ).values( {
      organizationId:  org ,
      recipientUserId: deudor ,
      type:            "debt_created" ,
      actorUserId:     acreedor ,
      transactionId:   tx.id ,
      amountInCents:   monto ,
      currency:        divisa ,
    } ).returning() ;
    return( { txId: tx.id , avisoId: av.id } ) ;
  }

  async function saldoEntre( userId: string , contraparteId: string , org: string ) {
    sesionDe( userId , org ) ;
    const res = await obtenerSaldosAction() ;
    expect( res.success ).toBe( true ) ;
    if( !res.success ) { return( 0 ) ; }
    const s = res.value.saldos.find( ( item ) => item.contraparteId === contraparteId ) ;
    return( s?.montoEnCentavos ?? 0 ) ;
  }

  beforeEach( async () => {
    vi.restoreAllMocks() ;
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-reclamos"   } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-reclamos" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;

    karla  = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "karla@ejemplo.com"  , name: "Karla"  , role: "owner"  } ) ).id ;
    juan   = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "juan@ejemplo.com"   , name: "Juan"   , role: "member" } ) ).id ;
    lector = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "lector@ejemplo.com" , name: "Lector" , role: "viewer" } ) ).id ;
    ajeno  = ( await crearUsuarioConMembresia( { organizationId: orgB , email: "ajeno@ejemplo.com"  , name: "Ajeno"  , role: "member" } ) ).id ;
  } ) ;

  afterAll( async () => {
    vi.restoreAllMocks() ;
  } ) ;

  it( "AC-34: reclamarPagoAction crea reclamo pending, Karla recibe payment_claimed con claim_id y el saldo no cambia" , async () => {
    const { avisoId } = await deudaConAviso( orgA , karla , juan , 490_000 ) ;

    sesionDe( juan , orgA ) ;
    const res = await reclamarPagoAction( { avisoId , montoEnCentavos: 490_000 } ) ;
    expect( res.success ).toBe( true ) ;

    const reclamos = await db.select().from( paymentClaims ).where( eq( paymentClaims.organizationId , orgA ) ) ;
    expect( reclamos ).toHaveLength( 1 ) ;
    expect( reclamos[ 0 ]!.status ).toBe( "pending" ) ;
    expect( reclamos[ 0 ]!.amountInCents ).toBe( 490_000 ) ;
    expect( reclamos[ 0 ]!.fromUserId ).toBe( juan ) ;
    expect( reclamos[ 0 ]!.toUserId ).toBe( karla ) ;

    const avisosKarla = await db
      .select()
      .from( notifications )
      .where( and( eq( notifications.recipientUserId , karla ) , eq( notifications.type , "payment_claimed" ) ) ) ;
    expect( avisosKarla ).toHaveLength( 1 ) ;
    expect( avisosKarla[ 0 ]!.claimId ).toBe( reclamos[ 0 ]!.id ) ;

    // El saldo de Juan sigue en -490.000 (debe 490.000)
    const saldoJuan = await saldoEntre( juan , karla , orgA ) ;
    expect( saldoJuan ).toBe( -490_000 ) ;
  } ) ;

  it( "AC-35: confirmarReclamoAction de Karla salda la deuda, inserta member_payments, avisa payment_received y confirma reclamo" , async () => {
    const { avisoId } = await deudaConAviso( orgA , karla , juan , 490_000 ) ;

    sesionDe( juan , orgA ) ;
    await reclamarPagoAction( { avisoId , montoEnCentavos: 490_000 } ) ;

    const [ reclamo ] = await db.select().from( paymentClaims ).where( eq( paymentClaims.organizationId , orgA ) ) ;
    expect( reclamo ).toBeDefined() ;

    sesionDe( karla , orgA , "owner" ) ;
    const resConfirma = await confirmarReclamoAction( { reclamoId: reclamo!.id } ) ;
    expect( resConfirma.success ).toBe( true ) ;

    // Saldo Juan con Karla = 0
    const saldoJuan = await saldoEntre( juan , karla , orgA ) ;
    expect( saldoJuan ).toBe( 0 ) ;

    // Una fila en member_payments registrada por Karla
    const pagos = await db.select().from( memberPayments ).where( eq( memberPayments.organizationId , orgA ) ) ;
    expect( pagos ).toHaveLength( 1 ) ;
    expect( pagos[ 0 ]!.fromUserId ).toBe( juan ) ;
    expect( pagos[ 0 ]!.toUserId ).toBe( karla ) ;
    expect( pagos[ 0 ]!.registeredByUserId ).toBe( karla ) ;
    expect( pagos[ 0 ]!.amountInCents ).toBe( 490_000 ) ;

    // Juan recibe aviso payment_received
    const avisosJuan = await db
      .select()
      .from( notifications )
      .where( and( eq( notifications.recipientUserId , juan ) , eq( notifications.type , "payment_received" ) ) ) ;
    expect( avisosJuan ).toHaveLength( 1 ) ;

    // Reclamo confirmado con fecha
    const [ reclamoActualizado ] = await db.select().from( paymentClaims ).where( eq( paymentClaims.id , reclamo!.id ) ) ;
    expect( reclamoActualizado!.status ).toBe( "confirmed" ) ;
    expect( reclamoActualizado!.resolvedAt ).not.toBeNull() ;
  } ) ;

  it( "AC-36: rechazarReclamoAction deja el saldo igual, avisa payment_claim_rejected y marca rejected" , async () => {
    const { avisoId } = await deudaConAviso( orgA , karla , juan , 490_000 ) ;

    sesionDe( juan , orgA ) ;
    await reclamarPagoAction( { avisoId , montoEnCentavos: 490_000 } ) ;

    const [ reclamo ] = await db.select().from( paymentClaims ).where( eq( paymentClaims.organizationId , orgA ) ) ;

    sesionDe( karla , orgA , "owner" ) ;
    const resRechaza = await rechazarReclamoAction( { reclamoId: reclamo!.id } ) ;
    expect( resRechaza.success ).toBe( true ) ;

    // Saldo no cambia
    const saldoJuan = await saldoEntre( juan , karla , orgA ) ;
    expect( saldoJuan ).toBe( -490_000 ) ;

    // Juan recibe payment_claim_rejected
    const avisosJuan = await db
      .select()
      .from( notifications )
      .where( and( eq( notifications.recipientUserId , juan ) , eq( notifications.type , "payment_claim_rejected" ) ) ) ;
    expect( avisosJuan ).toHaveLength( 1 ) ;
    expect( avisosJuan[ 0 ]!.claimId ).toBe( reclamo!.id ) ;

    // Cero pagos insertados
    const pagos = await db.select().from( memberPayments ).where( eq( memberPayments.organizationId , orgA ) ) ;
    expect( pagos ).toHaveLength( 0 ) ;

    // Reclamo en rejected
    const [ reclamoActualizado ] = await db.select().from( paymentClaims ).where( eq( paymentClaims.id , reclamo!.id ) ) ;
    expect( reclamoActualizado!.status ).toBe( "rejected" ) ;
    expect( reclamoActualizado!.resolvedAt ).not.toBeNull() ;
  } ) ;

  it( "AC-37: cancelarReclamoAction pasa el reclamo a cancelled sin avisos y el listado de Karla lo muestra cancelled sin botones" , async () => {
    const { avisoId } = await deudaConAviso( orgA , karla , juan , 490_000 ) ;

    sesionDe( juan , orgA ) ;
    await reclamarPagoAction( { avisoId , montoEnCentavos: 490_000 } ) ;

    const [ reclamo ] = await db.select().from( paymentClaims ).where( eq( paymentClaims.organizationId , orgA ) ) ;

    sesionDe( juan , orgA ) ;
    const resCancela = await cancelarReclamoAction( { reclamoId: reclamo!.id } ) ;
    expect( resCancela.success ).toBe( true ) ;

    const [ reclamoActualizado ] = await db.select().from( paymentClaims ).where( eq( paymentClaims.id , reclamo!.id ) ) ;
    expect( reclamoActualizado!.status ).toBe( "cancelled" ) ;
    expect( reclamoActualizado!.resolvedAt ).not.toBeNull() ;

    // Sin avisos nuevos
    const avisosNuevos = await db
      .select()
      .from( notifications )
      .where( and( eq( notifications.recipientUserId , karla ) , eq( notifications.type , "payment_claim_cancelled" ) ) ) ;
    expect( avisosNuevos ).toHaveLength( 0 ) ;

    // Karla lista sus notificaciones: el aviso payment_claimed tiene accion responder_reclamo con estado cancelled
    sesionDe( karla , orgA , "owner" ) ;
    const listado = await listarNotificacionesAction() ;
    expect( listado.success ).toBe( true ) ;
    if( listado.success ) {
      const avisoClaimed = listado.value.items.find( ( i ) => i.tipo === "payment_claimed" ) ;
      expect( avisoClaimed ).toBeDefined() ;
      expect( avisoClaimed?.accion ).toEqual( {
        tipo:      "responder_reclamo" ,
        reclamoId: reclamo!.id ,
        estado:    "cancelled" ,
      } ) ;
    }
  } ) ;

  it( "AC-38: dos reclamarPagoAction simultáneas dejan una sola fila pending y un solo aviso" , async () => {
    const { avisoId } = await deudaConAviso( orgA , karla , juan , 490_000 ) ;

    sesionDe( juan , orgA ) ;
    const [ res1 , res2 ] = await Promise.all( [
      reclamarPagoAction( { avisoId , montoEnCentavos: 490_000 } ) ,
      reclamarPagoAction( { avisoId , montoEnCentavos: 490_000 } ) ,
    ] ) ;

    // Una triunfa y la otra falla por conflicto
    const triunfos = [ res1 , res2 ].filter( ( r ) => r.success ) ;
    const fallos   = [ res1 , res2 ].filter( ( r ) => !r.success ) ;
    expect( triunfos ).toHaveLength( 1 ) ;
    expect( fallos ).toHaveLength( 1 ) ;
    expect( fallos[ 0 ]!.error ).toBe( "Ya hay un pago pendiente de confirmación con esa persona." ) ;

    const reclamos = await db.select().from( paymentClaims ).where( eq( paymentClaims.organizationId , orgA ) ) ;
    expect( reclamos ).toHaveLength( 1 ) ;

    const avisosKarla = await db
      .select()
      .from( notifications )
      .where( and( eq( notifications.recipientUserId , karla ) , eq( notifications.type , "payment_claimed" ) ) ) ;
    expect( avisosKarla ).toHaveLength( 1 ) ;
  } ) ;

  it( "AC-39: con saldo 0, reclamarPagoAction falla y el listado no ofrece ya_pague" , async () => {
    const { avisoId } = await deudaConAviso( orgA , karla , juan , 490_000 ) ;

    // Karla registra el pago por saldos para saldar la deuda previamente
    sesionDe( karla , orgA , "owner" ) ;
    await registrarPagoAction( { contraparteId: juan , divisa: "ARS" , montoEnCentavos: 490_000 } ) ;

    sesionDe( juan , orgA ) ;
    const res = await reclamarPagoAction( { avisoId , montoEnCentavos: 490_000 } ) ;
    expect( res.success ).toBe( false ) ;
    expect( res.error ).toBe( "No tenés deuda pendiente con esa persona." ) ;

    const reclamos = await db.select().from( paymentClaims ).where( eq( paymentClaims.organizationId , orgA ) ) ;
    expect( reclamos ).toHaveLength( 0 ) ;

    // Juan lista sus avisos: su aviso debt_created ya no tiene accion
    const listado = await listarNotificacionesAction() ;
    expect( listado.success ).toBe( true ) ;
    if( listado.success ) {
      const aviso = listado.value.items.find( ( i ) => i.id === avisoId ) ;
      expect( aviso?.accion ).toBeUndefined() ;
    }
  } ) ;

  it( "AC-40: monto superior a la deuda falla y no crea reclamo" , async () => {
    const { avisoId } = await deudaConAviso( orgA , karla , juan , 490_000 ) ;

    sesionDe( juan , orgA ) ;
    const res = await reclamarPagoAction( { avisoId , montoEnCentavos: 500_000 } ) ;
    expect( res.success ).toBe( false ) ;
    expect( res.error ).toBe( "El monto supera lo que debés." ) ;

    const reclamos = await db.select().from( paymentClaims ).where( eq( paymentClaims.organizationId , orgA ) ) ;
    expect( reclamos ).toHaveLength( 0 ) ;
  } ) ;

  it( "RN-40: un viewer no puede reclamar ni confirmar y la fila no cambia" , async () => {
    const { avisoId } = await deudaConAviso( orgA , karla , lector , 100_000 ) ;

    sesionDe( lector , orgA , "viewer" ) ;
    const resReclamo = await reclamarPagoAction( { avisoId , montoEnCentavos: 100_000 } ) ;
    expect( resReclamo.success ).toBe( false ) ;
    expect( resReclamo.error ).toBe( "No autorizado." ) ;

    // Si Juan reclama, el viewer no puede confirmar
    const { avisoId: avisoJuan } = await deudaConAviso( orgA , lector , juan , 50_000 ) ;
    sesionDe( juan , orgA ) ;
    await reclamarPagoAction( { avisoId: avisoJuan , montoEnCentavos: 50_000 } ) ;

    const [ reclamo ] = await db.select().from( paymentClaims ).where( and( eq( paymentClaims.fromUserId , juan ) , eq( paymentClaims.toUserId , lector ) ) ) ;
    expect( reclamo ).toBeDefined() ;

    sesionDe( lector , orgA , "viewer" ) ;
    const resConfirma = await confirmarReclamoAction( { reclamoId: reclamo!.id } ) ;
    expect( resConfirma.success ).toBe( false ) ;
    expect( resConfirma.error ).toBe( "No autorizado." ) ;

    const [ reclamoSinCambio ] = await db.select().from( paymentClaims ).where( eq( paymentClaims.id , reclamo!.id ) ) ;
    expect( reclamoSinCambio!.status ).toBe( "pending" ) ;
  } ) ;

  it( "Autoría: tercero no puede confirmar, rechazar ni cancelar; y reclamar con aviso ajeno falla con 'Aviso inexistente.'" , async () => {
    const { avisoId } = await deudaConAviso( orgA , karla , juan , 490_000 ) ;

    // Reclamar con aviso ajeno: Karla intenta usar el aviso de Juan
    sesionDe( karla , orgA , "owner" ) ;
    const resAvisoAjeno = await reclamarPagoAction( { avisoId , montoEnCentavos: 490_000 } ) ;
    expect( resAvisoAjeno.success ).toBe( false ) ;
    expect( resAvisoAjeno.error ).toBe( "Aviso inexistente." ) ;

    sesionDe( juan , orgA ) ;
    await reclamarPagoAction( { avisoId , montoEnCentavos: 490_000 } ) ;
    const [ reclamo ] = await db.select().from( paymentClaims ).where( eq( paymentClaims.organizationId , orgA ) ) ;

    // Tercero (lector) intenta confirmar, rechazar o cancelar
    sesionDe( lector , orgA , "viewer" ) ;
    expect( ( await confirmarReclamoAction( { reclamoId: reclamo!.id } ) ).error ).toBe( "No autorizado." ) ;
    expect( ( await rechazarReclamoAction( { reclamoId: reclamo!.id } ) ).error ).toBe( "No autorizado." ) ;
    expect( ( await cancelarReclamoAction( { reclamoId: reclamo!.id } ) ).error ).toBe( "No autorizado." ) ;

    // Juan no puede confirmar ni rechazar (es el deudor)
    sesionDe( juan , orgA ) ;
    expect( ( await confirmarReclamoAction( { reclamoId: reclamo!.id } ) ).error ).toBe( "No autorizado." ) ;
    expect( ( await rechazarReclamoAction( { reclamoId: reclamo!.id } ) ).error ).toBe( "No autorizado." ) ;

    // Karla no puede cancelar (es la acreedora)
    sesionDe( karla , orgA , "owner" ) ;
    expect( ( await cancelarReclamoAction( { reclamoId: reclamo!.id } ) ).error ).toBe( "No autorizado." ) ;

    const [ reclamoIntacto ] = await db.select().from( paymentClaims ).where( eq( paymentClaims.id , reclamo!.id ) ) ;
    expect( reclamoIntacto!.status ).toBe( "pending" ) ;
  } ) ;

  it( "Aislamiento: usuario de org B no puede accionar aviso ni reclamo de org A" , async () => {
    const { avisoId } = await deudaConAviso( orgA , karla , juan , 490_000 ) ;

    sesionDe( ajeno , orgB ) ;
    const resReclamo = await reclamarPagoAction( { avisoId , montoEnCentavos: 490_000 } ) ;
    expect( resReclamo.success ).toBe( false ) ;
    expect( resReclamo.error ).toBe( "Aviso inexistente." ) ;

    sesionDe( juan , orgA ) ;
    await reclamarPagoAction( { avisoId , montoEnCentavos: 490_000 } ) ;
    const [ reclamo ] = await db.select().from( paymentClaims ).where( eq( paymentClaims.organizationId , orgA ) ) ;

    sesionDe( ajeno , orgB ) ;
    const resConfirma = await confirmarReclamoAction( { reclamoId: reclamo!.id } ) ;
    expect( resConfirma.success ).toBe( false ) ;
    expect( resConfirma.error ).toBe( "No autorizado." ) ;
  } ) ;

  it( "Confirmar con saldo ya en 0 falla, reclamo queda pending y cero pagos nuevos" , async () => {
    const { avisoId } = await deudaConAviso( orgA , karla , juan , 490_000 ) ;

    sesionDe( juan , orgA ) ;
    await reclamarPagoAction( { avisoId , montoEnCentavos: 490_000 } ) ;
    const [ reclamo ] = await db.select().from( paymentClaims ).where( eq( paymentClaims.organizationId , orgA ) ) ;

    // Karla registra el pago por saldos primero
    sesionDe( karla , orgA , "owner" ) ;
    await registrarPagoAction( { contraparteId: juan , divisa: "ARS" , montoEnCentavos: 490_000 } ) ;

    // Ahora Karla intenta confirmar el reclamo pendiente
    const resConfirma = await confirmarReclamoAction( { reclamoId: reclamo!.id } ) ;
    expect( resConfirma.success ).toBe( false ) ;
    expect( resConfirma.error ).toBe( "Sólo quien es acreedor puede registrar un pago: esa persona no te debe nada en esa divisa." ) ;

    const [ reclamoDespues ] = await db.select().from( paymentClaims ).where( eq( paymentClaims.id , reclamo!.id ) ) ;
    expect( reclamoDespues!.status ).toBe( "pending" ) ;

    // Hubo sólo 1 pago (el registrado a mano por saldos), no 2
    const pagos = await db.select().from( memberPayments ).where( eq( memberPayments.organizationId , orgA ) ) ;
    expect( pagos ).toHaveLength( 1 ) ;
  } ) ;

  it( "Atomicidad: si notificar falla, no queda reclamo ni cambio de estado" , async () => {
    const { avisoId } = await deudaConAviso( orgA , karla , juan , 490_000 ) ;

    // Espiar insertar de notificationRepository para forzar error
    vi.spyOn( notificationRepository , "insertar" ).mockRejectedValueOnce( new Error( "Error simulado en notificación" ) ) ;

    sesionDe( juan , orgA ) ;
    const resReclamo = await reclamarPagoAction( { avisoId , montoEnCentavos: 490_000 } ) ;
    expect( resReclamo.success ).toBe( false ) ;

    // Cero reclamos creados
    const reclamos = await db.select().from( paymentClaims ).where( eq( paymentClaims.organizationId , orgA ) ) ;
    expect( reclamos ).toHaveLength( 0 ) ;

    // Ahora creamos el reclamo exitosamente
    await reclamarPagoAction( { avisoId , montoEnCentavos: 490_000 } ) ;
    const [ reclamoCreado ] = await db.select().from( paymentClaims ).where( eq( paymentClaims.organizationId , orgA ) ) ;

    // Forzar fallo en notificación al rechazar
    vi.spyOn( notificationRepository , "insertar" ).mockRejectedValueOnce( new Error( "Error simulado en rechazo" ) ) ;
    sesionDe( karla , orgA , "owner" ) ;
    const resRechazo = await rechazarReclamoAction( { reclamoId: reclamoCreado!.id } ) ;
    expect( resRechazo.success ).toBe( false ) ;

    // El reclamo sigue en pending
    const [ reclamoRevertido ] = await db.select().from( paymentClaims ).where( eq( paymentClaims.id , reclamoCreado!.id ) ) ;
    expect( reclamoRevertido!.status ).toBe( "pending" ) ;
  } ) ;

  it( "Doble confirmación simultánea produce un solo pago y la otra responde 'El pago ya fue resuelto.'" , async () => {
    const { avisoId } = await deudaConAviso( orgA , karla , juan , 490_000 ) ;

    sesionDe( juan , orgA ) ;
    await reclamarPagoAction( { avisoId , montoEnCentavos: 490_000 } ) ;
    const [ reclamo ] = await db.select().from( paymentClaims ).where( eq( paymentClaims.organizationId , orgA ) ) ;

    sesionDe( karla , orgA , "owner" ) ;
    const [ res1 , res2 ] = await Promise.all( [
      confirmarReclamoAction( { reclamoId: reclamo!.id } ) ,
      confirmarReclamoAction( { reclamoId: reclamo!.id } ) ,
    ] ) ;

    const exitos = [ res1 , res2 ].filter( ( r ) => r.success ) ;
    const fallos = [ res1 , res2 ].filter( ( r ) => !r.success ) ;

    expect( exitos ).toHaveLength( 1 ) ;
    expect( fallos ).toHaveLength( 1 ) ;
    expect( fallos[ 0 ]!.error ).toBe( "El pago ya fue resuelto." ) ;

    // Exactamente 1 pago registrado
    const pagos = await db.select().from( memberPayments ).where( eq( memberPayments.organizationId , orgA ) ) ;
    expect( pagos ).toHaveLength( 1 ) ;
  } ) ;
} ) ;
