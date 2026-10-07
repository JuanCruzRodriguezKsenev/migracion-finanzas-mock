/**
 * @file goalViewFactory.ts
 * Factory de `GoalView` y `GoalsViewData` en memoria para los tests de componentes de Metas.
 */
// Feature: Goals
import type { Goal , GoalView , GoalsViewData , GoalCompatibleAccount } from "../types" ;


/**
 * Meta canónica: «Viaje», $2.000.000 (200.000.000 centavos), con $200.000 ahorrados (10 %).
 *
 * @param overrides - Campos de la vista a sobreescribir.
 * @param goalOverrides - Campos de la meta a sobreescribir.
 */
export function makeGoalView( overrides?: Partial< GoalView > , goalOverrides?: Partial< Goal > ): GoalView {
  const goal: Goal = {
    id:             "11111111-1111-4111-8111-111111111111" ,
    organizationId: "22222222-2222-4222-8222-222222222222" ,
    name:           "Viaje" ,
    currency:       "ARS" ,
    targetAmount:   200000000 ,
    targetDate:     "2027-08-06" ,
    priority:       "normal" ,
    status:         "active" ,
    completedAt:    null ,
    createdAt:      new Date( "2026-10-06T12:00:00Z" ) ,
    updatedAt:      new Date( "2026-10-06T12:00:00Z" ) ,
    ...goalOverrides
  } ;

  return( {
    goal ,
    ahorrado:        20000000 ,
    porcentaje:      10 ,
    porcentajeBarra: 10 ,
    mesesRestantes:  10 ,
    aporteSugerido:  18000000 ,
    vencida:         false ,
    historial:       [] ,
    reservas:        [] ,
    descubierta:     false ,
    ...overrides
  } ) ;
}

/** Cuenta compatible canónica: $1.000.000 de saldo, $200.000 reservados. */
export function makeAccount( overrides?: Partial< GoalCompatibleAccount > ): GoalCompatibleAccount {
  return( {
    id:        "33333333-3333-4333-8333-333333333333" ,
    name:      "Caja de ahorro" ,
    currency:  "ARS" ,
    balance:   100000000 ,
    reservado: 20000000 ,
    libre:     80000000 ,
    ...overrides
  } ) ;
}

/** Vista completa de la pantalla con indicadores coherentes con las metas dadas. */
export function makeViewData( metas: GoalView[] , overrides?: Partial< GoalsViewData > ): GoalsViewData {
  const objetivoTotal = metas.reduce( ( s , m ) => { return( s + m.goal.targetAmount ) ; } , 0 ) ;
  const ahorradoTotal = metas.reduce( ( s , m ) => { return( s + m.ahorrado ) ; } , 0 ) ;
  const completadas   = metas.filter( ( m ) => { return( m.goal.status === "completed" ) ; } ).length ;

  return( {
    currency:    "ARS" ,
    divisas:     [ "ARS" ] ,
    metas ,
    indicadores: {
      cantidad:        metas.length ,
      objetivoTotal ,
      ahorradoTotal ,
      porcentajeTotal: ( objetivoTotal > 0 ? Math.floor( (ahorradoTotal * 100) / objetivoTotal ) : 0 ) ,
      completadas ,
      porCompletar:    metas.length - completadas
    } ,
    cuentas:     [ makeAccount() ] ,
    ...overrides
  } ) ;
}
