// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach , afterAll } from "vitest" ;
import { getServerSession }                                                from "next-auth" ;

// Shared
import { db }                       from "@/shared/db/client" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import {
  createFinancialEntityAction ,
  createAccountAction
} from "./accountingActions" ;
import { accountRepository } from "../repositories/accountRepository" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

describe( "accountingActions - Sesión huérfana: la guarda de escritura la rechaza antes del insert" , () => {
  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  it( "createFinancialEntityAction rechaza una organización inexistente con el mensaje de sesión inválida" , async () => {
    // Simular sesión con organizationId huérfano (no existe en DB)
    vi.mocked( getServerSession ).mockResolvedValue( {
      user: {
        id:             "00000000-0000-0000-0000-000000000001" ,
        organizationId: "00000000-0000-0000-0000-000000000002" ,
        role:           "owner" ,
      } ,
      expires: new Date().toISOString() ,
    } ) ;

    const res = await createFinancialEntityAction( {
      name:        "Banco Fantasma" ,
      logo:        "bank" ,
      brandDomain: "fantasma.com" ,
      color:       "#6366f1" ,
    } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ){
      expect( res.error ).toBe( "Tu sesión ya no es válida. Volvé a iniciar sesión." ) ;
    }
  } ) ;

  it( "createAccountAction rechaza una organización inexistente con el mensaje de sesión inválida" , async () => {
    vi.mocked( getServerSession ).mockResolvedValue( {
      user: {
        id:             "00000000-0000-0000-0000-000000000001" ,
        organizationId: "00000000-0000-0000-0000-000000000002" ,
        role:           "owner" ,
      } ,
      expires: new Date().toISOString() ,
    } ) ;

    const res = await createAccountAction( {
      name:    "Cuenta Fantasma" ,
      type:    "asset" ,
      balance: 50000 ,
    } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ){
      expect( res.error ).toBe( "Tu sesión ya no es válida. Volvé a iniciar sesión." ) ;
    }
  } ) ;
} ) ;

describe( "createFinancialEntityAction — Lógica de entidades" , () => {
  let orgId:      string ;
  let autorId:    string ;

  const cleanDb = async () => {
    await limpiarBase() ;
  } ;

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await cleanDb() ;

    const [ org1 ] = await db
      .insert( organizations )
      .values( { name: "Org Principal" , slug: "org-principal" } )
      .returning() ;
    orgId = org1.id ;

    // La guarda de escritura consulta la membresía: el autor de la sesión simulada es un `owner` real
    autorId = ( await crearUsuarioConMembresia( { organizationId: orgId , role: "owner" } ) ).id ;
  } ) ;

  afterEach( async () => {
    await cleanDb() ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "createFinancialEntityAction no crea ninguna cuenta propia (alta pura)" , async () => {
    vi.mocked( getServerSession ).mockResolvedValue( {
      user: {
        id:             autorId ,
        organizationId: orgId ,
        role:           "owner" ,
      } ,
      expires: new Date().toISOString() ,
    } ) ;

    const res = await createFinancialEntityAction( {
      name:        "Banco Galicia" ,
      brandDomain: "galicia.ar" ,
      logo:        "bank" ,
      color:       "#e67e22" ,
    } ) ;

    expect( res.success ).toBe( true ) ;
    if( res.success ) {
      expect( res.value.name ).toBe( "Banco Galicia" ) ;
      expect( res.value.brandDomain ).toBe( "galicia.ar" ) ;
    }

    // Invariante crítico: no debe haber creado ninguna cuenta en el plan de cuentas
    const cuentas = await accountRepository.findAll( orgId ) ;
    expect( cuentas ).toHaveLength( 0 ) ;
  } ) ;
} ) ;
