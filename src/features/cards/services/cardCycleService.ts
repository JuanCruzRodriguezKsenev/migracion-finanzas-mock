/**
 * @file cardCycleService.ts
 * Resuelve la partición del saldo de una tarjeta de crédito entre lo ya facturado y lo que está
 * en curso (RFC 007 §4), apoyándose en el ciclo puro de `ciclo.ts` y en la agregación acotada del
 * libro mayor.
 */
// Feature: Accounting
import { ledgerRepository } from "@/features/accounting/repositories/ledgerRepository" ;

// Feature: Cards
import { CardWithAccountsAndEntity , CicloTarjeta } from "../types" ;
import { calcularPeriodos }                        from "../utils/ciclo" ;


/**
 * Resuelve el ciclo y la partición de saldo de una única tarjeta de crédito.
 *
 * La deuda de un pasivo crece con el **crédito** del asiento, así que la partición es
 * `credit - debit` y no al revés: un consumo acredita la tarjeta. Es el mismo cambio de signo que
 * `deudaDe` aplica sobre el saldo acumulado, pero acá sobre un rango de asientos.
 *
 * @param card - Tarjeta con sus cuentas contables ya resueltas.
 * @param organizationId - Organización dueña, para el aislamiento multi-tenant de la agregación.
 * @param zonaHoraria - Identificador IANA con el que se decide a qué día del mes pertenece un consumo.
 * @returns El ciclo con su partición, o `null` si la tarjeta no tiene ciclo que calcular.
 */
export async function calcularCicloDeTarjeta(
  card:           CardWithAccountsAndEntity ,
  organizationId: string ,
  zonaHoraria:    string
): Promise< CicloTarjeta | null > {
  // Una tarjeta de débito no tiene ciclo, y una de crédito sin día de cierre tampoco: sin cierre no
  // hay nada que congelar, así que todo su saldo está en curso.
  if( (card.type !== "credit") || !card.closingDay ){
    return( null ) ;
  }

  const periodos = calcularPeriodos(
    card.closingDay ,
    ( card.dueDay || card.closingDay ) ,
    new Date() ,
    zonaHoraria
  ) ;

  // Dos consultas por cuenta, todas en paralelo: la cascada es lo que el §8D del RFC prohíbe.
  const porCuenta = await Promise.all( card.accounts.map( async (ca) => {
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
  } ) ;
}

/**
 * Resuelve el ciclo de un lote de tarjetas en paralelo.
 *
 * @param cards - Tarjetas a resolver.
 * @param organizationId - Organización dueña.
 * @param zonaHoraria - Identificador IANA de la zona horaria del usuario.
 * @returns Las mismas tarjetas, cada una con su `ciclo` resuelto (o `null` si no le corresponde).
 */
export async function calcularCiclosDeTarjetas(
  cards:          CardWithAccountsAndEntity[] ,
  organizationId: string ,
  zonaHoraria:    string
): Promise< CardWithAccountsAndEntity[] > {
  return( await Promise.all( cards.map( async (card) => ( {
    ...card ,
    ciclo: await calcularCicloDeTarjeta( card , organizationId , zonaHoraria ) ,
  } ) ) ) ) ;
}
