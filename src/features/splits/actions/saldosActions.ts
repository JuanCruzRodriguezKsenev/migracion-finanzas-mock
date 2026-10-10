/**
 * @file saldosActions.ts
 * Server Actions de los saldos entre miembros: leerlos, registrar un pago y solicitar un pago. Toman usuario y
 * organización de la sesión y leen el rol de la base (`membershipRepository.findMembership`), nunca del token.
 * Un pago no crea asientos (RN-23): vive en `member_payments`, aparte del libro mayor.
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { armarClaveIdempotencia , conIdempotencia } from "@/shared/services/idempotencyService" ;
import { ok , fail , Result }  from "@/shared/lib/result" ;
import { authOptions }         from "@/shared/lib/auth" ;
import { logger }              from "@/shared/lib/logger" ;
import { db }                   from "@/shared/db/client" ;
import { claveDeDia }          from "@/shared/lib/monthKey" ;

// Feature: Auth
import { obtenerSesionDeEscritura } from "@/features/auth/services/authorizationService" ;

// Feature: Budgets
import { budgetsService } from "@/features/budgets/services/budgetsService" ;

// Feature: Auth
import { membershipRepository } from "@/features/auth/repositories/membershipRepository" ;
import { nombreVisible }        from "@/features/auth/utils/nombreVisible" ;

// Feature: Notifications
import { notificar } from "@/features/notifications/services/notificationService" ;

// Feature: Splits
import { registrarPagoSchema , solicitarPagoSchema , RegistrarPagoInput , SolicitarPagoInput } from "../schemas/saldos.schema" ;
import { registrarPagoEnTx , saldoCon }                                                         from "../services/pagosService" ;
import { saldosRepository }                                                                    from "../repositories/saldosRepository" ;
import { acuerdoRepository }                                                                   from "../repositories/acuerdoRepository" ;
import { calcularSaldos }                                                                      from "../utils/saldos" ;


/** Un saldo en la vista: con quién, en qué divisa y cuánto (con signo: `+` te deben, `-` debés). */
export interface SaldoVista {
  /** `null` agrupa a los ex miembros («Miembro anterior», S-AE). */
  contraparteId:   string | null ;
  nombre:          string | null ;
  divisa:          string ;
  montoEnCentavos: number ;
}

/** Los saldos tal como los ve quien los pide. */
export interface VistaSaldos {
  rol:           string ;
  /** `false` para el `viewer`: ve los saldos sin botones. */
  puedeEscribir: boolean ;
  /** ¿Existe la pestaña? Modo del acuerdo distinto de `none`, o alguna deuda o pago (S-X). */
  visible:       boolean ;
  saldos:        SaldoVista[] ;
}

/** Contexto de quien llama: usuario, organización y rol vigentes en la base. */
interface Contexto {
  userId:         string ;
  organizationId: string ;
  rol:            string ;
}

/** Lee el contexto de la sesión; el rol sale de la base. */
async function contextoDeSesion(): Promise< Contexto | null > {
  const sesion         = ( await getServerSession( authOptions ) ) as { user?: { id?: string ; organizationId?: string } } | null ;
  const userId         = sesion?.user?.id ;
  const organizationId = sesion?.user?.organizationId ;

  if( !userId || !organizationId ) {
    return( null ) ;
  }

  const membresia = await membershipRepository.findMembership( userId , organizationId ) ;

  return( membresia ? { userId , organizationId , rol: membresia.role } : null ) ;
}


/**
 * Lee los saldos de quien llama con cada otro miembro, por divisa y sin compensar entre divisas. Todos los roles.
 *
 * @returns La vista de saldos y si la pestaña debe mostrarse.
 */
export async function obtenerSaldosAction(): Promise< Result< VistaSaldos , string > > {
  const contexto = await contextoDeSesion() ;

  if( !contexto ) {
    return( fail( "No autorizado." ) ) ;
  }

  const { userId , organizationId , rol } = contexto ;

  try {
    const [ deudas , pagos , acuerdo , actividad , miembros ] = await Promise.all( [
      saldosRepository.deudasDe( organizationId , userId ) ,
      saldosRepository.pagosDe( organizationId , userId ) ,
      acuerdoRepository.obtener( organizationId ) ,
      saldosRepository.hayActividad( organizationId ) ,
      membershipRepository.findByOrganization( organizationId ) ,
    ] ) ;

    const nombres = new Map( miembros.map( ( m ) => [ m.userId , nombreVisible( m.nombre , m.email ) ] as [ string , string ] ) ) ;

    return( ok( {
      rol ,
      puedeEscribir: ( rol !== "viewer" ) ,
      visible:       ( ((acuerdo?.modo ?? "none") !== "none") || actividad ) ,
      saldos:        calcularSaldos( userId , deudas , pagos ).map( ( s ) => ( {
        contraparteId:   s.contraparteId ,
        nombre:          ( s.contraparteId ? (nombres.get( s.contraparteId ) ?? null) : null ) ,
        divisa:          s.divisa ,
        montoEnCentavos: s.montoEnCentavos ,
      } ) ) ,
    } ) ) ;
  } catch( error ) {
    logger.error( "Error en obtenerSaldosAction." , { organizationId , error: String( error ) } ) ;
    return( fail( "Error al consultar los saldos." ) ) ;
  }
}

/**
 * Registra un pago que recibe quien llama (el acreedor). Exige que la contraparte le deba algo en esa divisa;
 * si el monto supera el saldo se acepta y el saldo cambia de signo (A9). No crea asientos. Avisa a la contraparte.
 *
 * @param datos - Contraparte (quien pagó), divisa y monto en centavos.
 * @returns Éxito, o `fail` con el motivo.
 */
export async function registrarPagoAction( datos: RegistrarPagoInput , claveDeEnvio?: string ): Promise< Result< null , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const validation = registrarPagoSchema.safeParse( datos ) ;

  if( !validation.success ) {
    return( fail( validation.error.issues[ 0 ]?.message || "Datos del pago inválidos." ) ) ;
  }

  const { userId , organizationId }                  = sesion.value ;
  const { contraparteId , divisa , montoEnCentavos } = validation.data ;

  if( contraparteId === userId ) {
    return( fail( "No podés registrar un pago a vos mismo." ) ) ;
  }

  let clave: string | null ;

  try {
    clave = armarClaveIdempotencia( { userId: sesion.value.userId , accion: "registrarPago" , claveCliente: claveDeEnvio , datos: validation.data } ) ;
  } catch {
    return( fail( "Clave de envío inválida." ) ) ;
  }

  return( await conIdempotencia( clave , async () => {
    try {
      return( await db.transaction( async ( tx ) => {
        await saldosRepository.bloquearPar( organizationId , userId , contraparteId , tx ) ;

        return( await registrarPagoEnTx( { organizationId , acreedorId: userId , deudorId: contraparteId , divisa , montoEnCentavos } , tx ) ) ;
      } ) ) ;
    } catch( error ) {
      logger.error( "Error en registrarPagoAction." , { organizationId , error: String( error ) } ) ;
      return( fail( "No se pudo registrar el pago." ) ) ;
    }
  } ) ) ;
}

/**
 * Solicita un pago a quien le debe a quien llama. Una solicitud por día, par y divisa, con el día en la zona del
 * acreedor (RN-11, S-AC). El aviso lleva el saldo del momento. Solicitud y aviso van en la misma transacción.
 *
 * @param datos - Contraparte (el deudor) y divisa.
 * @returns Éxito, o `fail` con el motivo (p. ej. ya se solicitó hoy).
 */
export async function solicitarPagoAction( datos: SolicitarPagoInput ): Promise< Result< null , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const validation = solicitarPagoSchema.safeParse( datos ) ;

  if( !validation.success ) {
    return( fail( validation.error.issues[ 0 ]?.message || "Datos de la solicitud inválidos." ) ) ;
  }

  const { userId , organizationId } = sesion.value ;
  const { contraparteId , divisa }  = validation.data ;

  if( contraparteId === userId ) {
    return( fail( "No podés solicitarte un pago a vos mismo." ) ) ;
  }

  try {
    const { zona } = await budgetsService.preferenciasDe( userId ) ;
    const dayKey   = claveDeDia( new Date() , zona ) ;

    return( await db.transaction( async ( tx ) => {
      await saldosRepository.bloquearPar( organizationId , userId , contraparteId , tx ) ;

      const actor       = await membershipRepository.findMembership( userId , organizationId , tx ) ;
      const contraparte = await membershipRepository.findMembership( contraparteId , organizationId , tx ) ;

      if( !actor || (actor.role === "viewer") ) {
        return( fail( "No autorizado." ) ) ;
      }

      if( !contraparte ) {
        return( fail( "La persona elegida no es miembro de la organización." ) ) ;
      }

      const saldo = await saldoCon( organizationId , userId , contraparteId , divisa , tx ) ;

      if( saldo <= 0 ) {
        return( fail( "Sólo quien es acreedor puede solicitar un pago: esa persona no te debe nada en esa divisa." ) ) ;
      }

      const inserto = await saldosRepository.registrarSolicitud( { organizationId , fromUserId: userId , toUserId: contraparteId , currency: divisa , dayKey } , tx ) ;

      if( !inserto ) {
        return( fail( "Ya solicitaste un pago a esta persona hoy en esa divisa." ) ) ;
      }

      await notificar( { organizationId , tipo: "payment_requested" , actorId: userId , monto: saldo , divisa , destinatarios: [ contraparteId ] } , tx ) ;

      return( ok( null ) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error en solicitarPagoAction." , { organizationId , error: String( error ) } ) ;
    return( fail( "No se pudo solicitar el pago." ) ) ;
  }
}
