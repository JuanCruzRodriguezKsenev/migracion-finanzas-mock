/**
 * @file cardCycleService.ts
 * Resuelve la partición del saldo de una tarjeta de crédito entre lo ya facturado y lo que está
 * en curso (RFC 007 §4), apoyándose en el ciclo puro de `ciclo.ts` y en la agregación acotada del
 * libro mayor.
 */
// Feature: Accounting
import { ledgerRepository } from "@/features/accounting/repositories/ledgerRepository" ;

// Feature: Subscriptions
import { obtenerHoyCivil } from "@/features/subscriptions/services/recurrenceService" ;

// Feature: Cards
import {
  CardWithAccountsAndEntity ,
  CardInstallmentPlanWithDetails ,
  CardInstallmentPlan ,
  CicloTarjeta
} from "../types" ;
import {
  cuotasFuturasPorDivisa ,
  cuotasImputadasDe ,
  pendientesDeCuotas
} from "./installmentService" ;
import { installmentPlansRepository } from "../repositories/installmentPlansRepository" ;
import { calcularPeriodos }           from "../utils/ciclo" ;


/**
 * Resuelve el ciclo, la partición de saldo y las cuotas futuras de una tarjeta de crédito.
 *
 * La deuda de un pasivo crece con el **crédito** del asiento, así que la partición es
 * `credit - debit` y no al revés: un consumo acredita la tarjeta. Es el mismo cambio de signo que
 * `deudaDe` aplica sobre el saldo acumulado, pero acá sobre un rango de asientos.
 *
 * @param card - Tarjeta con sus cuentas contables ya resueltas.
 * @param organizationId - Organización dueña, para el aislamiento multi-tenant de la agregación.
 * @param zonaHoraria - Identificador IANA con el que se decide a qué día del mes pertenece un consumo.
 * @param planes - Planes de cuotas de la tarjeta opcionales (si se omiten, se consultan del DAL).
 * @returns El ciclo con su partición y cuotas futuras, o `null` si la tarjeta es de débito.
 */
export async function calcularCicloDeTarjeta(
  card:           CardWithAccountsAndEntity ,
  organizationId: string ,
  zonaHoraria:    string ,
  planes?:        CardInstallmentPlan[]
): Promise< CicloTarjeta | null > {
  // Una tarjeta de débito no financia compromisos futuros ni posee ciclo
  if( card.type !== "credit" ) {
    return( null ) ;
  }

  // 1. Calcular cuotas futuras antes de verificar día de cierre (RFC 025 §8)
  const planesTarjeta = ( planes !== undefined
    ? planes
    : await installmentPlansRepository.findByCard( card.id , organizationId )
  ) ;
  const cuotasFuturas = cuotasFuturasPorDivisa( planesTarjeta ) ;

  // 2. Si no tiene día de cierre, todo su saldo está en curso y no hay fechas que congelar,
  // pero sus cuotas futuras deben quedar expuestas para deducir del disponible.
  if( !card.closingDay ) {
    return( {
      cierreAnterior: null ,
      cierreActual:   null ,
      vencimiento:    null ,
      facturado:      0 ,
      enCurso:        0 ,
      cuotasFuturas ,
    } ) ;
  }

  const periodos = calcularPeriodos(
    card.closingDay ,
    ( card.dueDay || card.closingDay ) ,
    new Date() ,
    zonaHoraria
  ) ;

  // Dos consultas por cuenta, todas en paralelo: la cascada es lo que el §8D del RFC prohíbe.
  const porCuenta = await Promise.all( card.accounts.map( async ( ca ) => {
    const [ facturado , enCurso ] = await Promise.all( [
      ledgerRepository.sumEntriesByAccountInRange(
        ca.accountId , organizationId , periodos.cierreAnterior , periodos.cierreActual
      ) ,
      ledgerRepository.sumEntriesByAccountInRange(
        ca.accountId , organizationId , periodos.cierreActual , null
      ) ,
    ] ) ;

    return( {
      facturado: ( facturado.credit - facturado.debit ) ,
      enCurso:   ( enCurso.credit   - enCurso.debit   ) ,
    } ) ;
  } ) ) ;

  return( {
    cierreAnterior: periodos.cierreAnterior.toISOString() ,
    cierreActual:   periodos.cierreActual.toISOString() ,
    vencimiento:    periodos.vencimiento.toISOString() ,
    facturado:      porCuenta.reduce( ( suma , p ) => suma + p.facturado , 0 ) ,
    enCurso:        porCuenta.reduce( ( suma , p ) => suma + p.enCurso   , 0 ) ,
    cuotasFuturas ,
  } ) ;
}

/**
 * Resuelve el ciclo, cuotas futuras y planes enriquecidos de un lote de tarjetas en paralelo.
 * Realiza una única consulta agregada de planes activos de la organización para evitar consultas N+1.
 *
 * @param cards - Tarjetas a resolver.
 * @param organizationId - Organización dueña.
 * @param zonaHoraria - Identificador IANA de la zona horaria del usuario.
 * @returns Las mismas tarjetas, cada una con su `ciclo` y `planes` resueltos (o `null` / `[]` si no le corresponde).
 */
export async function calcularCiclosDeTarjetas(
  cards:          CardWithAccountsAndEntity[] ,
  organizationId: string ,
  zonaHoraria:    string
): Promise< CardWithAccountsAndEntity[] > {
  const planesActivos = await installmentPlansRepository.findActiveByOrganization( organizationId ) ;
  const hoyCivil      = obtenerHoyCivil( zonaHoraria ) ;

  return( await Promise.all( cards.map( async ( card ) => {
    if( card.type !== "credit" ) {
      return( {
        ...card ,
        ciclo:  null ,
        planes: [] ,
      } ) ;
    }

    const planesDeTarjeta = planesActivos.filter( ( p ) => p.cardId === card.id ) ;
    const planesEnriquecidos: CardInstallmentPlanWithDetails[] = planesDeTarjeta.map( ( plan ) => ( {
      ...plan ,
      cuotasImputadas: cuotasImputadasDe( plan ) ,
      pendientes:      pendientesDeCuotas( plan , hoyCivil ) ,
    } ) ) ;

    return( {
      ...card ,
      ciclo:  await calcularCicloDeTarjeta( card , organizationId , zonaHoraria , planesDeTarjeta ) ,
      planes: planesEnriquecidos ,
    } ) ;
  } ) ) ) ;
}
