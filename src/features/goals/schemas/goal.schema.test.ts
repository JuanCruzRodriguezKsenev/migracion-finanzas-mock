/**
 * @file goal.schema.test.ts
 * Pruebas de las validaciones de entrada de Metas (RFC 011 §5).
 */
// Librerías externas
import { describe , it , expect } from "vitest" ;

// Feature: Goals
import { createGoalSchema , goalMovementSchema , updateGoalSchema , abandonGoalSchema } from "./goal.schema" ;


const UUID = "11111111-1111-4111-8111-111111111111" ;
const base = { name: "Viaje" , currency: "ARS" , targetAmount: 100000 } ;

describe( "goal.schema - createGoalSchema" , () => {
  it( "acepta una meta válida y recorta el nombre" , () => {
    const r = createGoalSchema.safeParse( { ...base , name: "  Viaje  " , targetDate: "2027-01-31" , priority: "high" } ) ;
    expect( r.success ).toBe( true ) ;
    if( r.success ) {
      expect( r.data.name ).toBe( "Viaje" ) ;
    }
  } ) ;

  it( "rechaza monto cero, negativo o decimal" , () => {
    expect( createGoalSchema.safeParse( { ...base , targetAmount: 0 } ).success ).toBe( false ) ;
    expect( createGoalSchema.safeParse( { ...base , targetAmount: -5 } ).success ).toBe( false ) ;
    expect( createGoalSchema.safeParse( { ...base , targetAmount: 10.5 } ).success ).toBe( false ) ;
  } ) ;

  it( "rechaza nombre vacío o de 151 caracteres" , () => {
    expect( createGoalSchema.safeParse( { ...base , name: "   " } ).success ).toBe( false ) ;
    expect( createGoalSchema.safeParse( { ...base , name: "a".repeat( 151 ) } ).success ).toBe( false ) ;
    expect( createGoalSchema.safeParse( { ...base , name: "a".repeat( 150 ) } ).success ).toBe( true ) ;
  } ) ;

  it( "rechaza divisa inválida, fecha mal formada o inexistente y prioridad inventada" , () => {
    expect( createGoalSchema.safeParse( { ...base , currency: "AR" } ).success ).toBe( false ) ;
    expect( createGoalSchema.safeParse( { ...base , targetDate: "31/01/2027" } ).success ).toBe( false ) ;
    expect( createGoalSchema.safeParse( { ...base , targetDate: "2027-02-31" } ).success ).toBe( false ) ;
    expect( createGoalSchema.safeParse( { ...base , targetDate: "2027-13-01" } ).success ).toBe( false ) ;
    expect( createGoalSchema.safeParse( { ...base , priority: "urgent" } ).success ).toBe( false ) ;
  } ) ;
} ) ;

describe( "goal.schema - resto" , () => {
  it( "movimiento: ids con forma de UUID y monto entero > 0" , () => {
    expect( goalMovementSchema.safeParse( { goalId: UUID , accountId: UUID , amount: 100 } ).success ).toBe( true ) ;
    expect( goalMovementSchema.safeParse( { goalId: "x" , accountId: UUID , amount: 100 } ).success ).toBe( false ) ;
    expect( goalMovementSchema.safeParse( { goalId: UUID , accountId: "x" , amount: 100 } ).success ).toBe( false ) ;
    expect( goalMovementSchema.safeParse( { goalId: UUID , accountId: UUID , amount: 0 } ).success ).toBe( false ) ;
    expect( goalMovementSchema.safeParse( { goalId: UUID , accountId: UUID , amount: 1.5 } ).success ).toBe( false ) ;
  } ) ;

  it( "edición no admite la divisa y abandono exige UUID" , () => {
    const edit = { goalId: UUID , name: "X" , targetAmount: 10 , priority: "normal" } ;
    expect( updateGoalSchema.safeParse( edit ).success ).toBe( true ) ;
    expect( updateGoalSchema.safeParse( { ...edit , currency: "USD" } ).success ).toBe( false ) ;
    expect( abandonGoalSchema.safeParse( { goalId: "nope" } ).success ).toBe( false ) ;
  } ) ;
} ) ;
