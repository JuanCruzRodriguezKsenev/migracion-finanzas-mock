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
  crearOrganizacionAction: vi.fn() ,
} ) ) ;

import { crearOrganizacionAction } from "../actions/organizationActions" ;
import { OrganizationSwitcher }    from "./OrganizationSwitcher" ;


describe( "OrganizationSwitcher" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  const dosOrgs = [
    { id: "org-1" , nombre: "Casa" , rol: "owner" } ,
    { id: "org-2" , nombre: "Negocio" , rol: "viewer" } ,
  ] ;

  const renderizar = ( orgs = dosOrgs , activaId = "org-1" ) => (
    render(
      <OrganizationSwitcher
        organizaciones={orgs}
        activaId={activaId}
        dict={ { ...dict.organizations.switcher , create: dict.organizations.create } }
      />
    )
  ) ;

  it( "muestra la organización activa en el botón y la marca con check al abrir" , () => {
    renderizar() ;

    const boton = screen.getByRole( "button" , { name: dict.organizations.switcher.ariaLabel } ) ;
    expect( boton.textContent ).toContain( "Casa" ) ;

    fireEvent.click( boton ) ;

    const activa = screen.getByRole( "menuitemradio" , { name: /Casa/ } ) ;
    const otra   = screen.getByRole( "menuitemradio" , { name: /Negocio/ } ) ;
    expect( activa.getAttribute( "aria-checked" ) ).toBe( "true" ) ;
    expect( otra.getAttribute( "aria-checked" ) ).toBe( "false" ) ;
    expect( otra.textContent ).toContain( dict.organizations.switcher.viewerBadge ) ;
  } ) ;

  it( "con una sola organización igual ofrece «Crear organización»" , () => {
    renderizar( [ dosOrgs[0] ] ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.switcher.ariaLabel } ) ) ;

    expect( screen.getByRole( "menuitem" , { name: dict.organizations.switcher.createNew } ) ).toBeTruthy() ;
  } ) ;

  it( "elegir otra llama update con su id y después router.refresh" , async () => {
    mocks.update.mockResolvedValue( { user: { organizationId: "org-2" } } ) ;
    renderizar() ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.switcher.ariaLabel } ) ) ;
    fireEvent.click( screen.getByRole( "menuitemradio" , { name: /Negocio/ } ) ) ;

    await waitFor( () => expect( mocks.refresh ).toHaveBeenCalledTimes( 1 ) ) ;
    expect( mocks.update ).toHaveBeenCalledWith( { organizationId: "org-2" } ) ;
    expect( mocks.update.mock.invocationCallOrder[0] ).toBeLessThan( mocks.refresh.mock.invocationCallOrder[0] ) ;
  } ) ;

  it( "si el servidor rechaza el cambio (la sesión no cambió) muestra el error y no refresca" , async () => {
    mocks.update.mockResolvedValue( { user: { organizationId: "org-1" } } ) ;
    renderizar() ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.switcher.ariaLabel } ) ) ;
    fireEvent.click( screen.getByRole( "menuitemradio" , { name: /Negocio/ } ) ) ;

    expect( await screen.findByRole( "alert" ) ).toHaveTextContent( dict.organizations.switcher.switchError ) ;
    expect( mocks.refresh ).not.toHaveBeenCalled() ;
  } ) ;

  it( "elegir la ya activa no llama update" , () => {
    renderizar() ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.switcher.ariaLabel } ) ) ;
    fireEvent.click( screen.getByRole( "menuitemradio" , { name: /Casa/ } ) ) ;

    expect( mocks.update ).not.toHaveBeenCalled() ;
  } ) ;

  it( "teclado: flechas mueven el foco entre opciones y Escape cierra devolviendo el foco al botón" , async () => {
    renderizar() ;

    const boton = screen.getByRole( "button" , { name: dict.organizations.switcher.ariaLabel } ) ;
    fireEvent.click( boton ) ;

    const activa = screen.getByRole( "menuitemradio" , { name: /Casa/ } ) ;
    const otra   = screen.getByRole( "menuitemradio" , { name: /Negocio/ } ) ;

    await waitFor( () => expect( document.activeElement ).toBe( activa ) ) ;

    fireEvent.keyDown( activa , { key: "ArrowDown" } ) ;
    expect( document.activeElement ).toBe( otra ) ;

    fireEvent.keyDown( otra , { key: "ArrowUp" } ) ;
    expect( document.activeElement ).toBe( activa ) ;

    fireEvent.keyDown( document , { key: "Escape" } ) ;

    expect( screen.queryByRole( "menu" ) ).toBeNull() ;
    expect( document.activeElement ).toBe( boton ) ;
  } ) ;

  it( "crear: el alta llama a la acción y luego cambia a la organización nueva" , async () => {
    vi.mocked( crearOrganizacionAction ).mockResolvedValue( { success: true , value: { organizationId: "org-3" } } ) ;
    mocks.update.mockResolvedValue( { user: { organizationId: "org-3" } } ) ;
    renderizar() ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.switcher.ariaLabel } ) ) ;
    fireEvent.click( screen.getByRole( "menuitem" , { name: dict.organizations.switcher.createNew } ) ) ;

    fireEvent.change( screen.getByLabelText( new RegExp( dict.organizations.create.nameLabel ) ) , { target: { value: "Prueba" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.create.submit } ) ) ;

    await waitFor( () => expect( mocks.refresh ).toHaveBeenCalledTimes( 1 ) ) ;
    expect( crearOrganizacionAction ).toHaveBeenCalledWith( { nombre: "Prueba" } ) ;
    expect( mocks.update ).toHaveBeenCalledWith( { organizationId: "org-3" } ) ;
  } ) ;

  it( "crear: un fallo del servidor se muestra en línea y no cambia de organización" , async () => {
    vi.mocked( crearOrganizacionAction ).mockResolvedValue( { success: false , error: "No se pudo crear la organización." } ) ;
    renderizar() ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.switcher.ariaLabel } ) ) ;
    fireEvent.click( screen.getByRole( "menuitem" , { name: dict.organizations.switcher.createNew } ) ) ;
    fireEvent.change( screen.getByLabelText( new RegExp( dict.organizations.create.nameLabel ) ) , { target: { value: "X" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.create.submit } ) ) ;

    expect( await screen.findByRole( "alert" ) ).toHaveTextContent( "No se pudo crear la organización." ) ;
    expect( mocks.update ).not.toHaveBeenCalled() ;
  } ) ;
} ) ;
