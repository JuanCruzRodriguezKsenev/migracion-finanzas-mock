/**
 * @file viewerEnPersonal.test.ts
 * Un `viewer` invitado al espacio Personal de otra persona no escribe nada (spec del espacio Personal: AC-8, A4).
 * Son las acciones que el informe del plan 29 probó que dejaban pasar a un `viewer`.
 */
// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                    from "next-auth" ;
import type { Session }                                        from "next-auth" ;
import { sql }                                                 from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Auth
import { crearEspacioPersonal }           from "@/features/auth/services/espacioPersonalService" ;
import { membershipRepository }           from "@/features/auth/repositories/membershipRepository" ;
import { ERROR_SIN_PERMISO_DE_ESCRITURA } from "@/features/auth/constants" ;
import { organizations , users }          from "@/features/auth/schema.db" ;

// Feature: Accounting
import { crearCuentaPersonalAction }                                 from "./cuentasPersonalesActions" ;
import { createFinancialEntityAction , createLedgerTransactionAction } from "./accountingActions" ;


vi.mock( "next-auth" , () => ( { getServerSession: vi.fn() } ) ) ;

/** Conteo de filas de cada tabla del esquema público. */
async function conteoDeTablas(): Promise< Record< string , number > > {
  const tablas = await db.execute< { tablename: string } >( sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename` ) ;
  const conteo: Record< string , number > = {} ;

  for( const { tablename } of tablas ) {
    const filas = await db.execute< { n: number } >( sql`SELECT count(*)::int AS n FROM ${sql.identifier( tablename )}` ) ;
    conteo[ tablename ] = filas[ 0 ].n ;
  }

  return( conteo ) ;
}

describe( "viewer invitado a un espacio Personal ajeno (AC-8, A4)" , () => {
  let personalDeJuan: string ;
  let viewerId:       string ;

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ juan ] = await db.insert( users ).values( {
      email: "juan@ejemplo.com" , name: "Juan" , passwordHash: "0".repeat( 128 ) , salt: "0123456789abcdef0123456789abcdef" ,
    } ).returning() ;

    personalDeJuan = await db.transaction( async ( tx ) => await crearEspacioPersonal( juan.id , tx ) ) ;

    // El viewer tiene su propia organización de origen y es invitado como `viewer` al Personal de Juan
    const [ casa ] = await db.insert( organizations ).values( { name: "Casa de Vera" , slug: "casa-vera-viewer" } ).returning() ;
    viewerId       = ( await crearUsuarioConMembresia( { organizationId: casa.id , email: "vera@ejemplo.com" , role: "owner" } ) ).id ;
    await membershipRepository.add( viewerId , personalDeJuan , "viewer" ) ;

    vi.mocked( getServerSession ).mockResolvedValue( {
      user:    { id: viewerId , organizationId: personalDeJuan , role: "viewer" } ,
      expires: new Date().toISOString() ,
    } as unknown as Session ) ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "createFinancialEntityAction, crearCuentaPersonalAction y createLedgerTransactionAction responden «sin permiso» y no cambian ninguna tabla" , async () => {
    const antes = await conteoDeTablas() ;

    const entidad = await createFinancialEntityAction( { name: "Banco de Juan" } ) ;
    const cuenta  = await crearCuentaPersonalAction( { name: "Caja de Vera" , currency: "ARS" , balance: 1000 } ) ;
    const asiento = await createLedgerTransactionAction( {
      description: "Gasto" ,
      entries:     [ { accountId: "11111111-1111-4111-8111-111111111111" , debit: 100 , credit: 0 } , { accountId: "22222222-2222-4222-8222-222222222222" , debit: 0 , credit: 100 } ] ,
    } as never ) ;

    for( const res of [ entidad , cuenta , asiento ] ) {
      expect( res.success ).toBe( false ) ;
      expect( res.error ).toBe( ERROR_SIN_PERMISO_DE_ESCRITURA ) ;
    }

    expect( await conteoDeTablas() ).toEqual( antes ) ;
  } ) ;
} ) ;
