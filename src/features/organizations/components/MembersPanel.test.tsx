// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeEach , beforeAll } from "vitest" ;
import { render , screen , fireEvent , waitFor , within }       from "@testing-library/react" ;

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
} ) ) ;

import {
  listarMiembrosAction ,
  invitarMiembroAction ,
  quitarMiembroAction ,
  type ListadoMiembros
} from "../actions/membersActions" ;
import { MembersPanel } from "./MembersPanel" ;


describe( "MembersPanel" , () => {
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

  const conOtros: ListadoMiembros = {
    miembros: [
      { userId: "u-1" , nombre: "Juan" , email: "juan@ejemplo.com" , rol: "owner" } ,
      { userId: "u-2" , nombre: "Ana"  , email: "ana@ejemplo.com"  , rol: "member" } ,
    ] ,
    invitaciones: [ { id: "inv-1" , email: "pendiente@ejemplo.com" , rol: "viewer" , venceEl: "2026-12-01T12:00:00.000Z" } ] ,
  } ;

  const renderizar = ( data: ListadoMiembros ) => (
    render( <MembersPanel initialData={data} currentUserId="u-1" lang="es" dict={dict.organizations.members} /> )
  ) ;

  it( "oculta la sección de invitaciones pendientes si no hay" , () => {
    renderizar( soloYo ) ;

    expect( screen.queryByText( dict.organizations.members.pendingTitle ) ).toBeNull() ;
  } ) ;

  it( "muestra pendientes con su vencimiento y el botón Revocar" , () => {
    renderizar( conOtros ) ;

    expect( screen.getByText( dict.organizations.members.pendingTitle ) ).toBeTruthy() ;
    expect( screen.getByText( "pendiente@ejemplo.com" ) ).toBeTruthy() ;
    expect( screen.getByRole( "button" , { name: dict.organizations.members.revoke } ) ).toBeTruthy() ;
  } ) ;

  it( "«Quitar» está deshabilitado y explicado para el único owner" , () => {
    renderizar( soloYo ) ;

    const quitar = screen.getByRole( "button" , { name: dict.organizations.members.remove } ) ;
    expect( quitar ).toBeDisabled() ;
    expect( quitar.getAttribute( "aria-describedby" ) ).toBeTruthy() ;
    expect( screen.getByText( dict.organizations.members.removeDisabledOnlyOwner ) ).toBeTruthy() ;
  } ) ;

  it( "pide confirmación antes de quitar y sólo entonces llama a la acción" , async () => {
    vi.mocked( quitarMiembroAction ).mockResolvedValue( { success: true , value: null } ) ;
    vi.mocked( listarMiembrosAction ).mockResolvedValue( { success: true , value: soloYo } ) ;
    renderizar( conOtros ) ;

    const botones = screen.getAllByRole( "button" , { name: dict.organizations.members.remove } ) ;
    fireEvent.click( botones[1] ) ; // Ana

    expect( quitarMiembroAction ).not.toHaveBeenCalled() ;

    const dialogo = screen.getByRole( "dialog" ) ;
    fireEvent.click( within( dialogo ).getByRole( "button" , { name: dict.organizations.members.removeConfirmSubmit } ) ) ;

    await waitFor( () => expect( quitarMiembroAction ).toHaveBeenCalledWith( "u-2" ) ) ;
    await waitFor( () => expect( screen.queryByText( "Ana" ) ).toBeNull() ) ;
  } ) ;

  it( "un error del servidor al quitar se muestra en el modal" , async () => {
    vi.mocked( quitarMiembroAction ).mockResolvedValue( { success: false , error: "No se puede quitar al único propietario de la organización." } ) ;
    renderizar( conOtros ) ;

    fireEvent.click( screen.getAllByRole( "button" , { name: dict.organizations.members.remove } )[1] ) ;
    fireEvent.click( within( screen.getByRole( "dialog" ) ).getByRole( "button" , { name: dict.organizations.members.removeConfirmSubmit } ) ) ;

    expect( await screen.findByRole( "alert" ) ).toHaveTextContent( "No se puede quitar al único propietario" ) ;
  } ) ;

  it( "invitar: envía correo y rol, muestra el aviso y recarga la lista" , async () => {
    vi.mocked( invitarMiembroAction ).mockResolvedValue( { success: true , value: { id: "inv-9" } } ) ;
    vi.mocked( listarMiembrosAction ).mockResolvedValue( { success: true , value: conOtros } ) ;
    renderizar( soloYo ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.members.inviteButton } ) ) ;
    fireEvent.change( screen.getByLabelText( new RegExp( dict.organizations.members.emailLabel ) ) , { target: { value: "ella@gmail.com" } } ) ;
    fireEvent.change( screen.getByLabelText( dict.organizations.members.roleLabel ) , { target: { value: "viewer" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.members.inviteSubmit } ) ) ;

    await waitFor( () => expect( invitarMiembroAction ).toHaveBeenCalledWith( { email: "ella@gmail.com" , rol: "viewer" } ) ) ;
    expect( await screen.findByRole( "status" ) ).toHaveTextContent( "ella@gmail.com" ) ;
    expect( screen.getByText( "pendiente@ejemplo.com" ) ).toBeTruthy() ;
  } ) ;

  it( "invitar: un fallo se muestra dentro del modal y no lo cierra" , async () => {
    vi.mocked( invitarMiembroAction ).mockResolvedValue( { success: false , error: "Ya hay una invitación vigente para ese correo." } ) ;
    renderizar( soloYo ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.members.inviteButton } ) ) ;
    fireEvent.change( screen.getByLabelText( new RegExp( dict.organizations.members.emailLabel ) ) , { target: { value: "ella@gmail.com" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.members.inviteSubmit } ) ) ;

    expect( await screen.findByRole( "alert" ) ).toHaveTextContent( "Ya hay una invitación vigente" ) ;
    expect( screen.getByRole( "dialog" ) ).toBeTruthy() ;
  } ) ;
} ) ;
