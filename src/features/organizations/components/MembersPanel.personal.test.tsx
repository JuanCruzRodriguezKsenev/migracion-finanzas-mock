// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeAll } from "vitest" ;
import { render , screen , fireEvent , within }    from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Mocks
vi.mock( "next/navigation" , () => ( {
  useRouter: () => ( { refresh: vi.fn() , push: vi.fn() , replace: vi.fn() } ) ,
} ) ) ;

vi.mock( "../actions/membersActions" , () => ( {
  listarMiembrosAction:    vi.fn() ,
  invitarMiembroAction:    vi.fn() ,
  revocarInvitacionAction: vi.fn() ,
  quitarMiembroAction:     vi.fn() ,
  cambiarRolAction:        vi.fn() ,
} ) ) ;

import { MembersPanel } from "./MembersPanel" ;


describe( "MembersPanel — espacio Personal (RN-4, AC-7)" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  const datos = {
    miembros: [
      { userId: "u-1" , nombre: "Juan"     , email: "juan@ejemplo.com"     , rol: "owner"  } ,
      { userId: "u-2" , nombre: "Contador" , email: "contador@ejemplo.com" , rol: "viewer" } ,
    ] ,
    invitaciones: [] ,
  } ;

  const abrirInvitar = ( soloVisualizador: boolean ) => {
    render( <MembersPanel initialData={datos} currentUserId="u-1" lang="es" dict={dict.organizations.members} soloVisualizador={soloVisualizador} /> ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.members.inviteButton } ) ) ;
    return( within( screen.getByRole( "dialog" ) ).getByLabelText( dict.organizations.members.roleLabel ) as HTMLSelectElement ) ;
  } ;

  it( "en una organización común el selector de invitación ofrece los tres roles" , () => {
    const selector = abrirInvitar( false ) ;

    expect( within( selector ).getAllByRole( "option" ).map( ( o ) => o.getAttribute( "value" ) ).sort() ).toEqual( [ "member" , "owner" , "viewer" ] ) ;
  } ) ;

  it( "en Personal el selector de invitación ofrece sólo viewer, preseleccionado, con el aviso" , () => {
    const selector = abrirInvitar( true ) ;

    expect( within( selector ).getAllByRole( "option" ).map( ( o ) => o.getAttribute( "value" ) ) ).toEqual( [ "viewer" ] ) ;
    expect( selector.value ).toBe( "viewer" ) ;
    expect( screen.getByText( dict.organizations.members.personalOnlyViewer ) ).toBeTruthy() ;
  } ) ;

  it( "en Personal el rol de un viewer no se puede subir: su selector sólo ofrece viewer" , () => {
    render( <MembersPanel initialData={datos} currentUserId="u-1" lang="es" dict={dict.organizations.members} soloVisualizador={true} /> ) ;

    const selector = screen.getByRole( "combobox" , { name: dict.organizations.members.roleSelectLabel.replace( "{nombre}" , "Contador" ) } ) ;

    expect( within( selector ).getAllByRole( "option" ).map( ( o ) => o.getAttribute( "value" ) ) ).toEqual( [ "viewer" ] ) ;
  } ) ;
} ) ;
