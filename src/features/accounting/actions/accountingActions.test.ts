// Librerías externas
import { describe , it , expect , vi , beforeEach } from "vitest" ;
import { getServerSession }                         from "next-auth" ;

// Feature: Accounting
import { createFinancialEntityAction , createAccountAction } from "./accountingActions" ;

vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

describe( "accountingActions - Manejo de error de sesión huérfana (FK 23503)" , () => {
  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  it( "createFinancialEntityAction debería capturar FK violation y devolver mensaje amigable" , async () => {
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
      name:    "Banco Fantasma" ,
      logo:    "bank" ,
      color:   "#6366f1" ,
      balance: 10000 ,
    } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ){
      expect( res.error ).toBe( "Tu sesión referencia una organización inexistente. Cerrá sesión y volvé a ingresar." ) ;
    }
  } ) ;

  it( "createAccountAction debería capturar FK violation y devolver mensaje amigable" , async () => {
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
      expect( res.error ).toBe( "Tu sesión referencia una organización inexistente. Cerrá sesión y volvé a ingresar." ) ;
    }
  } ) ;
} ) ;
