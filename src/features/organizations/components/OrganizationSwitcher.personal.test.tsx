// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeEach , beforeAll } from "vitest" ;
import { render , screen , fireEvent , within }                 from "@testing-library/react" ;

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

import { OrganizationSwitcher } from "./OrganizationSwitcher" ;


describe( "OrganizationSwitcher — espacio Personal (RN-15, AC-9)" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  const orgs = [
    { id: "p-1"   , nombre: "Personal" , rol: "owner"  , esPersonal: true } ,
    { id: "org-1" , nombre: "Casa"     , rol: "member" , esPersonal: false } ,
    { id: "org-2" , nombre: "Negocio"  , rol: "viewer" , esPersonal: false } ,
  ] ;

  const renderizar = ( activaId: string , lista = orgs ) => (
    render(
      <OrganizationSwitcher
        organizaciones={lista}
        activaId={activaId}
        dict={ { ...dict.organizations.switcher , create: dict.organizations.create , leave: dict.organizations.leave } }
      />
    )
  ) ;

  const abrirMenu = () => fireEvent.click( screen.getByRole( "button" , { name: dict.organizations.switcher.ariaLabel } ) ) ;

  it( "«Personal» va primero, con su ícono y sin etiqueta de rol" , () => {
    renderizar( "org-1" ) ;
    abrirMenu() ;

    const items = screen.getAllByRole( "menuitemradio" ) ;

    expect( items[0].textContent ).toContain( dict.organizations.switcher.personalLabel ) ;
    expect( items[0].querySelector( "svg" ) ).not.toBeNull() ;
    expect( items[0].textContent ).not.toContain( dict.organizations.switcher.viewerBadge ) ;
    expect( items[2].querySelector( "svg" ) ).toBeNull() ;
    // El resto conserva su etiqueta de lectura
    expect( items[2].textContent ).toContain( dict.organizations.switcher.viewerBadge ) ;
  } ) ;

  it( "AC-9: estando en Personal no se ofrece «Abandonar»" , () => {
    renderizar( "p-1" ) ;
    abrirMenu() ;

    expect( screen.queryByRole( "menuitem" , { name: /Abandonar/ } ) ).toBeNull() ;
    expect( screen.getByRole( "menuitem" , { name: dict.organizations.switcher.createNew } ) ).toBeTruthy() ;
  } ) ;

  it( "estando en una organización real «Abandonar» sigue disponible" , () => {
    renderizar( "org-1" ) ;
    abrirMenu() ;

    const menu = screen.getByRole( "menu" ) ;

    expect( within( menu ).getByRole( "menuitem" , { name: dict.organizations.leave.menuLabel.replace( "{nombre}" , "Casa" ) } ) ).toBeTruthy() ;
  } ) ;

  it( "el botón muestra «Personal» con el diccionario cuando es la activa" , () => {
    renderizar( "p-1" ) ;

    const boton = screen.getByRole( "button" , { name: dict.organizations.switcher.ariaLabel } ) ;

    expect( boton.textContent ).toContain( dict.organizations.switcher.personalLabel ) ;
    expect( boton.querySelector( "svg" ) ).not.toBeNull() ;
  } ) ;

  it( "plan 30: un Personal ajeno se rotula «Personal de <dueño>» y el propio sigue «Personal»" , () => {
    const lista = [
      { id: "p-1" , nombre: "Personal" , rol: "owner"  , esPersonal: true } ,
      { id: "p-2" , nombre: "Personal" , rol: "viewer" , esPersonal: true , duenoNombre: "Juan" } ,
      { id: "org-1" , nombre: "Casa"   , rol: "member" , esPersonal: false } ,
    ] ;
    renderizar( "p-2" , lista ) ;

    const boton = screen.getByRole( "button" , { name: dict.organizations.switcher.ariaLabel } ) ;
    expect( boton.textContent ).toContain( "Personal de Juan" ) ;

    abrirMenu() ;
    const items = screen.getAllByRole( "menuitemradio" ) ;
    expect( items[0].textContent ).toContain( "Personal" ) ;
    expect( items[0].textContent ).not.toContain( "Personal de" ) ;
    expect( items[1].textContent ).toContain( "Personal de Juan" ) ;
  } ) ;
} ) ;
