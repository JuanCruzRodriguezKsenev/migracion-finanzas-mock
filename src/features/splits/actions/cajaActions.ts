/**
 * @file cajaActions.ts
 * Server Actions de la caja común: leer las participaciones y registrar un aporte o un retiro. Toman usuario y
 * organización de la sesión y leen el rol de la base (`membershipRepository.findMembership`), nunca del token.
 * Un aporte o retiro no crea asientos (RN-26): vive en `common_pot_contributions`, aparte del libro mayor, y no
 * genera avisos (RN-9 no incluye ninguno de caja).
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;
import { db }                 from "@/shared/db/client" ;

// Feature: Auth
import { membershipRepository } from "@/features/auth/repositories/membershipRepository" ;
import { nombreVisible }        from "@/features/auth/utils/nombreVisible" ;

// Feature: Splits
import { registrarAporteCajaSchema , RegistrarAporteCajaInput } from "../schemas/caja.schema" ;
import { acuerdoRepository }                                    from "../repositories/acuerdoRepository" ;
import { cajaRepository }                                       from "../repositories/cajaRepository" ;
import { calcularParticipaciones }                              from "../utils/caja" ;


/** Cuántos registros recientes lista la vista. */
const REGISTROS_RECIENTES = 50 ;

/** Una fila de la participación en la vista: nombre `null` = «Miembro anterior». */
export interface FilaCajaVista {
  userId: string | null ;
  nombre: string | null ;
  neto:   number ;
  /** Puntos básicos (`10000` = 100 %); `null` si el total no es positivo. */
  bp:     number | null ;
}

/** Participaciones de una divisa en la vista. */
export interface ParticipacionVista {
  divisa: string ;
  total:  number ;
  filas:  FilaCajaVista[] ;
}

/** Un aporte o retiro reciente en la vista. */
export interface AporteVista {
  id:            string ;
  userId:        string | null ;
  nombre:        string | null ;
  amountInCents: number ;
  currency:      string ;
  note:          string | null ;
  /** ISO 8601. */
  occurredAt:    string ;
}

/** La caja común tal como la ve quien la pide. */
export interface VistaCaja {
  /** Quien mira: el `owner` lo usa como miembro por omisión del selector. */
  yoId:            string ;
  rol:             string ;
  /** `false` para el `viewer`: ve la caja sin botones. */
  puedeEscribir:   boolean ;
  /** ¿Existe la pestaña? Sólo con la caja común activa en el acuerdo (RN-25). */
  visible:         boolean ;
  /** Divisas en las que se puede registrar: las de las cuentas marcadas como caja (S-AK). */
  divisas:         string[] ;
  participaciones: ParticipacionVista[] ;
  aportes:         AporteVista[] ;
  /** `owner`: todos los miembros no `viewer`. `member`: sólo él. `viewer`: nadie. */
  miembros:        { userId: string ; nombre: string }[] ;
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
 * Lee la caja común de la organización activa: participaciones por divisa, registros recientes y miembros
 * elegibles. Todos los roles pueden leer. Sin la caja activa devuelve `visible: false` y ningún dato.
 *
 * @returns La vista de la caja y si la pestaña debe mostrarse.
 */
export async function obtenerCajaAction(): Promise< Result< VistaCaja , string > > {
  const contexto = await contextoDeSesion() ;

  if( !contexto ) {
    return( fail( "No autorizado." ) ) ;
  }

  const { userId , organizationId , rol } = contexto ;

  try {
    const acuerdo = await acuerdoRepository.obtener( organizationId ) ;

    if( !(acuerdo?.usesCommonPot) ) {
      return( ok( { yoId: userId , rol , puedeEscribir: false , visible: false , divisas: [] , participaciones: [] , aportes: [] , miembros: [] } ) ) ;
    }

    const [ aportes , recientes , cuentas , miembros ] = await Promise.all( [
      cajaRepository.listarAportes( organizationId ) ,
      cajaRepository.listarRecientes( organizationId , REGISTROS_RECIENTES ) ,
      cajaRepository.cuentasDeCaja( organizationId ) ,
      membershipRepository.findByOrganization( organizationId ) ,
    ] ) ;

    const nombres   = new Map( miembros.map( ( m ) => [ m.userId , nombreVisible( m.nombre , m.email ) ] as [ string , string ] ) ) ;
    const nombreDe  = ( id: string | null ): string | null => ( id ? (nombres.get( id ) ?? null) : null ) ;
    const noViewer  = miembros.filter( ( m ) => (m.rol !== "viewer") ) ;
    const elegibles = ( rol === "owner" ) ? noViewer : ( (rol === "member") ? noViewer.filter( ( m ) => (m.userId === userId) ) : [] ) ;

    return( ok( {
      yoId:            userId ,
      rol ,
      puedeEscribir:   ( rol !== "viewer" ) ,
      visible:         true ,
      divisas:         [ ...new Set( cuentas.map( ( c ) => c.currency ) ) ].sort() ,
      participaciones: calcularParticipaciones( aportes ).map( ( p ) => ( {
        divisa: p.divisa ,
        total:  p.total ,
        filas:  p.filas.map( ( f ) => ( { userId: f.userId , nombre: nombreDe( f.userId ) , neto: f.neto , bp: f.bp } ) ) ,
      } ) ) ,
      aportes:         recientes.map( ( r ) => ( {
        id:            r.id ,
        userId:        r.userId ,
        nombre:        nombreDe( r.userId ) ,
        amountInCents: r.amountInCents ,
        currency:      r.currency ,
        note:          r.note ,
        occurredAt:    r.occurredAt.toISOString() ,
      } ) ) ,
      miembros:        elegibles.map( ( m ) => ( { userId: m.userId , nombre: nombreVisible( m.nombre , m.email ) } ) ) ,
    } ) ) ;
  } catch( error ) {
    logger.error( "Error en obtenerCajaAction." , { organizationId , error: String( error ) } ) ;
    return( fail( "Error al consultar la caja común." ) ) ;
  }
}

/**
 * Registra un aporte (monto positivo) o un retiro (monto negativo) en la caja común. `owner`: el de cualquier
 * miembro no `viewer`; `member`: sólo el propio; `viewer`: no. Un retiro no puede superar el neto del miembro en
 * esa divisa. Todo en una transacción serializada por organización (NFR-3). No escribe en el libro mayor ni avisa.
 *
 * @param datos - Miembro (opcional: por defecto, quien llama), divisa, monto con signo en centavos y nota.
 * @returns Éxito, o `fail` con el motivo.
 */
export async function registrarAporteCajaAction( datos: RegistrarAporteCajaInput ): Promise< Result< null , string > > {
  const contexto = await contextoDeSesion() ;

  if( !contexto || (contexto.rol === "viewer") ) {
    return( fail( "No autorizado." ) ) ;
  }

  const validation = registrarAporteCajaSchema.safeParse( datos ) ;

  if( !validation.success ) {
    return( fail( validation.error.issues[ 0 ]?.message || "Datos del aporte inválidos." ) ) ;
  }

  const { userId , organizationId }         = contexto ;
  const { currency , amountInCents , note } = validation.data ;
  const objetivoId                          = ( validation.data.userId ?? userId ) ;

  try {
    return( await db.transaction( async ( tx ) => {
      await cajaRepository.bloquear( organizationId , tx ) ;

      // El rol se revalida dentro de la transacción: quien llama pudo perderlo mientras esperaba el candado
      const actor = await membershipRepository.findMembership( userId , organizationId , tx ) ;

      if( !actor || (actor.role === "viewer") ) {
        return( fail( "No autorizado." ) ) ;
      }

      if( (actor.role !== "owner") && (objetivoId !== userId) ) {
        return( fail( "No autorizado." ) ) ;
      }

      const objetivo = ( (objetivoId === userId) ? actor : await membershipRepository.findMembership( objetivoId , organizationId , tx ) ) ;

      if( !objetivo || (objetivo.role === "viewer") ) {
        return( fail( "La persona elegida no es un miembro que pueda aportar a la caja." ) ) ;
      }

      const acuerdo = await acuerdoRepository.obtener( organizationId , tx ) ;
      const cuentas = await cajaRepository.cuentasDeCaja( organizationId , tx ) ;

      if( !(acuerdo?.usesCommonPot) || !cuentas.some( ( c ) => (c.currency === currency) ) ) {
        return( fail( "Ninguna cuenta de la caja común usa esa divisa." ) ) ;
      }

      if( amountInCents < 0 ) {
        const neto = await cajaRepository.netoDe( organizationId , objetivoId , currency , tx ) ;

        if( (neto + amountInCents) < 0 ) {
          return( fail( "No podés retirar más de lo que aportaste." ) ) ;
        }
      }

      await cajaRepository.insertar( {
        organizationId ,
        userId:             objetivoId ,
        amountInCents ,
        currency ,
        note:               ( note?.trim() || null ) ,
        registeredByUserId: userId ,
      } , tx ) ;

      return( ok( null ) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error en registrarAporteCajaAction." , { organizationId , error: String( error ) } ) ;
    return( fail( "No se pudo registrar el movimiento de la caja." ) ) ;
  }
}
