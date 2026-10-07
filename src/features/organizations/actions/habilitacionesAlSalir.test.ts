// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                   from "next-auth" ;
import type { Session }                                       from "next-auth" ;
import { eq }                                                 from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Auth
import { habilitacionRepository }                 from "@/features/auth/repositories/habilitacionRepository" ;
import { membershipRepository }                   from "@/features/auth/repositories/membershipRepository" ;
import { organizations , holderAuthorizations } from "@/features/auth/schema.db" ;

// Feature: Organizations
import { abandonarOrganizacionAction } from "./organizationActions" ;
import { quitarMiembroAction }         from "./membersActions" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

vi.mock( "next/cache" , () => ( {
  revalidatePath: vi.fn() ,
} ) ) ;

function sesionDe( userId: string , organizationId: string , role = "owner" ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

describe( "habilitaciones al quitar o abandonar" , () => {
  let orgA:   string ;
  let orgB:   string ;
  let ownerA: string ;
  let ana:    string ;
  let beto:   string ;

  beforeEach( async () => {
    vi.restoreAllMocks() ;
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-sal"   } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-sal" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;

    ownerA = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "owner@ejemplo.com" , role: "owner"  } ) ).id ;
    ana    = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "ana@ejemplo.com"   , role: "member" } ) ).id ;
    beto   = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "beto@ejemplo.com"  , role: "member" } ) ).id ;

    // Ana y Beto también están en el Taller: lo que tengan allá debe sobrevivir
    await membershipRepository.add( ana  , orgB , "member" ) ;
    await membershipRepository.add( beto , orgB , "member" ) ;

    await habilitacionRepository.otorgar( orgA , ana  , beto ) ;
    await habilitacionRepository.otorgar( orgA , beto , ana  ) ;
    await habilitacionRepository.otorgar( orgB , ana  , beto ) ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "quitar a un miembro borra sus habilitaciones (como otorgante y como habilitado) y conserva las de otra organización" , async () => {
    sesionDe( ownerA , orgA ) ;

    const res = await quitarMiembroAction( ana ) ;

    expect( res.success ).toBe( true ) ;
    expect( await db.select().from( holderAuthorizations ).where( eq( holderAuthorizations.organizationId , orgA ) ) ).toHaveLength( 0 ) ;
    expect( await habilitacionRepository.existeVigente( orgB , ana , beto ) ).toBe( true ) ;
  } ) ;

  it( "si quitar falla (no es miembro), no se borra nada" , async () => {
    sesionDe( ownerA , orgA ) ;
    const ajeno = ( await crearUsuarioConMembresia( { organizationId: orgB , email: "ajeno@ejemplo.com" , role: "member" } ) ).id ;

    const res = await quitarMiembroAction( ajeno ) ;

    expect( res.success ).toBe( false ) ;
    expect( await db.select().from( holderAuthorizations ).where( eq( holderAuthorizations.organizationId , orgA ) ) ).toHaveLength( 2 ) ;
  } ) ;

  it( "abandonar borra las habilitaciones del usuario en esa organización y conserva las de la otra" , async () => {
    sesionDe( ana , orgA , "member" ) ;

    const res = await abandonarOrganizacionAction() ;

    expect( res.success ).toBe( true ) ;
    expect( await db.select().from( holderAuthorizations ).where( eq( holderAuthorizations.organizationId , orgA ) ) ).toHaveLength( 0 ) ;
    expect( await habilitacionRepository.existeVigente( orgB , ana , beto ) ).toBe( true ) ;
  } ) ;
} ) ;
