// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeEach , beforeAll } from "vitest" ;
import { render , screen , fireEvent , waitFor }               from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Mocks
const mocks = vi.hoisted( () => ( {
  refresh: vi.fn() ,
} ) ) ;

vi.mock( "next/navigation" , () => ( {
  useRouter: () => ( { refresh: mocks.refresh , push: vi.fn() , replace: vi.fn() } ) ,
} ) ) ;

vi.mock( "../actions/membersActions" , () => ( {
  listarMiembrosAction:    vi.fn() ,
  invitarMiembroAction:    vi.fn() ,
  revocarInvitacionAction: vi.fn() ,
  quitarMiembroAction:     vi.fn() ,
  cambiarRolAction:        vi.fn() ,
} ) ) ;

import { listarMiembrosAction , cambiarRolAction , type ListadoMiembros } from "../actions/membersActions" ;
import { MembersPanel }                                                    from "./MembersPanel" ;


describe( "MembersPanel - rol desplegable (RN-29, RN-31, AC-25)" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  const soloYo: ListadoMiembros = {
    miembros:     [ { userId: "u-1" , nombre: "Juan" , email: "juan@ejemplo.com" , rol: "owner" } ] ,
    invitaciones: [] ,
  } ;

  const conAna: ListadoMiembros = {
    miembros: [
      { userId: "u-1" , nombre: "Juan" , email: "juan@ejemplo.com" , rol: "owner" } ,
      { userId: "u-2" , nombre: "Ana"  , email: "ana@ejemplo.com"  , rol: "member" } ,
    ] ,
    invitaciones: [] ,
  } ;

  const renderizar = ( data: ListadoMiembros ) => (
    render( <MembersPanel initialData={data} currentUserId="u-1" lang="es" dict={dict.organizations.members} /> )
  ) ;

  const selectorDe = ( nombre: string ) => (
    screen.getByRole( "combobox" , { name: dict.organizations.members.roleSelectLabel.replace( "{nombre}" , nombre ) } ) as HTMLSelectElement
  ) ;

  it( "el desplegable del único owner está deshabilitado y explicado" , () => {
    renderizar( soloYo ) ;

    const select = selectorDe( "Juan" ) ;
    expect( select.disabled ).toBe( true ) ;
    expect( screen.getByText( dict.organizations.members.roleDisabledOnlyOwner ).id ).toBe( select.getAttribute( "aria-describedby" ) ) ;
  } ) ;

  it( "con dos owner ninguno queda deshabilitado" , () => {
    renderizar( { ...conAna , miembros: [ conAna.miembros[0] , { ...conAna.miembros[1] , rol: "owner" } ] } ) ;

    expect( selectorDe( "Juan" ).disabled ).toBe( false ) ;
    expect( selectorDe( "Ana" ).disabled ).toBe( false ) ;
    expect( screen.queryByText( dict.organizations.members.roleDisabledOnlyOwner ) ).toBeNull() ;
  } ) ;

  it( "cambiar el rol llama la acción con el usuario y el rol, y recarga la lista" , async () => {
    vi.mocked( cambiarRolAction ).mockResolvedValue( { success: true , value: null } ) ;
    vi.mocked( listarMiembrosAction ).mockResolvedValue( {
      success: true ,
      value:   { ...conAna , miembros: [ conAna.miembros[0] , { ...conAna.miembros[1] , rol: "viewer" } ] } ,
    } ) ;
    renderizar( conAna ) ;

    fireEvent.change( selectorDe( "Ana" ) , { target: { value: "viewer" } } ) ;

    await waitFor( () => expect( cambiarRolAction ).toHaveBeenCalledWith( { userId: "u-2" , rol: "viewer" } ) ) ;
    await waitFor( () => expect( selectorDe( "Ana" ).value ).toBe( "viewer" ) ) ;
    expect( listarMiembrosAction ).toHaveBeenCalledTimes( 1 ) ;
  } ) ;

  it( "mientras guarda, los desplegables están deshabilitados" , async () => {
    let resolver: ( v: { success: true ; value: null } ) => void = () => {} ;
    vi.mocked( cambiarRolAction ).mockReturnValue( new Promise( ( r ) => { resolver = r ; } ) ) ;
    vi.mocked( listarMiembrosAction ).mockResolvedValue( { success: true , value: conAna } ) ;
    renderizar( conAna ) ;

    fireEvent.change( selectorDe( "Ana" ) , { target: { value: "viewer" } } ) ;

    await waitFor( () => expect( selectorDe( "Ana" ).disabled ).toBe( true ) ) ;
    expect( selectorDe( "Ana" ).value ).toBe( "viewer" ) ;

    resolver( { success: true , value: null } ) ;

    await waitFor( () => expect( selectorDe( "Ana" ).disabled ).toBe( false ) ) ;
  } ) ;

  it( "un error del servidor restaura el valor anterior y lo muestra" , async () => {
    vi.mocked( cambiarRolAction ).mockResolvedValue( { success: false , error: "No se pudo cambiar el rol." } ) ;
    renderizar( conAna ) ;

    fireEvent.change( selectorDe( "Ana" ) , { target: { value: "viewer" } } ) ;

    expect( await screen.findByRole( "alert" ) ).toHaveTextContent( "No se pudo cambiar el rol." ) ;
    await waitFor( () => expect( selectorDe( "Ana" ).value ).toBe( "member" ) ) ;
    expect( listarMiembrosAction ).not.toHaveBeenCalled() ;
  } ) ;

  it( "elegir el rol que ya tiene no llama a la acción" , () => {
    renderizar( conAna ) ;

    fireEvent.change( selectorDe( "Ana" ) , { target: { value: "member" } } ) ;

    expect( cambiarRolAction ).not.toHaveBeenCalled() ;
  } ) ;

  it( "si el owner se degrada a sí mismo refresca la página en vez de pedir la lista" , async () => {
    vi.mocked( cambiarRolAction ).mockResolvedValue( { success: true , value: null } ) ;
    renderizar( { ...conAna , miembros: [ conAna.miembros[0] , { ...conAna.miembros[1] , rol: "owner" } ] } ) ;

    fireEvent.change( selectorDe( "Juan" ) , { target: { value: "member" } } ) ;

    await waitFor( () => expect( mocks.refresh ).toHaveBeenCalledTimes( 1 ) ) ;
    expect( cambiarRolAction ).toHaveBeenCalledWith( { userId: "u-1" , rol: "member" } ) ;
    expect( listarMiembrosAction ).not.toHaveBeenCalled() ;
  } ) ;
} ) ;
