// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeEach , beforeAll } from "vitest" ;
import { render , screen , fireEvent , waitFor }               from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Mocks
const mocks = vi.hoisted( () => ( {
  refresh: vi.fn() ,
  update:  vi.fn() ,
} ) ) ;

vi.mock( "next/navigation" , () => ( {
  useRouter: () => ( { refresh: mocks.refresh , push: vi.fn() , replace: vi.fn() } ) ,
} ) ) ;

vi.mock( "next-auth/react" , () => ( {
  useSession: () => ( { data: null , update: mocks.update } ) ,
} ) ) ;

vi.mock( "../actions/organizationActions" , () => ( {
  renombrarOrganizacionAction: vi.fn() ,
  eliminarOrganizacionAction:  vi.fn() ,
} ) ) ;

import { renombrarOrganizacionAction , eliminarOrganizacionAction } from "../actions/organizationActions" ;
import { OrganizationPanel }                                         from "./OrganizationPanel" ;


describe( "OrganizationPanel (RN-30, RN-33, RN-35, AC-29, AC-30)" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
    sessionStorage.clear() ;
  } ) ;

  const renderizar = ( cantidad = 2 ) => (
    render( <OrganizationPanel nombre="Casa" cantidadOrganizaciones={cantidad} dict={dict.organizations.panel} /> )
  ) ;

  const campoConfirmar = () => (
    screen.getByLabelText( dict.organizations.panel.dangerZoneConfirmLabel.replace( "{nombre}" , "Casa" ) )
  ) ;

  const botonEliminar = () => (
    screen.getByRole( "button" , { name: dict.organizations.panel.dangerZoneSubmit } ) as HTMLButtonElement
  ) ;

  it( "eliminar sigue deshabilitado con «casa x» y con el nombre en otra capitalización, y se habilita con el exacto (A12)" , () => {
    renderizar() ;

    expect( botonEliminar().disabled ).toBe( true ) ;

    fireEvent.change( campoConfirmar() , { target: { value: "casa x" } } ) ;
    expect( botonEliminar().disabled ).toBe( true ) ;

    fireEvent.change( campoConfirmar() , { target: { value: "casa" } } ) ;
    expect( botonEliminar().disabled ).toBe( true ) ;

    fireEvent.change( campoConfirmar() , { target: { value: "Casa " } } ) ;
    expect( botonEliminar().disabled ).toBe( true ) ;

    fireEvent.change( campoConfirmar() , { target: { value: "Casa" } } ) ;
    expect( botonEliminar().disabled ).toBe( false ) ;
  } ) ;

  it( "con una sola organización eliminar está siempre deshabilitado y explicado, aun escribiendo el nombre" , () => {
    renderizar( 1 ) ;

    expect( screen.getByText( dict.organizations.panel.dangerZoneOnlyOrg ) ).toBeTruthy() ;
    expect( botonEliminar().disabled ).toBe( true ) ;
    expect( botonEliminar().getAttribute( "aria-describedby" ) ).toBe( screen.getByText( dict.organizations.panel.dangerZoneOnlyOrg ).id ) ;

    fireEvent.change( campoConfirmar() , { target: { value: "Casa" } } ) ;
    expect( botonEliminar().disabled ).toBe( true ) ;
    expect( eliminarOrganizacionAction ).not.toHaveBeenCalled() ;
  } ) ;

  it( "eliminar con el nombre exacto llama la acción, deja el aviso, hace update con el id y después refresh" , async () => {
    vi.mocked( eliminarOrganizacionAction ).mockResolvedValue( { success: true , value: { organizationId: "org-2" , nombreAnterior: "Casa" } } ) ;
    mocks.update.mockResolvedValue( { user: { organizationId: "org-2" } } ) ;
    renderizar() ;

    fireEvent.change( campoConfirmar() , { target: { value: "Casa" } } ) ;
    fireEvent.click( botonEliminar() ) ;

    await waitFor( () => expect( mocks.refresh ).toHaveBeenCalledTimes( 1 ) ) ;
    expect( eliminarOrganizacionAction ).toHaveBeenCalledWith( { confirmacion: "Casa" } ) ;
    expect( mocks.update ).toHaveBeenCalledWith( { organizationId: "org-2" } ) ;
    expect( mocks.update.mock.invocationCallOrder[0] ).toBeLessThan( mocks.refresh.mock.invocationCallOrder[0] ) ;
    expect( sessionStorage.getItem( "aviso-organizacion" ) ).toBe( dict.organizations.panel.deleteNotice.replace( "{nombre}" , "Casa" ) ) ;
  } ) ;

  it( "un error del servidor al eliminar se muestra en FormError y no cambia la sesión" , async () => {
    vi.mocked( eliminarOrganizacionAction ).mockResolvedValue( { success: false , error: "No se pudo eliminar la organización. No se borró nada." } ) ;
    renderizar() ;

    fireEvent.change( campoConfirmar() , { target: { value: "Casa" } } ) ;
    fireEvent.click( botonEliminar() ) ;

    expect( await screen.findByRole( "alert" ) ).toHaveTextContent( "No se borró nada." ) ;
    expect( mocks.update ).not.toHaveBeenCalled() ;
    expect( mocks.refresh ).not.toHaveBeenCalled() ;
    expect( sessionStorage.getItem( "aviso-organizacion" ) ).toBeNull() ;
  } ) ;

  it( "guardar el nombre llama renombrar, avisa y refresca" , async () => {
    vi.mocked( renombrarOrganizacionAction ).mockResolvedValue( { success: true , value: { nombre: "Taller" } } ) ;
    renderizar() ;

    fireEvent.change( screen.getByLabelText( new RegExp( dict.organizations.panel.renameLabel ) ) , { target: { value: "Taller" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.panel.renameSubmit } ) ) ;

    await waitFor( () => expect( renombrarOrganizacionAction ).toHaveBeenCalledWith( { nombre: "Taller" } ) ) ;
    expect( (await screen.findByRole( "status" )).textContent ).toContain( dict.organizations.panel.renameSuccess ) ;
    expect( mocks.refresh ).toHaveBeenCalledTimes( 1 ) ;
  } ) ;

  it( "un error del servidor al renombrar se muestra y no refresca" , async () => {
    vi.mocked( renombrarOrganizacionAction ).mockResolvedValue( { success: false , error: "El nombre de la organización no puede estar vacío." } ) ;
    renderizar() ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.panel.renameSubmit } ) ) ;

    expect( await screen.findByRole( "alert" ) ).toHaveTextContent( "no puede estar vacío" ) ;
    expect( mocks.refresh ).not.toHaveBeenCalled() ;
  } ) ;
} ) ;
