/**
 * @file acuerdoActions.ts
 * Server Actions del acuerdo de reparto: leerlo, guardarlo, declarar el aporte del mes y previsualizar
 * el reparto de un gasto. Todas toman usuario y organización de la sesión y leen el rol de la base
 * (`membershipRepository.findMembership`), nunca del token ni del cliente.
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { ok , fail , Result }                from "@/shared/lib/result" ;
import { authOptions }                       from "@/shared/lib/auth" ;
import { logger }                            from "@/shared/lib/logger" ;
import { db }                                from "@/shared/db/client" ;
import { claveDeMesActual }                  from "@/shared/lib/monthKey" ;

// Feature: Budgets
import { budgetsService } from "@/features/budgets/services/budgetsService" ;

// Feature: Auth
import { membershipRepository }      from "@/features/auth/repositories/membershipRepository" ;
import { autorizarTitularPorCuenta } from "@/features/auth/services/titularService" ;
import { nombreVisible }             from "@/features/auth/utils/nombreVisible" ;

// Feature: Notifications
import { notificar } from "@/features/notifications/services/notificationService" ;

// Feature: Splits
import { guardarAcuerdoSchema , declararAporteSchema , previsualizarSchema , GuardarAcuerdoInput , DeclararAporteInput , PrevisualizarInput } from "../schemas/acuerdo.schema"
import { validarAcuerdo , resolverReparto }                                                                                                   from "../services/acuerdoService"
import { acuerdoRepository }                                                                                                                  from "../repositories/acuerdoRepository"
import { cajaRepository }                                                                                                                    from "../repositories/cajaRepository"
import { calcularPesos , type ModoAcuerdo , type MotivoReparto }                                                                              from "../utils/reparto"


/** Un miembro en la vista del acuerdo. */
export interface MiembroDelAcuerdo {
  userId:        string ;
  nombre:        string ;
  /** Proporción en puntos básicos: el porcentaje fijo, o el peso relativo de los aportes. */
  porcentajeBp:  number ;
  /** Aporte declarado para el mes en curso; `null` si no declaró ese mes. */
  aporteDelMes:  number | null ;
}

/** El acuerdo tal como lo ve quien lo pide. */
export interface VistaAcuerdo {
  rol:           "owner" | "member" ;
  modo:          ModoAcuerdo ;
  usesCommonPot: boolean ;
  /** Mes en curso en la zona de quien mira (`month` de 1 a 12). */
  mes:           { year: number ; month: number } ;
  /** `owner`: todos los miembros no `viewer`. `member`: sólo él. */
  miembros:      MiembroDelAcuerdo[] ;
  partesIguales: boolean ;
  /** Cuentas de activo que pueden marcarse como caja común. Vacía para el `member`: sólo el `owner` las edita. */
  cuentasMarcables: { id: string ; nombre: string ; divisa: string ; esCaja: boolean }[] ;
}

/** Una parte de la vista previa. */
export interface ParteDelReparto {
  userId:          string ;
  nombre:          string ;
  porcentajeBp:    number ;
  montoEnCentavos: number ;
  esDeuda:         boolean ;
}

/** Vista previa del reparto de un gasto. Sólo lee. */
export interface VistaPreviaReparto {
  aplica:         boolean ;
  motivo:         MotivoReparto ;
  /** Nombre del titular (el acreedor) cuando aplica. */
  titular:        string | null ;
  partes:         ParteDelReparto[] ;
  partesIguales:  boolean ;
  desactualizado: boolean ;
}

/** Contexto de quien llama: usuario, organización y rol vigentes en la base. */
interface Contexto {
  userId:         string ;
  organizationId: string ;
  rol:            string ;
}

/** Lee el contexto de la sesión; el rol sale de la base. */
async function contextoDe( session: Awaited< ReturnType< typeof getServerSession > > ): Promise< Contexto | null > {
  const sesion         = session as { user?: { id?: string ; organizationId?: string } } | null ;
  const userId         = sesion?.user?.id ;
  const organizationId = sesion?.user?.organizationId ;

  if( !userId || !organizationId ) {
    return( null ) ;
  }

  const membresia = await membershipRepository.findMembership( userId , organizationId ) ;

  return( membresia ? { userId , organizationId , rol: membresia.role } : null ) ;
}

/** Misma sesión, pero sólo `owner` o `member`: el `viewer` no accede a nada del reparto (S-W). */
async function contextoNoViewer(): Promise< Contexto | null > {
  const contexto = await contextoDe( await getServerSession( authOptions ) ) ;

  return( (contexto && (contexto.rol !== "viewer")) ? contexto : null ) ;
}

/** Mes en curso en la zona del usuario, como `{ year , month }`. */
async function mesEnCurso( userId: string ): Promise< { year: number ; month: number } > {
  const { zona } = await budgetsService.preferenciasDe( userId ) ;
  const [ year , month ] = claveDeMesActual( zona ).split( "-" ).map( Number ) ;

  return( { year , month } ) ;
}

/**
 * Lee el acuerdo de la organización activa. `owner`: modo, porcentajes y aportes del mes de todos los miembros
 * no `viewer`. `member`: el modo, su proporción y su aporte. `viewer`: `fail`.
 *
 * @returns La vista del acuerdo según el rol.
 */
export async function obtenerAcuerdoAction(): Promise< Result< VistaAcuerdo , string > > {
  const contexto = await contextoNoViewer() ;

  if( !contexto ) {
    return( fail( "No autorizado." ) ) ;
  }

  const { userId , organizationId , rol } = contexto ;

  try {
    const [ acuerdo , miembros , mes ] = await Promise.all( [
      acuerdoRepository.obtener( organizationId ) ,
      membershipRepository.findByOrganization( organizationId ) ,
      mesEnCurso( userId ) ,
    ] ) ;

    const modo     = ( acuerdo?.modo ?? "none" ) ;
    const noViewer = miembros.filter( ( m ) => (m.rol !== "viewer") ) ;
    const ids      = noViewer.map( ( m ) => m.userId ) ;
    const aportes  = await acuerdoRepository.aportesDe( organizationId , ids ) ;
    const porcentajesBp = new Map( ( acuerdo?.porcentajes ?? [] ).map( ( p ) => [ p.userId , p.percentageBp ] as [ string , number ] ) ) ;
    const { pesos , partesIguales } = calcularPesos( { modo , miembros: ids , porcentajesBp , aportes , mes } ) ;

    let sumaPesos = 0 ;
    for( const peso of pesos.values() ) {
      sumaPesos += peso ;
    }

    const proporcionDe = ( id: string ): number => {
      if( modo === "fixed_percentages" ) {
        return( porcentajesBp.get( id ) ?? 0 ) ;
      }

      if( (modo === "none") || (sumaPesos === 0) ) {
        return( 0 ) ;
      }

      return( Math.floor( Number( (BigInt( pesos.get( id ) ?? 0 ) * BigInt( 10000 )) / BigInt( sumaPesos ) ) ) ) ;
    } ;

    const visibles = ( rol === "owner" ) ? noViewer : noViewer.filter( ( m ) => (m.userId === userId) ) ;
    const cuentas  = ( rol === "owner" ) ? await cajaRepository.cuentasMarcables( organizationId ) : [] ;

    return( ok( {
      rol:           ( rol === "owner" ) ? "owner" : "member" ,
      modo ,
      usesCommonPot: ( acuerdo?.usesCommonPot ?? false ) ,
      mes ,
      partesIguales: ( modo === "monthly_contributions" ) && partesIguales ,
      cuentasMarcables: cuentas.map( ( c ) => ( { id: c.id , nombre: c.name , divisa: c.currency , esCaja: c.isCommonPot } ) ) ,
      miembros:      visibles.map( ( m ) => ( {
        userId:       m.userId ,
        nombre:       nombreVisible( m.nombre , m.email ) ,
        porcentajeBp: proporcionDe( m.userId ) ,
        aporteDelMes: ( aportes.find( ( a ) => (a.userId === m.userId) && (a.year === mes.year) && (a.month === mes.month) )?.amountInCents ?? null ) ,
      } ) ) ,
    } ) ) ;
  } catch( error ) {
    logger.error( "Error en obtenerAcuerdoAction." , { error: String( error ) } ) ;
    return( fail( "Error al consultar el acuerdo." ) ) ;
  }
}

/** ¿El acuerdo nuevo es igual al guardado? Un acuerdo sin fila equivale a «sin reparto». Compara también las cuentas de la caja. */
function esIgual( anterior: Awaited< ReturnType< typeof acuerdoRepository.obtener > > , nuevo: { modo: string ; usesCommonPot: boolean ; porcentajes: { userId: string ; percentageBp: number }[] } , cuentasAnteriores: string[] , cuentasNuevas: string[] ): boolean {
  const modoAnterior = ( anterior?.modo ?? "none" ) ;
  const potAnterior  = ( anterior?.usesCommonPot ?? false ) ;

  if( (modoAnterior !== nuevo.modo) || (potAnterior !== nuevo.usesCommonPot) ) {
    return( false ) ;
  }

  if( (cuentasAnteriores.length !== cuentasNuevas.length) || !cuentasNuevas.every( ( id ) => cuentasAnteriores.includes( id ) ) ) {
    return( false ) ;
  }

  const previos = new Map( ( anterior?.porcentajes ?? [] ).filter( ( p ) => (p.percentageBp > 0) ).map( ( p ) => [ p.userId , p.percentageBp ] as [ string , number ] ) ) ;
  const nuevos  = nuevo.porcentajes.filter( ( p ) => (p.percentageBp > 0) ) ;

  return( (previos.size === nuevos.length) && nuevos.every( ( p ) => (previos.get( p.userId ) === p.percentageBp) ) ) ;
}

/**
 * Guarda el acuerdo de la organización. Sólo `owner`. Vale hacia adelante: no toca los gastos ya cargados (RN-21).
 * Todo en una transacción serializada por organización (NFR-3). Si algo cambió, avisa a todos los miembros menos
 * al actor (RN-9e, RN-10); si no cambió nada, no avisa.
 *
 * @param datos - Modo, caja común y porcentajes (puntos básicos).
 * @returns Éxito, o `fail` con el motivo (p. ej. «Suman 90 %: faltan 10»).
 */
export async function guardarAcuerdoAction( datos: GuardarAcuerdoInput ): Promise< Result< null , string > > {
  const contexto = await contextoDe( await getServerSession( authOptions ) ) ;

  if( !contexto || (contexto.rol !== "owner") ) {
    return( fail( "No autorizado." ) ) ;
  }

  const validation = guardarAcuerdoSchema.safeParse( datos ) ;

  if( !validation.success ) {
    return( fail( validation.error.issues[ 0 ]?.message || "Datos del acuerdo inválidos." ) ) ;
  }

  const { userId , organizationId } = contexto ;
  const { modo , usesCommonPot }    = validation.data ;

  try {
    return( await db.transaction( async ( tx ) => {
      await acuerdoRepository.bloquear( organizationId , tx ) ;

      // El rol se revalida dentro de la transacción: quien llama pudo perderlo mientras esperaba el candado
      const actor = await membershipRepository.findMembership( userId , organizationId , tx ) ;

      if( !actor || (actor.role !== "owner") ) {
        return( fail( "No autorizado." ) ) ;
      }

      const miembros = await membershipRepository.findByOrganization( organizationId , tx ) ;
      const valido   = validarAcuerdo( { modo , porcentajes: validation.data.porcentajes , miembrosNoViewer: miembros.filter( ( m ) => (m.rol !== "viewer") ).map( ( m ) => m.userId ) } ) ;

      if( !valido.success ) {
        return( fail( valido.error ) ) ;
      }

      // Las cuentas de la caja (S-AG): sólo activos de esta organización, y al menos una si la caja está activa
      const cuentasCajaIds = [ ...new Set( usesCommonPot ? validation.data.cuentasCajaIds : [] ) ] ;

      if( usesCommonPot && (cuentasCajaIds.length === 0) ) {
        return( fail( "Elegí al menos una cuenta para la caja común." ) ) ;
      }

      const marcables = new Set( ( await cajaRepository.cuentasMarcables( organizationId , tx ) ).map( ( c ) => c.id ) ) ;

      if( !cuentasCajaIds.every( ( id ) => marcables.has( id ) ) ) {
        return( fail( "Cuenta inválida para la caja común." ) ) ;
      }

      const anterior          = await acuerdoRepository.obtener( organizationId , tx ) ;
      const cuentasAnteriores = ( await cajaRepository.cuentasDeCaja( organizationId , tx ) ).map( ( c ) => c.id ) ;
      const nuevo             = { modo , usesCommonPot , porcentajes: valido.value } ;

      await acuerdoRepository.guardar( organizationId , nuevo , userId , tx ) ;
      await cajaRepository.marcarCuentas( organizationId , cuentasCajaIds , tx ) ;

      if( !esIgual( anterior , nuevo , cuentasAnteriores , cuentasCajaIds ) ) {
        await notificar( {
          organizationId ,
          tipo:          "agreement_changed" ,
          actorId:       userId ,
          destinatarios: miembros.filter( ( m ) => (m.userId !== userId) ).map( ( m ) => m.userId ) ,
        } , tx ) ;
      }

      return( ok( null ) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error en guardarAcuerdoAction." , { organizationId , error: String( error ) } ) ;
    return( fail( "No se pudo guardar el acuerdo." ) ) ;
  }
}

/**
 * Declara (o corrige) el aporte mensual de un miembro. `owner`: el de cualquier miembro no `viewer`; `member`:
 * sólo el propio. El mes no puede ser futuro respecto de la zona de quien declara.
 *
 * @param datos - Miembro (opcional: por defecto, quien llama), año, mes y centavos.
 * @returns Éxito, o `fail` con el motivo.
 */
export async function declararAporteAction( datos: DeclararAporteInput ): Promise< Result< null , string > > {
  const contexto = await contextoNoViewer() ;

  if( !contexto ) {
    return( fail( "No autorizado." ) ) ;
  }

  const validation = declararAporteSchema.safeParse( datos ) ;

  if( !validation.success ) {
    return( fail( validation.error.issues[ 0 ]?.message || "Datos del aporte inválidos." ) ) ;
  }

  const { userId , organizationId , rol } = contexto ;
  const { year , month , amountInCents }  = validation.data ;
  const objetivo                          = ( validation.data.userId ?? userId ) ;

  if( (rol !== "owner") && (objetivo !== userId) ) {
    return( fail( "No autorizado." ) ) ;
  }

  try {
    const membresia = await membershipRepository.findMembership( objetivo , organizationId ) ;

    if( !membresia || (membresia.role === "viewer") ) {
      return( fail( "La persona elegida no es un miembro que reparta gastos." ) ) ;
    }

    const actual = await mesEnCurso( userId ) ;

    if( ((year * 12) + month) > ((actual.year * 12) + actual.month) ) {
      return( fail( "No se puede declarar el aporte de un mes futuro." ) ) ;
    }

    await db.transaction( async ( tx ) => {
      await acuerdoRepository.upsertAporte( organizationId , objetivo , year , month , amountInCents , tx ) ;
    } ) ;

    return( ok( null ) ) ;
  } catch( error ) {
    logger.error( "Error en declararAporteAction." , { organizationId , error: String( error ) } ) ;
    return( fail( "No se pudo guardar el aporte." ) ) ;
  }
}

/**
 * Vista previa del reparto de un gasto: usa el **mismo** `resolverReparto` que la carga y no escribe nada (RN-17).
 * Para `viewer`: `fail`.
 *
 * @param datos - Tipo, monto, divisa, fecha, titular pedido y cuentas del formulario.
 * @returns Si aplica, el motivo y las partes de cada miembro.
 */
export async function previsualizarRepartoAction( datos: PrevisualizarInput ): Promise< Result< VistaPreviaReparto , string > > {
  const contexto = await contextoNoViewer() ;

  if( !contexto ) {
    return( fail( "No autorizado." ) ) ;
  }

  const validation = previsualizarSchema.safeParse( datos ) ;

  if( !validation.success ) {
    return( fail( validation.error.issues[ 0 ]?.message || "Datos de la vista previa inválidos." ) ) ;
  }

  const { userId , organizationId } = contexto ;
  const entrada                     = validation.data ;

  try {
    const titular = await autorizarTitularPorCuenta( organizationId , userId , entrada.holderUserId , entrada.accountIds ) ;

    if( !titular.success ) {
      return( fail( titular.error ) ) ;
    }

    const fecha = ( entrada.fecha && !isNaN( new Date( entrada.fecha ).getTime() ) ) ? new Date( entrada.fecha ) : new Date() ;

    const reparto = await resolverReparto( {
      orgId:           organizationId ,
      autorId:         userId ,
      titularId:       titular.value ,
      tipo:            entrada.tipo ,
      montoEnCentavos: entrada.montoEnCentavos ,
      currency:        entrada.currency ,
      occurredAt:      fecha ,
      cuentas:         entrada.accountIds ,
      esGastoManual:   true ,
      absorbe:         entrada.absorbe ,
    } ) ;

    if( !reparto.aplica || reparto.desactualizado ) {
      return( ok( { aplica: reparto.aplica , motivo: reparto.motivo , titular: null , partes: [] , partesIguales: false , desactualizado: reparto.desactualizado } ) ) ;
    }

    const miembros = await membershipRepository.findByOrganization( organizationId ) ;
    const nombres  = new Map( miembros.map( ( m ) => [ m.userId , nombreVisible( m.nombre , m.email ) ] as [ string , string ] ) ) ;
    const deudas   = new Map( reparto.deudas.map( ( d ) => [ d.userId , d.montoEnCentavos ] as [ string , number ] ) ) ;

    let sumaPesos = BigInt( 0 ) ;
    for( const p of reparto.pesos ) {
      sumaPesos += BigInt( p.peso ) ;
    }

    const partes: ParteDelReparto[] = reparto.pesos.map( ( p ) => {
      const esTitular = ( p.userId === reparto.titularId ) ;
      const monto     = esTitular ? reparto.parteTitular : ( deudas.get( p.userId ) ?? 0 ) ;

      return( {
        userId:          p.userId ,
        nombre:          ( nombres.get( p.userId ) ?? "" ) ,
        porcentajeBp:    ( sumaPesos > BigInt( 0 ) ) ? Number( (BigInt( p.peso ) * BigInt( 10000 )) / sumaPesos ) : 0 ,
        montoEnCentavos: monto ,
        esDeuda:         ( !esTitular && (monto > 0) ) ,
      } ) ;
    } ) ;

    return( ok( { aplica: true , motivo: "aplica" , titular: ( reparto.titularId ? (nombres.get( reparto.titularId ) ?? null) : null ) , partes , partesIguales: reparto.partesIguales , desactualizado: false } ) ) ;
  } catch( error ) {
    logger.error( "Error en previsualizarRepartoAction." , { organizationId , error: String( error ) } ) ;
    return( fail( "No se pudo calcular el reparto." ) ) ;
  }
}
