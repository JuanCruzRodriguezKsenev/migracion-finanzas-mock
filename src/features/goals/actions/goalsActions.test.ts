/**
 * @file goalsActions.test.ts
 * Pruebas de las Server Actions de Metas: sesión, validación y organización tomada de la sesión (RFC 011 §5).
 */
// Librerías externas
import { describe , it , expect , vi , beforeEach } from "vitest" ;
import { getServerSession }                          from "next-auth" ;
import type { Session }                              from "next-auth" ;

// Shared
import { db }          from "@/shared/db/client" ;
import { limpiarBase } from "@/shared/db/testCleanup" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { accounts } from "@/features/accounting/schema.db" ;

// Feature: Goals
import {
  createGoalAction ,
  updateGoalAction ,
  contributeToGoalAction ,
  withdrawFromGoalAction ,
  abandonGoalAction ,
  getGoalsAction ,
  getReservedByAccountAction
} from "./goalsActions" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn()
} ) ) ;

describe( "goalsActions - sesión y validación" , () => {
  let orgId:  string ;
  let org2Id: string ;
  let cuenta: string ;

  const loguear = ( organizationId: string | null ) => {
    vi.mocked( getServerSession ).mockResolvedValue(
      organizationId ? ( { user: { id: "22222222-2222-4222-8222-222222222222" , organizationId } } as unknown as Session ) : null
    ) ;
  } ;

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await limpiarBase() ;
    const [ o1 ] = await db.insert( organizations ).values( { name: "O1" , slug: "o1-goals-act" } ).returning() ;
    const [ o2 ] = await db.insert( organizations ).values( { name: "O2" , slug: "o2-goals-act" } ).returning() ;
    orgId  = o1.id ;
    org2Id = o2.id ;
    const [ c ] = await db.insert( accounts ).values( { organizationId: orgId , code: "1.1.01.01" , name: "Banco" , type: "asset" , balance: 1000000 , currency: "ARS" } ).returning() ;
    cuenta = c.id ;
  } ) ;

  it( "sin sesión, todas las acciones rechazan" , async () => {
    loguear( null ) ;
    const uuid = "11111111-1111-4111-8111-111111111111" ;
    const rs = await Promise.all( [
      createGoalAction( { name: "X" , currency: "ARS" , targetAmount: 100 } ) ,
      updateGoalAction( { goalId: uuid , name: "X" , targetAmount: 100 , priority: "normal" } ) ,
      contributeToGoalAction( { goalId: uuid , accountId: uuid , amount: 1 } ) ,
      withdrawFromGoalAction( { goalId: uuid , accountId: uuid , amount: 1 } ) ,
      abandonGoalAction( { goalId: uuid } ) ,
      getGoalsAction() ,
      getReservedByAccountAction()
    ] ) ;
    for( const r of rs ) {
      expect( r.success ).toBe( false ) ;
    }
  } ) ;

  it( "valida con Zod antes de tocar la base" , async () => {
    loguear( orgId ) ;
    expect( ( await createGoalAction( { name: "" , currency: "ARS" , targetAmount: 100 } ) ).success ).toBe( false ) ;
    expect( ( await createGoalAction( { name: "X" , currency: "ARS" , targetAmount: 1.5 } ) ).success ).toBe( false ) ;
    expect( ( await contributeToGoalAction( { goalId: "no" , accountId: cuenta , amount: 1 } ) ).success ).toBe( false ) ;
  } ) ;

  it( "flujo completo con la organización de la sesión; otra organización no toca la meta" , async () => {
    loguear( orgId ) ;
    const creada = await createGoalAction( { name: "Auto" , currency: "ARS" , targetAmount: 500000 } ) ;
    expect( creada.success ).toBe( true ) ;
    const goalId = creada.value!.id ;

    expect( ( await contributeToGoalAction( { goalId , accountId: cuenta , amount: 200000 } ) ).success ).toBe( true ) ;
    const res = await getReservedByAccountAction() ;
    expect( res.value![ cuenta ] ).toEqual( { reservado: 200000 , libre: 800000 } ) ;

    const vista = await getGoalsAction( { currency: "ARS" } ) ;
    expect( vista.value!.metas[ 0 ].ahorrado ).toBe( 200000 ) ;

    loguear( org2Id ) ;
    expect( ( await contributeToGoalAction( { goalId , accountId: cuenta , amount: 1 } ) ).success ).toBe( false ) ;
    expect( ( await abandonGoalAction( { goalId } ) ).success ).toBe( false ) ;
    expect( ( await getGoalsAction() ).value!.metas.length ).toBe( 0 ) ;

    loguear( orgId ) ;
    expect( ( await withdrawFromGoalAction( { goalId , accountId: cuenta , amount: 200000 } ) ).success ).toBe( true ) ;
    expect( ( await abandonGoalAction( { goalId } ) ).success ).toBe( true ) ;
  } ) ;
} ) ;
