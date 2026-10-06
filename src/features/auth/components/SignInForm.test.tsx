// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent }                          from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Auth
import { SignInForm } from "./SignInForm" ;


const { mockSignIn , mockRouter , searchParamsRef } = vi.hoisted( () => ( {
  mockSignIn:      vi.fn() ,
  mockRouter:      { push: vi.fn() , refresh: vi.fn() } ,
  searchParamsRef: { current: new URLSearchParams() } ,
} ) ) ;

vi.mock( "next-auth/react" , () => ( {
  signIn: mockSignIn ,
} ) ) ;

vi.mock( "next/navigation" , () => ( {
  useRouter:       () => mockRouter ,
  useSearchParams: () => searchParamsRef.current ,
} ) ) ;

describe( "SignInForm (AC-16)" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
    searchParamsRef.current = new URLSearchParams() ;
  } ) ;

  it( "debería ocultar el botón de Google y el separador cuando googleHabilitado es falso (AC-16)" , () => {
    render(
      <SignInForm
        dict={dict.signin}
        lang="es"
        googleHabilitado={false}
      />
    ) ;

    const botonGoogle = screen.queryByText( dict.signin.googleBtn ) ;
    const separador   = screen.queryByRole( "separator" ) ;

    expect( botonGoogle ).toBeNull() ;
    expect( separador ).toBeNull() ;
    expect( screen.getByLabelText( new RegExp( dict.signin.emailLabel , "i" ) ) ).toBeInTheDocument() ;
    expect( screen.getByLabelText( new RegExp( dict.signin.passwordLabel , "i" ) ) ).toBeInTheDocument() ;
  } ) ;

  it( "debería mostrar el botón de Google y el separador cuando googleHabilitado es verdadero" , () => {
    render(
      <SignInForm
        dict={dict.signin}
        lang="es"
        googleHabilitado={true}
      />
    ) ;

    const botonGoogle = screen.getByText( dict.signin.googleBtn ) ;
    const separador   = screen.getByRole( "separator" ) ;

    expect( botonGoogle ).toBeInTheDocument() ;
    expect( separador ).toBeInTheDocument() ;
  } ) ;

  it( "debería invocar signIn de Google con el callbackUrl resuelto al presionar el botón" , async () => {
    searchParamsRef.current = new URLSearchParams( "?callbackUrl=%2Fes%2Faccounts" ) ;

    render(
      <SignInForm
        dict={dict.signin}
        lang="es"
        googleHabilitado={true}
      />
    ) ;

    const botonGoogle = screen.getByRole( "button" , { name: new RegExp( dict.signin.googleBtn , "i" ) } ) ;
    fireEvent.click( botonGoogle ) ;

    expect( mockSignIn ).toHaveBeenCalledTimes( 1 ) ;
    expect( mockSignIn ).toHaveBeenCalledWith( "google" , { callbackUrl: "/es/accounts" } ) ;
  } ) ;

  it( "debería mostrar mensaje de acceso denegado si searchParams contiene error=AccessDenied" , () => {
    searchParamsRef.current = new URLSearchParams( "?error=AccessDenied" ) ;

    render(
      <SignInForm
        dict={dict.signin}
        lang="es"
        googleHabilitado={true}
      />
    ) ;

    expect( screen.getByText( dict.signin.accessDenied ) ).toBeInTheDocument() ;
  } ) ;

  it( "debería mostrar mensaje de error de Google si searchParams contiene error=OAuthCallback" , () => {
    searchParamsRef.current = new URLSearchParams( "?error=OAuthCallback" ) ;

    render(
      <SignInForm
        dict={dict.signin}
        lang="es"
        googleHabilitado={true}
      />
    ) ;

    expect( screen.getByText( dict.signin.googleError ) ).toBeInTheDocument() ;
  } ) ;
} ) ;
