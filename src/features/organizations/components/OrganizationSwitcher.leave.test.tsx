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
  crearOrganizacionAction:     vi.fn() ,
  abandonarOrganizacionAction: vi.fn() ,
} ) ) ;

import { abandonarOrganizacionAction } from "../actions/organizationActions" ;
import { OrganizationSwitcher }        from "./OrganizationSwitcher" ;


describe( "OrganizationSwitcher - Abandonar (RN-28, RN-29, RN-30, RN-37)" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
    sessionStorage.clear() ;
  } ) ;

  const dosOrgs = [
    { id: "org-1" , nombre: "Casa" , rol: "owner" } ,
    { id: "org-2" , nombre: "Negocio" , rol: "member" } ,
  ] ;

  const renderizar = ( orgs = dosOrgs , esUnicoOwner = false ) => (
    render(
      <OrganizationSwitcher
        organizaciones={orgs}
        activaId="org-1"
        esUnicoOwner={esUnicoOwner}
        dict={ { ...dict.organizations.switcher , create: dict.organizations.create , leave: dict.organizations.leave } }
      />
    )
  ) ;

  const abrirMenu = () => (
    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.switcher.ariaLabel } ) )
  ) ;

  const botonAbandonar = () => (
    screen.getByRole( "menuitem" , { name: dict.organizations.leave.menuLabel.replace( "{nombre}" , "Casa" ) } )
  ) ;

  it( "con una sola organización «Abandonar» está deshabilitado y explicado, y no abre el modal" , () => {
    renderizar( [ dosOrgs[0] ] ) ;
    abrirMenu() ;

    const boton = botonAbandonar() ;
    expect( boton.getAttribute( "aria-disabled" ) ).toBe( "true" ) ;
    expect( screen.getByText( dict.organizations.leave.disabledOnlyOrg ) ).toBeTruthy() ;
    expect( boton.getAttribute( "aria-describedby" ) ).toBe( screen.getByText( dict.organizations.leave.disabledOnlyOrg ).id ) ;

    fireEvent.click( boton ) ;

    expect( screen.queryByRole( "button" , { name: dict.organizations.leave.submit } ) ).toBeNull() ;
  } ) ;

  it( "siendo el único owner «Abandonar» está deshabilitado y explicado" , () => {
    renderizar( dosOrgs , true ) ;
    abrirMenu() ;

    expect( botonAbandonar().getAttribute( "aria-disabled" ) ).toBe( "true" ) ;
    expect( screen.getByText( dict.organizations.leave.disabledOnlyOwner ) ).toBeTruthy() ;

    fireEvent.click( botonAbandonar() ) ;

    expect( screen.queryByRole( "button" , { name: dict.organizations.leave.submit } ) ).toBeNull() ;
  } ) ;

  it( "con las condiciones en orden está habilitado, sin explicación" , () => {
    renderizar() ;
    abrirMenu() ;

    expect( botonAbandonar().getAttribute( "aria-disabled" ) ).toBe( "false" ) ;
    expect( screen.queryByText( dict.organizations.leave.disabledOnlyOrg ) ).toBeNull() ;
    expect( screen.queryByText( dict.organizations.leave.disabledOnlyOwner ) ).toBeNull() ;
  } ) ;

  it( "confirmar llama update con el id devuelto y DESPUÉS router.refresh, y muestra el aviso" , async () => {
    vi.mocked( abandonarOrganizacionAction ).mockResolvedValue( { success: true , value: { organizationId: "org-2" , nombreAnterior: "Casa" } } ) ;
    mocks.update.mockResolvedValue( { user: { organizationId: "org-2" } } ) ;
    renderizar() ;
    abrirMenu() ;
    fireEvent.click( botonAbandonar() ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.leave.submit } ) ) ;

    await waitFor( () => expect( mocks.refresh ).toHaveBeenCalledTimes( 1 ) ) ;
    expect( abandonarOrganizacionAction ).toHaveBeenCalledTimes( 1 ) ;
    expect( mocks.update ).toHaveBeenCalledWith( { organizationId: "org-2" } ) ;
    expect( mocks.update.mock.invocationCallOrder[0] ).toBeLessThan( mocks.refresh.mock.invocationCallOrder[0] ) ;

    const aviso = await screen.findByRole( "status" ) ;
    expect( aviso.textContent ).toContain( dict.organizations.leave.notice.replace( "{nombre}" , "Casa" ) ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.leave.dismiss } ) ) ;
    expect( screen.queryByRole( "status" ) ).toBeNull() ;
  } ) ;

  it( "si el servidor rechaza la salida muestra el error, no cambia la sesión ni refresca" , async () => {
    vi.mocked( abandonarOrganizacionAction ).mockResolvedValue( { success: false , error: "No podés abandonar tu única organización." } ) ;
    renderizar() ;
    abrirMenu() ;
    fireEvent.click( botonAbandonar() ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.leave.submit } ) ) ;

    expect( await screen.findByRole( "alert" ) ).toHaveTextContent( "No podés abandonar tu única organización." ) ;
    expect( mocks.update ).not.toHaveBeenCalled() ;
    expect( mocks.refresh ).not.toHaveBeenCalled() ;
  } ) ;

  it( "cancelar cierra el modal sin llamar a la acción" , async () => {
    renderizar() ;
    abrirMenu() ;
    fireEvent.click( botonAbandonar() ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.leave.cancel } ) ) ;

    await waitFor( () => expect( screen.queryByRole( "button" , { name: dict.organizations.leave.submit } ) ).toBeNull() ) ;
    expect( abandonarOrganizacionAction ).not.toHaveBeenCalled() ;
  } ) ;

  it( "lee el aviso dejado en sessionStorage al montar, lo muestra y lo borra" , async () => {
    sessionStorage.setItem( "aviso-organizacion" , "Eliminaste Taller" ) ;
    renderizar() ;

    expect( (await screen.findByRole( "status" )).textContent ).toContain( "Eliminaste Taller" ) ;
    expect( sessionStorage.getItem( "aviso-organizacion" ) ).toBeNull() ;
  } ) ;

  it( "si sessionStorage lanza, el selector se monta igual y sin aviso" , () => {
    const espia = vi.spyOn( Storage.prototype , "getItem" ).mockImplementation( () => { throw new Error( "bloqueado" ) ; } ) ;

    try {
      renderizar() ;
      expect( screen.queryByRole( "status" ) ).toBeNull() ;
      expect( screen.getByRole( "button" , { name: dict.organizations.switcher.ariaLabel } ) ).toBeTruthy() ;
    } finally {
      espia.mockRestore() ;
    }
  } ) ;
} ) ;
