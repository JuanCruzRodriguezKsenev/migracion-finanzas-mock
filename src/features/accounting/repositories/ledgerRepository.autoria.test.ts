// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                   from "next-auth" ;
import type { Session }                                       from "next-auth" ;
import { sql }                                                from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { getTransactionsPageAction } from "../actions/accountingActions" ;
import { ledgerRepository }          from "./ledgerRepository" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

describe( "ledgerRepository.findTransactionsPage — titular y autor" , () => {
  let orgA:   string ;
  let orgB:   string ;
  let ana:    string ;
  let beto:   string ;
  let carla:  string ; // member de B

  beforeEach( async () => {
    vi.restoreAllMocks() ;
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-lista"   } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-lista" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;

    ana   = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "ana@ejemplo.com"   , name: "Ana"  } ) ).id ;
    beto  = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "beto@ejemplo.com"  , name: "Beto" } ) ).id ;
    carla = ( await crearUsuarioConMembresia( { organizationId: orgB , email: "carla@ejemplo.com" , name: "Carla" } ) ).id ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  async function cargar( organizationId: string , description: string , extra: { createdByUserId?: string , holderUserId?: string } = {} ) {
    return( await ledgerRepository.createTransaction( { organizationId , description , ...extra } ) ) ;
  }

  it( "resuelve holder y createdBy con el nombre de cada uno" , async () => {
    await cargar( orgA , "Súper" , { createdByUserId: beto , holderUserId: ana } ) ;

    const { items } = await ledgerRepository.findTransactionsPage( { organizationId: orgA } ) ;

    expect( items ).toHaveLength( 1 ) ;
    expect( items[0].holder ).toEqual( { id: ana , nombre: "Ana" } ) ;
    expect( items[0].createdBy ).toEqual( { id: beto , nombre: "Beto" } ) ;
  } ) ;

  it( "AC-26: los movimientos viejos o sin autor devuelven null en ambos" , async () => {
    await cargar( orgA , "Viejo" ) ;

    const { items } = await ledgerRepository.findTransactionsPage( { organizationId: orgA } ) ;

    expect( items[0].holder ).toBeNull() ;
    expect( items[0].createdBy ).toBeNull() ;
  } ) ;

  it( "un movimiento con autor y sin titular devuelve sólo createdBy" , async () => {
    await cargar( orgA , "Propio" , { createdByUserId: ana } ) ;

    const { items } = await ledgerRepository.findTransactionsPage( { organizationId: orgA } ) ;

    expect( items[0].holder ).toBeNull() ;
    expect( items[0].createdBy?.nombre ).toBe( "Ana" ) ;
  } ) ;

  it( "si la persona no tiene nombre, se muestra la parte local de su correo" , async () => {
    await db.execute( sql`update users set name = null where id = ${ana}` ) ;
    await cargar( orgA , "Sin nombre" , { createdByUserId: beto , holderUserId: ana } ) ;

    const { items } = await ledgerRepository.findTransactionsPage( { organizationId: orgA } ) ;

    expect( items[0].holder?.nombre ).toBe( "ana" ) ;
  } ) ;

  it( "el filtro por titular devuelve sólo sus movimientos" , async () => {
    await cargar( orgA , "De Ana"  , { createdByUserId: beto , holderUserId: ana } ) ;
    await cargar( orgA , "De Beto" , { createdByUserId: beto , holderUserId: beto } ) ;
    await cargar( orgA , "Sin titular" ) ;

    const { items } = await ledgerRepository.findTransactionsPage( { organizationId: orgA , holderUserId: ana } ) ;

    expect( items.map( ( i ) => i.description ) ).toEqual( [ "De Ana" ] ) ;
  } ) ;

  it( "el filtro por titular no cruza organizaciones" , async () => {
    await cargar( orgB , "De Carla en B" , { createdByUserId: carla , holderUserId: carla } ) ;
    await cargar( orgA , "De Ana en A"   , { createdByUserId: ana   , holderUserId: ana   } ) ;

    const deA = await ledgerRepository.findTransactionsPage( { organizationId: orgA , holderUserId: carla } ) ;
    const deB = await ledgerRepository.findTransactionsPage( { organizationId: orgB , holderUserId: carla } ) ;

    expect( deA.items ).toHaveLength( 0 ) ;
    expect( deB.items.map( ( i ) => i.description ) ).toEqual( [ "De Carla en B" ] ) ;
  } ) ;

  it( "el filtro por titular se combina con la paginación por cursor sin perder ni repetir filas" , async () => {
    for( let n = 1 ; n <= 5 ; n++ ) {
      await cargar( orgA , `Movimiento ${n}` , { createdByUserId: beto , holderUserId: ana } ) ;
    }
    await cargar( orgA , "Otro titular" , { createdByUserId: beto , holderUserId: beto } ) ;

    const primera = await ledgerRepository.findTransactionsPage( { organizationId: orgA , holderUserId: ana , limit: 3 } ) ;
    const segunda = await ledgerRepository.findTransactionsPage( {
      organizationId: orgA ,
      holderUserId:   ana ,
      limit:          3 ,
      cursor:         primera.nextCursor ? { occurredAt: new Date( primera.nextCursor.occurredAt ) , id: primera.nextCursor.id } : null ,
    } ) ;

    const todas = [ ...primera.items , ...segunda.items ].map( ( i ) => i.description ) ;

    expect( primera.hasMore ).toBe( true ) ;
    expect( segunda.hasMore ).toBe( false ) ;
    expect( todas ).toHaveLength( 5 ) ;
    expect( new Set( todas ).size ).toBe( 5 ) ;
    expect( todas ).not.toContain( "Otro titular" ) ;
  } ) ;

  it( "getTransactionsPageAction acepta el filtro por titular y rechaza un id que no es uuid" , async () => {
    vi.mocked( getServerSession ).mockResolvedValue( {
      user:    { id: ana , organizationId: orgA , role: "member" } ,
      expires: new Date().toISOString() ,
    } as unknown as Session ) ;
    await cargar( orgA , "De Ana" , { createdByUserId: beto , holderUserId: ana } ) ;
    await cargar( orgA , "De Beto" , { createdByUserId: beto , holderUserId: beto } ) ;

    const ok  = await getTransactionsPageAction( { holderUserId: ana } ) ;
    const mal = await getTransactionsPageAction( { holderUserId: "no-es-uuid" } ) ;

    expect( ok.success && ok.value.items.map( ( i ) => i.description ) ).toEqual( [ "De Ana" ] ) ;
    expect( mal.success ).toBe( false ) ;
  } ) ;
} ) ;
