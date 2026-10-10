/**
 * @file pagosService.ts
 * Lógica de negocio compartida de pagos entre miembros y cálculo de saldo entre un par:
 * cálculo puntual de saldo con signo y registro de pago en transacción activa.
 */

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { DBOrTx }              from "@/shared/db/client" ;

// Feature: Auth
import { membershipRepository } from "@/features/auth/repositories/membershipRepository" ;

// Feature: Notifications
import { notificar } from "@/features/notifications/services/notificationService" ;

// Feature: Splits
import { saldosRepository } from "../repositories/saldosRepository" ;
import { calcularSaldos }   from "../utils/saldos" ;


/**
 * Datos requeridos para registrar un pago dentro de una transacción activa.
 */
export interface RegistrarPagoEnTxDatos {
  organizationId:  string ;
  acreedorId:      string ;
  deudorId:        string ;
  divisa:          string ;
  montoEnCentavos: number ;
}

/**
 * Saldo con signo de `userId` con `contraparteId` en `divisa` dentro de una transacción.
 * Positivo: la contraparte le debe a `userId`. Negativo: `userId` le debe a la contraparte.
 *
 * @param organizationId - Identificador de la organización.
 * @param userId - Usuario que mira su saldo.
 * @param contraparteId - La otra persona.
 * @param divisa - Código de la divisa (p. ej. "ARS").
 * @param tx - Transacción de base de datos activa.
 * @returns El saldo en centavos con signo.
 */
export async function saldoCon( organizationId: string , userId: string , contraparteId: string , divisa: string , tx: DBOrTx ): Promise< number > {
  const [ deudas , pagos ] = await Promise.all( [
    saldosRepository.deudasDe( organizationId , userId , tx ) ,
    saldosRepository.pagosDe( organizationId , userId , tx ) ,
  ] ) ;

  const saldo = calcularSaldos( userId , deudas , pagos ).find( ( s ) => (s.contraparteId === contraparteId) && (s.divisa === divisa) ) ;

  return( saldo?.montoEnCentavos ?? 0 ) ;
}

/**
 * Registra un pago dentro de una transacción activa sin abrir transacción ni tomar lock (eso lo hace quien llama).
 * Revalida que el acreedor no sea `viewer`, que el deudor sea miembro activo, que exista deuda (`saldo > 0`),
 * inserta el pago con `registeredByUserId: acreedorId` y emite el aviso `payment_received` al deudor.
 *
 * @param datos - Par acreedor/deudor, organización, divisa y monto.
 * @param tx - Transacción activa con el bloqueo de par ya tomado.
 * @returns `ok( null )` o `fail` con el motivo.
 */
export async function registrarPagoEnTx( datos: RegistrarPagoEnTxDatos , tx: DBOrTx ): Promise< Result< null , string > > {
  const { organizationId , acreedorId , deudorId , divisa , montoEnCentavos } = datos ;

  // El rol se revalida dentro de la transacción, y la contraparte debe seguir siendo miembro
  const actor       = await membershipRepository.findMembership( acreedorId , organizationId , tx ) ;
  const contraparte = await membershipRepository.findMembership( deudorId , organizationId , tx ) ;

  if( !actor || (actor.role === "viewer") ) {
    return( fail( "No autorizado." ) ) ;
  }

  if( !contraparte ) {
    return( fail( "La persona elegida no es miembro de la organización." ) ) ;
  }

  const saldo = await saldoCon( organizationId , acreedorId , deudorId , divisa , tx ) ;

  if( saldo <= 0 ) {
    return( fail( "Sólo quien es acreedor puede registrar un pago: esa persona no te debe nada en esa divisa." ) ) ;
  }

  await saldosRepository.insertarPago( { organizationId , fromUserId: deudorId , toUserId: acreedorId , amountInCents: montoEnCentavos , currency: divisa , registeredByUserId: acreedorId } , tx ) ;

  await notificar( { organizationId , tipo: "payment_received" , actorId: acreedorId , monto: montoEnCentavos , divisa , destinatarios: [ deudorId ] } , tx ) ;

  return( ok( null ) ) ;
}
